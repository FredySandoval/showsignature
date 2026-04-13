import type { ParseContext } from "../../00-core-types.js";

export interface CreateMarkdownParseContextOptions {
  source: string;
  filePath: string;
}

export function createMarkdownParseContext(
  options: CreateMarkdownParseContextOptions,
): ParseContext {
  return {
    source: options.source,
    filePath: options.filePath,
  };
}
