import { execFile }                  from "node:child_process";
import { existsSync }                from "node:fs"           ;
import { basename, delimiter, join } from "node:path"         ;
import { fileURLToPath }             from "node:url"          ;
import { promisify }                 from "node:util"         ;

// Agent-neutral core for the showsignature agent tools. The opencode plugin
// (05/06) and the pi extension (.pi/extensions/) are thin schema adapters
// over the descriptions, argv builders, and CLI runner defined here.

const execFileAsync = promisify(execFile);

// The CLI entry sits next to this module: 02-cli.js in dist, 02-cli.ts in src
// (when an agent loads this file uncompiled during development).
function resolveCliEntry(): string {
  for (const name of ["02-cli.js", "02-cli.ts"]) {
    const candidate = fileURLToPath(new URL(name, import.meta.url));
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("showsignature CLI entry not found next to plugin module");
}

// Inside standalone-binary hosts (e.g. the compiled opencode executable),
// process.execPath is the host binary itself, which would ignore the CLI
// script argument and print its own help. Only reuse execPath when it really
// is node or bun; otherwise resolve one from PATH.
function resolveRuntime(): string {
  if (/^(node|bun)(\.exe)?$/i.test(basename(process.execPath))) return process.execPath;
  for (const dir of (process.env["PATH"] ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const name of ["node", "bun", "node.exe", "bun.exe"]) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error("showsignature: no node or bun runtime found on PATH to run the CLI");
}

export async function runCli(argv: string[], cwd: string, signal?: AbortSignal): Promise<string> {
  const result = await execFileAsync(resolveRuntime(), [resolveCliEntry(), ...argv], {
    cwd,
    signal,
    maxBuffer: 32 * 1024 * 1024,
  }).catch((err: NodeJS.ErrnoException & { stdout?: string | undefined; stderr?: string | undefined; code?: unknown }) => err);
  const stdout = "stdout" in result ? (result.stdout ?? "") : "";
  const stderr = "stderr" in result ? (result.stderr ?? "") : "";
  if (result instanceof Error) {
    // Throw so the host agent marks the tool call as failed (pi only sets
    // isError on a thrown execute; a returned string reads as success).
    throw new Error(`showsignature ${argv[0]} failed (${result.code ?? "error"}):\n${stdout}${stderr}`.trim());
  }
  return `${stdout}${stderr}`.trim() || "(no output)";
}

// Tool descriptions, arg docs, and prompt snippets live in the single
// instruction source src/00-instructions.ts; re-exported here so every
// adapter keeps importing one stable module.
export {
  MAP_ARG_DOCS    ,
  MAP_DESCRIPTION ,
  MAP_PROMPT      ,
  READ_ARG_DOCS   ,
  READ_DESCRIPTION,
  READ_PROMPT     ,
} from "./00-instructions.js";

export interface MapParams {
  paths         ?: string[] | undefined ;
  only          ?: string   | undefined ;
  skip          ?: number   | undefined ;
  take          ?: number   | undefined ;
  maxDepth      ?: number   | undefined ;
  lang          ?: string   | undefined ;
  includeTests  ?: boolean  | undefined ;
  symbolSummary ?: boolean  | undefined ;
  noLineNumber  ?: boolean  | undefined ;
}

export interface ReadParams {
  file     : string              ;
  offset  ?: number  | undefined ;
  limit   ?: number  | undefined ;
  outline ?: string  | undefined ;
  framing ?: string  | undefined ;
  lang    ?: string  | undefined ;
}

export function buildMapArgv(params: MapParams): string[] {
  const argv: string[] = ["map"];

  if (params.only                  ) argv.push("--only"     ,params.only            ) ;
  if (params.skip !== undefined    ) argv.push("--skip"     ,String(params.skip)    ) ;
  if (params.take !== undefined    ) argv.push("--take"     ,String(params.take)    ) ;
  if (params.maxDepth !== undefined) argv.push("--max-depth",String(params.maxDepth)) ;
  if (params.lang                  ) argv.push("--lang"     ,params.lang            ) ;
  if (params.includeTests          ) argv.push("--include-tests"                    ) ;
  if (params.symbolSummary         ) argv.push("--symbol-summary"                   ) ;
  if (params.noLineNumber          ) argv.push("--no-line-number"                   ) ;

  argv.push(...(params.paths?.length ? params.paths : ["."]));
  return argv;
}

export function buildReadArgv(params: ReadParams): string[] {
  const argv: string[] = ["read"];
  if (params.offset !== undefined) argv.push("--offset" ,String(params.offset)) ;
  if (params.limit !== undefined ) argv.push("--limit"  ,String(params.limit )) ;
  if (params.outline             ) argv.push("--outline",params.outline       ) ;
  if (params.framing             ) argv.push("--framing",params.framing       ) ;
  if (params.lang                ) argv.push("--lang"   ,params.lang          ) ;
  argv.push(params.file);
  return argv;
}
