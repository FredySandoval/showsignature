import { describe, expect, test } from "bun:test";

import { createJsonParseContext } from "@/src/languages/json/01-context.js";
import {
  createShapeExtractor,
  JSON_SHAPE_KIND,
} from "@/src/languages/json/03-extractors.js";

describe("json extractors", () => {
  test("extracts object shape", () => {
    const context = createJsonParseContext({
      source: JSON.stringify({ name: "api", enabled: true, count: 2 }),
      filePath: "/tmp/object.json",
    });

    const result = createShapeExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: JSON_SHAPE_KIND,
        lines: ["{ count: number, enabled: boolean, name: string }"],
        metadata: {
          filePath: "/tmp/object.json",
          sourcePos: 0,
        },
      },
    ]);
  });

  test("extracts array shape", () => {
    const context = createJsonParseContext({
      source: JSON.stringify([{ id: 1, tags: ["stable"] }]),
      filePath: "/tmp/array.json",
    });

    const result = createShapeExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: JSON_SHAPE_KIND,
        lines: ["[{ id: number, tags: [string] }]"],
        metadata: {
          filePath: "/tmp/array.json",
          sourcePos: 0,
        },
      },
    ]);
  });

  test("extracts scalar shape", () => {
    const context = createJsonParseContext({
      source: "null",
      filePath: "/tmp/scalar.json",
    });

    const result = createShapeExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries).toEqual([
      {
        kind: JSON_SHAPE_KIND,
        lines: ["null"],
        metadata: {
          filePath: "/tmp/scalar.json",
          sourcePos: 0,
        },
      },
    ]);
  });

  test("extracts empty object shape", () => {
    const context = createJsonParseContext({
      source: "{}",
      filePath: "/tmp/empty.json",
    });

    const result = createShapeExtractor().extract(context);

    expect(result.warnings).toEqual([]);
    expect(result.entries[0]?.lines).toEqual(["{}"]);
  });

  test("returns warning and no entries for invalid JSON", () => {
    const context = createJsonParseContext({
      source: "{ // no jsonc\n }",
      filePath: "/tmp/invalid.json",
    });

    const result = createShapeExtractor().extract(context);

    expect(result.entries).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      level: "warning",
      severity: "warning",
      message: "Invalid JSON: unable to parse strict JSON input",
      filePath: "/tmp/invalid.json",
      kind: JSON_SHAPE_KIND,
    });
  });
});
