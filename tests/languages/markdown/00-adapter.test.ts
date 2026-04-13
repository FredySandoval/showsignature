import { describe, expect, test } from "bun:test";

import { PluginExtractKind } from "@/src/00-core-types.js";
import { createMarkdownAdapter } from "@/src/languages/markdown/00-adapter.js";
import {
  MARKDOWN_CAVEMAN_KIND,
  MARKDOWN_CODEBLOCKS_KIND,
  MARKDOWN_DOCUMENT_KIND,
  MARKDOWN_HEADINGS_KIND,
  MARKDOWN_TABLES_KIND,
} from "@/src/languages/markdown/03-extractors.js";

function toPluginExtractKind(kind: string): PluginExtractKind {
  return kind as PluginExtractKind;
}

describe("createMarkdownAdapter", () => {
  test("builds an adapter with expected metadata and extractor kinds", () => {
    const adapter = createMarkdownAdapter({
      id: "md",
      extensions: [".md"],
      fenceLang: "markdown",
    });

    expect(adapter.id).toBe("md");
    expect(adapter.extensions).toEqual([".md"]);
    expect(adapter.fenceLang).toBe("markdown");
    expect([...adapter.extractors.keys()]).toEqual([
      MARKDOWN_DOCUMENT_KIND,
      MARKDOWN_HEADINGS_KIND,
      MARKDOWN_TABLES_KIND,
      MARKDOWN_CODEBLOCKS_KIND,
      MARKDOWN_CAVEMAN_KIND,
    ]);
  });

  test("buildContext returns a base parse context", () => {
    const adapter = createMarkdownAdapter({
      id: "md",
      extensions: [".md"],
      fenceLang: "markdown",
    });
    const context = adapter.buildContext({
      source: "# Hello\n",
      filePath: "/tmp/example.md",
    });

    expect(context.source).toBe("# Hello\n");
    expect(context.filePath).toBe("/tmp/example.md");
  });

  test("supportsKind reflects registered extractor availability", () => {
    const adapter = createMarkdownAdapter({
      id: "md",
      extensions: [".md"],
      fenceLang: "markdown",
    });

    expect(adapter.supportsKind("md:headings" as PluginExtractKind)).toBe(true);
    expect(adapter.supportsKind("comments")).toBe(false);
    expect(adapter.supportsKind(toPluginExtractKind("custom-kind"))).toBe(
      false,
    );
  });
});
