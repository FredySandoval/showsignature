# Fix report: default `--max-depth` + output size cap

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

## Fix 1 — default `maxDepth` for directory scans

When the target is a **directory** and the user did not pass `--max-depth`, apply a
default of **2** .
Explicit `--max-depth <n>` keeps overriding everything. Single-file targets are unaffected.

When the default kicks in AND the scan actually hit the depth limit, append one notice
line to stderr (not stdout, to keep stdout parseable):

```
note: directory scan depth-limited to 2 by default; pass --max-depth <n> to go deeper
```

**Where (all in `src/01-main.ts`):**
- CLI option declared ~line 309 (`--max-depth <number>`), validated ~lines 363–366.
- `maxDepth` is plumbed into the execution plan at ~lines 560 and 583
  (`resolveExecutionPlan`, ~line 603) — this is the spot to inject the default when
  `args.maxDepth === undefined` and the resolved target is a directory.
- Discovery applies it at ~line 1277 as the `deep` option of the glob walk.
- Types: `maxDepth?: number` in `src/00-core-types.ts` (~lines 180–256).

## Fix 2 — output cap on high output
Add a byte cap on rendered output. Suggested default: 2000 lines or 50KB (whichever is hit first).

- for now this values will be hard-coded
  --limit <number> maximum number of extracted entries to display
  --all                  display all extracted entries (disable the limit)
- you need to add a message at the end in a form of a comment, informing of the capped, with the remaining,
  so they how big the repo is.
- Degrade gracefully, don't hard-truncate mid-entry. Preferred behavior when the cap is
  hit: keep whole per-file sections until the budget is spent, then emit a summary for
  the remainder (file paths + entry counts only), ending with:

```
note: output capped at 50 KB (N files summarized). Narrow the path, or use
--show-only / --max-depth  to adjust.
```

This keeps the output useful as a map ("these files exist, re-run on the one you need")
instead of ending in an arbitrary cut.

A loud, structured truncation notice — e.g., [Showing lines 1–2000 of 8,431. Use offset=2001 to continue.] This converts the model's biggest failure mode (silent partial reads) into a recoverable one, and even tells it the exact next call.

## Fix 3 — add offset
add the following
--offset <number>    skip the first N extracted entries
                     (default: 0)


 Use offset/limit for large files. When you need the full file, continue with offset until complete.                                │

## fix 4 — add read

`--read`
when read is used, it literally reads from `--offset` until `--limit`
If offset is not set: reading starts at the beginning of the file (line 1). 
That's the natural default — offset is described as "line number to start reading from," so omitting it means "start from the top."

If limit is not set: 
the tool reads as much as it can up to its built-in truncation caps — 2000 lines or 50KB, whichever is hit first. 
So there's always an implicit ceiling; omitting limit doesn't mean "read the whole file," it means "read up to the maximum allowed in one call."

when `--read` is used, it outputs the literal content of the path, this being a single file or folder

when `--read` is used and --limit is for example 100, then it auto add signatures as context before and below
for example:
<just signatures>
<offset starts>
literal content, no signatures extracted, it reads and shows the content as it is, no line numbers
<offset ends>
<just signatures>

My recommendation: cap at ~50 outline lines per side (before + after), so ~100 max total. or all if the content of the file is below that.

What we designed: a per-call, per-file skeleton attached to a windowed read — "here's your 500-line window, plus the signatures of everything elided above and below it."



## Acceptance criteria

1. `showsignature <large-repo-root>` (e.g. astropy checkout) emits ≤ ~50 KB by default
   and prints both notice lines where applicable.
2. `showsignature --max-depth 5 <dir>` behaves exactly as today (no default interferes).
3. `showsignature <single-file>` output is byte-identical to v0.1.9 (caps shouldn't
   trigger on any reasonable single file).
4. `--no-output-cap` restores current unbounded behavior.
5. stdout stays clean data; notices go to stderr.
6. Tests cover: default depth applied / not applied, cap hit mid-file-list, escape hatches.

## Follow-up docs (same PR or after)

- READMEs (all languages) and `skills/` docs: remove or de-emphasize examples that run
  showsignature on the repo root with no depth flag (e.g. bare `showsignature`,
  `showsignature ./`) in favor of scoped-directory examples; where a repo-wide overview
  is shown, pair it with `--max-depth`.
