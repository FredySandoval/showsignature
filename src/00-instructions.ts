// SINGLE SOURCE OF TRUTH for every instruction surface this project ships:
// CLI --help texts, agent tool descriptions/arg docs (pi, opencode), pi
// prompt snippets, the agent SKILL, and the generated README sections.
//
// This file is plain exported strings — no logic. The CLI and the agent
// adapters import it directly; SKILL.md and the README block are written
// from it by `pnpm gen` (scripts/build-instructions.ts). Never edit those
// two outputs by hand.

const cli = "showsignature";

export const DEFAULT_DIRECTORY_MAX_DEPTH = 2;

// Static help texts. These are the product spec for the CLI surface (see
// REPORT.md); update them by hand whenever a command or option changes.
export const HELP_EXTRACTORS_BODY = 
`    signatures     Functions, classes, methods, constructors
    imports        Import statements/declarations
    exports        JS/TS exports, exported Go decls, Python public exports
    interfaces     TypeScript/Go interfaces
    types          Type aliases/declarations
    variables      Variables/constants
    comments       Code comments
    md:headings    Markdown headings
    md:tables      Markdown tables
    md:codeblocks  Markdown fenced code blocks
    json:shape     JSON value shape`;

export const ROOT_HELP = 
`${cli} — extract the useful structure from source files

Usage:
  ${cli} map  [OPTION]... [PATH]...
  ${cli} read [OPTION]... <FILE>

Commands:
  map     Structural overview of files or directories: signatures, imports,
          exports, types, variables, comments, Markdown sections, JSON shapes.
  read    Literal windowed read of exactly one file, with an optional
          structural outline around the window for orientation.

Extractors (for map --only and read --outline):
${HELP_EXTRACTORS_BODY}

Global options (accepted by both commands):
  --all            Lift the output caps (2000 lines / 50 KB). Exception:
                   json:shape's nesting summary ("...") is fixed.
  --no-redact      Disable built-in secrets redaction.
  --lang <l>       Restrict/declare language. For stdin: required by map,
                   optional for read (enables the outline).
                   Example: ts, js, tsx, jsx, svelte, go, py, rs, lua, md, json
  -h, --help       Show help. Use \`${cli} <command> --help\` for
                   command-specific options and examples.
  -v, --version    Print version and exit.

Remember the split:
  map  works in ENTRIES:  --skip <n> / --take <n>
  read works in LINES:    --offset <line> / --limit <n>

Getting started:
  ${cli} map ./src                                Overview of a folder
  ${cli} map --only imports ./src                 One extractor only
  ${cli} read --offset 200 --limit 100 file.ext   Read lines 200–299
  ${cli} read --framing none file.ext             Plain read, no outline


Output is capped at 2000 lines / 50 KB.
When a cap kicks in, a trailing \`note:\` names the exact flags or
follow-up call to continue.
`;

export const MAP_HELP = 
`${cli} map — structural overview of files and directories

Usage:
  ${cli} map [OPTION]... [PATH]...

  PATH may be one or more files or directories (default: current directory).

Output is a list of extracted ENTRIES (one signature, import, heading,
etc. per entry), each prefixed with its real source line number.

Options:
  --only <extractors>    Comma-separated extractors to run (default:
                         signatures,imports for code files; md:* for
                         Markdown; json:shape for JSON). See "Extractors"
                         below.
  --skip <n>             Skip the first N entries (default: 0).
  --take <n>             Show at most N entries.
  --symbol-summary       Keyword-discovery mode: one line per (extractor,
                         file) pair listing the identifiers that literally
                         exist there, space-separated (paths containing
                         spaces are double-quoted). Import specifiers are
                         one whole token (relative paths reduced to their
                         basename). Summarizes the active extractors —
                         defaults signatures,imports unless --only selects
                         others; symbol extractors only
                         (no comments / md:*); no line numbers;
                         --skip/--take page over output lines.
  --max-depth <n>        Folder scan depth (default: ${DEFAULT_DIRECTORY_MAX_DEPTH}).
  --include-tests        Include test files in folder scans.
  --no-line-number       Hide source line-number prefixes.
  -h, --help             Show this help.

Global options:
  --all                  Lift the output caps (entry limit and the
                         2000-line / 50 KB cap). Exception: json:shape's
                         nesting summary ("...") is fixed.
  --no-redact            Disable built-in secrets redaction.
  --lang <l>             Only process files of this language; required when
                         reading stdin. Example: ts, go, py, rs, md, json

Extractors (for --only):
${HELP_EXTRACTORS_BODY}

Examples:
  ${cli} map ./src
  ${cli} map src/main.py README.md tests/fixtures
  ${cli} map --only signatures,imports,exports ./src
  ${cli} map --only md:headings
  ${cli} map --only json:shape config.json
  ${cli} map --lang go --only imports,exports
  ${cli} map --skip 40 --take 40 ./src
  ${cli} map --symbol-summary ./src
  ${cli} map --symbol-summary --only interfaces,types ./src

Note: map paginates ENTRIES (--skip/--take).
      To read LINES from one file, use \`${cli} read --offset/--limit\`.
`;

