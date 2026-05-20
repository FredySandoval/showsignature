<p align="center">
  <img src="demo.png" alt="showsignature terminal demo" />
</p>

# showsignature

A CLI that extracts the useful structure from source files: signatures, imports, types, variables, comments, and Markdown sections.

Use it to understand a codebase quickly, review files, or create compact context for AI assistants.

## Quickstart installation

```bash
# Add as skill for all agents
npx skills add https://github.com/FredySandoval/showsignature --skill showsignature
```

```bash
# use without installing it
npx showsignature --help
```

```bash
# global install
npm install -g showsignature
```

Pi package install from npm:

```bash
pi install npm:showsignature
```

Pi package install from GitHub:

```bash
pi install git:github.com/FredySandoval/showsignature
pi install https://github.com/FredySandoval/showsignature
```

From source:

```bash
git clone https://github.com/FredySandoval/showsignature.git
cd showsignature
pnpm install
pnpm build
pnpm add -g .
```

Requires Node.js 18+.

## Why?

Large files are noisy. `showsignature` gives you the shape of a project before you read the implementation:

- What functions/classes exist?
- What does each file import/export?
- What types and interfaces define the data?
- What headings/tables/code blocks exist in Markdown?

## Install

Global npm install:



## Usage

```bash
showsignature [--file <file> | --folder <folder> | --stdin] [options]
```

| Option | Description |
| --- | --- |
| `--file <file>` | Inspect one file. |
| `--folder <folder>` | Inspect a folder. |
| `--stdin` | Read source from stdin. |
| `--lang-only <lang>` | Force language, useful with stdin. |
| `--show-only <items>` | Choose extractors. |
| `--output <file>` | Save output. |
| `--include-tests` | Include test files in folder scans. |
| `--max-depth <n>` | Limit folder scan depth. |
| `--ignore-folder <name>` | Skip folders. |

## Examples

```bash
showsignature --file src/01-main.ts
showsignature --folder src
showsignature --folder src --show-only signatures,imports
showsignature --folder src --show-only interfaces,types
showsignature --folder src --show-only signatures,imports --output structure.md
cat src/01-main.ts | showsignature --stdin --lang-only ts
showsignature --file README.md --show-only md:headings
```

## Extractors

Code files:

| Mode | Shows |
| --- | --- |
| `signatures` | Functions, classes, methods, constructors. |
| `imports` | Import statements. |
| `interfaces` | TypeScript/Go interfaces. |
| `types` | Type aliases/declarations. |
| `variables` | Variables/constants. |
| `comments` | Code comments. |

Markdown files:

| Mode | Shows |
| --- | --- |
| `md:headings` | Headings. |
| `md:tables` | Tables. |
| `md:codeblocks` | Fenced code blocks. |
| `md:all` | Full document. |

Combine modes with commas:

```bash
showsignature --folder src --show-only signatures,imports,comments
```

## Supported files

| Language | Extensions |
| --- | --- |
| TypeScript | `.ts`, `.mts`, `.cts` |
| JavaScript | `.js`, `.mjs`, `.cjs` |
| Go | `.go` |
| Python | `.py` |
| Markdown | `.md` |

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format
```

## Troubleshooting

- Command not found? Use `node dist/02-cli.js --help` for local builds, or check your global npm bin path.
- Folder scan empty? Supported files only are scanned; `.gitignore` is respected; tests are skipped unless `--include-tests` is set.
- Stdin language unknown? Add `--lang-only ts`, `--lang-only py`, `--lang-only go`, or similar.

## License

ISC. See [LICENSE](LICENSE).
