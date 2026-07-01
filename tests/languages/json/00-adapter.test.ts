import { describe, expect, test } from "bun:test";

import { PluginExtractKind } from "@/src/00-core-types.js";
import { createJsonAdapter } from "@/src/languages/json/00-adapter.js";
import { JSON_SHAPE_KIND } from "@/src/languages/json/03-extractors.js";

function toPluginExtractKind(kind: string): PluginExtractKind {
  return kind as PluginExtractKind;
}

describe("createJsonAdapter", () => {
  test("builds an adapter with expected metadata and only json:shape", () => {
    const adapter = createJsonAdapter({
      id: "json",
      extensions: [".json"],
      fenceLang: "json",
    });

    expect(adapter.id).toBe("json");
    expect(adapter.extensions).toEqual([".json"]);
    expect(adapter.fenceLang).toBe("json");
    expect([...adapter.extractors.keys()]).toEqual([JSON_SHAPE_KIND]);
  });

  test("buildContext returns a JSON parse context", () => {
    const adapter = createJsonAdapter({
      id: "json",
      extensions: [".json"],
      fenceLang: "json",
    });
    const context = adapter.buildContext({
      source: '{"ok":true}',
      filePath: "/tmp/example.json",
    });

    expect(context.source).toBe('{"ok":true}');
    expect(context.filePath).toBe("/tmp/example.json");
  });

  test("supportsKind reflects registered extractor availability", () => {
    const adapter = createJsonAdapter({
      id: "json",
      extensions: [".json"],
      fenceLang: "json",
    });

    expect(adapter.supportsKind("json:shape" as PluginExtractKind)).toBe(true);
    expect(adapter.supportsKind("json:all" as PluginExtractKind)).toBe(false);
    expect(adapter.supportsKind("comments")).toBe(false);
    expect(adapter.supportsKind(toPluginExtractKind("custom-kind"))).toBe(
      false,
    );
  });
});