export const READ_HELP = 
`${cli} read — windowed literal read of one file, with an optional outline

Usage:
  ${cli} read [OPTION]... <FILE>

  Reads exactly one file.
  The content window is wrapped in <content> tags by default and has no
  line-number prefixes, making it safe to copy into exact-match edit
  tools. A structural outline is shown around the window.

Options:
  --offset <line>         First line to show, 1-indexed (default: 1).
  --limit <n>             Maximum lines shown in the window.
  --outline <extractors>  Extractors used for the outline (default:
                          signatures).
  --framing <mode>        How the content window is wrapped (default:
                          tags). One of: tags, none.
  --no-line-number        Hide line-number prefixes on outline lines
                          (content never has them).
  --no-binary-check       Read files that look binary instead of refusing.
  -h, --help              Show this help.

Global options:
  --all                   Lift the 2000-line / 50 KB window cap.
  --no-redact             Disable secret redaction for literal bytes
                          (redaction is disclosed otherwise).
  --lang <l>              Declare the file's language. Optional for stdin:
                          content always displays; the outline appears only
                          when the language is known.

Extractors (for --outline):
${HELP_EXTRACTORS_BODY}

Framing modes:
    tags           Wrap content in <content>...</content> (default)
    none           Emit the content only

Examples:
  ${cli} read src/01-main.ts
  ${cli} read --offset 200 --limit 100 src/main.ext
  ${cli} read --outline imports,signatures src/config.ext
  ${cli} read --outline types src/config.ext
  ${cli} read --outline interfaces --framing none src/data.ext

Tip: outline lines carry real line numbers, so you can jump anywhere
     with \`${cli} read --offset <line> <file>\`.

Note: read windows LINES (--offset/--limit).
      To page through structural ENTRIES, use \`${cli} map --skip/--take\`.
`;

// ---------------------------------------------------------------------------
// Agent tool surface (pi native tools, opencode plugin tools)
// ---------------------------------------------------------------------------

export const MAP_DESCRIPTION = 
`Structural overview of code, Markdown, and JSON. Use INSTEAD of read/grep/cat for the FIRST look at any unfamiliar file or folder: by default returns ONLY function/class signatures and imports (Markdown headings for .md, value shape for .json) at a fraction of the token cost, each entry prefixed with its real source line number. In Go and Rust the default also includes type declarations (Go 'type X struct/interface', Rust struct/enum/trait/union/type alias) — they are those languages' class equivalents. Exports, types, interfaces, variables, and comments are otherwise NOT in the default output — request them explicitly via 'only'.
Output is plain text (never JSON): one '// path' header per file, then one 'LINE signature' entry per line, e.g. \`16 function formatItem(item: Item): string;\`; class/interface bodies render as indented member lines (no line number) under the class entry — method signatures only for classes (property fields are omitted). Interfaces are NOT in the default output; when selected via 'only' they render the same way, listing their properties as member lines.
Supported: .ts/.mts/.cts .js/.mjs/.cjs .tsx/.jsx .svelte .go .py .rs .lua .md .json — for other file types use read/grep directly.
Workflow: map first to see what exists, then jump to exact lines with showsignature_read using the line numbers from the map. Before grepping for a name you are guessing at, run with symbolSummary to get the identifiers that literally exist (each token is a valid ripgrep pattern).
If the output ends with a 'note:' line, it was capped, depth-limited, or filtered — the note names the exact follow-up flags; never ignore it.`;

