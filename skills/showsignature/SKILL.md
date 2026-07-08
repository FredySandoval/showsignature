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

Two commands (run `showsignature <command> --help` for the full option reference):

- `showsignature map [OPTION]... [PATH]...` — structural overview of files or directories. Paginates in **ENTRIES**: `--skip <n>` / `--take <n>`.
- `showsignature read [OPTION]... <FILE>` — literal windowed read of exactly one file, with a structural outline (real line numbers) around the window. Windows in **LINES**: `--offset <line>` / `--limit <n>`.

Supported files: `.ts/.mts/.cts`, `.js/.mjs/.cjs`, `.tsx/.jsx`, `.svelte`, `.go`, `.py`, `.rs`, `.lua`, `.md`, `.json`. For anything else, use Read/Grep directly — don't spend a call finding out.

## When to use

Run `showsignature map` BEFORE opening any supported file with Read, cat, head, or grep. The map tells you what the file or folder is responsible for at a fraction of the token cost, and every entry carries its real source line number, so the follow-up is always precise.

- First look at any unfamiliar file or folder → `map` it.
- Need the actual lines → `read --offset <line> --limit <n>`, jumping to a line number the map gave you.
- Reviewing an API or data shape → `map --only interfaces,types` (or `json:shape` for JSON).
- Migrating between languages → `map --lang <lang>` to inspect one language at a time.
- Preparing compact context for another tool or agent → pipe `map` output.

Fall back to Read/Grep only when: the file type is unsupported (list above), you are searching for a string pattern rather than structure, or you already know the exact lines you need and have no need for orientation.

## Workflow

1. `map` the folder or file to see what exists.
2. Act on the trailing `note:` if one appears — it means output was capped, depth-limited, or filtered, and it names the exact flags or follow-up call to continue. Never ignore it.
3. `read` the specific region: `showsignature read --offset <line> --limit <n> <file>`.

Defaults to know (so you don't pass redundant flags or get surprised):

- `map` extractors default to `signatures,imports` for code, `md:*` for Markdown, `json:shape` for JSON. Pass `--only` to see exports, types, interfaces, variables, or comments.
- Folder scans default to `--max-depth 2` and **exclude test files**; use `--include-tests` when hunting for tests.
- The `read` outline defaults to the `signatures` extractor; pick others with `--outline`.
- In `read`, everything between the `<content>` tags is raw bytes with no line-number prefixes — safe to copy into exact-match edit tools. Pass `--framing none` for a plain read (content only: no tags, no outline).
- Secrets are redacted by default (disclosed in the `note:`); `--no-redact` returns literal bytes.

## Canonical examples

```sh
# First look at the folder I'll be working with
showsignature map ./src

# What is this file responsible for?
showsignature map src/01-main.ts

# Several targets at once (files and/or directories)
showsignature map src/main.ts README.md tests/fixtures/

# Go deeper than the default depth of 2, and include test files
showsignature map --max-depth 4 --include-tests ./

# Narrow to specific extractors
showsignature map --only imports,exports ./src
showsignature map --only interfaces,types ./src
showsignature map --only md:headings README.md
showsignature map --only json:shape config.json

# One language at a time (useful for migrations)
showsignature map --lang go --only imports,exports ./src

# Page through a large ENTRY listing, or lift every cap
showsignature map --skip 40 --take 40 ./src
showsignature map --all ./src

# Read literal LINES, windowed (--offset is the first line, 1-indexed)
showsignature read --offset 200 --limit 100 src/01-main.ts

# Choose the outline extractors, or drop the framing entirely
showsignature read --outline imports,signatures src/01-main.ts
showsignature read --framing none src/01-main.ts

# stdin works too; the outline appears only when --lang names the language
cat snippet.py | showsignature read - --lang py
```

Output is capped at 2000 lines / 50 KB; when a cap kicks in, the trailing `note:` names the exact flags or follow-up call to continue.
