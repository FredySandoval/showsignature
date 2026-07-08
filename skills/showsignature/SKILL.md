---
name: showsignature
description: >
    Map the structure of code, Markdown, and JSON before reading it. Use
    INSTEAD of Read/Grep/cat for the first look at any unfamiliar file or
    folder: extracts signatures, imports, exports, types, interfaces,
    variables, comments, Markdown headings/tables/code blocks, and JSON
    shapes in a fraction of the tokens. Triggers: exploring a codebase,
    understanding what a file is responsible for, reviewing an API or data
    shape, planning a refactor or migration, or reading one file in a
    windowed way (showsignature read).
license: ISC
compatibility: Requires Node.js. Written in TypeScript and built to JavaScript; no native binary is bundled.
metadata:
  author: FredySandoval
  source_repository: https://github.com/FredySandoval/showsignature
  npm_package: showsignature
allowed-tools: Bash(showsignature:*)
---

# Showsignature

Two commands:

- `showsignature map [OPTION]... [FILE]...` — structural overview of files or directories: signatures, imports, exports, types, interfaces, variables, comments, Markdown headings/tables/code blocks (`md:*`), JSON shapes (`json:shape`).
- `showsignature read [OPTION]... <FILE>` — windowed literal read of exactly one file, framed by a signature skeleton with real line numbers.

Run `showsignature <command> --help` for the full option reference; the summaries below cover the decision rules and the flags you will actually reach for.

## When to use

Run `showsignature map` BEFORE opening any file with Read, cat, head, or grep. The map tells you what the file or folder is responsible for at a fraction of the token cost, and the entries carry real line numbers so the follow-up is always precise.

- First look at any unfamiliar file or folder → `map` it.
- Need the actual lines → `read` with `--offset`/`--limit`, jumping to a line number the map gave you.
- Reviewing an API or data shape → `map --show-only interfaces,types` (or `json:shape` for JSON).
- Migrating between languages → `map --lang-only <lang>` to inspect one language at a time.
- Preparing compact context for another tool or agent → pipe `map` output.

Fall back to Read/Grep only when: showsignature reports the file type is unsupported, you are searching for a string pattern rather than structure, or you already know the exact lines you need and have no need for orientation.

## Workflow

1. `map` the folder or file to see what exists.
2. Act on the trailing `note:` if one appears — it means output was capped or depth-limited, and it names the exact flags or follow-up call to continue. Never ignore it.
3. `read` the specific region: `showsignature read --offset <line> --limit <n> <file>`.

Two properties to rely on:

- In `read`, everything between the `<content>` tags is raw bytes with no line-number prefixes — safe to copy into exact-match edit tools. The skeleton above and below the window lists elided signatures with their real line numbers, so you can jump anywhere next.
- `--offset`/`--limit` count extracted **ENTRIES** in `map` but **LINES** in `read`.

## Canonical examples

```sh
# First look at the folder I'll be working with
showsignature map ./src

# What is this file responsible for?
showsignature map src/01-main.ts

# Several targets at once (files and/or directories)
showsignature map src/main.ts README.md tests/fixtures/

# Directory scans default to --max-depth 2; go deeper explicitly
showsignature map --max-depth 4 ./

# Narrow to specific extractors
showsignature map --show-only imports,exports ./src
showsignature map --show-only interfaces,types ./src
showsignature map --show-only md:headings README.md
showsignature map --show-only json:shape config.json

# One language at a time (useful for migrations)
showsignature map --lang-only go --show-only imports,exports ./src

# Page through a large listing, or lift every cap
showsignature map --offset 40 --limit 40 ./src
showsignature map --all ./src

# Read literal content, windowed (--offset is the first line, 1-indexed)
showsignature read src/01-main.ts
showsignature read --offset 200 --limit 100 src/01-main.ts

# Secrets are redacted by default and the note discloses it; get literal bytes with
showsignature read --no-redact src/config.ts

# stdin works too; skeletons appear only when --lang-only names the language
cat snippet.py | showsignature read - --lang-only py
```

Output is capped at 2000 lines / 50 KB; when a cap kicks in, the trailing `note:` names the exact flags or follow-up call to continue.
