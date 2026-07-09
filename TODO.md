# TODO — findings from fixture testing (2026-07-08, v0.1.9)

- [x] **Remove the cwd-only restriction.** `read` errored and `map` silently
      output nothing for paths outside the cwd. Removed the sandbox in
      `resolveSafeInputPath` and the folder-scan check in
      `resolveInputTarget`; updated `tests/vulnerabilities/01-discovery.test.ts`
      to assert external paths are readable. (done 2026-07-08)
- [x] **Header paths for absolute inputs are rendered as long `../../...`
      relative paths** (e.g. `// ../../../../home/user/.../basic.ts`).
      Fixed `toDisplayPath` to keep the absolute path whenever the relative
      form would climb above the cwd; files under the cwd still display
      relative. Also fixes the `note:` continuation hints. (done 2026-07-08)
- [x] **Emit a `note:` instead of silent empty output.** Discovery now tallies
      excluded test files (`note: N test file(s) excluded; pass
      --include-tests to include them`) and probes one level past an explicit
      `--max-depth` (`note: depth limit N reached; M more file(s) at depth
      N+1 — pass --max-depth N+1 or --all`), matching the existing
      default-depth notice. Notes appear even when the result set is empty.
      (done 2026-07-08)
- [x] **`md:headings` matches `#` comments inside fenced code blocks.**
      `toSourceLines` now tracks fence state (``` and ~~~, per CommonMark
      closing rules) and both `md:headings` and `md:tables` skip lines
      inside fences — `|` pipes in code blocks no longer become tables
      either. (done 2026-07-08)
- [x] **`map` default extractors mismatch.** Default is now
      `signatures,imports` for code files, `md:*` for Markdown, and
      `json:shape` for JSON (one default list, intersected per file with the
      adapter's supported kinds — bare `map README.md`/`map config.json`
      previously printed nothing). Help text updated to match;
      `read --outline` default stays `signatures` as documented.
      (done 2026-07-08)
- [x] **Redaction misses Anthropic API keys.** Added
      `ANTHROPIC_API_KEY_PATTERN` (`sk-ant-…`) to `redactSecrets`, matching
      by value regardless of variable name. (done 2026-07-08)
- [x] **`--lang` help overstates stdin requirement.** Global help now says
      "For stdin: required by map, optional for read (enables the outline)";
      `read` help explains content always displays and the outline appears
      only when the language is known. `map` help unchanged (accurate).
      (done 2026-07-08)
- [x] **Trailing `note:` emitted to both stdout and stderr**, appearing twice
      in a terminal. Now emitted via a shared `emitTrailerNote` helper:
      always to stdout, mirrored to stderr only when stdout is not a TTY
      (i.e. piped/redirected). (done 2026-07-08)
- [x] **`tests/fixtures/generate-fixtures.sh` uses old CLI syntax.** Now
      invokes `showsignature map --only …`; regenerating produces
      byte-identical golden fixtures. (done 2026-07-08)

## Round 2 findings (verified 2026-07-08, from independent re-review)

- [x] **`--lang` on an explicit file forces the wrong parser instead of
      filtering or warning.** Explicit file operands whose detected language
      mismatches `--lang` are now skipped with a note (`skipped file.py:
      detected language "py" does not match --lang go`); files with no
      inferable language can still be forced. (done 2026-07-08)
- [x] **Zero-entry results print nothing — no file header, no note.**
      `map` now emits `note: 0 <extractors> entries in N file(s)` whenever
      files were processed but nothing was extracted. (done 2026-07-08)
- [x] **`map` redacts secrets without the disclosure note.** `map` now emits
      the same `note: N secret(s) redacted; pass --no-redact for literal
      bytes` trailer as `read`, counted by diffing against an unredacted
      render. (done 2026-07-08)
- [x] **`json:shape` truncates with `... }` silently.** Chose the note:
      `note: json:shape elides nested detail as "..." past depth 5 or 20
      object keys; this cap is fixed (--all does not lift it)`, emitted when
      a displayed shape entry contains a truncation marker. (done 2026-07-08)
- [x] **`md:codeblocks` line numbers off by one + blank-line padding.**
      Replaced the multiline regex (whose `^\s*` swallowed the preceding
      newline) with the same fence-tracking scanner used by `md:headings`;
      entries now start exactly at the fence line and `~~~` fences are
      supported too. (done 2026-07-08)
- [x] **Outline "← window opens inside this" annotation** could mark an
      entry the window starts after. Since spans aren't tracked, the
      annotation now requires the window's first non-blank line to be
      indented deeper than the candidate entry. (done 2026-07-08)
- [x] **Unknown-option errors print twice.** Commander's own `writeErr`
      output is suppressed (`configureOutput`, inherited by subcommands); the
      thrown CommanderError is reported once via `handleCliFailure`.
      (done 2026-07-08)
- [x] **Empty `<outline region=...>` tag pairs** are no longer emitted;
      regions with zero entries are skipped entirely. (done 2026-07-08)

## Round 3 findings (verified 2026-07-08, full spec re-verification)

- [x] **`--lang` directory scans with zero matches produce empty output,
      exit 0, and no (or a misleading) note.**
      `map --lang go --max-depth 10 src` printed nothing at all — no note,
      exit 0; with the default depth the only note blamed the depth limit.
      Both directory-scan branches in `resolveInputTarget` now emit
      `note: 0 files matched --lang <l> under <dir>; remove --lang or check
      the extension` whenever the lang filter leaves a scan empty (per
      directory in multi-path runs; `.` for the default cwd scan).
      Regression tests added. (done 2026-07-08)
- [x] **Stale golden fixtures for zero-entry extractors.**
      `tests/fixtures/lua/interfaces.lua`, `lua/types.lua`,
      `python/interfaces.py`, `python/types.py` were empty, but live output
      now (correctly) emits `note: 0 <extractor> entries in 1 file` on
      stdout. Regenerated all goldens with `generate-fixtures.sh` against
      the local build; only those four changed. (done 2026-07-08)
- [x] **False-positive secret redaction of `package.json` `author`.**
      `map --only json:shape package.json` showed `author: [redacted]`:
      `SECRET_NAME_PATTERN` appended `[A-Za-z0-9_]*` to each keyword, so
      `auth` matched "auth"+"or" = `author`. The keyword suffix now must
      start with a digit or `_` (`AUTH_TOKEN`/`token2` still match;
      `author`/`tokenizer` don't), and `authorization` was added as an
      explicit keyword so bearer headers stay redacted. Regression tests
      added. (done 2026-07-08)
- [x] **`--all` docs overstate: json:shape depth/key cap is fixed.**
      Global/`map` help and the README `--all` row now say "Lift the output
      caps … Exception: json:shape's nesting summary ("...") is fixed",
      matching the runtime trailer. Help snapshot updated.
      (done 2026-07-08)
- [x] **Pluralization nits in output** (cosmetic). Added a `pluralize`
      helper; `(1 entry)`/`(N entries)`, `1 more file`/`N more files`,
      `N test files excluded`, and the zero-entry note reworded to
      `0 entries for <extractors> in N file(s→files)`. Tests and the four
      zero-entry golden fixtures updated to the new wording.
      (done 2026-07-08)

## Round 4 findings (verified 2026-07-08, full spec re-verification)

- [x] **Depth truncation silently undisclosed when the next level holds only
      directories.** `map --max-depth 1 ./src` hid all 29 files under
      `src/languages/*/` (depth 3) with no trailing `note:` — the probe only
      scanned to depth N+1. The probe in `discoverFilesWithDefaultDepth` is
      now unbounded, counts every file beyond the limit, and the note names
      the deepest depth needed (`depth limit 1 reached; 29 more files at
      depth 3 — pass --max-depth 3 or --all`; a range prints as
      `at depths X-Y`). Side benefit: the `N test files excluded` stat is
      now computed after the depth filter, so it reflects the visible scan
      rather than the probe. Regression test added. (done 2026-07-08)
- [x] **Golden fixtures stale again for zero-entry extractors.** FALSE
      POSITIVE: the round-4 diff captured live output with `2>&1`, so the
      stderr-mirrored `note:` line doubled up; the committed goldens were
      already correct. Kept the hardening anyway: `generate-fixtures.sh`
      now invokes the local `dist/02-cli.js` (failing fast if not built)
      instead of whatever `showsignature` is on PATH. (done 2026-07-08)
- [x] **Stdin `map` zero-entry note lists extractors from every file type.**
      The note now intersects `extractOrder` with the extractors supported
      by the languages actually processed (falling back to the full list if
      the intersection is empty): `map - --lang py` on `x = 1` →
      `note: 0 entries for signatures, imports in 1 file`. Regression test
      added. (done 2026-07-08)
- [x] **`read` on an unsupported file type silently omits the outline.**
      When framing includes an outline and no language is known, `read` now
      appends `note: no outline: could not infer a language from the file
      name; pass --lang <l> to enable it` (stdin wording: `no outline:
      stdin language unknown; …`). `--framing none` stays note-free.
      Regression tests added. (done 2026-07-08)
