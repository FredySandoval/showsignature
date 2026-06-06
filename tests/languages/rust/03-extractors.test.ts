import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createRustParseContext } from "@/src/languages/rust/01-context.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "@/src/languages/rust/03-extractors.js";

function buildContext(source: string) {
  return createRustParseContext({ source, filePath: "/tmp/example.rs" });
}

describe("Rust extractors", () => {
  test("extract signatures, traits, types, variables, comments, imports, and exports", async () => {
    const fixturePath = path.resolve("tests/fixtures/rust/basic.rs");
    const source = await readFile(fixturePath, "utf8");
    const context = buildContext(source);

    expect(createSignaturesExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "pub async fn load(id: UserId) -> Result<User, Error> ...",
      "fn helper(value: &str) -> String ...",
    ]);
    expect(createInterfacesExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "pub trait Named {",
    ]);
    expect(createTypesExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "pub struct User {",
      "enum State {",
      "type UserId = u64;",
    ]);
    expect(createVariablesExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      'pub const VERSION: &str = "1.0"',
      "static COUNT: usize = 3",
    ]);
    expect(createCommentsExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "// module comment",
      "/* block",
    ]);
    expect(createImportsExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "use std::{fmt, io};",
      "pub use crate::prelude::*;",
      "mod inner;",
      "extern crate alloc;",
    ]);
    expect(createExportsExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "async fn load(id: UserId) -> Result<User, Error> ...",
      "trait Named {",
      "struct User {",
      'const VERSION: &str = "1.0"',
      "use crate::prelude::*;",
    ]);
  });
});
