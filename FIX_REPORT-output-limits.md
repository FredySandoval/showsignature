# Fix report: default `--max-depth`, output caps, and windowed `--read` mode

**Repo:** `04_showsignature` (v0.1.9) · **Date:** 2026-07-06 · **Priority:** high for agent use cases

## Problem

When pointed at a large directory tree with no `--max-depth`, showsignature recurses the
entire tree and prints everything. Observed in a real agent run (SWE-bench, astropy repo):

```
showsignature /testbed   →  417,757 chars (~104k tokens) in a single output
```

For LLM agents this one output can consume most of the context window and dominates
token cost. Running on a broad directory is a legitimate, intended use — the fix is to
make the default behavior safe, not to forbid it.

## Global conventions (read first — these resolve ambiguities across all fixes)

**Two modes.** *Signature mode* (default, current behavior) and *read mode* (`--read`,
new, Fix 4).

**`--offset` / `--limit` are mode-dependent. Document this explicitly in `--help`:**

| flag | signature mode | read mode (`--read`) |
|---|---|---|
| `--offset <n>` | skip the first N extracted **entries** (default 0) | first **line** to show, 1-indexed (default 1) |
| `--limit <n>` | max extracted **entries** displayed | max **lines** shown in the window |

**Hard caps.** 2000 lines or 50 KB of rendered output, whichever is hit first. These
values are hard-coded constants for now (not configurable numbers); the flags below are
the only overrides. Caps apply in both modes and are the implicit `--limit` when none is
given: omitting `--limit` never means "everything", it means "up to the cap".

**One escape hatch.** `--all` disables both the entry limit and the line/byte cap,
restoring current unbounded behavior.

**Notice routing.** Anything the reader must *act on* — truncation trailers with
continuation instructions — is emitted at the **end of stdout** as a single structured
`note:` trailer, because the primary reader is an LLM agent that may never see stderr.
Purely advisory diagnostics may additionally be mirrored to stderr. stdout therefore
stays "clean data plus at most one trailer".

## Fix 1 — default `maxDepth` for directory scans

When the target is a **directory** and the user did not pass `--max-depth`, apply a
default of **2**. Explicit `--max-depth <n>` keeps overriding everything. Single-file
targets are unaffected.

When the default kicks in AND the scan actually hit the depth limit, append the trailer:

```
note: directory scan depth-limited to 2 by default; pass --max-depth <n> to go deeper
```

(stdout trailer, mirrored to stderr — see conventions.)

**Where (all in `src/01-main.ts`):**
- CLI option declared ~line 309 (`--max-depth <number>`), validated ~lines 363–366.
- `maxDepth` is plumbed into the execution plan at ~lines 560 and 583
  (`resolveExecutionPlan`, ~line 603) — this is the spot to inject the default when
  `args.maxDepth === undefined` and the resolved target is a directory.
- Discovery applies it at ~line 1277 as the `deep` option of the glob walk.
- Types: `maxDepth?: number` in `src/00-core-types.ts` (~lines 180–256).

## Fix 2 — output cap in signature mode

Apply the hard caps (2000 lines / 50 KB) to rendered signature output.

Flags (per conventions): `--limit <n>` caps extracted entries; `--all` disables all caps.

**Degrade gracefully, don't hard-truncate mid-entry.** When the cap is hit: keep whole
per-file sections until the budget is spent, then emit a summary for the remainder
(file paths + entry counts only — this stays in stdout, it is data), ending with the
trailer:

```
note: output capped at 50 KB (N of M files summarized). Narrow the path, or use
--show-only / --max-depth / --limit to adjust; --all disables the cap.
```

This keeps the output useful as a map ("these files exist, re-run on the one you need")
instead of ending in an arbitrary cut. The trailer converts the model's biggest failure
mode — silently acting on a partial listing — into a recoverable one.

## Fix 3 — add `--offset` (signature mode)

```
--offset <number>    skip the first N extracted entries (default: 0)
```

