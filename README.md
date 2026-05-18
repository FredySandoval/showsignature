# showsignature

Extract structure from source files and turn them into clean, readable artifacts.

`showsignature` is a CLI and library for extracting high-signal structure from TypeScript, JavaScript, Python, and Markdown files. It can pull signatures, interfaces, type aliases, variables, comments, imports, and markdown-specific structure, then emit the result in source order across one file or many.

## Quick start

Install dependencies and build the CLI:

```bash
pnpm install
pnpm build
```

Run the built CLI locally:

```bash
node dist/02-cli.js --help
```

Or, if the package is installed in your environment:

```bash
showsignature --help
```

## Common commands

```bash
# Extract default signatures from one file
showsignature --file src/example.ts

# Extract comments and signatures from one file
showsignature --file src/example.ts --show-only comments,signatures

# Read TypeScript from standard input
cat src/example.ts | showsignature --stdin --lang-only ts

# Piped Markdown is picked up automatically for markdown-only extract kinds
cat README.md | showsignature --show-only md:headings

# Scan a folder recursively
showsignature --folder src --show-only signatures,imports

# Limit recursive folder scanning depth
showsignature --folder src --max-depth 2 --show-only signatures

# Ignore a folder by path or name during recursive scanning
showsignature --folder src --ignore-folder generated --show-only signatures
showsignature --folder src --ignore-folder vendor/generated --show-only signatures

# Scan the current directory
showsignature --show-only signatures

# Extract a full Markdown file
showsignature --file README.md --show-only md:all

# Extract Markdown headings
showsignature --file README.md --show-only md:headings

# Include test fixtures during discovery
showsignature --folder tests/fixtures --include-tests --show-only signatures

# Write Markdown output
showsignature --folder src --show-only comments,signatures --output structure.md

# Include source line numbers
showsignature --folder src --show-only signatures --line-number
```

## Supported languages

If `--lang-only` is omitted, `showsignature` infers the language from the file extension.

| `--lang-only` value | Extensions            |
| ------------------- | --------------------- |
| `ts`                | `.ts`, `.mts`, `.cts` |
| `js`                | `.js`, `.mjs`, `.cjs` |
| `py`                | `.py`                 |
| `md`                | `.md`                 |

## Extract kinds

### Code extract kinds

| Kind         | Description                                         |
| ------------ | --------------------------------------------------- |
| `signatures` | Function, method, constructor, and class signatures |
| `interfaces` | Interface declarations                              |
| `types`      | Type alias declarations                             |
| `variables`  | Variable declarations                               |
| `comments`   | Comment blocks and line comments                    |
| `imports`    | Import declarations                                 |

### Markdown extract kinds

| Kind            | Description                   |
| --------------- | ----------------------------- |
| `md:all`        | Full Markdown document output |
| `md:headings`   | Markdown headings             |
| `md:tables`     | Markdown tables               |
| `md:codeblocks` | Markdown fenced code blocks   |

`--show-only` accepts a comma-separated list of extract kinds.

Default: `signatures`

That default targets code structure. Markdown files only produce output when you request a markdown extract kind such as `md:all`, `md:headings`, or `md:tables`.

When you select multiple kinds, the final output is merged in original source order.

## CLI reference

### Input rules

- Use `--file <file>` to process exactly one file.
- Use `--folder <folder>` to process supported files under a directory recursively.
- Use `--stdin` to read source from standard input.
- If `--file`, `--folder`, and `--stdin` are omitted, `showsignature` first checks for piped standard input.
- If piped standard input has content and the language is unambiguous, `showsignature` reads from standard input.
- Markdown-only extract kinds such as `md:headings` imply Markdown for piped standard input.
- If piped standard input is empty, `showsignature` scans the current working directory recursively.
- If piped standard input has content but the language is ambiguous, pass `--lang-only <lang>`.
- `--file`, `--folder`, and `--stdin` cannot be combined with each other.
- `--stdin` requires `--lang-only <lang>`.
- Recursive discovery respects `.gitignore` files.
- Use `--max-depth <number>` to limit recursive discovery depth for folder scans.
- Use `--ignore-folder <folder>` to ignore a folder path or folder name during recursive discovery. Repeat the option to ignore multiple folders.
- When every requested extract kind is Markdown-only, discovery scans only `.md` files.
- Test-like files are excluded during recursive discovery unless you pass `--include-tests`.
- An explicit `--file` path is processed directly and is not filtered as a test file.

### Options

