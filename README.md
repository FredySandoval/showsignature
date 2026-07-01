<p align="center">
  <picture>
    <img  alt="ShowSignature-header-2" src="https://github.com/user-attachments/assets/311e83f7-b2db-4e11-afb7-9d8f6e2e8d25" >
  </picture>
</p>


# showsignature

A CLI that extracts the useful structure from source files: signatures, imports, types, variables, comments, and Markdown sections.

Use it to understand a codebase quickly, review files, or create compact context for AI assistants.

## Install

### 1. Install locally or globally from the NPM registry
`showsignature` is executed as a bash tool, so must be available locally or globally.

```bash
#npm|pnpm|yarn
# global install
npm install -g showsignature

# local install
npm install showsignature
```

## 2. Set your AI Agent

<details id="claude-code">
<summary>
<h2>Claude Code</h2>
</summary>
  
```bash
/plugin marketplace add FredySandoval/showsignature
```

```bash
/plugin install showsignature@showsignature
```
(You have to send two separate prompts for the install to work)

The desktop app has no /plugin command. Install it from the UI instead: Customize, the + by personal plugins, Create plugin and add marketplace, Add from repository, then enter the repo URL.
</details>


<details id="codex">
<summary>
<h2>Codex</h2>
</summary>

```sh
codex plugin marketplace add FredySandoval/showsignature
codex
``` 
Open /plugins, select the `showsignature` marketplace, and install `showsignature`. Then open /hooks, review and trust its lifecycle hook, and start a new thread.

This same install also covers the Codex desktop app: restart the app after installing and it picks up the plugin.

</details>


<details id="agent-skill">
<summary>
<h2>Agent Skill</h2>
</summary>
  
```bash
# All agents
npx skills add https://github.com/FredySandoval/showsignature --skill showsignature
```
</details>

<details id="pi-agent-extension">
<summary>
<h2>Pi agent extension</h2>
</summary>
  
```bash
# option 1
pi install npm:showsignature
# option 2
pi install git:github.com/FredySandoval/showsignature
# option 3
pi install https://github.com/FredySandoval/showsignature
```
</details>

<details id="from-source">
<summary>
<h2>From source code</h2>
</summary>
  
```bash
git clone https://github.com/FredySandoval/showsignature.git
cd showsignature
pnpm install
pnpm build
pnpm link --global
```
</details>

<p align="center">
  <img width="1723" height="623" alt="example-showsignature-1" src="https://github.com/user-attachments/assets/36b636af-c3b3-485a-852d-fd0f3cce6321" />
</p>

## Why?

Large files are noisy. `showsignature` gives you the shape of a project before you read the implementation:

- What functions/classes exist?
- What does each file import/export?
- What types and interfaces define the data?
- What headings/tables/code blocks exist in Markdown?

## Usage

```sh
showsignature [OPTION]... [FILE]...
```

Inspect [FILE] operands—files or directory paths—using the current directory by default.

| OPTION                | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `--lang-only <lang>`  | Force language, required when using `-` to read stdin. |
| `--show-only <items>` | Choose extractors.                                     |
| `--include-tests`     | Include test files in folder scans.                    |
| `--max-depth <n>`     | Limit folder scan depth.                               |

## Extractors

Code files:

| Mode         | Shows                                                               |
| ------------ | ------------------------------------------------------------------- |
| `signatures` | Functions, classes, methods, constructors.                          |
| `imports`    | Import statements/declarations.                                     |
| `exports`    | JS/TS exports, exported Go declarations, and Python public exports. |
| `interfaces` | TypeScript/Go interfaces.                                           |
| `types`      | Type aliases/declarations.                                          |
| `variables`  | Variables/constants.                                                |
| `comments`   | Code comments.                                                      |

Markdown files:

| Mode            | Shows               |
| --------------- | ------------------- |
| `md:headings`   | Headings.           |
| `md:tables`     | Tables.             |
| `md:codeblocks` | Fenced code blocks. |

## Supported files

| Language   | Extensions            |
| ---------- | --------------------- |
| TypeScript | `.ts`, `.mts`, `.cts` |
| JavaScript | `.js`, `.mjs`, `.cjs` |
| TSX/JSX    | `.tsx`, `.jsx`        |
| Svelte     | `.svelte`             |
| Go         | `.go`                 |
| Python     | `.py`                 |
| Rust       | `.rs`                 |
| Lua        | `.lua`                |
| Markdown   | `.md`                 |

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

showsignature --show-only md:headings                       # Extract Markdown code blocks
showsignature --show-only md:tables,md:codeblocks           # Extract Markdown tables

# useful when doing migrations from one language to other
showsignature --lang-only py                                # Process Python files only
showsignature --lang-only go --show-only imports,exports    # Show Go imports and exported declarations
showsignature --lang-only py --show-only types,comments     # Show Python imports and public exports
showsignature --max-depth 4                                 # Limit recursive scan depth
```

Combine modes with commas:

```bash
showsignature src --show-only signatures,imports,comments
```

## Output

`showsignature` prints compact text output. Use shell redirection to save output to a file:

```bash
showsignature src --show-only signatures > structure.txt
```

## Pipeline usage

`showsignature` writes to stdout by default, so it works well with tools like `rg`, `grep`, `fzf`, `less`, `head`, `tee`, and shell redirects.

```sh
showsignature src --show-only imports | rg "node"                         # Find matching imports
showsignature src --show-only signatures | rg "async"                     # Find async functions or methods
showsignature src --show-only comments,signatures | rg -C 2 "ExtractKind" # Search comments/signatures with nearby context
showsignature src --show-only signatures,imports | bat -l js              # Page through large output
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format
```

## License

ISC. See [LICENSE](LICENSE).
