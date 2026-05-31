
const DESCRIPTION = `Fastest path for understanding an unfamiliar codebase by extracting structural signatures from key source files.
--lang-only <lang>        only process files for the provided language
                          (optional) inferred from file extension if not provided
                          supported extensions: .cjs, .cts, .go, .js, .md, .mjs, .mts, .py, .ts
--show-only <options>     comma-separated extract kinds to include
                          code: signatures, interfaces, types, variables, comments, imports
                          markdown: md:all, md:codeblocks, md:headings, md:tables (legacy alias: md -> md:all)
                          default: signatures --line-number
--file <file>             process a single file
--folder <folder>         process files from a folder (.gitignore files are respected)
--max-depth <number>      maximum folder discovery depth for recursive scans

Example args:
--folder .          # Inspect the current directory
--file src/main.ts  # Inspect one file
--folder ./src      # Inspect a folder
--lang-only ts      # Read TypeScript

--show-only imports # Show code structure and imports
--show-only signatures,interfaces,types # Show data shapes

--file README.md --show-only md:headings,md:codeblocks # Extract Markdown headings

--max-depth 2 # Limit recursive scan depth
`;
