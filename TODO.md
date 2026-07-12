# TODO — Pi extension review findings

## Tool findings (from experiments)

- [x] showsignature does not follow symlinks, and this is undocumented:
  `map <dir>` over symlinked files reports "no supported files found", and
  mapping a symlinked file directly resolves it, turning the `// path` header
  absolute. Found via the ../showsignature-testing playground (laguna-m.1
  runs, 2026-07-12). Decide: follow symlinks in folder scans, or document
  the behavior. (Playground switched to full copies to bypass this for now.)
  RESOLVED (2026-07-12): folder scans now follow symlinks
  (followSymbolicLinks:true + suppressErrors for broken/cyclic links, cycles
  bounded by scan depth); resolveSafeInputPath no longer realpaths, so `//
  path` headers keep the path as given; documented in the SKILL defaults
  bullet; tests in 04-file-discovery + 01-cli.
- [ ] Rust defaults feel thinner than TS/Python: `pub const`, `static`,
  `trait`, `struct`, `enum`, `type` are all absent from default `map` output
  (laguna-m.1 expected them). Candidates for docs or extractor changes.
- [ ] Long signatures are truncated with `…` with no `note:` explaining it
  (laguna-m.1 flagged the bare `...` on Rust fn signatures as surprising).
- [ ] Go defaults are thin like Rust: `type User struct` and `type Reader
  interface` are absent from default `map` output — only `import` + `func`
  appear (tencent/hy3 expected them, 2026-07-12). Same docs-or-extractor
  decision as the Rust finding above.

- [ ] `--only` is not a strict filter outside the TS family: with
  `--only imports,exports,interfaces,types`, TS/TSX output only the requested
  categories, but Go/Rust/Lua/Python leak unrequested entries (`const`,
  `func`/`def`/`function`, `class`, bare variable assignments like
  `Config = {...}`, `x = 2`). Found by tencent/hy3 on the map only run,
  verified directly (2026-07-12). Decide: strict per-language filtering, or
  document the language-dependent behavior.
- [ ] Rust `pub` items are duplicated under `--only`: `pub use crate::prelude::*`
  also emits `use crate::prelude::*` at the same line, `pub trait Named` also
  emits `trait Named`, `pub struct User` also emits `struct User`. Verified
  directly on tests/fixtures/rust/basic.rs (2026-07-12).

## Comprehension experiment — one flag per pi run

Mark each as `[x]` when tested, noting the model and whether the
instructions (src/00-instructions.ts) were optimized as a result.

SUBCOMMAND:
- [x] map (all 9 map flags tested across the 5 models, 2026-07-12)
- [x] read (all 6 read flags tested across the 5 models, 2026-07-12)

map
- [x] paths
    tested:
        nemotron-3-ultra
        laguna-m.1
        north-mini-code: tool call succeeded but never printed a literal
            prediction (weak instruction-following, no doc signal)
        gemma-4-31b-it: near-perfect prediction; only miss was expecting
            per-member line numbers on class methods
        hy3: best run; flagged class-member rendering as its one
            doc-attributable uncertainty
    optimized: 
        YES (MAP_DESCRIPTION: plain-text output format + defaults-first rewrite; SKILL description aligned). Both models still mispredicted defaults even with the correct sentence in context — remaining gap is model reasoning, not docs. Tool calls themselves succeeded first-try on both models.
        YES round 2 (2026-07-12): MAP_DESCRIPTION now says class/interface
        bodies render as indented member lines without line numbers — the
        one gap shared by gemma + hy3. Verified on hy3 rerun: it predicted
        the member rendering exactly; remaining misses were line-count
        arithmetic (model reasoning) plus the Go-defaults tool finding.
- [x] take
    tested (2026-07-12):
        nemotron-3-ultra: clean run; take:10 on one file, correct
            prediction, correctly reasoned no truncation occurred
        laguna-m.1: clean run; prediction matched docs exactly
        north-mini-code: tool call worked but again printed no literal
            prediction (same weak pattern as paths — no doc signal)
        gemma-4-31b-it: good prediction; still sketched line numbers on
            class members despite updated description (reasoning slip)
        hy3: best exercise — mapped folder with take:30, hit the real
            34-entry cap, note: matched docs verbatim; learned ordering
            is alphabetical by path; re-confirmed Go-defaults finding;
            wrongly guessed TS defaults include const/type/interface
            despite docs stating exclusion (model reasoning, not docs)
    optimized:
        NO — no doc-attributable gap; pagination + cap note behaved
        exactly as documented.
