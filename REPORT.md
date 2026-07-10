The fuzz agent finished: 3 genuine bugs found, each with a minimal reproducer, a ## bug: entry in REPORT.md, and a failing regression test in tests/14-symbol-summary.test.ts. I verified:
bun test now shows 284 pass / 3 fail — exactly the 3 new deliberately-failing regression tests.

All three bugs are in the whole-specifier logic we added to src/03-symbol-summary.ts:

1. Trailing-slash specifier drops its token. import x from "./dir/" (or "./") — the basename after the last / is empty, so specifierToken returns nothing and the specifier contributes no
token, violating the doc's "contributes exactly one token" rule.
2. Specifier with a space leaks a fragment. "./has space.js" emits has space\.js as one "token" — but the output format is space-delimited, so consumers see a bogus standalone token has.
3. Dedup violation via quoted strings on export lines. Any quoted string on an imports/exports line gets specifier treatment; a value like "b c" becomes a space-containing pseudo-token
whose words are never added to the seen set, so the same words can repeat within a line (a b c b c).

It ran ~45 probes across all 12 supported extensions with an automated oracle (every token must be a valid regex that rg-matches its file, no within-line dupes), plus CLI edge cases.
Things that looked odd but are documented (bare ./.. tokens, Python/Rust unquoted module-path splitting, a couple of stopword slips in Go/Lua) went into a separate "observations" section
in REPORT.md.

the bugs are documented. Common thread: QUOTED_SPECIFIER_PATTERN treats any quoted string on an imports/exports line as a specifier, and specifierToken
doesn't guard empty/whitespace results. A likely fix shape: reject or fall back to normal tokenization when the candidate token is empty or contains whitespace.
fix all bugs and turn the tests green


## bug: trailing-slash relative import specifier drops its token

Reproducer:
```sh
printf 'import slash from "./dir/";\n' > /tmp/m1.ts
node dist/02-cli.js map --symbol-summary /tmp/m1.ts
```
Observed: `imports:/tmp/m1.ts slash` — the specifier contributes no token
(`specifierToken` in src/03-symbol-summary.ts slices after the last `/`,
yielding an empty string; same for `"./"`).
Expected per docs/symbol-summary.md TOKEN RULES: "The quoted module specifier
in an imports/exports entry contributes exactly one token, never path
fragments" — a token (e.g. basename `dir`) must be emitted.
Regression test (PASSING, bug fixed):
`tests/14-symbol-summary.test.ts` — "relative specifier ending in a slash
still contributes one token".
FIXED: `specifierToken` strips trailing slashes before taking the basename,
so `"./dir/"` emits `dir`; bare `"./"` degrades to the documented `\.` case.

## bug: import specifier containing a space emits a space-containing pseudo-token (fragment leakage)

Reproducer:
```sh
printf 'import sp from "./has space.js";\n' > /tmp/m2.ts
node dist/02-cli.js map --symbol-summary /tmp/m2.ts
```
Observed: `imports:/tmp/m2.ts sp has space\.js` — three space-separated
fields; a consumer parses the fragment `has` as a standalone token.
Expected per docs/symbol-summary.md OUTPUT FORMAT ("tokens separated by
single spaces") and TOKEN RULES ("contributes exactly one token, never path
fragments"): exactly two unambiguous tokens. (The JSON whitespace-splitting
caveat applies to JSON keys only, not import specifiers.)
Regression test (PASSING, bug fixed):
`tests/14-symbol-summary.test.ts` — "import specifier containing a space
contributes exactly one unambiguous token".
FIXED: `escapeSymbolToken` renders each whitespace char as `\s`, so the
specifier stays one space-free field (`has\sspace\.js`) that still
rg-matches the file verbatim.

## bug: quoted string values on exports lines break within-line dedup

Any quoted string on an imports/exports entry line gets specifier treatment
(QUOTED_SPECIFIER_PATTERN), even when it is not a module specifier. A string
value containing a space is emitted as one pseudo-token with an embedded
space, and its words are never marked "seen", so they re-appear.
Reproducer:
```sh
printf 'export const a = "b c";\nexport const b = 1;\nexport const c = 2;\n' > /tmp/m8.ts
node dist/02-cli.js map --symbol-summary --only exports /tmp/m8.ts
```
Observed: `exports:/tmp/m8.ts a b c b c` — fields `b` and `c` each appear
twice on one line.
Expected per docs/symbol-summary.md TOKEN RULES: "Dedup within a line only.
A token appears at most once per line".
Regression test (PASSING, bug fixed):
`tests/14-symbol-summary.test.ts` — "quoted strings containing spaces do not
break the space-delimited token format".
FIXED: the whitespace-to-`\s` escaping makes `"b c"` a single field
(`b\sc`), so `b` and `c` no longer leak as duplicate fields — the line reads
`a b\sc b c` with every field unique.

## observations (documented, not bugs)

- Bare `.` / `..` specifiers emit `\.` / `\.\.` — near-useless single/short
  metachar tokens, but verbatim and valid regex (single-character-token
  CAVEAT covers this).
- Non-specifier quoted strings inside imports/exports lines (e.g. a template
  literal `` `import fake from "./not-real.js"` `` in an export initializer)
  get specifier reduction and emit `not-real\.js`; tokens still exist
  verbatim, so the contract holds — noise rather than violation (root cause
  shared with the dedup bug above).
- Python `import os.path` and Rust `use std::collections::HashMap` split
  into segment tokens (`os path`, `std collections HashMap`); the whole-token
  rule is stated for the *quoted* module specifier, and these are unquoted.
- Go blank-import `_` and Lua `require` are emitted as tokens — finite
  per-language stopword tables CAVEAT ("an unlisted builtin may slip
  through").
- Markdown files produce no output by default; `--only comments` /
  `--only md:headings` error exactly as documented; `--no-line-number`
  accepted silently; `--skip`/`--take` edges (0, negative, huge) produce
  clear errors or a correct "skips all" note; the paging `note:` names the
  exact resume command; secrets redacted by default with disclosure,
  `--no-redact` restores literal bytes; json:shape depth/key-count
  truncation and the dropped `...` marker behave exactly per CAVEATS.
- Deep-relative/very long specifiers, query strings (`a\.js\?raw`), scoped
  packages, unicode/emoji/digit-only basenames, CRLF, BOM, empty files,
  one-line files, stdin (`--lang` required, path shown as `<stdin>.ts`),
  multiple targets, and paths with spaces (quoted in output) all conform.
