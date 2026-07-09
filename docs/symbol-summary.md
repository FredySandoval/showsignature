# SHOWSIGNATURE-SYMBOL-SUMMARY(1)

## NAME

**showsignature map --symbol-summary** — emit the identifier vocabulary of a
codebase as ripgrep-ready alternation patterns

## SYNOPSIS

```
showsignature map --symbol-summary [OPTION]... [PATH]...
```

## DESCRIPTION

In an unfamiliar repository, the first search is usually a blind one: names
are guessed from generic conventions ("it's probably called `DATABASE_URL`")
rather than taken from the code itself. The repository may use its own naming
conventions, a different stack, or names its documentation no longer reflects.

**--symbol-summary** closes this gap. It reuses `map`'s existing extraction,
but instead of formatted structural output it emits **the vocabulary that
literally exists in the code** — a compendium of real identifiers to start
searching from. Scan the output, spot the suspicious name, then `rg` or
`showsignature map` *that* — no more guessing.

The flag is deliberately verbose: a primary consumer is LLM agents, and
`--symbol-summary` is self-describing at the call site.

The flag exists on `map` only. It is not available on `read`; use
`read --offset --outline` to orient around a location.

## OUTPUT FORMAT

One line per (extractor, file) pair:

```
<extractor>:<relative/path/to/file>: token1|token2|token3
```

Example:

```
$ showsignature map --symbol-summary ./src
exports:src/db/pool.ts: PgPool|createPool|POOL_MAX|acquireConn
imports:src/db/migrate.ts: runMigrations|MigrationLock|schemaVersion|LogErrMig
exports:src/db/migrate.ts: runMigrations|MigrationLock
json:shape:src/config/default.json: db|host|port|poolMax|migrationTable
```

- The extractor prefix says *why* a token is listed: an export is API
  surface, an import is dependency vocabulary, a variable is config
  vocabulary.
- A file may produce multiple lines — one per extractor that yielded
  tokens for it. They are never merged.
- Ordering is stable: file order first (same traversal order as normal
  `map`), extractor order second — output is diffable and deterministic
  across runs on an unchanged tree.
- Lines whose every token was stopworded are omitted.
- **No line numbers appear, ever**, regardless of `--no-line-number`.
  Regular `map` is the discovery tool for locations.

## THE OUTPUT CONTRACT

> The token payload of every line is a valid ripgrep pattern in default
> (regex) mode.

Every token exists verbatim in the corresponding source file (modulo
escaping). Regex metacharacters occurring in identifiers are escaped rather
than dropped — e.g. Svelte/PHP-style `$name` is emitted as `\$name`. `|` is
the alternation separator, so a literal `|` inside a token would likewise be
escaped. The payload is always safe to paste:

```
rg "PgPool|createPool|POOL_MAX|acquireConn" src/db/pool.ts
```

## TOKEN RULES

- **Verbatim identifiers.** No splitting of compound identifiers:
  `getUserById` stays whole, `DATABASE_URL` stays whole. Splitting would
  break the output contract and produce noisy greps.
- **First-occurrence order** per line, mirroring source order, so related
  terms cluster naturally.
- **Dedup within a line only.** A token appears at most once per line but
  may appear on multiple lines — seeing `runMigrations` under both
  `exports:src/db/migrate.ts` and `imports:src/cli.ts` tells you who
  defines it and who uses it. Repetition across lines is information;
  repetition within a line is noise.
- **Stopwords are purely syntactic.** Language keywords (`function`,
  `def`, `fn`, `pub`, `local`, …), primitive/builtin type names (`string`,
  `int`, `bool`, `void`, common JS/TS globals and utility types like
  `Promise`, `Set`, `Record`, …), and structural noise (`self`, `this`)
  are removed. Nothing is filtered for perceived relevance — if it's a
  name someone chose, it is kept.

## EXTRACTOR SCOPE

Only extractors whose output is symbols — names that verifiably exist in
code or config — contribute:

| Included | Excluded |
| --- | --- |
| `signatures`, `imports`, `exports`, `interfaces`, `types`, `variables`, `json:shape` | `comments`, `md:headings`, `md:tables`, `md:codeblocks` |

Code and JSON config are ground truth; comments and Markdown are prose that
can reference names which no longer exist. JSON is deliberately included:
config keys are exactly the kind of token users grep for.

Explicitly requesting an excluded extractor is an **error**, not a silent
drop:

```
$ showsignature map --symbol-summary --only comments ./src
[error] --symbol-summary only applies to symbol extractors (names that
exist in code or config); comments is a prose extractor and cannot
contribute. Remove it from --only.
```

When `--only` is not given, the default extractor set applies with the
excluded extractors simply not contributing (Markdown files therefore
produce no output in this mode).

## INTERACTION WITH OTHER OPTIONS

| Option | Behavior |
| --- | --- |
| `--only` | Composes naturally: `--only interfaces,types` yields domain vocabulary; `--only signatures` yields verb vocabulary. Errors on excluded extractors. |
| `--skip` / `--take` | Page over **output lines** (extractor×file entries), not individual tokens. |
| `--no-line-number` | Redundant (no line numbers exist in this mode); accepted silently. |
| `--max-depth`, `--include-tests`, `--lang` | Unchanged. |
| `--all` | Lifts the output caps as usual. |

Output is capped at 2000 lines / 50 KB as in normal `map`. When paging or a
cap truncates output, the trailing `note:` names the **exact** resume
command — the skip count is handed over, never guessed:

```
note: showing summary lines 1-2 of 6 — rerun with --symbol-summary --skip 2 --take 2 src
```

## EXAMPLES

```sh
# Full vocabulary of a source tree
showsignature map --symbol-summary ./src

# Domain vocabulary only (data shapes)
showsignature map --symbol-summary --only interfaces,types ./src

# Dependency vocabulary only
showsignature map --symbol-summary --only imports ./src

# Page through a large tree, two lines at a time
showsignature map --symbol-summary --take 2 ./src

# Follow up on a discovered name
rg "LogErrMig" src/
showsignature map src/db/migrate.ts
```

## CAVEATS

- **Import specifiers are tokenized too.** A line like
  `import { x } from "./00-core-types.js"` contributes path fragments
  (`core`, `types`, `js`) alongside the imported names. They satisfy the
  contract (they exist verbatim and match with `rg`), but they are noisier
  than chosen identifiers. Package names (`commander`) are valuable enough
  that string literals are not skipped wholesale.
- **Single-character tokens can appear** (e.g. a lone `s` from a template
  literal in a signature). They are verbatim and harmless, but rarely
  useful grep targets on their own.
- **Stopword tables are per-language and finite.** An unlisted builtin
  (e.g. a niche global type) may slip through as a token. This errs on the
  side of the feature's principle: keep chosen names, drop syntax.
- **Tokens are not scoped.** A parameter name and a top-level export look
  the same in the payload; the extractor prefix is the only context given.
- **Prose is invisible.** Comments and Markdown never contribute, by
  design — a name that exists only in documentation will not appear here.
  Use `map --only comments` or `map --only md:headings` for those.
- **Redaction applies.** Secret-looking values are redacted as elsewhere
  in `map` (disclosed in the `note:`); pass `--no-redact` for literal
  bytes.

## OUT OF SCOPE (v1)

- `read --symbol-summary`
- Identifier splitting (a possible future `--split-identifiers` opt-in)
- Comments / Markdown extractors (would need natural-language stopwords)
- Any semantic relevance filtering

## SEE ALSO

`showsignature map --help`, `showsignature read --help`, `rg(1)`, and the
"Symbol summary" section of the project README.
