# TODO —

## MCP server adapter (PLAN.md)

- [x] Add dependency: `pnpm add @modelcontextprotocol/sdk` — resolved to
      1.29.0 (current v1.x, zod v4 raw-shape support confirmed; single zod
      4.1.8 copy in the tree).
- [x] Create `src/adapters/mcp.ts`: `createMcpServer(): McpServer` —
      declares mapArgs / readArgs zod raw shapes from `MAP_ARG_DOCS` /
      `READ_ARG_DOCS`, registers `showsignature_map` / `showsignature_read`
      with title/description/inputSchema and handlers that call
      `runCli(buildMapArgv(args) | buildReadArgv(args), resolveRoot(), extra.signal)`
      and return `{ content: [{ type: "text", text: output }] }`.
      Handlers must also implement PLAN.md decisions 5/7/8:
      - strip a leading `@` from `paths` / `file` before building argv
        (same as the pi extension's `stripAt`);
      - `resolveRoot()` = `MCP_SHOWSIGNATURE_ROOT` env var → `roots/list`
        spike → `process.cwd()`; if the resolved root is `/` and the call
        uses relative/default paths, return a clear error instead of
        scanning `/`;
      - catch `runCli` throws and return
        `{ isError: true, content: [{ type: "text", text: msg }] }`;
      - MCP descriptions/param docs tell the model to prefer absolute paths
        (adapter-specific wording added in `src/00-instructions.ts`, not by
        mutating the shared `*_ARG_DOCS`).
- [x] Add the `mcp` subcommand to the CLI (src/01-main.ts arg parsing):
      lazily `import()` the adapter, `createMcpServer()`,
      `await server.connect(new StdioServerTransport())`, log startup to
      stderr (never stdout — the transport owns it), stay alive until
      disconnect.
      Handle `mcp` entirely inside its own commander action, before the
      pipeline ever runs — cleaner than threading a third variant through the
      `ParsedCliArgs` / `CliCommandName` union (00-core-types.ts) and the
      `execute`/`validateCliArgs` dispatch; if that proves awkward, the union
      branch is the fallback and is trivial.
      Root help is the static `ROOT_HELP` string from `src/00-instructions.ts`
      (`configureHelp({ formatHelp: () => ROOT_HELP })`), so mention `mcp`
      there too — then `pnpm build` (mandatory: pi reads dist/). `pnpm gen` is
      only needed if the SKILL.md / README generated blocks also change;
      `gen:check` catches it either way.
