# REPORT: `showsignature read` as a full replacement for a native read tool

Context: in the SWE-bench A/B experiment, the tool arm runs the pi agent with
the built-in `read` tool disabled (`--exclude-tools read`), so
`showsignature_read` must handle *everything* an agent would ever read — not
just the supported language list. This report records the observed behavior on
out-of-scope inputs (showsignature 0.1.9) and recommends the strategy.

## Observed behavior

| Input | Behavior | Verdict |
|---|---|---|
| Unsupported text file (`.txt`) | Returns literal content in `<content>` tags; skips the outline; `note:` explains no language could be inferred and suggests `--lang` | Good — graceful degradation |
| Unsupported file + `--offset`/`--limit` | Windowing works normally; `note:` gives the exact follow-up call to continue paging | Good |
| Binary file (ELF) | Dumps raw bytes into `<content>` verbatim, exit 0 | Bad — see below |
| Nonexistent file | `[error] Could not access path … ENOENT`, exit 1 | Good — clear, actionable |
| Directory | `[error] 'read' requires a file target; run 'showsignature map <dir>'` , exit 1 | Good — redirects to the right call |

The key finding is the first row: the risk that motivated the check was that
`read` might *error* on unsupported extensions, which would leave a
read-disabled agent with only `cat` via bash for `.cfg`/`.rst`/`.ini`/`.toml`
files. It doesn't — it degrades to a raw passthrough. This is what makes the
`--exclude-tools read` experiment design viable at all.

## The one real gap: binary files

Feeding an ELF binary produced ~2 KB of raw bytes (NUL-laden garbage) with a
success exit. For an agent this is the worst outcome: it burns tokens, can
poison the context with byte noise, and — because the call "succeeded" — the
model has no signal that it did something wrong and may retry variations.

Native agent read tools reject binaries ("cannot read binary file") or, for
images, render them. Rejection is the behavior to copy.

## Recommended strategy

For an investigator/agent, every response should either deliver useful content
or teach the caller the correct next move. Concretely:

1. **Keep raw passthrough for unsupported *text*** (current behavior). Literal
   content plus an explanatory `note:` is exactly right; the file's bytes are
   the structure.
2. **Detect and refuse binary content.** Cheap heuristic on the first block
   (NUL byte, or high ratio of non-printable bytes) → exit 1 with an error
   like: `[error] <file> looks binary (application/octet-stream); showsignature
   reads text. Use a hex viewer or file-type-specific tooling.` An explicit
   `--force`/`--no-binary-check` escape hatch preserves power-user access.
3. **Never fail silently-successfully.** The ENOENT and directory errors are
   the model to follow: nonzero exit, one line, and — where possible — name
   the correct follow-up call (the directory error already does this).
4. **Always emit the `note:` on degraded output.** An agent that sees *why*
   the outline is missing (`pass --lang <l>`) can self-correct in one step;
   an agent that just sees less output cannot.

Items 1, 3, 4 are already the shipped behavior; item 2 (binary rejection) is
the only change needed for `showsignature_read` to be a safe drop-in
replacement for a native read tool.