- [x] skip
    tested (2026-07-12):
        nemotron-3-ultra: tool worked; got tangled post-hoc because it
            forgot imports count as entries when reconstructing skip:2
        laguna-m.1: same miscount — claimed skip dropped "import + type
            alias" though type aliases aren't default entries
        north-mini-code: slightly better than prior flags (skip:1 on a
            folder, real comparison) but ran the tool before predicting
        gemma-4-31b-it: exact prediction — used the new "indented member
            lines" doc sentence to reason class+members = one entry
        hy3 (round 1): skip:5 over "."; invented "deduplication" and
            "non-uniform member expansion" because it counted interfaces
            as entries — tool was actually consistent (2 entries/file)
    optimized:
        YES — MAP_ARG_DOCS skip/take now define what an entry is (one
        line-numbered item; class+members = one entry; headers and
        member lines are not entries). Verified on hy3 rerun: correct
        entry inventory, skip:1 reasoned exactly, only misses were
        blank-line arithmetic (model reasoning, not docs).
- [x] only
    tested (2026-07-12): NOTE — prompt phrase "use showsignature map only"
    was ambiguous; first four models never exercised the flag. hy3 was run
    with the argument spelled "--only", which fixed it.
        nemotron-3-ultra: never used --only; mapped whole dir, mispredicted
            defaults (expected const/type/interface) — known reasoning gap
        laguna-m.1: never used --only; correctly concluded excluded
            categories require it — re-confirmed defaults finding
        north-mini-code: never used --only; paraphrased output instead of
            quoting (same weak pattern)
        gemma-4-31b-it: read "only" as "only use map"; defaults prediction
            near-perfect (correct format, members, exclusions)
        hy3 (as "--only"): best run — predicted strict inclusive filter;
            found the language-dependent leakage + saw rust duplicates
            (both logged under Tool findings, verified directly)
    optimized:
        NO doc change — gaps found are tool behavior (leaky filter,
        pub-item duplication), logged under Tool findings. hy3's only doc
        uncertainty (replace vs add semantics) is moot until the tool
        behavior itself is decided.
- [x] symbolSummary
    tested (2026-07-12, argument passed as "--symbol-summary"):
        nemotron-3-ultra: clean run; expected grouping by construct type
            and exports/types included — exposed the doc gap below
        laguna-m.1 (round 1): same gap — expected exports/types/variables
            in the summary of a bare call
        laguna-m.1 (rerun after fix): reasoned "defaults are signatures
            and imports" from the new sentence; format predicted exactly
        north-mini-code: run 1 hallucinated a React tutorial (discarded);
            run 2 produced thinking but no printed prediction — no signal
        gemma-4-31b-it: post-fix, predicted defaults-only correctly;
            missed the 'extractor:path ids' line format (param doc now
            shows it) and the import-specifier token
        hy3: post-fix, predicted defaults-only correctly; misses were
            params/members/base-classes emitted as identifiers, regex
            escaping of dotted specifiers (documented in SKILL but not
            param docs), variables/type aliases excluded (known
            reasoning gap)
    optimized:
        YES — symbolSummary param doc + SKILL section now state it
        summarizes only the ACTIVE extractors (defaults signatures,imports
        unless --only), the SKILL example no longer shows exports: from a
        bare call (it was factually wrong — verified against the tool),
        and the param doc shows the 'extractor:path id1 id2' line format.
        Verified on laguna + gemma + hy3 reruns.
