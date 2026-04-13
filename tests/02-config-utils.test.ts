import { describe, expect, test } from "bun:test";

import {
  parseExtractOptions,
  stringifyError,
  toPipelineError,
} from "@/src/01-main.js";
import {
  BUILT_IN_EXTRACT_KINDS,
  type PluginExtractKind,
} from "@/src/00-core-types.js";

describe("parseExtractOptions", () => {
  test("parses comma-separated kinds in order", () => {
    const result = parseExtractOptions(
      "comments,signatures,imports",
      BUILT_IN_EXTRACT_KINDS,
    );

    expect(result).toEqual(["comments", "signatures", "imports"]);
  });

  test("trims whitespace and deduplicates", () => {
    const result = parseExtractOptions(
      " comments , signatures , comments , imports ",
      BUILT_IN_EXTRACT_KINDS,
    );

    expect(result).toEqual(["comments", "signatures", "imports"]);
  });

  test("throws for empty input after trimming", () => {
    expect(() => parseExtractOptions(" ,  , ", BUILT_IN_EXTRACT_KINDS)).toThrow(
      "No extract options were provided",
    );
  });

  test("supports md:rewrite as an alias for md:caveman", () => {
    const mdCaveman = "md:caveman" as PluginExtractKind;
    const result = parseExtractOptions("md:rewrite", [mdCaveman]);

    expect(result).toEqual([mdCaveman]);
  });

  test("throws for unsupported kind", () => {
    expect(() =>
      parseExtractOptions("comments,unknown", BUILT_IN_EXTRACT_KINDS),
    ).toThrow("Unsupported extract option: unknown");
  });
});

describe("stringifyError", () => {
  test("returns raw string errors", () => {
    expect(stringifyError("plain error")).toBe("plain error");
  });

  test("returns Error.message for Error instances", () => {
    expect(stringifyError(new Error("boom"))).toBe("boom");
  });

  test("returns message property from plain object", () => {
    expect(stringifyError({ message: "object boom" })).toBe("object boom");
  });

  test("falls back to JSON.stringify for non-error objects", () => {
    expect(stringifyError({ code: "E_FAIL" })).toBe('{"code":"E_FAIL"}');
  });
});

describe("toPipelineError", () => {
  test("normalizes string errors", () => {
    expect(toPipelineError("failed")).toEqual({ message: "failed" });
  });

  test("maps filePath, code, and exitCode from object errors", () => {
    const result = toPipelineError({
      message: "failed",
      filePath: "/tmp/file.ts",
      code: "E_PARSE",
      exitCode: 2,
    });

    expect(result).toEqual({
      message: "failed",
      filePath: "/tmp/file.ts",
      code: "E_PARSE",
      exitCode: 2,
    });
  });

  test("prefers explicit filePath over error filePath", () => {
    const result = toPipelineError(
      { message: "failed", filePath: "/tmp/inner.ts" },
      "/tmp/outer.ts",
    );

    expect(result).toEqual({
      message: "failed",
      filePath: "/tmp/outer.ts",
    });
  });
});
