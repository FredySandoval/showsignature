To quickly explore a project use the bash command `showsignature`

```sh
$ showsignature --help
Usage: showsignature [options]

Options:
  -V, --version             output the version number
  --lang-only <lang>        only process files for the provided language
                            (optional) inferred from file extension if not provided
                            supported extensions: .cjs, .cts, .js, .md, .mjs, .mts, .py, .ts
  --show-only <options>     comma-separated extract kinds to include
                            code: signatures, interfaces, types, variables, comments, imports
                            markdown: md:all, md:codeblocks, md:headings, md:tables (legacy alias: md -> md:all)
                            default: signatures --line-number
  --file <file>             process a single file
  --folder <folder>         process files from a folder (.gitignore files are respected)
  --stdin                   read source from standard input (default: false)
  --output <name>           write formatted output to a file
  --max-depth <number>      maximum folder discovery depth for recursive scans
  --include-tests           include files under test directories during discovery (default: false)
  --ignore-folder <folder>  ignore a folder path or folder name during recursive discovery (repeatable) (default: [])
  -n, --line-number         prefix each extracted entry with its source line number (default: true)
  -h, --help                display help for command
```

```sh
showsignature --file src/utils/parser.ts
showsignature --folder ./src
cat src/index.ts | showsignature --stdin --lang-only ts
showsignature --folder . --show-only imports
showsignature --folder ./src --show-only interfaces,types
showsignature --file src/config.ts --show-only variables
showsignature --folder ./src --show-only signatures,interfaces,types,variables,comments,imports
showsignature --folder ./docs --show-only md:headings
showsignature --file README.md --show-only md:codeblocks
showsignature --folder ./docs --show-only md:tables
showsignature --folder . --lang-only py
showsignature --folder . --max-depth 2
showsignature --folder ./src --include-tests
```
