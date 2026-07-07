# Fix report: git-style subcommands (`map` / `read`), safe defaults, and output caps

**Repo:** `04_showsignature` (v0.1.9) · **Date:** 2026-07-06 · **Priority:** high for agent use cases

## Global conventions (read first — these resolve ambiguities across all fixes)

**Enforced subcommands (git-style) — breaking change, targeted at v0.2.0.** There is no
default command anymore:

```
showsignature                                # prints help + examples, exit code 1
showsignature map  [OPTION]... [FILE]...     # current behavior (signature extraction / overview)
showsignature read [OPTION] <FILE>           # windowed literal read (Fix 4)
```

- Bare invocation prints help to stdout and exits 1 ("you asked for nothing"). This
  kills the original footgun — an accidental repo-wide dump — before any cap is needed,
  and doubles as tool discovery for agents. --help still works.
- `map` keeps the exact current semantics and flags, multi-path `[FILE]...` included.
  (Named `map`: it describes the command's role in the agent workflow — the
  cheap overview you drill into with `read`)
- `read`'s required single `<FILE>` positional enforces "exactly one file" in the
  parser itself, and enforced subcommands remove the position-1 ambiguity entirely —
  a file named `read` or `map` is fine as a path argument, no `./` workaround needed.
- **Migration is load-bearing for agents:** models with stale knowledge will call the
  old form. `showsignature <path>` must fail with
  `error: unknown command '<path>'. Did you mean: showsignature map <path>?`
  — the suggestion in that error is what makes the break self-healing in agent loops.
- Each command declares and documents its own `--offset`/`--limit`, so no flag ever has
  two meanings within one `--help`:

| flag | `showsignature map` | `showsignature read` |
|---|---|---|
| `--offset <n>` | skip the first N extracted **entries** (default 0) | first **line** to show, 1-indexed (default 1) |
| `--limit <n>` | max extracted **entries** displayed | max **lines** shown in the window |

Stdin stays available in both: `showsignature map -`, `showsignature read -`.

**Hard caps.** 2000 lines or 50 KB of rendered output, whichever is hit first. These
values are hard-coded constants for now (not configurable numbers); the flags below are
the only overrides. Caps apply in both modes and are the implicit `--limit` when none is
given: omitting `--limit` never means "everything", it means "up to the cap".

**One escape hatch.** `--all` turns off every cap at once — the entry limit and the
2000-line / 50 KB cap — giving you the full, unbounded output the tool produces today.
This is the only escape-hatch flag. 

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

## Fix 2 — output cap in `map` (signature mode)

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

## Fix 3 — add `--offset` (`map` command)

```
--offset <number>    skip the first N extracted entries (default: 0)
```

Combined with `--limit`, this allows paginating through a large signature listing.
(For line-based continuation of a single file's *content*, see the `read` subcommand,
Fix 4.)

## Fix 4 — add `read` subcommand (windowed literal read with skeleton frame)

`showsignature read [OPTION] <FILE>` outputs the **literal content** of a file.

**Exactly one file target — enforced by the parser.** The subcommand's positional is
`<FILE>` (required, single), so arity violations are parse errors, not runtime checks:
- `showsignature read <directory>` → `error: 'read' requires a file target; run 'showsignature map <dir>' for a directory overview.`
- `showsignature read <file1> <file2>` → rejected by the parser (`<FILE>` takes one argument); error suggests one invocation per file.

*Why single-file (recorded decision):* multi-file reads make `--offset`/`--limit`,
partial failures, and continuation ambiguous, and they reintroduce the unbounded-blob
problem this report exists to fix. Agents batch fine without it — parallel tool calls
for tool schemas, `;`-chained invocations in one bash call for the CLI — and signature
mode already serves the "many files at once" need. *Deferred v2, only if real demand
appears:* accept multiple files only when `--offset`/`--limit` are absent, share the
2000-line/50 KB budget across them, and degrade as in Fix 2 (whole files until the
budget is spent, then summarize the remainder).

`showsignature read -` (stdin) is allowed: input is slurped fully, so `lines="X-Y of N"`
still works. Skeletons require a parser and stdin has no extension — emit skeletons only
when `--lang-only <lang>` is given; otherwise frame the window without skeletons (still
with the `<content>` range and trailer).

**Window defaults** (per conventions): no `--offset` → start at line 1; no `--limit` →
read up to the hard cap (2000 lines / 50 KB, whichever first). Omitting `--limit` means
"up to the cap", not "the whole file". To read a full large file, continue with
`--offset` until complete.

**Content is raw — no line numbers.** No prefixes, no reformatting, so the output is
safe to copy into exact-match edit tools and safe to pipe. Orientation comes from the
frame and the skeleton instead (both of which DO carry line numbers).

**Redaction caveat.** Built-in secret redaction is ON by default (existing behavior;
`--no-redact` disables it), and it applies in read mode too — so "literal" means
*byte-identical except where redaction fired*. Because a redacted span will make an
exact-match edit against the real file fail, the frame must disclose it: when redaction
modified anything inside the window, emit `<content lines="..." redacted="true">` and
mention it in the trailer (`note: N secrets redacted; pass --no-redact for literal bytes`).

**Interactions with existing flags.**
- `--no-line-number` in read mode affects the **skeleton prefixes only** (content never
  has them). Advise against it for agent use — it removes the navigation index.
- The skeleton reuses the extract-kind machinery: it honors `--show-only` (default:
  `signatures`), which makes read mode work beyond code for free — `md:headings` frames
  a markdown window, `json:shape` frames a JSON window.
