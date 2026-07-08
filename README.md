<p align="center">
  <picture>
    <img  alt="ShowSignature-header-2" src="https://github.com/user-attachments/assets/311e83f7-b2db-4e11-afb7-9d8f6e2e8d25" >
  </picture>
</p>


# showsignature

Languages:
- English
- [简体中文](README.zh-CN.md)
- [日本語](README.ja.md)
- [Español](README.es.md)
- [Русский](README.ru.md)
- [العربية](README.ar.md)

A CLI that extracts the useful structure from source files: signatures, imports, types, variables, comments, Markdown sections, and JSON shapes.

Use it to understand a codebase quickly, review files, or create compact context for AI assistants.


<p align="center">
  <img width="1723" height="623" alt="example-showsignature-1" src="https://github.com/user-attachments/assets/36b636af-c3b3-485a-852d-fd0f3cce6321" />
</p>

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

## Why?

Large files are noisy. `showsignature` gives you the shape of a project before you read the implementation:

- What functions/classes exist?
- What does each file import/export?
- What types and interfaces define the data?
- What headings/tables/code blocks exist in Markdown?
- What shape does a JSON file have?

## Usage

```sh
showsignature map  [OPTION]... [PATH]...
showsignature read [OPTION]... <FILE>
```

Two commands:

- `map` — structural overview: signatures and other extracted entries. Inspect [PATH] operands—files or directory paths—using the current directory by default.
- `read` — literal windowed read of exactly one file, with an optional structural outline around the window for orientation.

Running `showsignature` with no command prints help and exits with code 1.

Options for `showsignature map`:

| OPTION                 | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `--only <extractors>`  | Comma-separated extractors to run (default: all applicable).                 |
| `--skip <n>`           | Skip the first N **entries** (default: 0).                                   |
| `--take <n>`           | Show at most N **entries**.                                                  |
| `--max-depth <n>`      | Folder scan depth (directory scans default to `2`).                          |
| `--include-tests`      | Include test files in folder scans.                                          |
| `--no-line-number`     | Hide source line-number prefixes.                                            |
| `--lang <l>`           | Only process files of this language; required when using `-` to read stdin.  |
| `--all`                | Lift all output caps (entry limit and the 2000-line / 50 KB cap).            |
| `--no-redact`          | Disable built-in secrets redaction.                                          |

Options for `showsignature read`:

| OPTION                   | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `--offset <line>`        | First **line** to show, 1-indexed (default: 1).                               |
| `--limit <n>`            | Max **lines** shown in the window.                                            |
| `--outline <extractors>` | Extractors used for the outline (default: `signatures`).                      |
| `--framing <mode>`       | How the content window is wrapped (default: `tags`). One of: `tags`, `none`.  |
| `--no-line-number`       | Hide line-number prefixes on outline lines (content never has them).          |
| `--lang <l>`             | Declare the file's language; required when reading stdin (`-`).               |
| `--all`                  | Lift the 2000-line / 50 KB window cap.                                        |
| `--no-redact`            | Disable secret redaction for literal bytes (redaction is disclosed otherwise).|

Remember the split: `map` works in **ENTRIES** (`--skip`/`--take`); `read` works in **LINES** (`--offset`/`--limit`).

Output is capped at 2000 lines / 50 KB by default; when a cap or the default scan depth
kicks in, the output ends with a single `note:` trailer (mirrored to stderr) naming the
exact flags or follow-up call to continue.

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

Markdown and JSON files:

| Mode            | Shows               |
| --------------- | ------------------- |
| `md:headings`   | Headings.           |
| `md:tables`     | Tables.             |
| `md:codeblocks` | Fenced code blocks. |
| `json:shape`    | JSON value shape.   |

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
| JSON       | `.json`               |

## Basic usage examples

`showsignature map [OPTION]... [PATH]...` / `showsignature read [OPTION]... <FILE>`

```sh
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

showsignature map --skip 40 --take 40 ./src                     # Page through a large entry listing
showsignature map --all ./src                                   # Lift the output caps
```

Read one file literally, with an optional structural outline around the window:

```sh
showsignature read src/01-main.ts                               # First lines of the file (up to the cap)
showsignature read --offset 200 --limit 100 src/01-main.ts      # Lines 200-299, outline around the window
showsignature read --outline imports,signatures src/01-main.ts  # Choose the outline extractors
showsignature read --framing none src/01-main.ts                # Plain read: no <content> tags, no outline
showsignature read --no-redact src/config.ts                    # Literal bytes, no secret redaction
cat snippet.py | showsignature read - --lang py                 # Stdin; --lang enables the outline
```

The outline lines carry real line numbers, so you can jump anywhere with
`showsignature read --offset <line> <file>`. The content between the `<content>` tags is
raw—no line-number prefixes—so it is safe to copy into exact-match edit tools.

Combine modes with commas:

```bash
showsignature map src --only signatures,imports,comments
```

## Output

`showsignature` prints compact text output. Use shell redirection to save output to a file:

```bash
showsignature map src --only signatures > structure.txt
```

## Pipeline usage

`showsignature` writes to stdout by default, so it works well with tools like `rg`, `grep`, `fzf`, `less`, `head`, `tee`, and shell redirects.

```sh
showsignature map src --only imports | rg "node"                         # Find matching imports
showsignature map src --only signatures | rg "async"                     # Find async functions or methods
showsignature map src --only comments,signatures | rg -C 2 "ExtractKind" # Search comments/signatures with nearby context
showsignature map src --only signatures,imports | bat -l js              # Page through large output
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
