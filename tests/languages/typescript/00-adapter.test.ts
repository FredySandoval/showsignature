import { describe, expect, test } from "bun:test";
import * as ts from "typescript";

import { toPluginExtractKind } from "../../../src/00-core-types";
import { createTsFamilyAdapter } from "../../../src/languages/typescript/00-adapter";

describe("createTsFamilyAdapter", () => {
  test("builds an adapter with expected metadata and extractor kinds", () => {
    const adapter = createTsFamilyAdapter({
      id: "ts",
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      fenceLang: "ts",
    });

    expect(adapter.id).toBe("ts");
    expect(adapter.extensions).toEqual([".ts", ".tsx", ".js", ".jsx"]);
    expect(adapter.fenceLang).toBe("ts");
    expect([...adapter.extractors.keys()]).toEqual([
      "signatures",
      "interfaces",
      "types",
      "variables",
      "comments",
      "imports",
    ]);
  });

  test("buildContext returns a TS parse context", () => {
    const adapter = createTsFamilyAdapter({
      id: "ts",
      extensions: [".ts"],
      fenceLang: "ts",
    });
    const context = adapter.buildContext({
      source: "export const x = 1;",
      filePath: "/tmp/example.ts",
    });

    expect(context.source).toBe("export const x = 1;");
    expect(context.filePath).toBe("/tmp/example.ts");
    expect(context.scriptKind).toBe(ts.ScriptKind.TS);
    expect(context.sourceFile.fileName).toBe("/tmp/example.ts");
  });

  test("supportsKind reflects registered extractor availability", () => {
    const adapter = createTsFamilyAdapter({
      id: "ts",
      extensions: [".ts"],
      fenceLang: "ts",
    });

    expect(adapter.supportsKind("signatures")).toBe(true);
    expect(adapter.supportsKind("imports")).toBe(true);
    expect(adapter.supportsKind(toPluginExtractKind("custom-kind"))).toBe(
      false,
    );
  });
});
