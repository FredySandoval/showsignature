import type { TsParseContext } from "../../00-core-types.js";
import { createTsParseContext } from "../typescript/01-context.js";

export interface CreateSvelteParseContextOptions {
  source: string;
  filePath: string;
}

const SCRIPT_BLOCK_PATTERN = /<script\b[^>]*>([\s\S]*?)<\/script>/giu;

function blankNonNewline(value: string): string {
  return value.replace(/[^\n\r]/gu, " ");
}

function extractScriptSource(source: string): string {
  const blocks: { start: number; end: number; body: string }[] = [];

  for (const match of source.matchAll(SCRIPT_BLOCK_PATTERN)) {
    const fullMatch = match[0] ?? "";
    const body = match[1] ?? "";
    const matchStart = match.index ?? 0;
    const bodyStart = matchStart + fullMatch.indexOf(body);

    blocks.push({
      start: bodyStart,
      end: bodyStart + body.length,
      body,
    });
  }

  if (blocks.length === 0) {
    return "";
  }

  let result = "";
  for (const block of blocks) {
    if (result.length < block.start) {
      result += blankNonNewline(source.slice(result.length, block.start));
    }

    result += block.body;

    if (result.length < block.end) {
      result += blankNonNewline(source.slice(result.length, block.end));
    }
  }

  if (result.length < source.length) {
    result += blankNonNewline(source.slice(result.length));
  }

  return result;
}

export function createSvelteParseContext(
  options: CreateSvelteParseContextOptions,
): TsParseContext {
  return createTsParseContext({
    source: extractScriptSource(options.source),
    filePath: options.filePath,
  });
}
