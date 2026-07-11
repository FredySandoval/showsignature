 showsignature_read
 <content lines="1-4 of 4">
 // go/basic.go
 14 type Reader interface {
        Read(p []byte) (n int, err error)
    }
 </content>



 showsignature_read
 <content lines="1-1 of 1">
 note: 0 entries for types in 1 file
 </content>



 showsignature_read
 <content lines="1-3 of 3">
 // rust/basic.rs
 10 pub const VERSION: &str = "1.0"
 11 static COUNT: usize = 3
 </content>

 showsignature_map
 signatures:case01/test1.ts UserAccount User id name email isActive deactivate getProfile createUser
 signatures:case01/test2.ts UserAccount User id name email isActive deactivate getProfile createUser
 signatures:case01/test3.ts UserAccount User id name email isActive deactivate getProfile createUser
 signatures:go/basic.go NewUser id User u Name
 imports:go/basic.go fmt alias example\.com/pkg _ net/http
 signatures:lua/basic.lua helper value greet name User new id run opts
 imports:lua/basic.lua json require http socket\.http

     ⚙ showsignature_map [includeTests=true, lang=python]
       showsignature map failed (1):
       [error] python not supported

     ⚙ showsignature_read [file=/home/fredy/Documents/MyProjects_development/04_showsignature/tests/fixtures/json/package.json, limit=10, offset=5, outline=interfaces]
       showsignature read failed (1):
       [error] Could not access path: /home/fredy/Documents/MyProjects_development/04_showsignature/tests/fixtures/json/package.json (ENOENT: no such file or directory, stat '/home/fredy/
       Documents/MyProjects_development/04_showsignature/tests/fixtures/json/package.json')


     ⚙ showsignature_map [includeTests=true, only=signatures, lang=typescript]
       showsignature map failed (1):
       [error] typescript not supported


     → Read src/00-core-types.js [limit=100, offset=1]
       File not found: /home/fredy/Documents/MyProjects_development/04_showsignature/src/00-core-types.js


     Thought: 6.7s

     I notice that when I run showsignature_map without includeTests flag, it doesn't find any supported files and says 51 test files excluded. This is the default behavior - it excludes
     test files. When I set includeTests=true, it finds all the test fixtures.

     Let me check the documentation to understand the difference between showsignature_map and showsignature_read better.

     From the tool descriptions:
     - showsignature_map: "Structural overview of code, Markdown, and JSON. Use INSTEAD of read/grep/cat for the FIRST look at any unfamiliar file or folder"
     - showsignature_read: "Windowed literal read of exactly one file, with a structural outline (real line numbers) around the window for orientation"

     So showsignature_map is meant to be used for the first look/overview, and it excludes test files by default. showsignature_read is for reading specific files with context.

     Let me do a comprehensive test to verify all features are working properly by checking the supported parameters and file types.

     ⚙ showsignature_map [includeTests=true, lang=ts]
     ⚙ showsignature_map [includeTests=true, maxDepth=1]
     ⚙ showsignature_map [includeTests=true, take=5]
     ⚙ showsignature_map [includeTests=true, skip=5]

# REPORT: `showsignature read` as a full replacement for a native read tool

Context: in the SWE-bench A/B experiment, the tool arm runs the pi agent with
the built-in `read` tool disabled (`--exclude-tools read`), so
`showsignature_read` must handle *everything* an agent would ever read — not
just the supported language list. This report records the observed behavior on
out-of-scope inputs (showsignature 0.2.0) and recommends the strategy.

## Observed behavior

| Input | Behavior | Verdict |
|---|---|---|
| Unsupported text file (`.txt`) | Returns literal content in `<content>` tags; skips the outline; `note:` explains no language could be inferred and suggests `--lang` | Good — graceful degradation |
| Unsupported file + `--offset`/`--limit` | Windowing works normally; `note:` gives the exact follow-up call to continue paging | Good |
| Binary file (ELF) | Dumps raw bytes into `<content>` verbatim, exit 0 | Bad — see below |
| Nonexistent file | `[error] Could not access path … ENOENT`, exit 1 | Good — clear, actionable |
| Directory | `[error] 'read' requires a file target; run 'showsignature map <dir>'` , exit 1 | Good — redirects to the right call |

The key finding is the first row: the risk that motivated the check was that
`read` might *error* on unsupported extensions, which would leave a
read-disabled agent with only `cat` via bash for `.cfg`/`.rst`/`.ini`/`.toml`
files. It doesn't — it degrades to a raw passthrough. This is what makes the
`--exclude-tools read` experiment design viable at all.

## The one real gap: binary files

Feeding an ELF binary produced ~2 KB of raw bytes (NUL-laden garbage) with a
success exit. For an agent this is the worst outcome: it burns tokens, can
poison the context with byte noise, and — because the call "succeeded" — the
model has no signal that it did something wrong and may retry variations.

Native agent read tools reject binaries ("cannot read binary file") or, for
images, render them. Rejection is the behavior to copy.

## Recommended strategy

For an investigator/agent, every response should either deliver useful content
or teach the caller the correct next move. Concretely:

1. **Keep raw passthrough for unsupported *text*** (current behavior). Literal
   content plus an explanatory `note:` is exactly right; the file's bytes are
   the structure.
2. **Detect and refuse binary content.** Cheap heuristic on the first block
   (NUL byte, or high ratio of non-printable bytes) → exit 1 with an error
   like: `[error] <file> looks binary (application/octet-stream); showsignature
   reads text. Use a hex viewer or file-type-specific tooling.` An explicit
   `--force`/`--no-binary-check` escape hatch preserves power-user access.
3. **Never fail silently-successfully.** The ENOENT and directory errors are
   the model to follow: nonzero exit, one line, and — where possible — name
   the correct follow-up call (the directory error already does this).
4. **Always emit the `note:` on degraded output.** An agent that sees *why*
   the outline is missing (`pass --lang <l>`) can self-correct in one step;
   an agent that just sees less output cannot.

Items 1, 3, 4 are already the shipped behavior; item 2 (binary rejection) is
the only change needed for `showsignature_read` to be a safe drop-in
replacement for a native read tool.
