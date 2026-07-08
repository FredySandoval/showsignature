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
