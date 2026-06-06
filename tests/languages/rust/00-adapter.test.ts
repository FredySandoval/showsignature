import { describe, expect, test } from "bun:test";

import { createRustAdapter } from "@/src/languages/rust/00-adapter.js";

describe("createRustAdapter", () => {
  test("supports all built-in extract kinds", () => {
    const adapter = createRustAdapter({ id: "rs", extensions: [".rs"], fenceLang: "rust" });

    expect(adapter.id).toBe("rs");
    expect(adapter.extensions).toEqual([".rs"]);
    expect(adapter.fenceLang).toBe("rust");
    expect([...adapter.extractors.keys()]).toEqual([
      "signatures",
      "interfaces",
      "types",
      "variables",
      "comments",
      "imports",
      "exports",
    ]);
  });
});