- [x] lang
    tested (2026-07-12, argument passed as "--lang"):
        nemotron-3-ultra: clean; used --lang typescript (full names work);
            mispredicted defaults (known reasoning gap)
        laguna-m.1: clean; correctly reasoned defaults from docs, exact
            format prediction
        north-mini-code: tried lang "ts,go,lua,py,rs" (comma list); the
            CLI error is self-describing ("Supported languages: … full
            names and file extensions also work") so no doc change;
            summary again vague/no literal prediction
        gemma-4-31b-it: near-perfect; one-line-off on class line number;
            correctly applied members-without-line-numbers doc
        hy3: best run; only novel miss was expecting class property
            fields as member lines — verified: classes render methods
            only (even public/readonly fields omitted), interfaces do
            list properties
    optimized:
        YES — MAP_DESCRIPTION member-lines sentence now says classes
        render method signatures only (property fields omitted) while
        interfaces list their properties. --lang itself had no doc gap.
- [x] maxDepth
    tested (2026-07-12, argument passed as "--max-depth"):
        nemotron-3-ultra: misread the flag as symbol-nesting depth and
            expected a tree view, despite "Directory scan depth" in the
            docs (model reasoning); also known defaults gap
        laguna-m.1: correct folder-traversal understanding; only the
            usual defaults miss; self-corrected via --only probes
        north-mini-code: thinking only, no printed prediction (no signal)
        gemma-4-31b-it (round 1): expected interfaces in default output —
            caused by the new "interfaces list their properties" sentence
            from the lang round
        gemma-4-31b-it (rerun): near-perfect after clarification
        hy3: best run — predicted the bare-flag argument-missing error,
            ran corrected form, everything matched; noted case01/test*.ts
            were NOT skipped as test files (probe during includeTests)
    optimized:
        YES — member-lines sentence now states interfaces are NOT in
        default output and render members only when selected via 'only'
        (fixing a regression my own lang-round wording introduced).
        Verified on gemma rerun. --max-depth itself had no doc gap.
- [x] includeTests
    tested (2026-07-12, argument passed as "--include-tests"):
        NOTE — the playground has no files matching the tool's real test
        patterns (test1.ts is not one), so the flag was behaviorally a
        no-op in every run; verified default vs --include-tests output is
        identical over the playground.
        nemotron-3-ultra: predicted JSON output despite "plain text
            (never JSON)" in docs (model reasoning); rest sloppy
        laguna-m.1: clean; usual defaults miss, self-explained
        north-mini-code: first run with a real printed comparison;
            nothing new
        gemma-4-31b-it: flaked once (empty stream), retry near-perfect
        hy3: structural rules all predicted correctly (incl. the new
            property-fields-omitted sentence); wrongly asserted that
            case01/test*.ts appeared BECAUSE of the flag — exposed that
            test-file detection rules were undocumented
    optimized:
        YES — includeTests param doc + SKILL defaults bullet now spell
        out the detection rules (test/tests/__tests__ dirs; *.test.* /
        *_test.* / *-test.* / spec names; test1.ts is NOT a test file),
        matching isTestFile() in src/01-main.ts.
- [x] noLineNumber
    tested (2026-07-12, argument passed as "--no-line-number"):
        nemotron-3-ultra: flag applied correctly; only miss the known
            defaults gap
        laguna-m.1: correct no-line-number behavior; expected types/
            interfaces (quoted the exclusion doc only post-hoc)
        north-mini-code: its best run — predicted output matched actual
            verbatim
        gemma-4-31b-it: exact prediction, zero differences
        hy3: near-perfect; misses were Rust/Go struct-not-a-class
            (re-confirms the Rust/Go defaults tool finding), 'mod' being
            import-like, and the ' ...' body ellipsis
    optimized:
        NO — no doc-attributable gap; the flag itself was predicted
        correctly by all models that printed a prediction.

read
- [x] file
    tested (2026-07-12, argument passed as "<FILE>"; "read file" was too
    ambiguous — first runs never invoked read):
        nemotron-3-ultra: two flaky runs (drifted off-task, then stream
            died) — no signal, moved on per protocol
        laguna-m.1 (round 1, as "file"): explored with map instead of
            read; expected read to return a signature map — exposed that
            READ_DESCRIPTION never described the output format
        laguna-m.1 (rerun after fix): quoted the new whole-file sentence
            verbatim to explain the behavior; still guessed map-like
            output pre-run (reasoning)
        north-mini-code: correctly anticipated <content> tags post-fix;
            fabricated an outline block on a whole-file read (harmless)
        gemma-4-31b-it: prediction was exactly right (content window +
            before/after outlines) but it MISREPORTED the actual output
            as a JSON object — verified directly that the real output
            matches its prediction; hallucinated comparison, not a bug
        hy3: perfect — predicted the single <content lines="1-42 of 42">
            block with no outline blocks, matched exactly
    optimized:
        YES — READ_DESCRIPTION now documents the output format: <content>
        block with RAW source (literal read, not a signature map),
        <outline region="before|after"> blocks, and the no-flags
        whole-file case with outlines omitted. Verified on laguna/hy3.
- [x] offset
    tested (2026-07-12, argument passed as "--offset"):
        nemotron-3-ultra: flag worked; still read `outline` as "extract
            signatures instead of content" despite the new literal-read
            sentence (model reasoning)
        laguna-m.1: good exploration; initially expected a before-outline
            for the imports, then discovered outlines cover signatures
            outside the window; miscounted file length
        north-mini-code: correctly predicted tags and explained the
            omitted-outline note — its most accurate run
        gemma-4-31b-it: content window predicted exactly; missed that the
            default read outline is signatures ONLY (expected the import
            in a before-outline) — doc gap, fixed
        hy3 (round 1): same before-outline gap + noted class members are
            not expanded in outlines; surprised by the outline note=
            attribute and the continuation note
        hy3 (rerun after fix): output matched its prediction
            character-for-character
    optimized:
        YES — READ_DESCRIPTION now states the outline defaults to the
        signatures extractor only (imports need outline:'imports,…'),
        empty regions are omitted, and class entries are single lines
        (members not expanded, unlike map). Verified on hy3 rerun.
- [x] limit
    tested (2026-07-12, argument passed as "--limit"):
        nemotron-3-ultra: good multi-scenario probing; only miss was
            expecting outlines when limit >= file length — doc sentence
            generalized from "no offset/limit" to "window covers the
            whole file"
        laguna-m.1: clean; correctly applied the new single-line-class
            and signatures-only-outline sentences
        north-mini-code: clean, exact match, no differences
        gemma-4-31b-it: one flaky empty run, retry solid; guessed
            expanded class members first, then cited the new doc sentence
        hy3: content block predicted byte-for-byte; missed the
            single-line class rendering (sentence was in context —
            reasoning) and called the continuation note unexpected
    optimized:
        YES — whole-file sentence generalized to any window covering the
        file; READ_DESCRIPTION now says every partial window ends with a
        continuation 'note:' (two models called it unexpected).
- [x] lang
    tested (2026-07-12, argument passed as "--lang"; note the stdin
    use-case for read's lang was never exercised by any model — they all
    passed lang alongside a file where it's redundant):
        nemotron-3-ultra: predicted outlines on a whole-file read, then
            quoted the new whole-file sentence to explain (post-hoc)
        laguna-m.1: again drifted to map expecting signature extraction
            from read; correct conclusions after probing
        north-mini-code: no printed prediction (no signal)
        gemma-4-31b-it: structure predicted exactly pre-run via the new
            whole-file sentence; only miss was file length guess
        hy3: perfect — predicted the single content block, no outlines,
            byte-for-byte cat parity
    optimized:
        NO new change this round (the read file/offset/limit fixes
        already covered the gaps that surfaced here).
- [x] outline
    tested (2026-07-12, argument passed as "--outline"):
        nemotron-3-ultra: eventually understood the context-viewer model;
            noted Rust struct/enum/type absent from outlines (consistent
            with the Rust-defaults tool finding)
        laguna-m.1: good probing but its summary conflated map output
            with the read outline (claimed expanded class members —
            contradicted by direct verification)
        north-mini-code: hit the self-describing bare-flag error, then
            recovered via the tool param; shallow comparison
        gemma-4-31b-it: one flaky run; retry predicted the full
            before/content/after/note structure exactly and correctly
            reasoned imports vs signatures extractor scopes
        hy3: best run — predicted the valued-option pitfall (bare
            --outline eats the file path), everything else matched;
            surfaced the undocumented "← window opens inside this"
            outline annotation
    optimized:
        YES — READ_DESCRIPTION now mentions the "← window opens inside
        this" annotation on outline entries containing the window.
- [x] framing
    tested (2026-07-12, argument passed as "--framing"):
        nemotron-3-ultra: predicted framing:none + whole-file behavior
            exactly, citing the whole-file doc sentence
        laguna-m.1: hit the valued-option error, recovered, compared
            none vs default vs windowed correctly
        north-mini-code: clear none-vs-default comparison; adequate
        gemma-4-31b-it: exact prediction — none output identical to cat,
            zero differences
        hy3: best run — used --framing tags (discovered the default
            value's name), predicted the 3-part structure and the
            window-annotation; misses were signature-normalization of
            outline lines (';' not '{'), the note= attribute, and the
            trailing pagination note (all documented; reasoning)
    optimized:
        NO — remaining misses are model reasoning; framing:'none'
        behavior was predicted correctly by every model that printed a
        prediction.
