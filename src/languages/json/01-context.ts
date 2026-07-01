import type { JsonParseContext } from "../../00-core-types.js";

export interface CreateJsonParseContextOptions {
  source: string;
  filePath: string;
}

export function createJsonParseContext(
  options: CreateJsonParseContextOptions,
): JsonParseContext {
  return {
    source: options.source,
    filePath: options.filePath,
  };
}
