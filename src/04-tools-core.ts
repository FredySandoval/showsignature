import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

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

export async function runCli(argv: string[], cwd: string, signal?: AbortSignal): Promise<string> {
  const result = await execFileAsync(process.execPath, [resolveCliEntry(), ...argv], {
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

export const MAP_DESCRIPTION = [
  "Structural overview of code, Markdown, and JSON. Use INSTEAD of read/grep/cat for the FIRST look at any unfamiliar file or folder: returns signatures, imports, exports, types, interfaces, variables, comments, Markdown headings, and JSON shapes at a fraction of the token cost, each entry prefixed with its real source line number.",
  "Supported: .ts/.mts/.cts .js/.mjs/.cjs .tsx/.jsx .svelte .go .py .rs .lua .md .json — for other file types use read/grep directly.",
  "Workflow: map first to see what exists, then jump to exact lines with showsignature_read using the line numbers from the map. Before grepping for a name you are guessing at, run with symbolSummary to get the identifiers that literally exist (each token is a valid ripgrep pattern).",
  "If the output ends with a 'note:' line, it was capped, depth-limited, or filtered — the note names the exact follow-up flags; never ignore it.",
].join(" ");

export const READ_DESCRIPTION = [
  "Windowed literal read of exactly one file, with a structural outline (real line numbers) around the window for orientation. Prefer this over plain read for supported file types (.ts/.js/.tsx/.jsx/.svelte/.go/.py/.rs/.lua/.md/.json), typically jumping to a line number that showsignature_map reported.",
  "The content window carries no line-number prefixes, so it is safe to copy into exact-match edit tools. Windows in LINES (offset/limit), unlike showsignature_map which paginates in ENTRIES (skip/take).",
  "If the output ends with a 'note:' line, the window was capped — it names the exact follow-up flags.",
].join(" ");

export const MAP_ARG_DOCS = {
  paths         : "One or more files and/or directories to map",
  only          : "Comma-separated extractors, e.g. 'imports,exports', 'interfaces,types', 'md:headings', 'json:shape'",
  skip          : "Skip N entries (pagination)",
  take          : "Take N entries (pagination)",
  maxDepth      : "Directory scan depth (default 2)",
  lang          : "Restrict to one language, e.g. 'go', 'py', 'ts'",
  includeTests  : "Include test files (excluded by default)",
  symbolSummary : "Keyword-discovery mode: one line per (extractor, file) listing identifiers",
  noLineNumber  : "Hide source line-number prefixes (cleaner text for piping)",
} as const;

export const READ_ARG_DOCS = {
  file    : "File to read"                                                        ,
  offset  : "First line to read (1-indexed)"                                      ,
  limit   : "Number of lines to read"                                             ,
  outline : "Outline extractors, e.g. 'imports,signatures' (default: signatures)" ,
  framing : "'none' for plain content only (no tags, no outline)"                 ,
  lang    : "Language hint, e.g. 'py', 'ts'"                                      ,
} as const;

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
