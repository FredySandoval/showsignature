import { describe, expect, test } from "bun:test";

import { createMarkdownParseContext } from "@/src/languages/markdown/01-context.js";
import {
  createCodeBlocksExtractor,
  createHeadingsExtractor,
  createTablesExtractor,
  MARKDOWN_CODEBLOCKS_KIND,
  MARKDOWN_HEADINGS_KIND,
  MARKDOWN_TABLES_KIND,
} from "@/src/languages/markdown/03-extractors.js";

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
});
