# TODO — Pi extension review findings

- [x] Remove `showsignature-instructions.ts` from `.pi/extensions/` — deleted; tools-only approach now, npm tarball ships only `showsignature-tools.ts`
- [x] Remove the `all` parameter from both tool schemas — removed from the core (`MAP_ARG_DOCS`/`READ_ARG_DOCS`, `MapParams`/`ReadParams`, argv builders), the pi extension, the opencode zod schemas, the SKILL.md example, and the two CLI `note:` messages that recommended `--all`; the human-facing CLI flag itself remains, README/docs note it is omitted from agent schemas on purpose
- [x] Throw on CLI failure in the tool adapters — `runCli` in `04-tools-core.ts` now throws on error (pi sets `isError: true`, opencode surfaces the failed call); both adapters inherit the fix
- [x] Add `promptGuidelines` to the pi tools, naming each tool explicitly (map-first workflow, read-with-line-numbers workflow)
- [x] ~~Fix instructions.ts cache / ctx.hasUI guard~~ — moot, file deleted
- [x] Awareness note: the pi extension imports `../../dist/04-tools-core.js` on purpose — the npm tarball has `dist/` but no `src/`, so a src import would break installed copies; rebuild (`npm run build`) after touching core code. If local staleness ever bites, add a session_start mtime check (src newer than dist → warn) rather than changing the import. Documented in the extension's header comment
