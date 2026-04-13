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
});
