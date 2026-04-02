import { describe, expect, test } from "bun:test";

import { ensureArray } from "@/src/01-main.js";

describe("ensureArray", () => {
  test("wraps non-array values in an array", () => {
    expect(ensureArray("value")).toEqual(["value"]);
    expect(ensureArray(42)).toEqual([42]);
  });

  test("returns array values unchanged by reference", () => {
    const input = ["a", "b"];
    const result = ensureArray(input);

    expect(result).toBe(input);
    expect(result).toEqual(["a", "b"]);
  });
});
