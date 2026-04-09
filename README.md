# showsignature

Extract structure from source code and turn files into clean, readable artifacts.

`showsignature` is a CLI and library for extracting high-signal code structure from TypeScript and JavaScript files. It can pull out signatures, interfaces, type aliases, variables, comments, and imports, then emit them in source order across one or many files.

## Features

- Extracts:
  - function, method, constructor, and class signatures
  - interface declarations
  - type alias declarations
  - variable declarations
  - comments
  - import declarations
- Supports TypeScript and JavaScript families
- Recursively scans folders
- Excludes test files by default during discovery
- Preserves source ordering when combining multiple extract kinds
- Can write plain text or Markdown-fenced output
- Optional source line numbers in output
- Also usable as a library

## Supported languages

Built-in language adapters:

- `ts` → `.ts`, `.mts`, `.cts`
- `js` → `.js`, `.mjs`, `.cjs`

If `--lang` is not provided, the language is inferred from the file extension.

## Installation

```bash
pnpm install
pnpm build
```

Run locally with the built CLI:

```bash
node dist/cli.js --help
```

Or, when installed as a package, use:

```bash
showsignature --help
```

## CLI usage

```bash
showsignature [options]
```

### Input behavior

- `--file <file>`: process exactly one file
- `--folder <folder>`: recursively process supported files from a folder
- no `--file` or `--folder`: recursively scan from the current working directory

`--file` and `--folder` cannot be used together.

## Options

### `--lang <lang>`

Explicitly select a language adapter.

If omitted, `showsignature` infers the language from the input file extension.

Supported built-in values:

- `ts`
- `js`

### `--show-only <options>`

Comma-separated extract kinds.

Default: `signatures`.

By default, the CLI extracts:

```text
signatures
```

Supported extract kinds:

- `signatures`
- `interfaces`
- `types`
- `variables`
- `comments`
- `imports`

When multiple kinds are selected, results are combined in original source order.

Example:

```bash
showsignature --file src/main.ts --show-only comments,signatures
```

### `--file <file>`

Process a single file.

### `--folder <folder>`

Process all supported files under a directory recursively.

FYI: recursive discovery respects `.gitignore` files.

### `--include-tests`

Include files that would normally be excluded during recursive discovery.

By default, test-like files are skipped when scanning folders or the current directory. This includes:

- directories named `test`, `tests`, or `__tests__`
- files matching `*.test.*`, `*.spec.*`, `*_test.*`, `*_spec.*`, `*-test.*`, or `*-spec.*`

This flag only affects recursive discovery. An explicit `--file` path is always processed directly.

### `--output <name>`

Write the final output to a file.

- If the output path ends in `.md` or `.mdx`, output is wrapped in a fenced code block.
- Otherwise, output is written as plain text.

### `-n, --line-number`

Prefix each extracted entry with its source line number.

This is optional and off by default, so the default output stays clean and easy to scan.

## Examples

### Extract default signatures from one file

```bash
showsignature --file src/main.ts
```

### Extract comments and signatures from one file

```bash
showsignature --file src/main.ts --show-only comments,signatures
```

### Scan a folder recursively

```bash
showsignature --folder src --show-only signatures,imports
```

### Scan the current directory

```bash
showsignature --show-only signatures
```

### Include test fixtures during discovery

```bash
showsignature --folder ./tests/fixtures --include-tests --show-only signatures
```

### Write Markdown output

```bash
showsignature --folder src --show-only comments,signatures --output structure.md
```

### Include source line numbers

```bash
showsignature --folder src --show-only signatures --line-number
```

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
  runPipeline,
  formatFinalOutput,
} from "showsignature";

const registry = buildDefaultRegistry();

const result = await runPipeline({
  registry,
  files: ["src/main.ts"],
  extractOrder: ["signatures", "comments"],
});

const output = formatFinalOutput({
  registry,
  sections: result.sections,
  seenLangs: result.meta.seenLangs,
});
```

Notable exports include:

- `buildCli`
- `runCli`
- `createLanguageRegistry`
- `buildDefaultRegistry`
- `discoverFiles`
- `extractFromSource`
- `processFile`
- `runPipeline`
- `formatPlainOutput`
- `formatFinalOutput`
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

- Current built-in extraction support is for TypeScript/JavaScript source files.
- Folder scanning respects `.gitignore`.
- If no supported files are found, the CLI exits with an error.
