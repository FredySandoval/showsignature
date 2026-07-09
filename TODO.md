# TODO — findings from `--symbol-summary` verification vs docs/symbol-summary.md (2026-07-08)

Verified against the local build (`node dist/02-cli.js`). Build/typecheck/tests all pass;
all golden fixtures match. The items below are the discrepancies to fix, ranked.

## 1. ✅ COMPLETED (2026-07-08) — HIGH — `--symbol-summary` bypassed secrets redaction

Fixed: entry lines are now redacted BEFORE tokenization (redaction patterns need
the assignment context that tokenizing strips). `buildSymbolSummaryLines` takes a
`redactLine` hook; the renderer counts redactions and discloses them in the
trailing `note:`. Regression test added (secret built by concatenation).

Doc says: "Redaction applies. Secret-looking values are redacted as elsewhere in `map`
(disclosed in the `note:`)."

Actual: symbol-summary emits literal secret values with no redaction and no `note:`.

```sh
# create the test fixture (fake secret-looking values; the AWS-style key is
# concatenated so this repo never contains a contiguous secret-shaped token):
printf 'export const AWS_SECRET = "%s%s";\nexport const dbPassword = "hunter2secretvalue123456";\n' 'AKIA' 'IOSFODNN7EXAMPLE1234' > /tmp/secrets.ts

# normal map redacts:
node dist/02-cli.js map --only variables,exports /tmp/secrets.ts
#   1 export const AWS_SECRET = [redacted];
#   note: 4 secrets redacted; pass --no-redact for literal bytes

# symbol-summary leaks:
node dist/02-cli.js map --symbol-summary --only variables,exports /tmp/secrets.ts
#   variables:/tmp/secrets.ts: AWS_SECRET|AKIA...1234|dbPassword|hunter2secretvalue123456   (leaked verbatim)
```

Fix: run the redaction pass over symbol-summary payload tokens (likely in
`renderSymbolSummaryOutput` / `buildSymbolSummaryLines` path in `src/01-main.ts` /
`src/03-symbol-summary.ts`) and disclose in the trailing `note:`. Add a regression test.

Note: in that regression test, construct the secret string by concatenation
(e.g. `"AKIA" + "IOSFODNN7EXAMPLE1234"`) so the test file never contains a
contiguous secret-shaped token and doesn't trip GitHub push protection.

## 2. ✅ COMPLETED (2026-07-08) — MEDIUM — JSON keys were split into fragments

Fixed: json:shape sections tokenize with a shape-aware pattern that keeps keys
whole and regex-escapes metacharacters (`pool.max` → `pool\.max`, `a|b` → `a\|b`).
Remaining known limit (documented in CAVEATS): keys containing whitespace still
split — the shape rendering is space-delimited and cannot represent them.

(Update 2026-07-08: the output format changed from `|`-joined to space-separated
tokens, so the `|`-ambiguity half of this finding is resolved. The splitting half
remains.)

Doc says: "Verbatim identifiers. No splitting."

Actual: tokens are identifier runs, so JSON key `"c.d"` is emitted as two tokens
`c d`, and `"a|b"` as `a b`. `$` is handled correctly (`e\$f`).

```sh
printf '{"a|b": 1, "c.d": {"e$f": 2}}' > /tmp/weird.json
node dist/02-cli.js map --symbol-summary /tmp/weird.json
#   json:shape:/tmp/weird.json a b c d e\$f
```

Fix (pick one, then make doc and code agree):
- tokenize JSON keys whole and regex-escape metacharacters, or
- amend the doc's TOKEN RULES to state tokens are identifier runs and
  non-identifier characters split them.
Dotted config keys are common, so keeping keys whole is more useful to the tool's
grep-oriented consumers.

## 3. ✅ COMPLETED (2026-07-08) — LOW — `self` not stopworded in TS/JS

Fixed both ways: `self` added to `TS_FAMILY_STOPWORDS` (it is the global scope in
browsers/workers), and the doc's TOKEN RULES now states the tables are per-language.

