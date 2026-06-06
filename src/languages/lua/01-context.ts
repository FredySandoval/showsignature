import type { LuaParseContext } from "../../00-core-types.js";

export interface CreateLuaParseContextOptions {
  source: string;
  filePath: string;
}

function toLines(source: string): string[] {
  if (source.length === 0) return [""];
  return source.split(/\r?\n/u);
}

function toLineStarts(source: string, lines: readonly string[]): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length;
    if (source.slice(offset, offset + 2) === "\r\n") offset += 2;
    else if (source[offset] === "\n") offset += 1;
  }
  return starts;
}

export function createLuaParseContext(
  options: CreateLuaParseContextOptions,
): LuaParseContext {
  const lines = toLines(options.source);
  return {
    source: options.source,
    filePath: options.filePath,
    lines,
    lineStarts: toLineStarts(options.source, lines),
  };
}
