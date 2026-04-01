import { describe, expect, test } from "bun:test";

import type {
  ExtractKind,
  LanguageAdapter,
  ParseContext,
  SingleExtractResult,
} from "../src/00-core-types.js";
import { createLanguageRegistry } from "../src/main.js";

function createNoopExtractor(kind: ExtractKind) {
  return {
    kind,
    extract(): SingleExtractResult {
      return { entries: [], warnings: [] };
    },
  };
}

function createMockAdapter(options: {
  id: string;
  extensions: readonly string[];
  fenceLang?: string;
}): LanguageAdapter<ParseContext> {
  return {
    id: options.id,
    extensions: options.extensions,
    fenceLang: options.fenceLang ?? options.id,
    extractors: new Map([["signatures", createNoopExtractor("signatures")]]),
    buildContext({ source, filePath }) {
      return { source, filePath };
    },
    supportsKind(kind) {
      return this.extractors.has(kind);
    },
  };
}

describe("createLanguageRegistry", () => {
  test("register/get/list/has/unregister for eager adapters", () => {
    const registry = createLanguageRegistry();
    const tsAdapter = createMockAdapter({
      id: "ts",
      extensions: [".ts", ".tsx"],
      fenceLang: "ts",
    });

    registry.register(tsAdapter);

    expect(registry.has("ts")).toBe(true);
    expect(registry.get("ts")).toBe(tsAdapter);
    expect(registry.listAdapters()).toEqual([tsAdapter]);
    expect(registry.supportedLanguages()).toEqual(["ts"]);
    expect(registry.supportedExtensions()).toEqual([".ts", ".tsx"]);
    expect(registry.inferFromFile("/tmp/file.TS")).toBe("ts");

    expect(registry.unregister("ts")).toBe(true);
    expect(registry.get("ts")).toBeUndefined();
    expect(registry.has("ts")).toBe(false);
    expect(registry.unregister("ts")).toBe(false);
  });

  test("supports lazy registration and loads on demand", async () => {
    const registry = createLanguageRegistry();
    const pyAdapter = createMockAdapter({
      id: "py",
      extensions: [".py"],
      fenceLang: "python",
    });

    registry.registerLazy({
      id: "py",
      extensions: ["py"],
      load: () => pyAdapter,
    });

    expect(registry.has("py")).toBe(true);
    expect(registry.get("py")).toBeUndefined();
    expect(registry.inferFromFile("/tmp/app.py")).toBe("py");
    expect(registry.supportedExtensions()).toEqual([".py"]);

    const loaded = await registry.getOrLoad("py");

    expect(loaded).toBe(pyAdapter);
    expect(registry.get("py")).toBe(pyAdapter);
    expect(registry.listAdapters()).toEqual([pyAdapter]);
  });

  test("throws when lazy loader returns mismatched adapter id", async () => {
    const registry = createLanguageRegistry();

    registry.registerLazy({
      id: "expected",
      extensions: [".exp"],
      load: () =>
        createMockAdapter({
          id: "actual",
          extensions: [".exp"],
        }),
    });

    await expect(registry.getOrLoad("expected")).rejects.toThrow(
      "Lazy adapter id mismatch",
    );
  });

  test("returns undefined from getOrLoad when adapter is unknown", async () => {
    const registry = createLanguageRegistry();
    await expect(registry.getOrLoad("missing")).resolves.toBeUndefined();
  });
});
