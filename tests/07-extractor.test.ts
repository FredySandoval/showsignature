import { describe, expect, test } from "bun:test";

import type {
  AggregatedExtractResult,
  ExtractKind,
  ExtractWarning,
  LanguageAdapter,
  SingleExtractResult,
} from "@/src/00-core-types.js";
import type { ParseContext } from "@/src/00-core-types.js";

import { runExtractors, type Extractor } from "@/src/01-main.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface TestParseContext extends ParseContext {
  readonly lang: string;
}

function createStubExtractor(
  kind: ExtractKind,
  lines: string[],
  opts?: { sourcePos?: number; warnings?: ExtractWarning[] },
): Extractor<TestParseContext> {
  return {
    kind,
    extract(_context): SingleExtractResult {
      return {
        entries: [
          {
            kind,
            lines,
            ...(opts?.sourcePos !== undefined
              ? { metadata: { sourcePos: opts.sourcePos } }
              : {}),
          },
        ],
        warnings: opts?.warnings ?? [],
      };
    },
  };
}

function createMultiEntryExtractor(
  kind: ExtractKind,
  entriesData: { lines: string[]; sourcePos?: number }[],
): Extractor<TestParseContext> {
  return {
    kind,
    extract(_context): SingleExtractResult {
      return {
        entries: entriesData.map((data) => ({
          kind,
          lines: data.lines,
          ...(data.sourcePos !== undefined
            ? { metadata: { sourcePos: data.sourcePos } }
            : {}),
        })),
        warnings: [],
      };
    },
  };
}

function createTestAdapter(
  extractorList: Extractor<TestParseContext>[],
): LanguageAdapter<TestParseContext> {
  const extractors = new Map<ExtractKind, Extractor<TestParseContext>>(
    extractorList.map((e) => [e.kind, e]),
  );
  return {
    id: "test-lang",
    extensions: [".test"],
    fenceLang: "ts",
    extractors,
    buildContext({ source, filePath }) {
      return { source, filePath, lang: "test-lang" };
    },
    supportsKind(kind) {
      return extractors.has(kind);
    },
  };
}