- `--lang-only` filters as usual and, for stdin, is what enables skeletons (above).

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
all of them. 
When the budget binds, degrade by **depth** (drop nested methods first,
keep top-level symbols), never by arbitrary cut. 
The enclosing scope chain of the window
itself (e.g. the class/function the window starts inside) is always shown and is exempt
from the budget.

Setup. You run showsignature read --offset 800 --limit 100 big_service.py on a 3000-line file with hundreds of symbols. 
The before-skeleton has to summarize lines 1–799, but that region alone contains, say, 120 signature lines — over the ~50/side budget. 
Something must be dropped. The question is what.

Rule 1 — degrade by depth, not by arbitrary cut. The naive approach is to take the first 50 signature lines and stop:

12 class AuthService:
15   def login(self):
32   def logout(self):
41   def _refresh_token(self):
...
[cut at line ~350 — everything between 350 and 799 simply vanishes]

That's bad in a specific way: the skeleton's job is to be a complete table of contents of the elided region, 
and a positional cut makes it silently incomplete — the model now believes nothing exists between lines 350 and 799, 
which is exactly the "silent partial view" failure this whole design fights. 
Depth-based degradation drops detail instead of coverage: when over budget, 
remove the most nested symbols first (methods inside classes, inner functions), keeping every top-level symbol:

12 class AuthService:          (14 methods)
210 class SessionStore:        (9 methods)
455 def build_middleware(app):
502 class RateLimiter:          (11 methods)
740 def configure_logging():
Now it fits in a handful of lines, and — the key property — it's shallow but complete: 
the model knows every region that exists in lines 1–799, just with less detail per region. 
A shallow-complete outline beats a deep-truncated one because the skeleton's purpose is navigation ("what's out there and at what line"), 
not comprehension.

Rule 2 — the enclosing scope chain is always shown, budget-exempt. 
Your window starts at line 800. 
Line 800 is very likely inside something — say, the middle of def process_batch inside class PaymentProcessor. 
Without this rule, the model's window opens on code like:

        for item in batch:
            self._validate(item)

...with no idea what self is or what function this belongs to. 
The single most valuable context for reading a mid-file window is the answer to "where am I?" — so the skeleton 
must always include the chain of definitions the window sits inside:

760 class PaymentProcessor:
791   def process_batch(self, batch):    ← window opens inside this

That's usually 1–3 lines. 
It's exempt from the budget because it should never be a casualty of degradation — if the budget is tight, 
you drop a sibling method somewhere, never the one signature that tells the model what it's currently reading. 
(Note it's a different kind of information than the rest of the skeleton: 
the rest answers "what else exists"; this answers "what am I inside" — which is why it gets special treatment.)

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
note: showing lines 200-700 of 1843; continue with: showsignature read --offset 701 <file>
```

The trailer names the exact next call (stdout, per conventions).

## Acceptance criteria

0. Bare `showsignature` prints help (with examples) to stdout and exits 1.
   `showsignature <path>` (old form) fails with an error that suggests
   `showsignature map <path>` — verified for both file and directory paths.
1. `showsignature map <large-repo-root>` (e.g. astropy checkout) emits ≤ ~50 KB by
   default and ends with the relevant trailer(s).
2. `showsignature map --max-depth 5 <dir>` behaves exactly as today (no default
   interferes).
3. `showsignature map <single-file>` is byte-identical to v0.1.9 output for typical
   files. (The cap still applies universally; a pathological file whose signature
   listing alone exceeds 2000 lines / 50 KB will be capped — accepted.)
4. `--all` restores current unbounded behavior in both modes.
5. stdout contains data plus at most one structured `note:` trailer; notices are
   mirrored to stderr.
6. `showsignature read <dir>` errors with the hint; `read` with two paths is a parse
   error; `showsignature read <file>` with no flags shows lines 1..cap;
   `--offset`/`--limit` window correctly; `showsignature read -` works, with skeletons
   iff `--lang-only` is given.
7. Skeletons appear iff a region is elided (including the default-cap case), carry real
   line numbers, respect the 50/side budget with depth-based degradation, and always
   include the window's enclosing scope. Content between the `<content>` tags is
   byte-literal with no line numbers.
8. A `read` that covers the whole file emits no skeletons and a `<content>` tag whose
   range equals the full file (e.g. `lines="1-843 of 843"`).
8a. Read-mode content with `--no-redact` is byte-identical to the source window; with
    default redaction active and a secret in-window, `redacted="true"` appears on the
    `<content>` tag and the trailer mentions it.
8b. `--no-line-number` strips prefixes from skeleton lines only; skeleton honors
    `--show-only` (markdown file → `md:headings` skeleton).
9. Tests cover: default depth applied / not applied; cap hit mid-file-list; both escape
   paths (`--limit`, `--all`); read-mode offset/limit semantics vs signature-mode
   entry semantics; skeleton trigger matrix (offset-only, limit-only, default cap,
   full-file).

## Follow-up docs

- **Migrate every example to subcommand form** — READMEs (all languages) and `skills/`
  docs: `showsignature <path>` → `showsignature map <path>`. While at it, remove or
  de-emphasize examples that scan the repo root with no depth flag in favor of
  scoped-directory examples; where a repo-wide overview is shown, pair it with
  `--max-depth`.
- Document `--offset`/`--limit` in each command's own `--help` (entries for `map`,
  lines for `read`) and show both forms side by side in the README — same flag names
  with per-command meanings is the likeliest point of user/agent confusion.

IMPORTANT: the working area is clean, for you to start working.
after any meaninful change like completing fix 1 for example, do `git add .` and `git commit -m "completed step bla bla"`
this is important because is a point of return if something is wrongly implemented.
we need to be able to go back to a state where something worked, if something crashes. Don't push to production please.