export const READ_DESCRIPTION = `
Windowed literal read of exactly one file, with a structural outline (real line numbers) around the window for orientation. Prefer this over plain read for supported file types (.ts/.js/.tsx/.jsx/.svelte/.go/.py/.rs/.lua/.md/.json), typically jumping to a line number that showsignature_map reported.
The content window carries no line-number prefixes, so it is safe to copy into exact-match edit tools. Windows in LINES (offset/limit), unlike showsignature_map which paginates in ENTRIES (skip/take).
Output format: a <content lines="16-27 of 42"> block holding the RAW source lines of the window (this is a literal read — full statements and bodies, NOT a signature map); structure outside the window appears as <outline region="before|after"> blocks of line-numbered signatures — the outline defaults to the signatures extractor ONLY (imports are not outlined unless requested via outline:'imports,signatures'), a region with no matching entries is omitted, class entries appear as a single line (members are not expanded, unlike showsignature_map), and an entry whose body contains the window is annotated with "← window opens inside this". Whenever the window covers the whole file (no offset/limit, or a limit >= the file's length), the whole file is returned as one <content lines="1-N of N"> block and the outline blocks are omitted.
Every partial window ends with a trailing 'note:' line giving the exact continuation command (e.g. "continue with: showsignature read --offset 28 <file>"); the note also reports capping or filtering when it occurs — never ignore it.
`.trim();

export const MAP_ARG_DOCS = {
  paths         : "One or more files and/or directories to map",
  only          : "Comma-separated extractors, e.g. 'imports,exports', 'interfaces,types', 'md:headings', 'json:shape'. Categories are language-semantic, not syntax filters: 'exports' means anything the module exposes, so in Go/Rust/Lua/Python it includes public/exported top-level functions, constants, classes, and variables — not just export statements",
  skip          : "Skip N entries (pagination). One entry = one line-numbered item: an import, a function, or a class/interface together with its indented members; file headers and member lines are not entries",
  take          : "Take N entries (pagination); see skip for what counts as one entry",
  maxDepth      : "Directory scan depth (default 2)",
  lang          : "Restrict to one language, e.g. 'go', 'py', 'ts'",
  includeTests  : "Include test files (excluded by default). A test file lives under a test/tests/__tests__ directory or is named *.test.*, *_test.*, *-test.* or the .spec equivalents — a name like test1.ts is NOT a test file",
  symbolSummary : "Keyword-discovery mode: one line per (extractor, file) listing identifiers, formatted 'extractor:path id1 id2 …' (no line numbers). Summarizes only the ACTIVE extractors — the defaults (signatures,imports) unless combined with 'only' (e.g. only:'exports,types' to list those instead); import specifiers are one whole token (relative paths reduced to their basename)",
  noLineNumber  : "Hide source line-number prefixes (cleaner text for piping)",
} as const;

export const READ_ARG_DOCS = {
  file    : "File to read"                                                        ,
  offset  : "First line to read (1-indexed)"                                      ,
  limit   : "Number of lines to read"                                             ,
  outline : "Outline extractors, e.g. 'imports,signatures' (default: signatures)" ,
  framing : "'none' for plain content only (no tags, no outline)"                 ,
  lang    : "Language hint, e.g. 'py', 'ts'"                                      ,
} as const;

/** pi extension prompt metadata (system-prompt-level nudges). */
export const MAP_PROMPT = {
  snippet    : "Map the structure of code/Markdown/JSON files or folders before reading them",
  guidelines : [ "Use showsignature_map instead of read/grep for the first look at any unfamiliar supported file or folder (.ts/.js/.tsx/.svelte/.go/.py/.rs/.lua/.md/.json); it returns the structure with real line numbers at a fraction of the tokens.", ],
} as const;

export const READ_PROMPT = {
  snippet    : "Windowed literal read of one file with a structural outline around the window",
  guidelines : [ "Use showsignature_read instead of read for supported file types, jumping to a line number reported by showsignature_map.", ],
} as const;

// ---------------------------------------------------------------------------
// SKILL.md — written verbatim to skills/showsignature/SKILL.md by pnpm gen
// ---------------------------------------------------------------------------

