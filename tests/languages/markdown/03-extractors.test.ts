import { describe, expect, test } from "bun:test";

import { createMarkdownParseContext } from "@/src/languages/markdown/01-context.js";
import { createSignaturesExtractor } from "@/src/languages/markdown/03-extractors.js";

describe("markdown extractors", () => {
  test("simplifies markdown with caveman and keeps markdown syntax", () => {
    const context = createMarkdownParseContext({
      source: [
        "# The API Guide",
        "- The guide is basically here: [The API Guide](https://example.com/docs).",
        "> The API is basically slow because it renders everything.",
        "",
      ].join("\n"),
      filePath: "/tmp/example.md",
    });

    const result = createSignaturesExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: "signatures",
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

  test("uses ultra caveman mode by default", () => {
    const context = createMarkdownParseContext({
      source: "State update leads to re-render and cache miss results in retry.\n",
      filePath: "/tmp/ultra.md",
    });

    const result = createSignaturesExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: "signatures",
        lines: ["State update → re-render cache miss → retry"],
        metadata: {
          filePath: "/tmp/ultra.md",
          sourcePos: 0,
        },
      },
    ]);
  });
});