Combined with `--limit`, this allows paginating through a large signature listing.
(For line-based continuation of a single file's *content*, see `--read`, Fix 4.)

## Fix 4 — add `--read` (windowed literal read with skeleton frame)

`--read` switches to read mode: output the **literal content** of a file.

**File targets only.** `--read <directory>` is an error:
`error: --read requires a file target; run without --read for a directory overview.`

**Window defaults** (per conventions): no `--offset` → start at line 1; no `--limit` →
read up to the hard cap (2000 lines / 50 KB, whichever first). Omitting `--limit` means
"up to the cap", not "the whole file". To read a full large file, continue with
`--offset` until complete.

**Content is raw — no line numbers.** Literal bytes, unmodified, so the output is safe
to copy into exact-match edit tools and safe to pipe. Orientation comes from the frame
and the skeleton instead (both of which DO carry line numbers).

**Skeleton rule.** A skeleton is rendered for **any elided region**, regardless of which
mechanism caused the elision:
- *before*-skeleton iff `offset > 1`;
- *after*-skeleton iff the window ended before EOF — whether due to explicit `--limit`
  **or the default cap** (the no-flags case is exactly where silent truncation is most
  dangerous, so it must be covered).
- If the window covers the whole file: no skeletons, but still emit the `<content>` tag
  with the full range, so completeness is always explicit.

**Skeleton content.** Extracted signatures **with their real line numbers** (this is the
navigation payoff — the model can jump straight to `--offset <line>`). Budget: up to
~50 outline lines per side (~100 total); if a side has fewer signatures than that, show
all of them. When the budget binds, degrade by **depth** (drop nested methods first,
keep top-level symbols), never by arbitrary cut. The enclosing scope chain of the window
itself (e.g. the class/function the window starts inside) is always shown and is exempt
from the budget.

**Frame.** XML-style tags with self-describing attributes (boring names on purpose —
they are optimized for model reading comprehension, not parsing):

```
<skeleton region="before" note="signatures only — display context, not file content">
12→class ConfigLoader:
45→  def parse_args(argv):
</skeleton>
<content lines="200-700 of 1843">
...literal file content, raw, no line numbers...
</content>
<skeleton region="after" note="signatures only — display context, not file content">
701→def main():
</skeleton>
note: showing lines 200-700 of 1843; continue with --read --offset 701
```

The trailer names the exact next call (stdout, per conventions).

## Acceptance criteria

1. `showsignature <large-repo-root>` (e.g. astropy checkout) emits ≤ ~50 KB by default
   and ends with the relevant trailer(s).
2. `showsignature --max-depth 5 <dir>` behaves exactly as today (no default interferes).
3. `showsignature <single-file>` in signature mode is byte-identical to v0.1.9 for
   typical files. (The cap still applies universally; a pathological file whose
   signature listing alone exceeds 2000 lines / 50 KB will be capped — accepted.)
4. `--all` restores current unbounded behavior in both modes.
5. stdout contains data plus at most one structured `note:` trailer; notices are
   mirrored to stderr.
6. `--read <dir>` errors with the hint; `--read <file>` with no flags shows lines
   1..cap; `--offset`/`--limit` window correctly.
7. Skeletons appear iff a region is elided (including the default-cap case), carry real
   line numbers, respect the 50/side budget with depth-based degradation, and always
   include the window's enclosing scope. Content between the `<content>` tags is
   byte-literal with no line numbers.
8. A `--read` that covers the whole file emits no skeletons and a `<content>` tag whose
   range equals the full file (e.g. `lines="1-843 of 843"`).
9. Tests cover: default depth applied / not applied; cap hit mid-file-list; both escape
   paths (`--limit`, `--all`); read-mode offset/limit semantics vs signature-mode
   entry semantics; skeleton trigger matrix (offset-only, limit-only, default cap,
   full-file).

## Follow-up docs (same PR or after)

- READMEs (all languages) and `skills/` docs: remove or de-emphasize examples that run
  showsignature on the repo root with no depth flag (e.g. bare `showsignature`,
  `showsignature ./`) in favor of scoped-directory examples; where a repo-wide overview
  is shown, pair it with `--max-depth`.
- Document the mode-dependent meaning of `--offset`/`--limit` prominently in `--help`
  and README — this is the likeliest point of user/agent confusion.
