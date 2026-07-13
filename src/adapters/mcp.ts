import { isAbsolute }    from "node:path" ;
import { fileURLToPath } from "node:url"  ;
import { z }             from "zod"       ;
import { McpServer }     from "@modelcontextprotocol/sdk/server/mcp.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  MAP_ARG_DOCS     ,
  MAP_DESCRIPTION  ,
  READ_ARG_DOCS    ,
  READ_DESCRIPTION ,
  buildMapArgv     ,
  buildReadArgv    ,
  runCli           ,
} from "../04-tools-core.js";
import { MCP_PATH_HINT } from "../00-instructions.js";
import type { PackageMetadata } from "../00-core-types.js";
import rawPackageMetadata from "../../package.json" with { type: "json" };

// MCP adapter: zod schemas over the agent-neutral core in 04-tools-core,
// exposed as showsignature_map / showsignature_read for MCP hosts (Claude
// Desktop, claude mcp add, Cursor, Zed, …). Bootstrapped by the `showsignature
// mcp` CLI subcommand over stdio; stdout belongs to the transport, so any
// logging here must go to stderr.

const packageMetadata = rawPackageMetadata as PackageMetadata;

const mapArgs = {
  paths         : z.array(z.string()).optional().describe(`${MAP_ARG_DOCS.paths}. ${MCP_PATH_HINT}`),
  only          : z.string().optional().describe(MAP_ARG_DOCS.only)           ,
  skip          : z.number().optional().describe(MAP_ARG_DOCS.skip)           ,
  take          : z.number().optional().describe(MAP_ARG_DOCS.take)           ,
  maxDepth      : z.number().optional().describe(MAP_ARG_DOCS.maxDepth)       ,
  lang          : z.string().optional().describe(MAP_ARG_DOCS.lang)           ,
  includeTests  : z.boolean().optional().describe(MAP_ARG_DOCS.includeTests)  ,
  symbolSummary : z.boolean().optional().describe(MAP_ARG_DOCS.symbolSummary) ,
  noLineNumber  : z.boolean().optional().describe(MAP_ARG_DOCS.noLineNumber)  ,
};

const readArgs = {
  file    : z.string().describe(`${READ_ARG_DOCS.file}. ${MCP_PATH_HINT}`) ,
  offset  : z.number().optional().describe(READ_ARG_DOCS.offset)           ,
  limit   : z.number().optional().describe(READ_ARG_DOCS.limit)            ,
  outline : z.string().optional().describe(READ_ARG_DOCS.outline)          ,
  framing : z.string().optional().describe(READ_ARG_DOCS.framing)          ,
  lang    : z.string().optional().describe(READ_ARG_DOCS.lang)             ,
};

// Some models prepend @ to path arguments; built-in tools strip it, so do we.
function stripAt(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(err: unknown): CallToolResult {
  const text = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text", text }] };
}

// MCP has no per-call cwd. Resolution order: explicit env override → the
// host's first file:// workspace root (available post-initialization; hosts
// without the roots capability just throw) → the server process cwd.
// The roots lookup is one client round-trip, so cache it per resolver;
// createMcpServer subscribes to roots/list_changed to invalidate the cache.
function createRootResolver(server: McpServer): {
  resolveRoot: () => Promise<string>;
  invalidate: () => void;
} {
  let cached: string | undefined;
  return {
    invalidate: () => {
      cached = undefined;
    },
    resolveRoot: async () => {
      const envRoot = process.env["MCP_SHOWSIGNATURE_ROOT"];
      if (envRoot) return envRoot;
      if (cached !== undefined) return cached;
      let root = process.cwd();
      try {
        const { roots } = await server.server.listRoots();
        const first = roots?.[0]?.uri;
        if (first?.startsWith("file://")) root = fileURLToPath(first);
      } catch {
        // host does not advertise the roots capability
      }
      cached = root;
      return root;
    },
  };
}

// Claude Desktop launches stdio servers with cwd "/": refuse to resolve
// relative paths (or map's default ".") against it rather than scan / at
// depth 2 or read the wrong file.
function guardSlashRoot(root: string, paths: string[]): CallToolResult | undefined {
  if (root !== "/") return undefined;
  if (paths.length > 0 && paths.every((p) => isAbsolute(p))) return undefined;
  return errorResult(
    "showsignature: the resolved working directory is '/' (no workspace root available), " +
      "so relative or default paths are unsafe. Pass absolute paths, or set the " +
      "MCP_SHOWSIGNATURE_ROOT environment variable in the MCP server config.",
  );
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name    : packageMetadata.name    ?? "showsignature" ,
    version : packageMetadata.version ?? "0.0.0"         ,
  });

  const { resolveRoot, invalidate } = createRootResolver(server);
  server.server.setNotificationHandler(RootsListChangedNotificationSchema, invalidate);

  server.registerTool(
    "showsignature_map",
    {
      title       : "Showsignature Map"                       ,
      description : MAP_DESCRIPTION                           ,
      inputSchema : mapArgs                                   ,
    },
    async (args, extra) => {
      try {
        const paths = args.paths?.map(stripAt);
        const root = await resolveRoot();
        const guarded = guardSlashRoot(root, paths ?? []);
        if (guarded) return guarded;
        return textResult(await runCli(buildMapArgv({ ...args, paths }), root, extra.signal));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "showsignature_read",
    {
      title       : "Showsignature Read"                      ,
      description : READ_DESCRIPTION                          ,
      inputSchema : readArgs                                  ,
    },
    async (args, extra) => {
      try {
        const file = stripAt(args.file);
        const root = await resolveRoot();
        const guarded = guardSlashRoot(root, [file]);
        if (guarded) return guarded;
        return textResult(await runCli(buildReadArgv({ ...args, file }), root, extra.signal));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  return server;
}