Doc says stopwords remove "structural noise (`self`, `this`)" and common JS globals.
Actual: `this` is dropped but `self` survives for TS/JS — `TS_FAMILY_STOPWORDS` in
`src/03-symbol-summary.ts` omits it (it's only in the Python/Rust/Lua tables), even
though `self` is a JS global.

Fix: either add `self` to `TS_FAMILY_STOPWORDS`, or soften the doc's `(self, this)`
example to say the tables are per-language.

## 4. ✅ COMPLETED (2026-07-08) — COSMETIC — `note:` printed twice when streams merged

Fixed: the stderr copy of the trailer note is now emitted only when stdout is NOT
a TTY and stderr IS one (a human watching a redirected command). `cmd 2>&1 | ...`
no longer duplicates notes; tests updated to assert no stderr copy in captures.

Notes are emitted to both stdout and stderr (tool-wide, not symbol-summary specific),
so an interactive terminal shows each note duplicated. If intentional (note survives
piping), document it; otherwise suppress the stderr copy when stdout is a TTY.

---

# Round 2 findings (2026-07-08 re-verification)

Re-verified against the local build. Build/typecheck/tests pass (280 tests);
all golden fixtures match; the output contract held for 1,763 real-identifier
tokens (0 rg misses). New discrepancies below, ranked.

## 5. HIGH — json:shape truncation marker `...` leaks as a fake token; truncated keys silently missing

Doc's OUTPUT CONTRACT: "Every token exists verbatim in the corresponding source
file." For JSON objects with more than ~20 keys (JSON_SHAPE_MAX_OBJECT_KEYS) or
beyond max depth, the shape renderer's `...` summary is tokenized and emitted as
`\.\.\.` — a token that does not exist in the file. Worse: the keys past the cap
are absent from the vocabulary with no `note:` disclosing truncation, and `--all`
does not restore them. Reproduces on the repo's own `package.json`.

```sh
node -e 'const o={};for(let i=0;i<40;i++)o["key"+i]=i;require("fs").writeFileSync("/tmp/wide.json",JSON.stringify(o))'
node dist/02-cli.js map --symbol-summary /tmp/wide.json
#   json:shape:/tmp/wide.json key0 key1 ... key26 \.\.\.     (key27–key39 missing)
grep -c '\.\.\.' /tmp/wide.json   # 0 — token not in file
```

Fix: in the symbol-summary path, drop the truncation marker from tokens, and
either emit ALL keys regardless of the shape-render cap (vocabulary is cheap)
or add a `note:` disclosing that N keys were truncated. Update CAVEATS either way.

## 6. MEDIUM — unhandled EPIPE crash when stdout closes early

`map ... | head -2` crashes with a Node stack trace (`Error: write EPIPE` at
`emitTrailerNote`, dist/01-main.js:501). Piping map output is an explicitly
encouraged workflow. Fix: handle EPIPE on stdout/stderr writes (exit 0 quietly).

```sh
node dist/02-cli.js map /tmp/wide.json | head -2   # stack trace
```

## 7. LOW — token order for json:shape does not mirror source order (doc wrong)

TOKEN RULES promise "First-occurrence order per line, mirroring source order."
JSON tokens follow the shape rendering, which sorts keys lexicographically
(`key0 key1 key10 ... key2 key20`; a first-in-source `pool.max` lands last).
Fix: amend the doc — for json:shape, order mirrors the (sorted) shape rendering.

## 8. LOW — empty directory scan: empty output, exit 0, no `note:`

A scan of a directory containing no supported files prints nothing (both plain
`map` and `--symbol-summary`), unlike every other empty-output case which gets
an explanatory note. Fix: emit e.g. `note: no supported files found in <dir>`.

```sh
mkdir -p /tmp/emptydir && node dist/02-cli.js map --symbol-summary /tmp/emptydir; echo $?   # silent, 0
```

## 9. COSMETIC — inflated redaction count in `note:`

40 files of `export const uniqueToken_N_M = <number>;` yield
`note: 8000 secrets redacted` — every assignment whose name matches
SECRET_NAME_PATTERN is counted even when the value is a small integer literal.
Tokens are unaffected; the note is just alarming noise. Fix: don't count (or
don't flag) values that can't plausibly be secrets, or word the note per-file.
