import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type {
  ExtractEntry,
  Extractor,
  ParseContext,
  SingleExtractResult,
} from "../../00-core-types.js";

const CAVEMAN_FILE_PATH = fileURLToPath(
  new URL("../../../cavemants/caveman.ts", import.meta.url),
);
const CAVEMAN_TIMEOUT_MS = 5_000;
const CAVEMAN_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

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

  const command = process.versions.bun ? process.execPath : "bun";
  const result = spawnSync(command, [CAVEMAN_FILE_PATH], {
    input: source,
    encoding: "utf8",
    timeout: CAVEMAN_TIMEOUT_MS,
    maxBuffer: CAVEMAN_MAX_BUFFER_BYTES,
  });

  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr.trim() ?? "unknown";

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

  return {
    output: result.stdout.trimEnd(),
  };
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