| Option                     | Description                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--lang-only <lang>`       | Only process files for the provided language. If omitted, the adapter is inferred from the file extension.                                        |
| `--show-only <options>`    | Comma-separated extract kinds to include. Default: `signatures`.                                                                                  |
| `--file <file>`            | Process a single file.                                                                                                                            |
| `--folder <folder>`        | Process supported files from a folder recursively.                                                                                                |
| `--stdin`                  | Read source from standard input. Requires `--lang-only <lang>`. Use it to force stdin mode even when discovery would otherwise run.               |
| `--include-tests`          | Include files from `test`, `tests`, and `__tests__` directories, plus common `*.test.*` and `*.spec.*` file patterns, during recursive discovery. |
| `--ignore-folder <folder>` | Ignore a folder path or folder name during recursive discovery. Repeat to ignore multiple folders.                                                |
| `--max-depth <number>`     | Limit recursive discovery to the provided non-negative folder depth.                                                                              |
| `--output <name>`          | Write the final output to a file.                                                                                                                 |
| `-n, --line-number`        | Prefix each extracted entry with its source line number.                                                                                          |

### Output behavior

- Plain output is grouped by file and prefixed with a file header comment.
- If `--line-number` is enabled, each extracted entry is prefixed with its source line number.
- If the output path ends in `.md` or `.mdx`, the final result is wrapped in a fenced code block.
- When all processed files resolve to the same language, or when `--lang-only` is provided, the Markdown fence is annotated with that language.
- Output files can be written inside the current working directory or inside the system temp directory, such as `/tmp`.
- If discovery finds no supported files, or if the selected extract kinds produce no entries, the CLI prints nothing.

## Output format

Plain output is grouped by file and prefixed with a file header comment:

```ts
// src/example.ts
export function greet(name: string): string;
```

When `--line-number` is enabled, each extracted entry is prefixed with its source line number:

```ts
// src/example.ts
  12 export function greet(name: string): string;
```

If the output file ends in `.md` or `.mdx`, the result is wrapped in a fenced code block. When all processed files resolve to the same language, the fence is annotated accordingly.

## Extraction examples

### Markdown headings

Input:

```md
# API Guide

## Install
```

Output:

```md
# API Guide

## Install
```

### Markdown tables

Input:

```md
| Name | Value |
| ---- | ----- |
| API  | ready |
```

Output:

```md
| Name | Value |
| ---- | ----- |
| API  | ready |
```

### Function signatures

Input:

```ts
function printUserInfo<T extends User>(user: T): void {
  console.log(user);
}
```

Output:

```ts
function printUserInfo<T extends User>(user: T): void;
```

### Method signatures

Input:

```ts
getProfile(): string {
  return "something";
}
```

Output:

```ts
getProfile(): string;
```

### Constructor signatures

Input:

```ts
constructor(public id: number) {}
```

Output:

```ts
constructor(public id: number);
```

### Class signatures

Input:

```ts
export class UserAccount implements User {
  constructor(public id: number) {}

  getProfile(): string {
    return "ok";
  }
}
```

Output:

```ts
export class UserAccount implements User {
  constructor(public id: number);
  getProfile(): string;
}
```

### Variables

Input:

```ts
export const API_URL = "https://example.com";
let cache: Map<string, User> = new Map();
const settings = { theme: "dark", compact: true };
```

Output:

```ts
export const API_URL = "https://example.com";
let cache: Map<string, User> = ...;
const settings = {...};
```

### Comments

Input:

```ts
// Env setup
const api = createApi();

/*
  Retry settings
*/
api.connect();
```

Output:

```ts
// Env setup
/*
  Retry settings
*/
```

### Imports

Input:

```ts
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import type { User } from "./types";
```

Output:

```ts
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import type { User } from "./types";
```

## Library usage

The package also exports the core pipeline utilities.

```ts
import {
  buildDefaultRegistry,
  formatFinalOutput,
  runPipeline,
} from "showsignature";

const registry = buildDefaultRegistry();

const result = await runPipeline({
  registry,
  files: ["src/example.ts"],
  extractOrder: ["signatures", "comments"],
});

const output = formatFinalOutput({
  registry,
  sections: result.sections,
  seenLangs: result.meta.seenLangs,
});
```

## Public API

Core exports include:

- `buildCli`
- `runCli`
- `createLanguageRegistry`
- `buildDefaultRegistry`
- `discoverFiles`
- `getSupportedGlobs`
- `isTestFile`
- `extractFromSource`
- `processFile`
- `runPipeline`
- `detectFenceLanguage`
- `formatPlainOutput`
- `formatFinalOutput`
- `toDisplayPath`
- `toMarkdownCodeBlock`
- `BUILT_IN_EXTRACT_KINDS`
- related public types from `src/00-core-types.ts`

## Development

Scripts from `package.json`:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm format
pnpm dedupe
pnpm clean
```

## Notes

- Built-in extraction support covers TypeScript, JavaScript, Python, and Markdown files.
- Python currently focuses on functions, classes, methods, variables, comments, and imports.
- Python does not currently implement `interfaces` or `types` extraction.
- Markdown support uses the markdown extract kinds `md:all`, `md:headings`, `md:tables`, and `md:codeblocks`.
- `md` is kept as a compatibility alias for `md:all`.
- Folder scanning respects `.gitignore`.