export const SKILL_MD = 
`---
name: showsignature
description: >
    Map the structure of code, Markdown, and JSON before reading it. Use
    INSTEAD of Read/Grep/cat for the first look at any unfamiliar file or
    folder: extracts function/class signatures and imports by default
    (Markdown headings and JSON shapes for those file types) in a fraction
    of the tokens; exports, types, interfaces, variables, comments, and
    Markdown tables/code blocks on request. Triggers: exploring a codebase,
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

<!-- GENERATED from src/00-instructions.ts — edit there and run \`pnpm gen\`. -->

# Showsignature

Two commands (\`showsignature <command> --help\` for the full option reference):

- \`showsignature map [OPTION]... [PATH]...\` — structural overview of files or directories. Paginates in **ENTRIES**: \`--skip <n>\` / \`--take <n>\`.
- \`showsignature read [OPTION]... <FILE>\` — literal windowed read of one file. Windows in **LINES**: \`--offset <line>\` / \`--limit <n>\`.

Supported files: \`.ts/.mts/.cts\`, \`.js/.mjs/.cjs\`, \`.tsx/.jsx\`, \`.svelte\`, \`.go\`, \`.py\`, \`.rs\`, \`.lua\`, \`.md\`, \`.json\`. For other file types, use Read/Grep directly.

PATHs are positional operands; every option is a kebab-case \`--flag\` (\`--symbol-summary\`, \`--max-depth\`, \`--include-tests\`, \`--no-line-number\`) — never camelCase, never a bare word.

## What the output looks like

\`map\` prints one \`// path\` header per file, then \`LINE signature\` entries; class/interface bodies are indented member lines under the entry:

\`\`\`
$ showsignature map src/store.ts
// src/store.ts
2 import type { Stats } from 'node:fs';
16 function formatItem(item: Item): string;
29 class ItemStore {
     add(item: Item): void;
     list(): Item[];
   }
\`\`\`

\`read\` prints a \`<content>\` block whose tag carries the window range and file total. The lines inside are raw source with no line-number prefixes — safe to copy into exact-match edit tools. Structure outside the window appears in \`<outline region="before|after">\` blocks; a trailing \`note:\` gives the exact command to continue:

\`\`\`
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
\`\`\`

\`read\` with no flags returns the whole file as a single \`<content lines="1-N of N">\` block; the outline blocks appear only when structure lies outside the window. When any output is capped (2000 lines / 50 KB), filtered, or depth-limited, the trailing \`note:\` names the exact flags or follow-up call — always act on it.

## When to use

Run \`showsignature map\` for the first look at any supported file or folder — it shows what the code is responsible for at a fraction of the token cost, and every entry carries its real source line number for a precise follow-up:

- First look at an unfamiliar file or folder → \`map\` it.
- Need the actual lines → \`read --offset <line> --limit <n>\`, jumping to a line number the map gave you.
- Reviewing an API or data shape → \`map --only interfaces,types\` (or \`json:shape\` for JSON).
- About to grep for a name you're guessing at → \`map --symbol-summary\` first to learn the identifiers that literally exist.
- Migrating between languages → \`map --lang <lang>\` for one language at a time.

Use Read/Grep instead when the file type is unsupported, you are searching for a string pattern rather than structure, or you already know the exact lines you need.

## Defaults (what to expect without flags)

- \`map\` extracts \`signatures,imports\` for code, \`md:*\` for Markdown, \`json:shape\` for JSON; \`--only\` selects others (exports, types, interfaces, variables, comments). In Go and Rust, \`signatures\` includes type declarations (Go \`type X struct/interface\`, Rust \`struct\`/\`enum\`/\`trait\`/\`union\`/type alias) — those languages' class equivalents. \`--only\` categories are language-semantic: \`exports\` means whatever the module exposes, so in Go/Rust/Lua/Python it includes public/exported top-level functions, constants, classes, and variables, not just export statements.
- Folder scans go 2 levels deep and skip test files (under test/tests/__tests__ directories or named \`*.test.*\` / \`*_test.*\` / \`*-test.*\` / spec equivalents); \`--include-tests\` brings tests in, \`--max-depth <n>\` goes deeper. Symlinked files and directories are followed (depth limits apply through links), and paths are always reported as given — never resolved to the link target.
- \`read\`'s outline uses the \`signatures\` extractor; \`--outline imports,signatures\` picks others; \`--framing none\` yields content only (no tags, no outline).
- Secrets are redacted and disclosed in the \`note:\`; \`--no-redact\` returns literal bytes.
- \`--no-line-number\` strips line-number prefixes from map entries / read outlines for cleaner piping.

## Symbol summary (\`map --symbol-summary\`)

Keyword discovery: one line per (extractor, file) pair listing the identifiers that literally exist there. Every token is a valid ripgrep pattern (regex metacharacters escaped), ready to pipe into \`rg\`:

\`\`\`
$ showsignature map --symbol-summary src/db/
signatures:src/db/pool.ts PgPool createPool acquireConn
imports:src/db/migrate.ts runMigrations MigrationLock schemaVersion
$ showsignature map --symbol-summary --only exports src/db/
exports:src/db/pool.ts PgPool createPool POOL_MAX acquireConn
\`\`\`

It summarizes only the ACTIVE extractors: the defaults (\`signatures,imports\`) unless \`--only\` selects others (any of \`signatures,imports,exports,interfaces,types,variables,json:shape\`; comments and \`md:*\` are excluded); identifiers are verbatim with keywords/builtins removed; import specifiers are one whole token (relative paths reduced to basename: \`../../00-core-types.js\` → \`00-core-types\\.js\`). The same name under \`exports:\` of one file and \`imports:\` of another tells you who defines it and who uses it. Here \`--skip\`/\`--take\` page over output LINES.

## More invocations

\`\`\`sh
showsignature map src/main.ts README.md tests/fixtures/   # several targets at once
showsignature map --max-depth 4 --include-tests ./        # deeper, with tests
showsignature map --only md:headings README.md            # Markdown structure
showsignature map --skip 40 --take 40 ./src               # page a large ENTRY listing
showsignature read --outline imports,signatures src/a.ts  # choose outline extractors
cat snippet.py | showsignature read - --lang py            # stdin (outline needs --lang)
\`\`\`
`;

