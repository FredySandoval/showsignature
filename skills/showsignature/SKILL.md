---
name: showsignature
description: >
  Fast structural and implementation-oriented overview of source files and markdown.
  Use this before read when you need to identify what a file is responsible for,
  exported symbols, imports, classes, functions, methods, constants, and nearby comments.
  For code files, includes enough context to locate important implementation points such as
  default constants, constructor parameters, method names, and lifecycle methods.
  Prefer this over the 'read' tool for first inspection of likely source files after search
  results; use the 'read' tool only when exact method bodies or full line-by-line code are
  required.

  Good when you need to know:
  - "Where is the xxxxxxx implemented?" after locating xxxxxx.xx
  - "What exports does this file provide?"
  - "What methods are on this class?"
  - "What constants/config drive this behavior?"

  Supported extensions: .cjs, .cts, .go, .js, .jsx, .lua, .md, .mjs, .mts, .py, .rs, .svelte, .ts, .tsx
license: ISC
compatibility: Requires Node.js. Written in TypeScript and built to JavaScript; no native binary is bundled.
metadata:
  author: FredySandoval
  source_repository: https://github.com/FredySandoval/showsignature
  npm_package: showsignature
allowed-tools: Bash(showsignature:*)
---

# showsignature skill guide

Use this skill to inspect code or Markdown structure without implementation noise.

`showsignature` extracts functions, classes, methods, imports, types, interfaces, variables, comments, and Markdown structure.

Security note: secret-like values are redacted by default.

## Use when

- Understanding an unfamiliar repository
- Summarizing a source file or folder
- Reviewing APIs or data shapes
- Preparing compact context for another AI tool
- Extracting Markdown headings, tables, or code blocks

## Basic usage examples

```sh
showsignature --version # check version
showsignature --help # Show available options
showsignature src/01-main.ts # Inspect one file
showsignature ./src # Inspect a folder
showsignature . # Inspect the current directory
cat src/01-main.ts | showsignature - --lang-only ts # Read TypeScript from stdin

showsignature . --show-only imports # Show imports only
showsignature ./src --show-only signatures,imports # Show code structure and imports
showsignature ./src --show-only interfaces,types # Show data shapes
showsignature src/01-main.ts --show-only variables # Show variables

showsignature README.md --show-only md:headings # Extract Markdown headings
showsignature README.md --show-only md:codeblocks # Extract Markdown code blocks
showsignature . --show-only md:tables # Extract Markdown tables

showsignature . --lang-only py # Process Python files only
showsignature . --max-depth 2 # Limit recursive scan depth
showsignature src --show-only signatures,imports --output structure.md # Save compact context
```

## Pipeline usage

`showsignature` writes to stdout by default, so it works well with tools like `rg`, `grep`, `fzf`, `less`, `head`, `tee`, and shell redirects.

```sh
showsignature src | rg "function|class" # Search extracted structure with ripgrep
showsignature src --show-only imports | rg "node:" # Find matching imports
showsignature src --show-only signatures | rg "async" # Find async functions or methods
showsignature src --show-only comments,signatures | rg -C 2 "ExtractKind" # Search comments/signatures with nearby context
showsignature src --show-only signatures,imports | less # Page through large output
showsignature src --show-only signatures | head -50 # Preview the first 50 lines
showsignature src --show-only signatures,imports | tee structure.md # View and save output
```

## Other options

```sh
showsignature [options]

Options:
  --include-tests           include files under test directories during discovery (default: false)
  --no-line-number         hide source line number prefixes for extracted entries
  -h, --help                display help for command
```