function createTestContext(
  overrides?: Partial<TestParseContext>,
): TestParseContext {
  return {
    source: "",
    filePath: "/tmp/test.ts",
    lang: "test-lang",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("08-extractor — runExtractors", () => {
  // -----------------------------------------------------------------------
  // Combined output
  // -----------------------------------------------------------------------

  describe("combined output", () => {
    test("merges and sorts entries by source position", () => {
      const adapter = createTestAdapter([
        createStubExtractor("comments", ["// first comment"], { sourcePos: 5 }),
        createStubExtractor("signatures", ["function run(): void;"], {
          sourcePos: 3,
        }),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["comments", "signatures"],
      });

      // Should be sorted by sourcePos: signatures (3) before comments (5)
      expect(result.entries[0]?.kind).toBe("signatures");
      expect(result.entries[0]?.lines).toEqual(["function run(): void;"]);
      expect(result.entries[1]?.kind).toBe("comments");
      expect(result.entries[1]?.lines).toEqual(["// first comment"]);
    });

    test("keeps entry metadata on combined output entries", () => {
      const adapter = createTestAdapter([
        createStubExtractor("imports", ['import fs from "node:fs";'], {
          sourcePos: 0,
        }),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["imports"],
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        kind: "imports",
        lines: ['import fs from "node:fs";'],
        metadata: {
          filePath: "/tmp/test.ts",
          sourceLine: 1,
          sourcePos: 0,
        },
      });
    });

    test("uses FALLBACK position for entries without sourcePos", () => {
      const adapter = createTestAdapter([
        createStubExtractor("comments", ["// no pos"]),
        createStubExtractor("signatures", ["function early(): void;"], {
          sourcePos: 1,
        }),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["comments", "signatures"],
      });

      // Entries without sourcePos get MAX_SAFE_INTEGER fallback and sort last
      expect(result.entries[0]?.kind).toBe("signatures");
      expect(result.entries[1]?.kind).toBe("comments");
    });

    test("interleaves multiple entries from multiple extractors by position", () => {
      const adapter = createTestAdapter([
        createMultiEntryExtractor("comments", [
          { lines: ["// second"], sourcePos: 20 },
          { lines: ["// fourth"], sourcePos: 40 },
        ]),
        createMultiEntryExtractor("signatures", [
          { lines: ["function first(): void;"], sourcePos: 10 },
          { lines: ["function third(): void;"], sourcePos: 30 },
        ]),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["comments", "signatures"],
      });

      expect(result.entries).toEqual([
        {
          kind: "signatures",
          lines: ["function first(): void;"],
          metadata: {
            filePath: "/tmp/test.ts",
            sourceLine: 1,
            sourcePos: 10,
          },
        },
        {
          kind: "comments",
          lines: ["// second"],
          metadata: {
            filePath: "/tmp/test.ts",
            sourceLine: 1,
            sourcePos: 20,
          },
        },
        {
          kind: "signatures",
          lines: ["function third(): void;"],
          metadata: {
            filePath: "/tmp/test.ts",
            sourceLine: 1,
            sourcePos: 30,
          },
        },
        {
          kind: "comments",
          lines: ["// fourth"],
          metadata: {
            filePath: "/tmp/test.ts",
            sourceLine: 1,
            sourcePos: 40,
          },
        },
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // Unsupported kinds
  // -----------------------------------------------------------------------

  describe("unsupported kinds", () => {
    test("ignores unsupported extract kinds when at least one kind matches", () => {
      const adapter = createTestAdapter([
        createStubExtractor("signatures", ["function run(): void;"], {
          sourcePos: 0,
        }),
      ]);
      const context = createTestContext({ filePath: "/tmp/warn.ts" });

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["signatures", "types"],
      });

      expect(result.entries).toHaveLength(1);
      expect(result.warnings).toEqual([]);
    });

    test("skips files when none of the requested kinds are supported", () => {
      const adapter = createTestAdapter([]);
      const context = createTestContext({ filePath: "/tmp/empty.ts" });

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["signatures", "interfaces", "types"],
      });

      expect(result.entries).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test("returns supported results without unsupported-kind warnings", () => {
      const adapter = createTestAdapter([
        createStubExtractor("imports", ['import x from "y";'], {
          sourcePos: 0,
        }),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["variables", "imports", "types"],
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.kind).toBe("imports");
      expect(result.warnings).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Extractor-produced warnings
  // -----------------------------------------------------------------------

  describe("extractor-produced warnings", () => {
    test("collects warnings emitted by extractors", () => {
      const extractorWarning: ExtractWarning = {
        message: "Suspicious pattern",
        filePath: "/tmp/test.ts",
        severity: "info",
        kind: "comments",
        code: "SUSPICIOUS_PATTERN",
      };

      const adapter = createTestAdapter([
        createStubExtractor("comments", ["// suspicious"], {
          sourcePos: 0,
          warnings: [extractorWarning],
        }),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["comments"],
      });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual(extractorWarning);
    });

    test("keeps extractor warnings while ignoring unsupported kinds", () => {
      const extractorWarning: ExtractWarning = {
        message: "Something odd",
        filePath: "/tmp/test.ts",
        severity: "warning",
      };

      const adapter = createTestAdapter([
        createStubExtractor("imports", ['import y from "z";'], {
          sourcePos: 0,
          warnings: [extractorWarning],
        }),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["types", "imports"],
      });

      expect(result.warnings).toEqual([extractorWarning]);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("edge cases", () => {
    test("returns empty result for empty extractOrder", () => {
      const adapter = createTestAdapter([
        createStubExtractor("signatures", ["function x(): void;"]),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: [],
      });

      expect(result.entries).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test("handles extractor returning empty entries array", () => {
      const emptyExtractor: Extractor<TestParseContext> = {
        kind: "comments",
        extract(): SingleExtractResult {
          return { entries: [], warnings: [] };
        },
      };

      const adapter = createTestAdapter([emptyExtractor]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["comments"],
      });

      expect(result.entries).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test("handles single kind in extractOrder", () => {
      const adapter = createTestAdapter([
        createStubExtractor("interfaces", ["interface Foo {}"], {
          sourcePos: 0,
        }),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["interfaces"],
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.kind).toBe("interfaces");
    });

    test("always returns entries in source order", () => {
      const adapter = createTestAdapter([
        createStubExtractor("comments", ["// pos 20"], { sourcePos: 20 }),
        createStubExtractor("signatures", ["function pos5(): void;"], {
          sourcePos: 5,
        }),
      ]);
      const context = createTestContext();

      const result = runExtractors({
        adapter,
        context,
        extractOrder: ["comments", "signatures"],
      });

      expect(result.entries[0]?.kind).toBe("signatures");
      expect(result.entries[1]?.kind).toBe("comments");
    });
  });

  // -----------------------------------------------------------------------
  // Return type contract
  // -----------------------------------------------------------------------

  describe("return type contract", () => {
    test("result conforms to AggregatedExtractResult", () => {
      const adapter = createTestAdapter([
        createStubExtractor("signatures", ["function x(): void;"]),
      ]);
      const context = createTestContext();

      const result: AggregatedExtractResult = runExtractors({
        adapter,
        context,
        extractOrder: ["signatures"],
      });

      expect(result).toHaveProperty("entries");
      expect(result).toHaveProperty("warnings");
      expect(Array.isArray(result.entries)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