// ---------------------------------------------------------------------------
// README — written between the generated:instructions markers by pnpm gen
// ---------------------------------------------------------------------------

export const README_USAGE = `
## Usage

\`\`\`sh
showsignature map  [OPTION]... [PATH]...
showsignature read [OPTION]... <FILE>
\`\`\`

Two commands:

- \`map\` — structural overview: signatures and other extracted entries. Inspect [PATH] operands—files or directory paths—using the current directory by default.
- \`read\` — literal windowed read of exactly one file, with an optional structural outline around the window for orientation.

Running \`showsignature\` with no command prints help and exits with code 1.

Options for \`showsignature map\`:

| OPTION                 | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| \`--only <extractors>\`  | Comma-separated extractors to run (default: \`signatures,imports\` for code files; \`md:*\` for Markdown; \`json:shape\` for JSON). |
| \`--skip <n>\`           | Skip the first N **entries** (default: 0).                                   |
| \`--take <n>\`           | Show at most N **entries**.                                                  |
| \`--symbol-summary\`     | Keyword-discovery mode: emit the identifier vocabulary per (extractor, file) as ripgrep-ready alternation patterns. Import specifiers are emitted as one whole token (relative paths reduced to their basename). See [Symbol summary](#symbol-summary). |
| \`--max-depth <n>\`      | Folder scan depth (directory scans default to \`2\`).                          |
| \`--include-tests\`      | Include test files in folder scans.                                          |
| \`--no-line-number\`     | Hide source line-number prefixes.                                            |
| \`--lang <l>\`           | Only process files of this language; required when using \`-\` to read stdin.  |
| \`--all\`                | Lift the output caps (entry limit and the 2000-line / 50 KB cap). Exception: \`json:shape\`'s nesting summary (\`...\`) is fixed. Omitted from the agent tool schemas on purpose — uncapped output would flood an LLM context; agents page with \`--skip\`/\`--take\` instead. |
| \`--no-redact\`          | Disable built-in secrets redaction.                                          |

Options for \`showsignature read\`:

| OPTION                   | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| \`--offset <line>\`        | First **line** to show, 1-indexed (default: 1).                               |
| \`--limit <n>\`            | Max **lines** shown in the window.                                            |
| \`--outline <extractors>\` | Extractors used for the outline (default: \`signatures\`).                      |
| \`--framing <mode>\`       | How the content window is wrapped (default: \`tags\`). One of: \`tags\`, \`none\`.  |
| \`--no-line-number\`       | Hide line-number prefixes on outline lines (content never has them).          |
| \`--lang <l>\`             | Declare the file's language. Optional for stdin (\`-\`): content always displays; the outline needs a known language. |
| \`--all\`                  | Lift the 2000-line / 50 KB window cap. Omitted from the agent tool schemas on purpose — agents window with \`--offset\`/\`--limit\` instead. |
| \`--no-redact\`            | Disable secret redaction for literal bytes (redaction is disclosed otherwise).|

Remember the split: \`map\` works in **ENTRIES** (\`--skip\`/\`--take\`); \`read\` works in **LINES** (\`--offset\`/\`--limit\`).

Output is capped at 2000 lines / 50 KB by default; when a cap, a depth limit, or a
default filter (such as test-file exclusion) kicks in, the output ends with a single
\`note:\` trailer naming the exact flags or follow-up call to continue. The note is
mirrored to stderr when stdout is piped or redirected, so it stays visible.

## Extractors

Code files:

| Mode         | Shows                                                               |
| ------------ | ------------------------------------------------------------------- |
| \`signatures\` | Functions, classes, methods, constructors; Go/Rust type declarations. |
| \`imports\`    | Import statements/declarations.                                     |
| \`exports\`    | JS/TS exports, exported Go declarations, and Python public exports. |
| \`interfaces\` | TypeScript/Go interfaces.                                           |
| \`types\`      | Type aliases/declarations.                                          |
| \`variables\`  | Variables/constants.                                                |
| \`comments\`   | Code comments.                                                      |

Markdown and JSON files:

| Mode            | Shows               |
| --------------- | ------------------- |
| \`md:headings\`   | Headings.           |
| \`md:tables\`     | Tables.             |
| \`md:codeblocks\` | Fenced code blocks. |
| \`json:shape\`    | JSON value shape.   |

## Supported files

| Language   | Extensions            |
| ---------- | --------------------- |
| TypeScript | \`.ts\`, \`.mts\`, \`.cts\` |
| JavaScript | \`.js\`, \`.mjs\`, \`.cjs\` |
| TSX/JSX    | \`.tsx\`, \`.jsx\`        |
| Svelte     | \`.svelte\`             |
| Go         | \`.go\`                 |
| Python     | \`.py\`                 |
| Rust       | \`.rs\`                 |
| Lua        | \`.lua\`                |
| Markdown   | \`.md\`                 |
| JSON       | \`.json\`               |

## Basic usage examples

\`showsignature map [OPTION]... [PATH]...\` / \`showsignature read [OPTION]... <FILE>\`

\`\`\`sh
showsignature map ./src                                         # Inspect a folder
showsignature map src/01-main.ts                                # Inspect one file

showsignature map src/main.ts README.md tests/fixtures          # [PATH] can be one or more files/directories
showsignature map --only imports,exports ./src                  # Show imports and exports only
showsignature map --only signatures,imports,exports ./src       # Show code structure and imports
showsignature map --only interfaces,types ./folder              # Show data shapes
showsignature map --only variables,comments src/main.ts         # Show variables

showsignature map --only md:headings                            # Extract Markdown headings
showsignature map --only md:tables,md:codeblocks                # Extract Markdown tables
showsignature map --only json:shape config.json                 # Extract JSON shape

# useful when doing migrations from one language to other
showsignature map --lang py                                     # Process Python files only
showsignature map --lang go --only imports,exports              # Show Go imports and exported declarations
showsignature map --lang py --only types,comments               # Show Python imports and public exports
showsignature map --max-depth 4 ./                              # Repo-wide overview with an explicit scan depth

showsignature map --symbol-summary ./src                        # Ripgrep-ready identifier vocabulary per file
showsignature map --symbol-summary --only interfaces,types ./src # Domain vocabulary only

showsignature map --skip 40 --take 40 ./src                     # Page through a large entry listing
showsignature map --all ./src                                   # Lift the output caps (CLI only; omitted from agent tool schemas)
\`\`\`

Read one file literally, with an optional structural outline around the window:

\`\`\`sh
showsignature read src/01-main.ts                               # First lines of the file (up to the cap)
showsignature read --offset 200 --limit 100 src/01-main.ts      # Lines 200-299, outline around the window
showsignature read --outline imports,signatures src/01-main.ts  # Choose the outline extractors
showsignature read --framing none src/01-main.ts                # Plain read: no <content> tags, no outline
showsignature read --no-redact src/config.ts                    # Literal bytes, no secret redaction
cat snippet.py | showsignature read - --lang py                 # Stdin; --lang enables the outline
\`\`\`

The outline lines carry real line numbers, so you can jump anywhere with
\`showsignature read --offset <line> <file>\`. The content between the \`<content>\` tags is
raw—no line-number prefixes—so it is safe to copy into exact-match edit tools.

Combine modes with commas:

\`\`\`bash
showsignature map src --only signatures,imports,comments
\`\`\`

## Symbol summary

\`showsignature map --symbol-summary [OPTION]... [PATH]...\` emits the identifier
vocabulary of a codebase as ripgrep-ready tokens: one line per (extractor, file)
pair listing the identifiers that literally exist there.

<details id="symbol-summary-spec">
<summary>Full specification</summary>

### Description

In an unfamiliar repository, the first search is usually a blind one: names
are guessed from generic conventions ("it's probably called \`DATABASE_URL\`")
rather than taken from the code itself. The repository may use its own naming
conventions, a different stack, or names its documentation no longer reflects.

**--symbol-summary** closes this gap. It reuses \`map\`'s existing extraction,
but instead of formatted structural output it emits **the vocabulary that
literally exists in the code** — a compendium of real identifiers to start
searching from. Scan the output, spot the suspicious name, then \`rg\` or
\`showsignature map\` *that* — no more guessing.

The flag is deliberately verbose: a primary consumer is LLM agents, and
\`--symbol-summary\` is self-describing at the call site.

The flag exists on \`map\` only. It is not available on \`read\`; use
\`read --offset --outline\` to orient around a location.

### Output format

One line per (extractor, file) pair, tokens separated by single spaces;
paths containing spaces are double-quoted:

\`\`\`
<extractor>:<relative/path/to/file> token1 token2 token3
\`\`\`

Example:

\`\`\`
$ showsignature map --symbol-summary ./src
exports:src/db/pool.ts PgPool createPool POOL_MAX acquireConn
imports:src/db/migrate.ts runMigrations MigrationLock schemaVersion LogErrMig
exports:src/db/migrate.ts runMigrations MigrationLock
json:shape:src/config/default.json db host port poolMax migrationTable
\`\`\`

- The extractor prefix says *why* a token is listed: an export is API
  surface, an import is dependency vocabulary, a variable is config
  vocabulary.
- A file may produce multiple lines — one per extractor that yielded
  tokens for it. They are never merged.
- Ordering is stable: file order first (same traversal order as normal
  \`map\`), extractor order second — output is diffable and deterministic
  across runs on an unchanged tree.
- Lines whose every token was stopworded are omitted.
- **No line numbers appear, ever**, regardless of \`--no-line-number\`.
  Regular \`map\` is the discovery tool for locations.

### The output contract

> Every token is a valid ripgrep pattern in default (regex) mode.

Every token exists verbatim in the corresponding source file (modulo
escaping). Regex metacharacters occurring in identifiers are escaped rather
than dropped — e.g. Svelte/PHP-style \`$name\` is emitted as \`\\$name\`. Any
token is safe to paste, and joining tokens with \`|\` yields a valid
alternation:

\`\`\`
rg "PgPool|createPool|POOL_MAX|acquireConn" src/db/pool.ts
\`\`\`

### Token rules

- **Verbatim identifiers.** No splitting of compound identifiers:
  \`getUserById\` stays whole, \`DATABASE_URL\` stays whole. Splitting would
  break the output contract and produce noisy greps.
- **Import specifiers are emitted whole.** The quoted module specifier in
  an \`imports\`/\`exports\` entry contributes exactly one token, never path
  fragments. A relative specifier is reduced to its basename — the
  leading \`./\`/\`../\` segments vary per importing file and would break
  cross-file correlation — while package and module names are kept
  verbatim (metacharacters escaped):

  \`\`\`
  import type { Range } from "../../00-core-types.js";   →  Range 00-core-types\\.js
  import * as ts from "typescript";                      →  ts typescript
  import "github.com/pkg/errors"                         →  github\\.com/pkg/errors
  \`\`\`

  The same specifier token under \`imports:\` of several files tells you
  exactly who depends on that module.
- **First-occurrence order** per line, mirroring source order, so related
  terms cluster naturally. Exception: \`json:shape\` tokens follow the shape
  rendering, which sorts object keys lexicographically — order there
  mirrors the (sorted) rendering, not the source file.
- **Dedup within a line only.** A token appears at most once per line but
  may appear on multiple lines — seeing \`runMigrations\` under both
  \`exports:src/db/migrate.ts\` and \`imports:src/cli.ts\` tells you who
  defines it and who uses it. Repetition across lines is information;
  repetition within a line is noise.
- **Stopwords are purely syntactic.** Language keywords (\`function\`,
  \`def\`, \`fn\`, \`pub\`, \`local\`, …), primitive/builtin type names (\`string\`,
  \`int\`, \`bool\`, \`void\`, common JS/TS globals and utility types like
  \`Promise\`, \`Set\`, \`Record\`, …), and structural noise (\`self\`, \`this\`)
  are removed. The tables are per-language: each language drops its own
  keywords and builtins. Nothing is filtered for perceived relevance — if
  it's a name someone chose, it is kept.

### Extractor scope

Only extractors whose output is symbols — names that verifiably exist in
code or config — contribute:

| Included | Excluded |
| --- | --- |
| \`signatures\`, \`imports\`, \`exports\`, \`interfaces\`, \`types\`, \`variables\`, \`json:shape\` | \`comments\`, \`md:headings\`, \`md:tables\`, \`md:codeblocks\` |

Code and JSON config are ground truth; comments and Markdown are prose that
can reference names which no longer exist. JSON is deliberately included:
config keys are exactly the kind of token users grep for.

Explicitly requesting an excluded extractor is an **error**, not a silent
drop:

\`\`\`
$ showsignature map --symbol-summary --only comments ./src
[error] --symbol-summary only applies to symbol extractors (names that
exist in code or config); comments is a prose extractor and cannot
contribute. Remove it from --only.
\`\`\`

When \`--only\` is not given, the default extractor set applies with the
excluded extractors simply not contributing (Markdown files therefore
produce no output in this mode).

### Interaction with other options

| Option | Behavior |
| --- | --- |
| \`--only\` | Composes naturally: \`--only interfaces,types\` yields domain vocabulary; \`--only signatures\` yields verb vocabulary. Errors on excluded extractors. |
| \`--skip\` / \`--take\` | Page over **output lines** (extractor×file entries), not individual tokens. |
| \`--no-line-number\` | Redundant (no line numbers exist in this mode); accepted silently. |
| \`--max-depth\`, \`--include-tests\`, \`--lang\` | Unchanged. |
| \`--all\` | Lifts the output caps as usual. CLI only — omitted from the agent tool schemas so agents page with \`--skip\`/\`--take\` instead. |

Output is capped at 2000 lines / 50 KB as in normal \`map\`. When paging or a
cap truncates output, the trailing \`note:\` names the **exact** resume
command — the skip count is handed over, never guessed:

\`\`\`
note: showing summary lines 1-2 of 6 — rerun with --symbol-summary --skip 2 --take 2 src
\`\`\`

### Examples

\`\`\`sh
# Full vocabulary of a source tree
showsignature map --symbol-summary ./src

# Domain vocabulary only (data shapes)
showsignature map --symbol-summary --only interfaces,types ./src

# Dependency vocabulary only
showsignature map --symbol-summary --only imports ./src

# Page through a large tree, two lines at a time
showsignature map --symbol-summary --take 2 ./src

# Follow up on a discovered name
rg "LogErrMig" src/
showsignature map src/db/migrate.ts
\`\`\`

### Caveats

- **Relative import specifiers are reduced to their basename.** A line
  like \`import { x } from "../../00-core-types.js"\` contributes
  \`00-core-types\\.js\`, not the full relative path — the \`../\` prefix
  differs per importing file, so the basename is what correlates across
  files. The basename still exists verbatim in the source (the contract
  holds), but grepping it may also match other references to the same
  filename, e.g. in build config.
- **JSON keys are kept whole** (\`pool.max\` → \`pool\\.max\`), except keys
  containing whitespace, which split on the space — the shape rendering
  itself is space-delimited and cannot represent them unambiguously.
- **json:shape truncation drops keys.** Objects with more than 20 keys (or
  nesting past depth 5) are elided by the shape rendering; the elided keys
  do not appear in the vocabulary, the \`...\` marker itself is never
  emitted as a token (a literal \`"..."\` key is likewise dropped), and the
  trailing \`note:\` discloses the truncation. The cap is fixed — \`--all\`
  does not lift it.
- **Single-character tokens can appear** (e.g. a lone \`s\` from a template
  literal in a signature). They are verbatim and harmless, but rarely
  useful grep targets on their own.
- **Stopword tables are per-language and finite.** An unlisted builtin
  (e.g. a niche global type) may slip through as a token. This errs on the
  side of the feature's principle: keep chosen names, drop syntax.
- **Tokens are not scoped.** A parameter name and a top-level export look
  the same in the payload; the extractor prefix is the only context given.
- **Prose is invisible.** Comments and Markdown never contribute, by
  design — a name that exists only in documentation will not appear here.
  Use \`map --only comments\` or \`map --only md:headings\` for those.
- **Redaction applies.** Secret-looking values are redacted as elsewhere
  in \`map\` (disclosed in the \`note:\`); pass \`--no-redact\` for literal
  bytes.

### Out of scope (v1)

- \`read --symbol-summary\`
- Identifier splitting (a possible future \`--split-identifiers\` opt-in)
- Comments / Markdown extractors (would need natural-language stopwords)
- Any semantic relevance filtering

</details>

## Output

\`showsignature\` prints compact text output. Use shell redirection to save output to a file:

\`\`\`bash
showsignature map src --only signatures > structure.txt
\`\`\`

## Pipeline usage

\`showsignature\` writes to stdout by default, so it works well with tools like \`rg\`, \`grep\`, \`fzf\`, \`less\`, \`head\`, \`tee\`, and shell redirects.

\`\`\`sh
showsignature map src --only imports | rg "node"                         # Find matching imports
showsignature map src --only signatures | rg "async"                     # Find async functions or methods
showsignature map src --only comments,signatures | rg -C 2 "ExtractKind" # Search comments/signatures with nearby context
showsignature map src --only signatures,imports | bat -l js              # Page through large output
\`\`\`
`.trim();
