import { describe, expect, test } from "bun:test";
import { performance } from "node:perf_hooks";

import type {
  ExtractEntry,
  ExtractKind,
  Extractor,
  LanguageAdapter,
  ParseContext,
  SingleExtractResult,
} from "@/src/00-core-types.js";
import { extractFromSource, createLanguageRegistry } from "@/src/01-main.js";

function oldLinearToLineNumber(source: string, position: number): number {
  let lineNumber = 1;

  for (let index = 0; index < position; index += 1) {
    if (source[index] === "\n") {
      lineNumber += 1;
    }
  }

  return lineNumber;
}

function createPerfFixture(options: { lineCount: number; entryCount: number }) {
  const lines = Array.from(
    { length: options.lineCount },
    (_, index) => `const value${index} = ${index};`,
  );
  const source = lines.join("\n");
  const entries: ExtractEntry[] = [];

  for (let index = 0; index < options.entryCount; index += 1) {
    const lineIndex = Math.floor(
      ((index + 1) * (options.lineCount - 1)) / options.entryCount,
    );
    const sourcePos = source.indexOf(`const value${lineIndex}`);
    entries.push({
      kind: "variables",
      lines: [`const value${lineIndex} = ...;`],
      metadata: { sourcePos },
    });
  }

  return { source, entries };
}

function createPerfAdapter(
  entries: readonly ExtractEntry[],
): LanguageAdapter<ParseContext> {
  const extractor: Extractor<ParseContext> = {
    kind: "variables",
    extract(): SingleExtractResult {
      return { entries: [...entries], warnings: [] };
    },
  };
  const extractors = new Map<ExtractKind, Extractor<ParseContext>>([
    ["variables", extractor],
  ]);

  return {
    id: "perf",
    extensions: [".perf"],
    fenceLang: "txt",
    extractors,
    buildContext({ source, filePath }) {
      return { source, filePath };
    },
    supportsKind(kind) {
      return extractors.has(kind);
    },
  };
}

function time(label: string, run: () => void): number {
  const startedAt = performance.now();
  run();
  const durationMs = performance.now() - startedAt;
  console.log(`${label}: ${durationMs.toFixed(2)}ms`);
  return durationMs;
}

describe("source line metadata performance", () => {
  test("measures baseline old linear lookup versus extractFromSource", () => {
    if (process.env["SHOWSIGNATURE_PERF"] !== "1") {
      console.log(
        "Skipping performance baseline. Set SHOWSIGNATURE_PERF=1 to run.",
      );
      return;
    }

    const { source, entries } = createPerfFixture({
      lineCount: 50_000,
      entryCount: 5_000,
    });

    let baselineChecksum = 0;
    const baselineMs = time("old linear toLineNumber baseline", () => {
      for (const entry of entries) {
        baselineChecksum += oldLinearToLineNumber(
          source,
          entry.metadata?.sourcePos ?? 0,
        );
      }
    });

    const registry = createLanguageRegistry();
    registry.register(createPerfAdapter(entries));

    let resultChecksum = 0;
    const optimizedMs = time("extractFromSource sourceLine metadata", () => {
      const result = extractFromSource({
        registry,
        lang: "perf",
        filePath: "/repo/fixture.perf",
        source,
        extractOrder: ["variables"],
      });
      resultChecksum = result.entries.reduce(
        (sum, entry) => sum + (entry.metadata?.sourceLine ?? 0),
        0,
      );
    });

    console.table({
      baselineMs,
      optimizedMs,
      speedup: baselineMs / optimizedMs,
      baselineChecksum,
      resultChecksum,
    });

    expect(resultChecksum).toBe(baselineChecksum);
  }, 20_000);
});
