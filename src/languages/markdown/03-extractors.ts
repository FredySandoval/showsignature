import {
  enableUsageTracking,
  isUsageTrackingEnabled,
  toCaveman,
} from "cavemants";

import type {
  ExtractEntry,
  ExtractKind,
  Extractor,
  ParseContext,
  SingleExtractResult,
} from "../../00-core-types.js";

export const MARKDOWN_REWRITE_KIND = "md:rewrite" as ExtractKind;
export const MARKDOWN_HEADINGS_KIND = "md:headings" as ExtractKind;
export const MARKDOWN_TABLES_KIND = "md:tables" as ExtractKind;
export const MARKDOWN_CODEBLOCKS_KIND = "md:codeblocks" as ExtractKind;

interface SourceLine {
  text: string;
  start: number;
}

function toResult(
  entries: ExtractEntry[],
  warnings: SingleExtractResult["warnings"] = [],
): SingleExtractResult {
  return { entries, warnings };
}

function toEntry(
  kind: ExtractEntry["kind"],
  lines: string[],
  filePath: string,
  sourcePos: number,
): ExtractEntry {
  return {
    kind,
    lines,
    metadata: {
      filePath,
      sourcePos,
    },
  };
}

function toSourceLines(source: string): SourceLine[] {
  const lines = source.split(/\r?\n/u);
  const output: SourceLine[] = [];
  let start = 0;

  for (const line of lines) {
    output.push({ text: line, start });
    start += line.length + 1;
  }

  return output;
}

function ensureBattleTestLogging(): void {
  if (!isUsageTrackingEnabled()) {
    enableUsageTracking();
  }
}

function runCaveman(
  source: string,
  filePath: string,
): {
  output: string;
  warning?: SingleExtractResult["warnings"][number];
} {
  if (source.trim().length === 0) {
    return { output: "" };
  }

  try {
    ensureBattleTestLogging();

    return {
      output: toCaveman(source, { ultra: true }),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    return {
      output: source,
      warning: {
        severity: "warning",
        filePath,
        code: "MARKDOWN_SIMPLIFY_FAILED",
        message: `Markdown simplifier failed. Using original markdown instead. ${detail}`,
      },
    };
  }
}

function isHeadingLine(line: string): boolean {
  return /^\s{0,3}#{1,6}\s+\S/u.test(line);
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("```")) {
    return false;
  }

  return trimmed.includes("|");
}

function createEntriesFromLines(
  context: ParseContext,
  kind: ExtractKind,
  predicate: (line: string) => boolean,
): ExtractEntry[] {
  return toSourceLines(context.source)
    .filter((line) => predicate(line.text))
    .map((line) => toEntry(kind, [line.text], context.filePath, line.start));
}

function createTableEntries(context: ParseContext): ExtractEntry[] {
  const lines = toSourceLines(context.source);
  const entries: ExtractEntry[] = [];
  let currentLines: SourceLine[] = [];

  function flush(): void {
    if (currentLines.length === 0) {
      return;
    }

    entries.push(
      toEntry(
        MARKDOWN_TABLES_KIND,
        currentLines.map((line) => line.text),
        context.filePath,
        currentLines[0]?.start ?? 0,
      ),
    );
    currentLines = [];
  }

  for (const line of lines) {
    if (isTableLine(line.text)) {
      currentLines.push(line);
      continue;
    }

    flush();
  }

  flush();
  return entries;
}

function createCodeBlockEntries(context: ParseContext): ExtractEntry[] {
  const entries: ExtractEntry[] = [];
  const pattern = /^\s*```.*(?:\r?\n|$)[\s\S]*?^\s*```\s*$/gmu;

  for (const match of context.source.matchAll(pattern)) {
    const block = match[0] ?? "";
    if (!block) {
      continue;
    }

    entries.push(
      toEntry(
        MARKDOWN_CODEBLOCKS_KIND,
        block.split(/\r?\n/u),
        context.filePath,
        match.index ?? 0,
      ),
    );
  }

  return entries;
}

export function createHeadingsExtractor(): Extractor<ParseContext> {
  return {
    kind: MARKDOWN_HEADINGS_KIND,
    extract(context: ParseContext): SingleExtractResult {
      return toResult(
        createEntriesFromLines(context, MARKDOWN_HEADINGS_KIND, isHeadingLine),
      );
    },
  };
}

export function createTablesExtractor(): Extractor<ParseContext> {
  return {
    kind: MARKDOWN_TABLES_KIND,
    extract(context: ParseContext): SingleExtractResult {
      return toResult(createTableEntries(context));
    },
  };
}

export function createCodeBlocksExtractor(): Extractor<ParseContext> {
  return {
    kind: MARKDOWN_CODEBLOCKS_KIND,
    extract(context: ParseContext): SingleExtractResult {
      return toResult(createCodeBlockEntries(context));
    },
  };
}

export function createRewriteExtractor(): Extractor<ParseContext> {
  return {
    kind: MARKDOWN_REWRITE_KIND,
    extract(context: ParseContext): SingleExtractResult {
      const simplified = runCaveman(context.source, context.filePath);
      const output = simplified.output.trim();

      if (output.length === 0) {
        return toResult([], simplified.warning ? [simplified.warning] : []);
      }

      return toResult(
        [
          toEntry(
            MARKDOWN_REWRITE_KIND,
            simplified.output.split(/\r?\n/u),
            context.filePath,
            0,
          ),
        ],
        simplified.warning ? [simplified.warning] : [],
      );
    },
  };
}
