import { describe, expect, test } from "bun:test";

import { PluginExtractKind } from "@/src/00-core-types.js";
import { createPythonAdapter } from "@/src/languages/python/00-adapter.js";

function toPluginExtractKind(kind: string): PluginExtractKind {
  return kind as PluginExtractKind;
}

describe("createPythonAdapter", () => {
  test("builds an adapter with expected metadata and extractor kinds", () => {
    const adapter = createPythonAdapter({
      id: "py",
      extensions: [".py"],
      fenceLang: "python",
    });

    expect(adapter.id).toBe("py");
    expect(adapter.extensions).toEqual([".py"]);
    expect(adapter.fenceLang).toBe("python");
    expect([...adapter.extractors.keys()]).toEqual([
      "signatures",
      "variables",
      "comments",
      "imports",
    ]);
  });

  test("buildContext returns a Python parse context", () => {
    const adapter = createPythonAdapter({
      id: "py",
      extensions: [".py"],
      fenceLang: "python",
    });
    const context = adapter.buildContext({
      source: "value = 1\n",
      filePath: "/tmp/example.py",
    });

    expect(context.source).toBe("value = 1\n");
    expect(context.filePath).toBe("/tmp/example.py");
    expect(context.lines).toEqual(["value = 1", ""]);
    expect(context.lineStarts).toEqual([0, 10]);
  });

  test("supportsKind reflects registered extractor availability", () => {
    const adapter = createPythonAdapter({
      id: "py",
      extensions: [".py"],
      fenceLang: "python",
    });

    expect(adapter.supportsKind("signatures")).toBe(true);
    expect(adapter.supportsKind("imports")).toBe(true);
    expect(adapter.supportsKind("interfaces")).toBe(false);
    expect(adapter.supportsKind(toPluginExtractKind("custom-kind"))).toBe(
      false,
    );
  });
});
