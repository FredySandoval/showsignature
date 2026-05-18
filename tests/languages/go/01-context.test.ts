import { describe, expect, test } from "bun:test";

import { createGoParseContext } from "@/src/languages/go/01-context.js";

describe("createGoParseContext", () => {
  test("creates a Go context for .go files", () => {
    const source = "package main\nvar x = 1\n";
    const context = createGoParseContext({ source, filePath: "/tmp/main.go" });

    expect(context.source).toBe(source);
    expect(context.filePath).toBe("/tmp/main.go");
    expect(context.lines).toEqual(["package main", "var x = 1", ""]);
    expect(context.lineStarts).toEqual([0, 13, 23]);
  });

  test("tracks line starts correctly for CRLF input", () => {
    const context = createGoParseContext({
      source: "package main\r\nvar x = 1\r\n",
      filePath: "/tmp/main.go",
    });

    expect(context.lines).toEqual(["package main", "var x = 1", ""]);
    expect(context.lineStarts).toEqual([0, 14, 25]);
  });
});
