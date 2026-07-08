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

  test("ignores # comments inside fenced code blocks", () => {
    const context = createMarkdownParseContext({
      source: [
        "# Title",
        "```bash",
        "# not a heading",
        "```",
        "~~~",
        "# also not a heading",
        "~~~",
        "## After",
        "",
      ].join("\n"),
      filePath: "/tmp/fenced-headings.md",
    });

    const result = createHeadingsExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      "# Title",
      "## After",
    ]);
  });

  test("ignores pipe characters inside fenced code blocks", () => {
    const context = createMarkdownParseContext({
      source: [
        "```sh",
        "cat file | grep foo",
        "```",
        "| Name | Value |",
        "| --- | --- |",
        "",
      ].join("\n"),
      filePath: "/tmp/fenced-tables.md",
    });

    const result = createTablesExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.lines).toEqual([
      "| Name | Value |",
      "| --- | --- |",
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
