import { describe, expect, test } from "bun:test";
import * as ts from "typescript";

import { extractFromSource, runExtractors } from "@/src/01-main.js";
import { PluginExtractKind } from "@/src/00-core-types.js";
import { createSvelteAdapter } from "@/src/languages/svelte/00-adapter.js";

function toPluginExtractKind(kind: string): PluginExtractKind {
  return kind as PluginExtractKind;
}

describe("createSvelteAdapter", () => {
  test("builds an adapter with expected metadata and extractor kinds", () => {
    const adapter = createSvelteAdapter();

    expect(adapter.id).toBe("svelte");
    expect(adapter.extensions).toEqual([".svelte"]);
    expect(adapter.fenceLang).toBe("svelte");
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

  test("buildContext returns a TypeScript parse context from Svelte script blocks", () => {
    const adapter = createSvelteAdapter();
    const context = adapter.buildContext({
      source: `<h1>Hello</h1>\n<script lang="ts">\nexport const count = 1;\n</script>`,
      filePath: "/tmp/Counter.svelte",
    });

    expect(context.filePath).toBe("/tmp/Counter.svelte");
    expect(context.scriptKind).toBe(ts.ScriptKind.TS);
    expect(context.source).toContain("export const count = 1;");
    expect(context.source).not.toContain("<h1>Hello</h1>");
    expect(context.sourceFile.fileName).toBe("/tmp/Counter.svelte");
  });

  test("supportsKind reflects registered extractor availability", () => {
    const adapter = createSvelteAdapter();

    expect(adapter.supportsKind("signatures")).toBe(true);
    expect(adapter.supportsKind("imports")).toBe(true);
    expect(adapter.supportsKind("exports")).toBe(true);
    expect(adapter.supportsKind(toPluginExtractKind("custom-kind"))).toBe(
      false,
    );
  });

  test("extracts TypeScript-family entries from module and instance scripts", () => {
    const adapter = createSvelteAdapter();
    const source = [
      '<script context="module" lang="ts">',
      '  import type { PageLoad } from "./$types";',
      "  export interface ModuleData { title: string }",
      '  export const load: PageLoad = async () => ({ title: "Home" });',
      "</script>",
      "",
      '<script lang="ts">',
      "  export let name: string;",
      "  type Greeting = `Hello ${string}`;",
      "  export function greet(value: string): Greeting {",
      "    return `Hello ${value}` as Greeting;",
      "  }",
      "</script>",
      "",
      "<h1>{name}</h1>",
      "",
    ].join("\n");

    const result = extractFromSource({
      adapter,
      filePath: "/tmp/Component.svelte",
      source,
      extractOrder: [
        "imports",
        "interfaces",
        "types",
        "variables",
        "signatures",
        "exports",
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(
      result.entries.some((entry) =>
        entry.lines.includes('import type { PageLoad } from "./$types";'),
      ),
    ).toBe(true);
    expect(
      result.entries.some((entry) =>
        entry.lines.includes("export interface ModuleData { title: string }"),
      ),
    ).toBe(true);
    expect(
      result.entries.some((entry) =>
        entry.lines.includes("type Greeting = `Hello ${string}`;"),
      ),
    ).toBe(true);
    expect(
      result.entries.some((entry) =>
        entry.lines.includes("export let name: string;"),
      ),
    ).toBe(true);
    expect(
      result.entries.some((entry) =>
        entry.lines.includes("export function greet(value: string): Greeting;"),
      ),
    ).toBe(true);
    expect(
      result.entries.every(
        (entry) => entry.metadata?.filePath === "/tmp/Component.svelte",
      ),
    ).toBe(true);
  });

  test("runExtractors reports source lines from the original Svelte file", () => {
    const adapter = createSvelteAdapter();
    const source = `<h1>Title</h1>\n<script lang="ts">\nexport const title = "Home";\n</script>`;
    const context = adapter.buildContext({
      source,
      filePath: "/tmp/Page.svelte",
    });

    const result = runExtractors({
      adapter,
      context,
      extractOrder: ["variables"],
    });

    expect(result.entries[0]?.metadata?.sourceLine).toBe(3);
  });
});
