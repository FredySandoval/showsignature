import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createPyParseContext } from "@/src/languages/python/01-context.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createSignaturesExtractor,
  createVariablesExtractor,
} from "@/src/languages/python/03-extractors.js";

function buildContext(source: string) {
  return createPyParseContext({
    source,
    filePath: "/tmp/example.py",
  });
}

describe("createSignaturesExtractor", () => {
  test("extracts class, method, and top-level function signatures", () => {
    const source = [
      "class User(Base):",
      "    @property",
      "    def name(self) -> str:",
      '        return "x"',
      "",
      "    async def load(self, id: int) -> None:",
      "        pass",
      "",
      "def greet(name: str) -> str:",
      "    return name",
      "",
    ].join("\n");

    const extractor = createSignaturesExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines)).toEqual([
      [
        "class User(Base):",
        "    def name(self) -> str: ...",
        "    async def load(self, id: int) -> None: ...",
      ],
      ["def greet(name: str) -> str: ..."],
    ]);
  });
});

describe("createVariablesExtractor", () => {
  test("extracts top-level assignments and summarizes values", () => {
    const source = [
      "VALUE: int = 3",
      "DATA = {'a': 1}",
      "LIST = [1, 2, 3]",
      "CALL = factory()",
      'TEXT = "# not comment"',
      "INLINE = 2  # note",
      "",
    ].join("\n");

    const extractor = createVariablesExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      "VALUE: int = 3",
      "DATA = {...}",
      "LIST = [...]",
      "CALL = ...",
      'TEXT = "# not comment"',
      "INLINE = 2",
    ]);
  });
});

describe("createCommentsExtractor", () => {
  test("extracts hash comments and ignores hashes inside strings", () => {
    const source = [
      'text = "# not a comment"',
      "# first real comment",
      "value = 1  # trailing",
      "triple = '''not # comment'''",
      'other = "still # not"',
      "",
    ].join("\n");

    const extractor = createCommentsExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      "# first real comment",
      "# trailing",
    ]);
  });
});

describe("createExportsExtractor", () => {
  test("exports public top-level declarations when __all__ is absent", () => {
    const source = [
      "import os",
      "import pathlib as PathLib",
      "from pkg import alpha, _beta, gamma as PublicGamma",
      "VALUE = 1",
      "_PRIVATE = 2",
      "Name, _other = make_names()",
      "class User(Base):",
      "    def name(self) -> str:",
      '        return "x"',
      "class _Hidden:",
      "    pass",
      "async def Load() -> None:",
      "    pass",
      "def _helper():",
      "    pass",
    ].join("\n");

    const result = createExportsExtractor().extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      "class User(Base):",
      "async def Load() -> None: ...",
      "VALUE = 1",
      "Name, _other = ...",
      "import os",
      "import pathlib as PathLib",
      "from pkg import alpha, _beta, gamma as PublicGamma",
    ]);
  });

  test("uses __all__ as the explicit Python export list when present", () => {
    const source = [
      "from pkg import alpha, beta as PublicBeta, gamma",
      "__all__ = [",
      "    'User',",
      "    'Load',",
      "    'PublicBeta',",
      "]",
      "VALUE = 1",
      "class User:",
      "    pass",
      "def Load():",
      "    pass",
      "def helper():",
      "    pass",
    ].join("\n");

    const result = createExportsExtractor().extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      "class User:",
      "def Load(): ...",
      "from pkg import alpha, beta as PublicBeta, gamma",
    ]);
  });
});

describe("createImportsExtractor", () => {
  test("extracts import statements including multiline imports", () => {
    const source = [
      "import os",
      "from pkg import (",
      "    alpha,",
      "    beta,",
      ")",
      "",
      "value = 1",
      "",
    ].join("\n");

    const extractor = createImportsExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      "import os",
      "from pkg import (alpha, beta,)",
    ]);
  });

  test("works with the repository Python fixture", async () => {
    const fixturePath = path.resolve("tests/fixtures/python/basic.py");
    const source = await readFile(fixturePath, "utf8");

    const signatures = createSignaturesExtractor().extract(
      createPyParseContext({
        source,
        filePath: fixturePath,
      }),
    );
    const imports = createImportsExtractor().extract(
      createPyParseContext({
        source,
        filePath: fixturePath,
      }),
    );

    expect(signatures.entries.map((entry) => entry.lines)).toEqual([
      [
        "class User(Base):",
        "    def name(self) -> str: ...",
        "    async def load(self, id: int,) -> None: ...",
      ],
      ["def greet(name: str) -> str: ..."],
    ]);
    expect(imports.entries.map((entry) => entry.lines[0])).toEqual([
      "import os",
      "from pkg import (alpha, beta,)",
    ]);
  });
});
