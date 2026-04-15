To quickly explore a project use the bash command `showsignature`
```sh
$ showsignature --help
Usage: showsignature [options]

Options:
  --show-only <options>  comma-separated extract kinds to include
                         code: signatures, interfaces, types, variables, comments, imports
                         markdown: md:all, md:caveman, md:codeblocks, md:headings, md:tables
                         default: signatures
  --file <file>          process a single file
  --folder <folder>      process files from a folder (.gitignore files are respected)
  --stdin                read source from standard input (default: false)
  --output <name>        write formatted output to a file
  --include-tests        include files under test directories during discovery (default: false)
  -n, --line-number      prefix each extracted entry with its source line number (default: false)
  -h, --help             display help for command
```
