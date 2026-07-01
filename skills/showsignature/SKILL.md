---
name: showsignature
description: >
  Fast structural and implementation-oriented overview of source files, markdown, and JSON.
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

  Supported extensions: .cjs, .cts, .go, .js, .json, .jsx, .lua, .md, .mjs, .mts, .py, .rs, .svelte, .ts, .tsx
license: ISC
compatibility: Requires Node.js. Written in TypeScript and built to JavaScript; no native binary is bundled.
metadata:
  author: FredySandoval
  source_repository: https://github.com/FredySandoval/showsignature
  npm_package: showsignature
allowed-tools: Bash(showsignature:*)
---

# showsignature skill guide

Use this skill to inspect code, Markdown, or JSON structure without implementation noise.

`showsignature` extracts functions, classes, methods, imports, types, interfaces, variables, comments, Markdown structure, and JSON shape.

Security note: secret-like values are redacted by default.

## Use when

- Understanding an unfamiliar repository
- Summarizing a source file or folder
- Reviewing APIs or data shapes
- Preparing compact context for another AI tool
- Extracting Markdown headings, tables, code blocks, or JSON shape

## Basic usage examples

`showsignature [OPTION]... [FILE]...`

```sh
showsignature                                               # default: --show-only signatures ./
showsignature ./src                                         # Inspect a folder
showsignature src/01-main.ts                                # Inspect one file

showsignature src/main.ts README.md tests/fixtures          # [FILE] can be one or more files/directories
showsignature --show-only imports,exports                   # Show exports only
showsignature --show-only signatures,imports,exports ./src  # Show code structure and imports
showsignature --show-only interfaces,types ./folder         # Show data shapes
showsignature --show-only variables,comments src/main.ts    # Show variables

showsignature --show-only md:headings                       # Extract Markdown headings
showsignature --show-only md:tables,md:codeblocks           # Extract Markdown tables
showsignature --show-only json:shape config.json            # Extract JSON shape

# useful when doing migrations from one language to other
showsignature --lang-only py                                # Process Python files only
showsignature --lang-only go --show-only imports,exports    # Show Go imports and exported declarations
showsignature --lang-only py --show-only types,comments     # Show Python imports and public exports
showsignature --max-depth 4                                 # Limit recursive scan depth
```

## Other options

```sh
Options:
  --include-tests          include files under test directories during discovery (default: false)
```
