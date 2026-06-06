import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createLuaParseContext } from "@/src/languages/lua/01-context.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "@/src/languages/lua/03-extractors.js";

function buildContext(source: string) {
  return createLuaParseContext({ source, filePath: "/tmp/example.lua" });
}

describe("Lua extractors", () => {
  test("extract signatures, variables, comments, imports, exports, and empty type-like kinds", async () => {
    const fixturePath = path.resolve("tests/fixtures/lua/basic.lua");
    const source = await readFile(fixturePath, "utf8");
    const context = buildContext(source);

    expect(createSignaturesExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "local function helper(value) ... end",
      "function greet(name) ... end",
      "function User:new(id) ... end",
      "run = function(opts) ... end",
    ]);
    expect(createVariablesExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      'local json = require("json")',
      'http = require "socket.http"',
      'local VERSION = "1.0"',
      "Config = {...}",
      "User = {...}",
    ]);
    expect(createCommentsExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "-- module comment",
      "--[[",
    ]);
    expect(createImportsExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      'local json = require("json")',
      'http = require "socket.http"',
    ]);
    expect(createExportsExtractor().extract(context).entries.map((entry) => entry.lines[0])).toEqual([
      "function greet(name) ... end",
      "function User:new(id) ... end",
      "run = function(opts) ... end",
      'http = require "socket.http"',
      "Config = {...}",
      "User = {...}",
    ]);
    expect(createInterfacesExtractor().extract(context).entries).toEqual([]);
    expect(createTypesExtractor().extract(context).entries).toEqual([]);
  });
});
