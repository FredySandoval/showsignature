# PLAN — MCP Server Adapter for showsignature

## Goal

Expose the two showsignature tools (`map`, `read`) as an MCP server over **stdio**
using `@modelcontextprotocol/sdk`, so any MCP-capable host (Claude Desktop, Claude
Code `claude mcp add`, Cursor, Zed, …) can use them — alongside the existing
opencode plugin and pi extension.

**Why:** agents like Claude Code and Codex can't register native tools, so today
they reach showsignature only via bash → CLI, and LLMs demonstrably prefer (and
more reliably use) direct tool calls over shelling out. The MCP server gives the
model `showsignature_map` / `showsignature_read` as first-class tools to raise
that call ratio. The human's involvement is a one-time host registration; nothing
here is a user-facing command, and no slash command / skill wrapper is added —
hosts inject MCP tools into the model's tool list automatically.

## Architecture (follows the existing adapter pattern)

The project already isolates everything agent-neutral in `src/04-tools-core.ts`:

```
src/00-instructions.ts        ← single source of all instruction text
        │  (MAP/READ _DESCRIPTION, _ARG_DOCS, _PROMPT re-exported by 04-tools-core)
        ▼
src/04-tools-core.ts          ← runCli(), buildMapArgv(), buildReadArgv(),
        │                        MapParams / ReadParams
        ├── src/adapters/opencode.ts         (zod schemas → opencode plugin)
        ├── .pi/extensions/showsignature-tools.ts (typebox → pi extension)
        └── src/adapters/mcp.ts              ← NEW: createMcpServer() (zod schemas)
                └── `showsignature mcp` subcommand in src/01-main.ts (stdio bootstrap, lazy import)
```

The MCP adapter is a **thin schema wrapper**, exactly like the opencode one:
no new business logic, no duplicated instruction text.

## Key design decisions

1. **Transport: stdio.** `StdioServerTransport` from
   `@modelcontextprotocol/sdk/server/stdio.js`. This is what every local MCP
   host expects; no HTTP surface needed.
2. **Server API: `McpServer` + `registerTool`** (high-level API,
   `@modelcontextprotocol/sdk/server/mcp.js`). It accepts zod raw shapes for
   `inputSchema` — declare them in the MCP adapter from
   `MAP_ARG_DOCS`/`READ_ARG_DOCS`, following the pattern the pi extension set.
   No shared schemas module: the adapters' shapes legitimately differ (opencode
   defaults `paths`, is typed against its plugin contract; pi uses typebox and
   consumes the MCP server never — pi/opencode keep their native tool calls).
   The single source of truth stays the text (`*_ARG_DOCS`) and logic
   (`buildMapArgv`/`buildReadArgv`/`runCli`) in 04-tools-core.
