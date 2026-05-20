# showsignature

`showsignature` is a small command-line tool that reads code and shows only the important structure.

Instead of opening a huge file and scrolling through all the implementation details, you can ask `showsignature` to show things like:

- function and class signatures
- imports
- types and interfaces
- variables
- comments
- Markdown headings, tables, or code blocks

It is useful when you want to quickly understand a project, review a file, or give an AI assistant a clean summary of your code.

## Why use it?

Large files are noisy. Most of the time, you first want to know:

- What functions exist?
- What classes exist?
- What does this file export?
- What does this folder contain?
- What are the main headings in this Markdown file?

`showsignature` extracts that high-level shape for you.

## Supported files

`showsignature` works with:

- TypeScript: `.ts`, `.mts`, `.cts`
- JavaScript: `.js`, `.mjs`, `.cjs`
- Go: `.go`
- Python: `.py`
- Markdown: `.md`

## Quick start

Install dependencies and build the CLI:

```bash
pnpm install
pnpm build
```

Run it locally:

```bash
node dist/02-cli.js --help
```

If `showsignature` is already installed in your environment, you can run:

```bash
showsignature --help
```

## Most useful commands

### See the structure of one file

```bash
showsignature --file src/example.ts
```

By default, this shows function, class, method, and constructor signatures.

### See the structure of a whole folder

```bash
showsignature --folder src
```

This scans supported files under `src` and prints their structure.

### Show imports too

```bash
showsignature --folder src --show-only signatures,imports
```

Useful when you want to understand what files depend on.

### Show types and interfaces

```bash
showsignature --folder src --show-only interfaces,types
```

Useful in TypeScript projects when you want to understand the data shapes.

### Show comments and signatures

```bash
showsignature --file src/example.ts --show-only comments,signatures
```

Useful when comments explain the intent of the code.

### Save the result to a file

```bash
showsignature --folder src --show-only signatures,imports --output structure.md
```

This creates a readable summary file that you can share, review, or paste into an AI tool.

### Read from standard input

```bash
cat src/example.ts | showsignature --stdin --lang-only ts
```

Use this when you want to pipe content directly into `showsignature`.

## Markdown examples

### Show only Markdown headings

```bash
showsignature --file README.md --show-only md:headings
```

### Show Markdown code blocks

```bash
showsignature --file README.md --show-only md:codeblocks
```

### Show the full Markdown file

```bash
showsignature --file README.md --show-only md:all
```

## What can `--show-only` extract?

For code files:

| Option       | What it shows                                 |
| ------------ | --------------------------------------------- |
| `signatures` | Functions, methods, constructors, and classes |
| `imports`    | Import statements                             |
| `interfaces` | TypeScript or Go interfaces                   |
| `types`      | Type aliases or type declarations             |
| `variables`  | Variables and constants                       |
| `comments`   | Code comments                                 |

For Markdown files:

| Option          | What it shows                            |
| --------------- | ---------------------------------------- |
| `md:headings`   | Headings like `# Title` and `## Section` |
| `md:tables`     | Markdown tables                          |
| `md:codeblocks` | Fenced code blocks                       |
| `md:all`        | The full Markdown document               |

You can combine multiple options with commas:

```bash
showsignature --folder src --show-only signatures,imports,comments
```

## Example

Given this TypeScript file:

```ts
import fs from "node:fs";

export class UserService {
  constructor(private db: Database) {}

  async findUser(id: string): Promise<User> {
    return this.db.users.find(id);
  }
}
```

`showsignature` outputs the important shape:

```ts
import fs from "node:fs";

export class UserService {
  constructor(private db: Database);
  async findUser(id: string): Promise<User>;
}
```

You see what exists without reading all the implementation code.

## Common workflow

A simple way to use this tool when exploring a project:

```bash
# 1. Look at the main source folder
showsignature --folder src

# 2. Include imports to understand dependencies
showsignature --folder src --show-only signatures,imports

# 3. Save a summary
showsignature --folder src --show-only signatures,imports --output structure.md
```

## Helpful options

| Option                     | Use it when...                                         |
| -------------------------- | ------------------------------------------------------ |
| `--file <file>`            | You want to inspect one file                           |
| `--folder <folder>`        | You want to inspect a folder                           |
| `--show-only <items>`      | You want specific information                          |
| `--output <file>`          | You want to save the result                            |
| `--lang-only <lang>`       | You are reading from stdin or want to force a language |
| `--max-depth <number>`     | You want to limit folder scanning depth                |
| `--ignore-folder <folder>` | You want to skip a folder                              |
| `--include-tests`          | You want to include test files                         |

## Development

Useful commands for contributors:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm format
```

## Notes

- Folder scans respect `.gitignore`.
- Test files are skipped by default during folder scans. Use `--include-tests` to include them.
- If no input is provided, `showsignature` scans the current directory.
- The default extraction mode is `signatures`.
