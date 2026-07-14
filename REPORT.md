# REPORT — `map`/`read` hang on non-TTY stdin when no path is given

Date: 2026-07-13
Status: FIXED 2026-07-14 — implicit stdin removed (option 2). See "Resolution" below.
Found via: side effect of the tool-name rename work — a smoke-test and a unit
test both hung; investigation traced it to CLI stdin handling, not the rename.

## Summary

`showsignature map` (and `read`) with **no path operand** eagerly drains stdin
before falling back to scanning the current directory. When stdin is a **non-TTY
stream that stays open without sending EOF** (a pipe with an idle/absent writer,
a CI runner, an editor/agent sandbox shell), the process **blocks forever**
instead of mapping the directory or erroring.

Under a normal interactive terminal the bug is invisible, because `stdin.isTTY`
is `true` and the implicit-stdin path is skipped.

## Impact

- Severity: medium. No data loss, but a silent hang with no output and no error.
- User-visible: `showsignature map --lang ts` (no path) appears to freeze in any
  environment where stdin is a non-TTY open pipe — CI, editor task runners, MCP
  hosts that leave stdin open, and agent sandboxes.
- Observed live: an agent ran `… map --lang ts` in `/tmp/ss-test` and the shell
  hung for >1 minute despite a `timeout 3` wrapper (see also the unit test note
  below).

## Reproduction

```sh
cd /tmp && mkdir -p ss-test/src \
  && echo 'export function greet(): void {}' > ss-test/src/app.ts \
  && cd ss-test \
  && node <path>/dist/01-main.js map --lang ts < <(sleep 60)   # open, idle stdin
# → hangs until the sleep ends (or forever with a truly open pipe)
```

Contrast (works, because stdin is a TTY):

```sh
showsignature map --lang ts        # run directly in an interactive terminal → OK
```

## Root cause

`src/01-main.ts`:

- `shouldTryImplicitStdin()` (~line 755) decides to read stdin whenever there is
  no path AND `process.stdin.isTTY !== true`:

  ```ts
  function shouldTryImplicitStdin(args: ParsedCliArgs): boolean {
    return (
      (!args.paths || args.paths.length === 0) && process.stdin.isTTY !== true
    );
  }
  ```

- `resolveInputTarget()` (~line 891) then does:

  ```ts
  if (shouldTryImplicitStdin(args)) {
    const stdinSource = await readStdin();   // <-- blocks here
    if (stdinSource.length > 0) { /* use stdin */ }
  }
  // else fall through to directory scan
  ```

- `readStdin()` (~line 736) consumes the stream to EOF:

  ```ts
  for await (const chunk of process.stdin) { ... }   // never returns if no EOF
  ```

The flaw: the code decides *"is data being piped in?"* by **draining stdin**.
`isTTY !== true` does **not** imply that data will ever arrive or that EOF will
ever come. An open, idle, non-TTY pipe satisfies the condition and makes
`readStdin()` await forever. The directory-scan fallback is never reached.

## Why it surfaced now (not caused by the rename)

The tool-name rename (`showsignature_map`/`_read` → `map`/`outline_read`) is
pure string changes and does not touch this logic. It surfaced because the
verification builds/tests were run in non-TTY contexts:

- The unit test `tests/01-cli.test.ts` → `"filters recursive discovery by
  explicit language"` runs `map --lang ts` with no path. It passes under a TTY,
  but hangs under a non-TTY open stdin. It was stabilized by adding
  `installStdin("")` (a closed, non-TTY empty stream), which makes `readStdin()`
  return immediately. That test change masks the symptom for the suite but does
  **not** fix the underlying CLI behavior.

## Suggested fixes (pick one; not yet implemented)

1. **Don't block on an idle pipe.** Only treat stdin as input when data is
   actually ready — e.g. check `fs.fstatSync(0)` for a FIFO/regular file with
   size, or read with a short idle timeout / `readableLength` probe, and fall
   back to the directory scan otherwise. Most robust, most code.

2. **Require an explicit stdin operand.** Drop implicit stdin entirely: only
   read stdin when the user passes `-` (`hasExplicitStdinOperand`). No path →
   scan the current directory. Simplest and most predictable; small behavior
   change for anyone relying on bare `cmd < file`.

3. **Gate implicit stdin on the absence of a usable directory.** If the default
   directory has discoverable files, prefer scanning it and skip the stdin
   drain. Keeps piping convenient but adds ordering subtlety.

Recommendation: option 2 (explicit `-` only) unless piping without `-` is a
documented, valued workflow — in which case option 1.

## Resolution (2026-07-14)

Implemented **option 2**: implicit stdin was removed. `map`/`read` now read
stdin **only** via the explicit `-` operand (which already required `--lang`).
With no path and no `-`, the tool always scans the current directory and never
touches stdin — so an open, idle non-TTY pipe can no longer block it.

Changes in `src/01-main.ts`:

- Removed the implicit-stdin block in `resolveInputTarget()` that called
  `readStdin()` when there was no path and `stdin.isTTY !== true`.
- Deleted the now-dead `shouldTryImplicitStdin()` and
  `inferImplicitStdinLanguage()` helpers.
- The `read` path (`resolveReadSource()`) was already safe — it only reads
  stdin when the target is literally `-`.

Docs needed no change: `src/00-instructions.ts` only ever documented stdin via
the explicit `-` operand; bare `cmd < file` (no `-`) was undocumented. If
anything, the no-path `map` examples (e.g. `map --only md:headings`) are now
more accurate, since they reliably scan cwd instead of maybe draining a pipe.

Tests (`tests/01-cli.test.ts`): the two tests covering the removed feature were
rewritten to assert the new behavior —
- "ignores piped stdin without the - operand and scans cwd instead" (regression
  guard for this bug)
- "scans cwd when no path is given, regardless of stdin content"

Verified live against `dist/02-cli.js` (the actual bin; the reproduction command
above pointed at `01-main.js`, which is a library module with no run guard and
prints nothing): `map --lang ts < <(sleep 30)` now returns immediately with the
directory map instead of hanging, and `echo … | map - --lang ts` still works.