3. **Zod version:** the project depends on zod ^4. **Verified (2026-07):**
   recent `@modelcontextprotocol/sdk` v1.x releases import from `zod/v4`
   internally and accept raw zod shapes with any zod ≥ 3.25 or v4 — no JSON
   Schema conversion needed. Older releases (≤ ~1.17.5) break with zod v4
   (`w._parse is not a function`, typescript-sdk issues #925/#555), so pin a
   current SDK version and avoid duplicate zod copies in the tree. The SDK v2
   beta (2026-07-28 spec) moves to Standard Schema (zod v4 / Valibot /
   ArkType), so the raw-shape approach carries forward.
4. **Tool names:** `showsignature_map` and `showsignature_read` (MCP tool names
   are global in the host; prefix avoids collisions with generic `read`).
   Descriptions come from `MAP_DESCRIPTION` / `READ_DESCRIPTION` as-is — they
   already carry the full when-to-use workflow (see the pi extension's note);
   `MAP_PROMPT`/`READ_PROMPT` are pi-specific system-prompt metadata and would
   only duplicate that text.
5. **Working directory:** MCP has no per-call cwd. Root resolution order:
   `MCP_SHOWSIGNATURE_ROOT` env override → MCP `roots/list` (spike during
   implementation: it's in the SDK v1 API and several hosts advertise roots
   today; if the first root is trivially available after initialization, use
   it — the analogue of opencode's `context.directory`; if it's awkward
   because roots arrive async or hosts vary, skip it for now) →
   `process.cwd()`. Path validation stays in the CLI, which already does it.
   Two model-facing mitigations, cheap and most effective:
   - The tool descriptions / param docs tell the model to pass **absolute
     paths when in doubt** (MCP-adapter-specific wording; add alongside
     `*_ARG_DOCS` in 00-instructions.ts, not by mutating the shared docs).
   - **Guard the `/` root:** if the resolved root is `/` (Claude Desktop
     launches stdio servers there) and the call uses relative paths — or
     map's default of `"."` (`buildMapArgv` pushes `"."` when `paths` is
     empty, safe in opencode/pi where a workspace cwd is guaranteed, unsafe
     here) — return a clear error instead of letting map scan `/` at depth 2.
6. **Execution:** reuse `runCli(argv, cwd, signal)` from `04-tools-core.ts`
   verbatim — it already resolves the runtime (node/bun), the CLI entry
   (dist/02-cli.js), handles errors by throwing, and caps output at 32 MB.
   Wire MCP's `RequestHandlerExtra.signal` through as the AbortSignal.
7. **Strip leading `@` from paths**, same as the pi extension's `stripAt`
   (.pi/extensions/showsignature-tools.ts): some models prepend `@` to path
   arguments, and the same models will call these MCP tools.
8. **Error mapping:** `runCli` throws on nonzero exit — catch in the tool
   handler and return `{ isError: true, content: [{ type: "text", text: msg }] }`
   so the model sees the CLI's own diagnostic text instead of a protocol error.
9. **Entry point / packaging: `showsignature mcp` subcommand (no second bin).**
   - The existing CLI grows an `mcp` subcommand next to `map`/`read` that
     connects `StdioServerTransport` and blocks until the host disconnects.
     One bin, and the host config line needs no `--package` gymnastics:
     `pnpm dlx showsignature mcp` just works.
   - The SDK import must be **lazy** (dynamic `import()` inside the `mcp`
     command handler) so `map`/`read` startup cost is unchanged.
   - `McpServer`'s `name`/`version` come from package.json metadata (same
     source the CLI already uses) — never hardcoded.
   - **No `./mcp` package export** — nothing consumes `createMcpServer()`
     programmatically (the subcommand imports it internally from dist); add an
     export only when an external consumer appears (e.g. an HTTP transport
     host). `package.json` only gains
     `@modelcontextprotocol/sdk` in `dependencies`. Trade-off, accepted:
     opencode/pi installs download the SDK without ever running `mcp`, but the
     lazy import makes their runtime cost zero, and a hard dep is required for
     `pnpm dlx showsignature mcp` to just work (optional/peer deps would break
     the one-liner).
   - **No stdout pollution:** stdio transport owns stdout. All logging must go
     to stderr (`console.error`) — audit that nothing in the adapter writes to
     stdout (the CLI runs as a child process, so its stdout is captured by
     `execFile`, not inherited — already safe).

## Implementation steps

1. **Add dependency**: `pnpm add @modelcontextprotocol/sdk` (resolves to a
   current v1.x, which supports zod v4 raw shapes; just confirm it's not an
   old ≤1.17.x version).
2. **Create `src/adapters/mcp.ts`**: `createMcpServer(): McpServer` —
   declares mapArgs / readArgs zod raw shapes from `MAP_ARG_DOCS` /
   `READ_ARG_DOCS`, registers `showsignature_map` / `showsignature_read` with
   title/description/inputSchema and handlers that call
   `runCli(buildMapArgv(args) | buildReadArgv(args), resolveRoot(), extra.signal)`
   and return `{ content: [{ type: "text", text: output }] }`.
