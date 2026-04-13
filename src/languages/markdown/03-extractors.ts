import {
  enableUsageTracking,
  isUsageTrackingEnabled,
  toCaveman,
} from "cavemants";

import type {
  ExtractEntry,
  Extractor,
  ParseContext,
  SingleExtractResult,
} from "../../00-core-types.js";

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
): ExtractEntry {
  return {
    kind,
    lines,
    metadata: {
      filePath,
      sourcePos: 0,
    },
  };
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

export function createSignaturesExtractor(): Extractor<ParseContext> {
  return {
    kind: "signatures",
    extract(context: ParseContext): SingleExtractResult {
      const simplified = runCaveman(context.source, context.filePath);
      const output = simplified.output.trim();

      if (output.length === 0) {
        return toResult([], simplified.warning ? [simplified.warning] : []);
      }

      return toResult(
        [
          toEntry(
            "signatures",
            simplified.output.split(/\r?\n/u),
            context.filePath,
          ),
        ],
        simplified.warning ? [simplified.warning] : [],
      );
    },
  };
}
