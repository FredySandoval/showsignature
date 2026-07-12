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

<!-- GENERATED from src/00-instructions.ts — edit there and run `pnpm gen`. -->

# Showsignature

Two commands (`showsignature <command> --help` for the full option reference):

- `showsignature map [OPTION]... [PATH]...` — structural overview of files or directories. Paginates in **ENTRIES**: `--skip <n>` / `--take <n>`.
- `showsignature read [OPTION]... <FILE>` — literal windowed read of one file. Windows in **LINES**: `--offset <line>` / `--limit <n>`.

Supported files: `.ts/.mts/.cts`, `.js/.mjs/.cjs`, `.tsx/.jsx`, `.svelte`, `.go`, `.py`, `.rs`, `.lua`, `.md`, `.json`. For other file types, use Read/Grep directly.

## What the output looks like

`map` prints one `// path` header per file, then `LINE signature` entries; class/interface bodies are indented member lines under the entry:

```
$ showsignature map src/store.ts
// src/store.ts
2 import type { Stats } from 'node:fs';
16 function formatItem(item: Item): string;
29 class ItemStore {
     add(item: Item): void;
     list(): Item[];
   }
```

`read` prints a `<content>` block whose tag carries the window range and file total. The lines inside are raw source with no line-number prefixes — safe to copy into exact-match edit tools. Structure outside the window appears in `<outline region="before|after">` blocks; a trailing `note:` gives the exact command to continue:

```
$ showsignature read --offset 16 --limit 12 src/store.ts
<content lines="16-27 of 42">
function formatItem(item: Item): string {
  ...raw source lines...
}
</content>
<outline region="after" note="signatures — display context, not file content">
29 class ItemStore {
</outline>
note: showing lines 16-27 of 42; continue with: showsignature read --offset 28 src/store.ts
```

`read` with no flags returns the whole file as a single `<content lines="1-N of N">` block; the outline blocks appear only when structure lies outside the window. When any output is capped (2000 lines / 50 KB), filtered, or depth-limited, the trailing `note:` names the exact flags or follow-up call — always act on it.

## When to use

Run `showsignature map` for the first look at any supported file or folder — it shows what the code is responsible for at a fraction of the token cost, and every entry carries its real source line number for a precise follow-up:

- First look at an unfamiliar file or folder → `map` it.
- Need the actual lines → `read --offset <line> --limit <n>`, jumping to a line number the map gave you.
- Reviewing an API or data shape → `map --only interfaces,types` (or `json:shape` for JSON).
- About to grep for a name you're guessing at → `map --symbol-summary` first to learn the identifiers that literally exist.
- Migrating between languages → `map --lang <lang>` for one language at a time.

Use Read/Grep instead when the file type is unsupported, you are searching for a string pattern rather than structure, or you already know the exact lines you need.

## Defaults (what to expect without flags)

- `map` extracts `signatures,imports` for code, `md:*` for Markdown, `json:shape` for JSON; `--only` selects others (exports, types, interfaces, variables, comments).
- Folder scans go 2 levels deep and skip test files; `--include-tests` brings tests in, `--max-depth <n>` goes deeper.
- `read`'s outline uses the `signatures` extractor; `--outline imports,signatures` picks others; `--framing none` yields content only (no tags, no outline).
- Secrets are redacted and disclosed in the `note:`; `--no-redact` returns literal bytes.
- `--no-line-number` strips line-number prefixes from map entries / read outlines for cleaner piping.

## Symbol summary (`map --symbol-summary`)

Keyword discovery: one line per (extractor, file) pair listing the identifiers that literally exist there. Every token is a valid ripgrep pattern (regex metacharacters escaped), ready to pipe into `rg`:

```
$ showsignature map --symbol-summary src/db/
exports:src/db/pool.ts PgPool createPool POOL_MAX acquireConn
imports:src/db/migrate.ts runMigrations MigrationLock schemaVersion
```

Symbol extractors only (`signatures,imports,exports,interfaces,types,variables,json:shape`); identifiers are verbatim with keywords/builtins removed; import specifiers are one whole token (relative paths reduced to basename: `../../00-core-types.js` → `00-core-types\.js`). The same name under `exports:` of one file and `imports:` of another tells you who defines it and who uses it. Here `--skip`/`--take` page over output LINES.

## More invocations

```sh
showsignature map src/main.ts README.md tests/fixtures/   # several targets at once
showsignature map --max-depth 4 --include-tests ./        # deeper, with tests
showsignature map --only md:headings README.md            # Markdown structure
showsignature map --skip 40 --take 40 ./src               # page a large ENTRY listing
showsignature read --outline imports,signatures src/a.ts  # choose outline extractors
cat snippet.py | showsignature read - --lang py            # stdin (outline needs --lang)
```
