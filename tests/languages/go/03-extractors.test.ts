import { describe, expect, test } from "bun:test";

import { createGoParseContext } from "@/src/languages/go/01-context.js";
import {
  createCommentsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "@/src/languages/go/03-extractors.js";

function buildContext(source: string) {
  return createGoParseContext({ source, filePath: "/tmp/example.go" });
}

describe("Go extractors", () => {
  test("extracts top-level function and method signatures", () => {
    const source = [
      "package main",
      "func NewUser(id string) *User { return &User{ID: id} }",
      "func (u *User) Name() string { return u.name }",
      "func generic[T any](value T) T { return value }",
      "func multiline(",
      "    value string,",
      ") error {",
      "    return nil",
      "}",
    ].join("\n");

    expect(
      createSignaturesExtractor()
        .extract(buildContext(source))
        .entries.map((entry) => entry.lines[0]),
    ).toEqual([
      "func NewUser(id string) *User",
      "func (u *User) Name() string",
      "func generic[T any](value T) T",
      "func multiline( value string, ) error",
    ]);
  });

  test("extracts interfaces and non-interface types", () => {
    const source = [
      "type Reader interface {",
      "    Read(p []byte) (n int, err error)",
      "}",
      "type Constraint[T any] interface { comparable }",
      "type User struct { ID string }",
      "type UserID = string",
      "type (",
      "    Point struct { X int; Y int }",
      "    Named string",
      "    GroupReader interface { Read([]byte) (int, error) }",
      ")",
    ].join("\n");

    expect(
      createInterfacesExtractor()
        .extract(buildContext(source))
        .entries.map((entry) => entry.lines[0]),
    ).toEqual([
      "type Reader interface {",
      "type Constraint[T any] interface { comparable }",
      "type GroupReader interface { Read([]byte) (int, error) }",
    ]);
    expect(
      createTypesExtractor()
        .extract(buildContext(source))
        .entries.map((entry) => entry.lines[0]),
    ).toEqual([
      "type User struct { ID string }",
      "type UserID = string",
      "type Point struct { X int; Y int }",
      "type Named string",
    ]);
  });

  test("extracts variables and summarizes values", () => {
    const source = [
      'const Version = "1.0.0"',
      "var cache = map[string]int{}",
      "var list = []int{1, 2, 3}",
      "var Ready bool",
      "const (",
      "    Flag = true",
      "    Number = factory()",
      ")",
    ].join("\n");

    expect(
      createVariablesExtractor()
        .extract(buildContext(source))
        .entries.map((entry) => entry.lines[0]),
    ).toEqual([
      'const Version = "1.0.0"',
      "var cache = {...}",
      "var list = [...]",
      "var Ready bool",
      "const Flag = true",
      "const Number = ...",
    ]);
  });

  test("extracts comments while ignoring comment-like tokens in strings, raw strings, and runes", () => {
    const source = [
      'var text = "// not comment"',
      "var raw = `/* not comment */",
      "// still raw`",
      "var r = '/'",
      "// real line",
      "const x = 1 // trailing",
      "/* block",
      "comment */",
    ].join("\n");

    expect(
      createCommentsExtractor()
        .extract(buildContext(source))
        .entries.map((entry) => entry.lines),
    ).toEqual([["// real line"], ["// trailing"], ["/* block", "comment */"]]);
  });

  test("extracts single and grouped imports", () => {
    const source = [
      'import "fmt"',
      'import alias "pkg/path"',
      "import (",
      '    "os"',
      '    _ "net/http"',
      ")",
    ].join("\n");

    expect(
      createImportsExtractor()
        .extract(buildContext(source))
        .entries.map((entry) => entry.lines),
    ).toEqual([
      ['import "fmt"'],
      ['import alias "pkg/path"'],
      ["import (", '    "os"', '    _ "net/http"', ")"],
    ]);
  });
});
