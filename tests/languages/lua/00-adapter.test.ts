import { describe, expect, test } from "bun:test";

import { createLuaAdapter } from "@/src/languages/lua/00-adapter.js";

describe("createLuaAdapter", () => {
  test("supports all built-in extract kinds", () => {
    const adapter = createLuaAdapter({ id: "lua", extensions: [".lua"], fenceLang: "lua" });

    expect(adapter.id).toBe("lua");
    expect(adapter.extensions).toEqual([".lua"]);
    expect(adapter.fenceLang).toBe("lua");
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
