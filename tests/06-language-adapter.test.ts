import { describe, expect, test } from "bun:test";

import type {
  ExtractKind as CoreExtractKind,
  LanguageAdapter as CoreLanguageAdapter,
  ParseContext as CoreParseContext,
  SingleExtractResult,
} from "../src/00-core-types.js";
import type { Extractor, LanguageAdapter } from "../src/index.js";
import type { ParseContext } from "../src/00-core-types.js";

interface TestParseContext extends ParseContext {
  readonly lang: string;
}

function createMockExtractor(
  kind: CoreExtractKind,
  line: string,
): Extractor<TestParseContext> {
  return {
    kind,
    extract(context): SingleExtractResult {
      return {
        entries: [
          { kind, lines: [line], metadata: { filePath: context.filePath } },
        ],
        warnings: [],
      };
    },
  };
}

function createMockAdapter(): LanguageAdapter<TestParseContext> {
  const extractors = new Map<CoreExtractKind, Extractor<TestParseContext>>([
    ["signatures", createMockExtractor("signatures", "function run(): void;")],
    ["imports", createMockExtractor("imports", 'import fs from "node:fs";')],
  ]);

  return {
    id: "test-lang",
    extensions: [".test"],
    fenceLang: "ts",
    metadata: {
      id: "test-lang",
      extensions: [".test"],
      fenceLang: "ts",
      displayName: "Test",
    },
    extractors,
    buildContext({ source, filePath }) {
      return { source, filePath, lang: "test-lang" };
    },
    supportsKind(kind) {
      return extractors.has(kind);
    },
  };
}

describe("07-language-adapter contracts", () => {
  test("defines a working Extractor contract", () => {
    const extractor = createMockExtractor("comments", "// hello");
    const result = extractor.extract({
      source: "// hello",
      filePath: "/tmp/sample.test",
      lang: "test-lang",
    });

    expect(result.entries).toEqual([
      {
        kind: "comments",
        lines: ["// hello"],
        metadata: { filePath: "/tmp/sample.test" },
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  test("defines a working LanguageAdapter contract", () => {
    const adapter = createMockAdapter();
    const context = adapter.buildContext({
      source: 'import fs from "node:fs";',
      filePath: "/tmp/file.test",
    });

    expect(adapter.id).toBe("test-lang");
    expect(adapter.extensions).toEqual([".test"]);
    expect(adapter.fenceLang).toBe("ts");
    expect(adapter.supportsKind("signatures")).toBe(true);
    expect(adapter.supportsKind("types")).toBe(false);
    expect(context).toEqual({
      source: 'import fs from "node:fs";',
      filePath: "/tmp/file.test",
      lang: "test-lang",
    });
  });

  test("stays structurally compatible with core type contracts", () => {
    const adapter = createMockAdapter();
    const extractor = createMockExtractor("variables", "const x = ...;");

    const coreAdapter: CoreLanguageAdapter<CoreParseContext> = adapter;
    const coreExtractor: Extractor<CoreParseContext> = extractor;

    expect(coreAdapter.supportsKind("imports")).toBe(true);
    expect(coreExtractor.kind).toBe("variables");
  });
});
