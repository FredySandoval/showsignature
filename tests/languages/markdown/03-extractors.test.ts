import { afterEach, describe, expect, test } from "bun:test";

import {
  disableUsageTracking,
  enableUsageTracking,
  isUsageTrackingEnabled,
} from "cavemants";

import { createMarkdownParseContext } from "@/src/languages/markdown/01-context.js";
import {
  createCodeBlocksExtractor,
  createHeadingsExtractor,
  createRewriteExtractor,
  createTablesExtractor,
  MARKDOWN_CODEBLOCKS_KIND,
  MARKDOWN_HEADINGS_KIND,
  MARKDOWN_REWRITE_KIND,
  MARKDOWN_TABLES_KIND,
} from "@/src/languages/markdown/03-extractors.js";

const initialUsageTrackingState = isUsageTrackingEnabled();

afterEach(() => {
  if (initialUsageTrackingState) {
    enableUsageTracking();
    return;
  }

  disableUsageTracking();
});

describe("markdown extractors", () => {
  test("extracts markdown headings", () => {
    const context = createMarkdownParseContext({
      source: ["# Title", "text", "## Subtitle", ""].join("\n"),
      filePath: "/tmp/headings.md",
    });

    const result = createHeadingsExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: MARKDOWN_HEADINGS_KIND,
        lines: ["# Title"],
        metadata: {
          filePath: "/tmp/headings.md",
          sourcePos: 0,
        },
      },
      {
        kind: MARKDOWN_HEADINGS_KIND,
        lines: ["## Subtitle"],
        metadata: {
          filePath: "/tmp/headings.md",
          sourcePos: 13,
        },
      },
    ]);
  });

  test("extracts markdown tables as blocks", () => {
    const context = createMarkdownParseContext({
      source: [
        "# Title",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| API | ready |",
        "",
      ].join("\n"),
      filePath: "/tmp/tables.md",
    });

    const result = createTablesExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: MARKDOWN_TABLES_KIND,
        lines: ["| Name | Value |", "| --- | --- |", "| API | ready |"],
        metadata: {
          filePath: "/tmp/tables.md",
          sourcePos: 9,
        },
      },
    ]);
  });

  test("extracts fenced code blocks", () => {
    const context = createMarkdownParseContext({
      source: ["Before", "```ts", "const value = 1;", "```", "After", ""].join(
        "\n",
      ),
      filePath: "/tmp/codeblocks.md",
    });

    const result = createCodeBlocksExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: MARKDOWN_CODEBLOCKS_KIND,
        lines: ["```ts", "const value = 1;", "```"],
        metadata: {
          filePath: "/tmp/codeblocks.md",
          sourcePos: 7,
        },
      },
    ]);
  });

  test("rewrites full markdown in ultra mode", () => {
    const context = createMarkdownParseContext({
      source: [
        "# The API Guide",
        "- The guide is basically here: [The API Guide](https://example.com/docs).",
        "> The API is basically slow because it renders everything.",
        "",
      ].join("\n"),
      filePath: "/tmp/example.md",
    });

    const result = createRewriteExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: MARKDOWN_REWRITE_KIND,
        lines: [
          "# API Guide",
          "- guide is here: [The API Guide](https://example.com/docs)",
          "> API is slow. it renders everything",
        ],
        metadata: {
          filePath: "/tmp/example.md",
          sourcePos: 0,
        },
      },
    ]);
  });

  test("rewrite uses ultra caveman mode", () => {
    const context = createMarkdownParseContext({
      source:
        "State update leads to re-render and cache miss results in retry.\n",
      filePath: "/tmp/ultra.md",
    });

    const result = createRewriteExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: MARKDOWN_REWRITE_KIND,
        lines: ["State update → re-render cache miss → retry"],
        metadata: {
          filePath: "/tmp/ultra.md",
          sourcePos: 0,
        },
      },
    ]);
  });

  test("rewrite re-enables cavemants usage tracking for markdown battle tests", () => {
    disableUsageTracking();
    expect(isUsageTrackingEnabled()).toBe(false);

    const context = createMarkdownParseContext({
      source: "The API is basically slow because it renders everything.\n",
      filePath: "/tmp/tracking.md",
    });

    const result = createRewriteExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: MARKDOWN_REWRITE_KIND,
        lines: ["API is slow. it renders everything"],
        metadata: {
          filePath: "/tmp/tracking.md",
          sourcePos: 0,
        },
      },
    ]);
    expect(isUsageTrackingEnabled()).toBe(true);
  });
});
