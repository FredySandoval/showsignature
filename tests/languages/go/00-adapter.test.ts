import { describe, expect, test } from "bun:test";

import { PluginExtractKind } from "@/src/00-core-types.js";
import { createGoAdapter } from "@/src/languages/go/00-adapter.js";

function toPluginExtractKind(kind: string): PluginExtractKind {
  return kind as PluginExtractKind;
}

describe("createGoAdapter", () => {
  test("builds an adapter with expected metadata and extractor kinds", () => {
    const adapter = createGoAdapter({
      id: "go",
      extensions: [".go"],
      fenceLang: "go",
    });

    expect(adapter.id).toBe("go");
    expect(adapter.extensions).toEqual([".go"]);
    expect(adapter.fenceLang).toBe("go");
    expect([...adapter.extractors.keys()]).toEqual([
      "signatures",
      "interfaces",
      "types",
      "variables",
      "comments",
      "imports",
      "exports",
    ]);
  });

  test("supportsKind reflects registered extractor availability", () => {
    const adapter = createGoAdapter({
      id: "go",
      extensions: [".go"],
      fenceLang: "go",
    });

    expect(adapter.supportsKind("signatures")).toBe(true);
    expect(adapter.supportsKind("interfaces")).toBe(true);
    expect(adapter.supportsKind("imports")).toBe(true);
    expect(adapter.supportsKind("exports")).toBe(true);
    expect(adapter.supportsKind(toPluginExtractKind("custom-kind"))).toBe(
      false,
    );
  });
});
