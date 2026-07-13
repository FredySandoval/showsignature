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
