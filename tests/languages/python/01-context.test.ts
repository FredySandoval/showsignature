import { describe, expect, test } from "bun:test";

import { createPyParseContext } from "@/src/languages/python/01-context.js";

describe("createPyParseContext", () => {
  test("creates a Python context for .py files", () => {
    const source = "value = 1\nprint(value)\n";
    const filePath = "/tmp/example.py";

    const context = createPyParseContext({ source, filePath });

    expect(context.source).toBe(source);
    expect(context.filePath).toBe(filePath);
    expect(context.lines).toEqual(["value = 1", "print(value)", ""]);
    expect(context.lineStarts).toEqual([0, 10, 23]);
  });

  test("tracks line starts correctly for CRLF input", () => {
    const context = createPyParseContext({
      source: "a = 1\r\nb = 2\r\n",
      filePath: "/tmp/example.py",
    });

    expect(context.lines).toEqual(["a = 1", "b = 2", ""]);
    expect(context.lineStarts).toEqual([0, 7, 14]);
  });
});
