import path from "node:path";

import * as ts from "typescript";

import type { TsParseContext } from "../../00-core-types.js";

export interface CreateTsParseContextOptions {
  source: string;
  filePath: string;
}

const EXTENSION_TO_SCRIPT_KIND: Record<string, ts.ScriptKind> = {
  ".ts": ts.ScriptKind.TS,
  ".js": ts.ScriptKind.JS,
  ".mts": ts.ScriptKind.TS,
  ".cts": ts.ScriptKind.TS,
  ".mjs": ts.ScriptKind.JS,
  ".cjs": ts.ScriptKind.JS,
  ".tsx": ts.ScriptKind.TSX,
  ".jsx": ts.ScriptKind.JSX,
};

function inferScriptKind(filePath: string): ts.ScriptKind {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_SCRIPT_KIND[ext] ?? ts.ScriptKind.TS;
}

export function createTsParseContext(
  options: CreateTsParseContextOptions,
): TsParseContext {
  const scriptKind = inferScriptKind(options.filePath);
  const sourceFile = ts.createSourceFile(
    options.filePath,
    options.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  return {
    source: options.source,
    filePath: options.filePath,
    sourceFile,
    scriptKind,
  };
}
