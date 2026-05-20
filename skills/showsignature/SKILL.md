---
name: showsignature
description: Fastest path for understanding an unfamiliar codebase by extracting compact structural signatures from key source files; use immediately before summarizing project architecture, entry points, modules, functions/classes, imports, or APIs.
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

## Use when

- Understanding an unfamiliar repository
- Summarizing a source file or folder
- Reviewing APIs or data shapes
- Preparing compact context for another AI tool
- Extracting Markdown headings, tables, or code blocks

## Basic usage examples

```sh
showsignature --help # Show available options
showsignature --file src/01-main.ts # Inspect one file
showsignature --folder ./src # Inspect a folder
showsignature --folder . # Inspect the current directory
cat src/01-main.ts | showsignature --stdin --lang-only ts # Read TypeScript from stdin

showsignature --folder . --show-only imports # Show imports only
showsignature --folder ./src --show-only signatures,imports # Show code structure and imports
showsignature --folder ./src --show-only interfaces,types # Show data shapes
showsignature --file src/01-main.ts --show-only variables # Show variables

showsignature --file README.md --show-only md:headings # Extract Markdown headings
showsignature --file README.md --show-only md:codeblocks # Extract Markdown code blocks
showsignature --folder . --show-only md:tables # Extract Markdown tables

showsignature --folder . --lang-only py # Process Python files only
showsignature --folder . --max-depth 2 # Limit recursive scan depth
showsignature --folder . --ignore-folder dist # Skip a noisy folder
showsignature --folder src --show-only signatures,imports --output structure.md # Save compact context
```

## Pipeline usage

`showsignature` writes to stdout by default, so it works well with tools like `rg`, `grep`, `fzf`, `less`, `head`, `tee`, and shell redirects.

```sh
showsignature --folder src | rg "function|class" # Search extracted structure with ripgrep
showsignature --folder src --show-only imports | rg "node:" # Find matching imports
showsignature --folder src --show-only signatures | rg "async" # Find async functions or methods
showsignature --folder src --show-only comments,signatures | rg -C 2 "ExtractKind" # Search comments/signatures with nearby context
showsignature --folder src --show-only signatures,imports | less # Page through large output
showsignature --folder src --show-only signatures | head -50 # Preview the first 50 lines
showsignature --folder src --show-only signatures,imports | tee structure.md # View and save output
```

## Other options

```sh
showsignature [options]

Options:
  --include-tests           include files under test directories during discovery (default: false)
  --ignore-folder <folder>  ignore a folder path or folder name during recursive discovery (repeatable) (default: [])
  -n, --line-number         prefix each extracted entry with its source line number (default: true)
  -h, --help                display help for command
```