3. **Add the `mcp` subcommand** to the CLI (src/01-main.ts arg parsing):
   lazily `import()` the adapter, `createMcpServer()`,
   `await server.connect(new StdioServerTransport())`, log startup to stderr
   (never stdout — the transport owns it), stay alive until disconnect.
   Handle `mcp` entirely inside its own commander action, before the pipeline
   ever runs — cleaner than threading a third variant through the
   `ParsedCliArgs` / `CliCommandName` union (00-core-types.ts) and the
   `execute`/`validateCliArgs` dispatch; if that proves awkward, the union
   branch is the fallback and is trivial.
   Root help is the static `ROOT_HELP` string from `src/00-instructions.ts`
   (`configureHelp({ formatHelp: () => ROOT_HELP })`), so mention `mcp` there
   too — then `pnpm build` (mandatory: pi reads dist/). `pnpm gen` is only
   needed if the SKILL.md / README generated blocks also change; step 6's
   `gen:check` catches it either way.
4. **Wire packaging**: `package.json` gains only the dependency (no new
   export); `files` already ships dist; `tsconfig.build.json` builds `src/`,
   so no change.
5. **Docs**:
   - README: add an "MCP" install section:
     - `claude mcp add showsignature -- pnpm dlx showsignature mcp`
     - or after `pnpm add -g showsignature`: `claude mcp add showsignature -- showsignature mcp`
     - Claude Desktop config JSON equivalent
       (`{"command": "showsignature", "args": ["mcp"]}`).
   - The README tool-usage block is generated: if the MCP section touches it,
     edit `src/00-instructions.ts` and run `pnpm gen` (never edit generated
     outputs), then `pnpm build` (drift test enforces this).
6. **Verify**: `pnpm gen:check && pnpm typecheck && pnpm test && pnpm build`,
   then a live smoke test:
   `echo '{"jsonrpc":"2.0",...tools/list...}' | node dist/02-cli.js mcp`
   and/or register with `claude mcp add` and call the tools.

## Non-goals

- No HTTP/SSE transport (can be added later behind the same `createMcpServer`;
  this is also the path to Claude web/Desktop remote custom connectors).
- No MCP Apps (`@modelcontextprotocol/ext-apps`, `ui://` resources) — these
  tools return text for the model, not interactive UI for the user.
- No MCP resources/prompts in v1 (a later iteration could expose SKILL.md as an
  MCP prompt).
- No tests in v1 — deliberate. The MCP surface is still clay: we expect to
  reshape it freely (names, schemas, cwd handling, output framing) based on
  how models actually use it, and tests written now would ossify a form we
  haven't chosen yet and make every change cost double. We test on the ground:
  ship a working product, watch for critical errors in real agent usage, and
  only once the shape settles add regression tests (SDK `InMemoryTransport` +
  `Client` end-to-end, as `tests/15-mcp-adapter.test.ts`). The stable layer
  underneath (argv building, `runCli`, the CLI itself) is already covered by
  the existing suite.
- No changes to CLI behavior or output format.
- pi and opencode keep their native tool-call adapters; the MCP server is not
  for them — it is additive for MCP-only hosts (Claude Desktop, Cursor, Zed…).

## Risks / open questions

- ~~**zod v4 ↔ MCP SDK compatibility**~~ — **resolved (2026-07):** recent SDK
  v1.x works with zod v4 raw shapes (zod ≥ 3.25 required); pass raw zod shapes,
  no JSON Schema path needed. Remaining care: pin a current SDK version
  (≤ ~1.17.5 breaks with zod v4) and keep a single zod copy in the tree.
- **cwd semantics** — confirmed: hosts differ in what cwd they launch stdio
  servers with (Claude Desktop uses `/`); mitigated by the resolution order,
  the `/`-root guard, and the absolute-paths guidance in decision 5. Open:
  whether the `roots/list` spike pans out in SDK v1 across hosts.
- ~~**Name conflict**~~ — moot: no second bin; `mcp` is a subcommand of the
  existing `showsignature` bin, so opencode/pi installs are untouched by
  construction. Only care: `mcp` must not collide with a future map/read
  operand parse (it's a distinct commander subcommand, so it won't).
