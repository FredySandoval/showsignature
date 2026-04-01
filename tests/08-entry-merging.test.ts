import { describe, expect, test } from "bun:test";

import {
  flattenExtractEntries,
  mergeAndSortEntries,
  stripCombinedPositions,
} from "../src/index";
import type { CombinedExtractEntry, ExtractEntry } from "../src/00-core-types";

describe("flattenExtractEntries", () => {
  test("flattens groups while preserving group and entry order", () => {
    const groupA: ExtractEntry[] = [
      { kind: "comments", lines: ["// a1"] },
      { kind: "comments", lines: ["// a2"] },
    ];
    const groupB: ExtractEntry[] = [
      { kind: "signatures", lines: ["function x(): void;"] },
    ];

    expect(flattenExtractEntries([groupA, groupB])).toEqual([
      { kind: "comments", lines: ["// a1"] },
      { kind: "comments", lines: ["// a2"] },
      { kind: "signatures", lines: ["function x(): void;"] },
    ]);
  });
});

describe("mergeAndSortEntries", () => {
  test("merges groups and sorts by source position", () => {
    const groupA: CombinedExtractEntry[] = [
      { kind: "comments", lines: ["// second"], pos: 20 },
      { kind: "comments", lines: ["// fourth"], pos: 40 },
    ];
    const groupB: CombinedExtractEntry[] = [
      { kind: "signatures", lines: ["function first(): void;"], pos: 10 },
      { kind: "signatures", lines: ["function third(): void;"], pos: 30 },
    ];

    expect(mergeAndSortEntries([groupA, groupB])).toEqual([
      { kind: "signatures", lines: ["function first(): void;"], pos: 10 },
      { kind: "comments", lines: ["// second"], pos: 20 },
      { kind: "signatures", lines: ["function third(): void;"], pos: 30 },
      { kind: "comments", lines: ["// fourth"], pos: 40 },
    ]);
  });

  test("uses deterministic tie-breaking for matching positions", () => {
    const groupA: CombinedExtractEntry[] = [
      { kind: "comments", lines: ["// a1"], pos: 5 },
      { kind: "comments", lines: ["// a2"], pos: 5 },
    ];
    const groupB: CombinedExtractEntry[] = [
      { kind: "signatures", lines: ["function b1(): void;"], pos: 5 },
    ];

    expect(mergeAndSortEntries([groupA, groupB])).toEqual([
      { kind: "comments", lines: ["// a1"], pos: 5 },
      { kind: "comments", lines: ["// a2"], pos: 5 },
      { kind: "signatures", lines: ["function b1(): void;"], pos: 5 },
    ]);
  });
});

describe("stripCombinedPositions", () => {
  test("removes positional data and keeps output lines intact", () => {
    const entries: CombinedExtractEntry[] = [
      { kind: "comments", lines: ["// one"], pos: 3 },
      { kind: "signatures", lines: ["function two(): void;"], pos: 8 },
    ];

    expect(stripCombinedPositions(entries)).toEqual<ExtractEntry[]>([
      { kind: "comments", lines: ["// one"] },
      { kind: "signatures", lines: ["function two(): void;"] },
    ]);
  });
});
