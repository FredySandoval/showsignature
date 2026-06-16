import { describe, expect, test } from "bun:test";

import { runExtractors } from "@/src/01-main.js";
import { createTsParseContext } from "@/src/languages/typescript/01-context.js";
import { createTsFamilyAdapter } from "@/src/languages/typescript/00-adapter.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "@/src/languages/typescript/03-extractors.js";

function buildContext(source: string) {
  return createTsParseContext({
    source,
    filePath: "/tmp/example.ts",
  });
}

describe("createSignaturesExtractor", () => {
  test("extracts class and function signatures", () => {
    const source = `
      export abstract class UserAccount<T> extends BaseAccount implements User {
        constructor(public id: number) {}
        async getProfile(): Promise<string> {
          return "ok";
        }
      }

      export function printUserInfo<T extends User>(user: T): void {
        console.log(user);
      }
    `;
    const extractor = createSignaturesExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.kind)).toEqual([
      "signatures",
      "signatures",
    ]);
    expect(result.entries[0]?.lines).toEqual([
      "export abstract class UserAccount<T> extends BaseAccount implements User {",
      "  constructor(public id: number);",
      "  async getProfile(): Promise<string>;",
      "}",
    ]);
    expect(result.entries[1]?.lines).toEqual([
      "export function printUserInfo<T extends User>(user: T): void;",
    ]);
    expect(
      result.entries.every(
        (entry) => entry.metadata?.filePath === "/tmp/example.ts",
      ),
    ).toBe(true);
    expect(
      result.entries.every(
        (entry) => typeof entry.metadata?.sourcePos === "number",
      ),
    ).toBe(true);
  });
});

describe("createInterfacesExtractor", () => {
  test("extracts interface definitions", () => {
    const source = `
      export interface User {
        id: string;
      }
    `;
    const extractor = createInterfacesExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.kind).toBe("interfaces");
    expect(result.entries[0]?.lines).toEqual([
      "export interface User {",
      "        id: string;",
      "      }",
    ]);
  });
});

describe("createTypesExtractor", () => {
  test("extracts type aliases", () => {
    const source = `
      export type UserId = string | number;
    `;
    const extractor = createTypesExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.kind).toBe("types");
    expect(result.entries[0]?.lines).toEqual([
      "export type UserId = string | number;",
    ]);
  });
});

describe("createVariablesExtractor", () => {
  test("extracts variable declarations and summarizes initializers", () => {
    const source = `
      export const API_URL = "https://example.com";
      let cache: Map<string, User> = new Map();
      const settings = { theme: "dark", compact: true };
      const list = [1, 2, 3];
      const fn = () => true;
      let deferred: number;
    `;
    const extractor = createVariablesExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      'export const API_URL = "https://example.com";',
      "let cache: Map<string, User> = ...;",
      'const settings = { theme: "dark", compact: true };',
      "const list = [1, 2, 3];",
      "const fn = ...;",
      "let deferred: number;",
    ]);
  });

  test("renders long array initializers as bounded one-line previews", () => {
    const source = 'const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];';
    const extractor = createVariablesExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      'const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];',
    ]);
  });

  test("renders multi-line template literal initializers as bounded one-line previews", () => {
    const source = [
      "const DESCRIPTION = `Fastest path for understanding an unfamiliar codebase by extracting structural signatures from key source files.",
      "--show-only <options>     comma-separated extract kinds to include",
      "`;",
    ].join("\n");
    const extractor = createVariablesExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      "const DESCRIPTION = `Fastest path for understanding an unfamiliar codebase by extracting structu...`;",
    ]);
  });
});

describe("createCommentsExtractor", () => {
  test("extracts comments and ignores comment-like tokens in strings/regex/templates", () => {
    const source = `
      const a = "not // comment";
      const b = \`not /* comment */\`;
      const c = /not \\/\\/ comment/;
      // first real comment
      /*
        second real comment
      */
      const done = true; // trailing
    `;
    const extractor = createCommentsExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines.join("\n"))).toEqual([
      "// first real comment",
      "/*\n        second real comment\n      */",
      "// trailing",
    ]);
  });
});

describe("createExportsExtractor", () => {
  test("extracts ES module export statements and declarations", () => {
    const source = `
      const local = 1;
      export { local as a } from "./a";
      export type { User } from "./types";
      export * from "./all";
      export default function run(): void { console.log("run"); }
      export = legacy;
      export interface Person { id: string; }
      export type Id = string;
      export enum Mode { On }
      export namespace Api { export const version = 1; }
      export const value = 1;
    `;
    const extractor = createExportsExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.kind)).toEqual([
      "exports",
      "exports",
      "exports",
      "exports",
      "exports",
      "exports",
      "exports",
      "exports",
      "exports",
      "exports",
    ]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      'export { local as a } from "./a";',
      'export type { User } from "./types";',
      'export * from "./all";',
      "export default function run(): void;",
      "export = legacy;",
      "export interface Person { id: string; }",
      "export type Id = string;",
      "export enum Mode { On }",
      "export namespace Api { ... }",
      "export const value = 1;",
    ]);
  });

  test("renders exported public APIs compactly", () => {
    const source = `
      export function compute(value: string): number {
        const parsed = Number(value);
        return parsed + 1;
      }

      export class Service {
        constructor(private readonly name: string) {}
        start(): void {
          console.log(this.name);
        }
      }

      export const config = {
        endpoint: "/api",
        retries: 3,
      };

      export namespace BigApi {
        export function noisy(): void {
          console.log("do not include this body");
        }
      }
    `;
    const extractor = createExportsExtractor();
    const result = extractor.extract(buildContext(source));
    const rendered = result.entries.map((entry) => entry.lines.join("\n"));

    expect(result.warnings).toEqual([]);
    expect(rendered).toEqual([
      "export function compute(value: string): number;",
      [
        "export class Service {",
        "  constructor(private readonly name: string);",
        "  start(): void;",
        "}",
      ].join("\n"),
      "export const config = ...;",
      "export namespace BigApi { ... }",
    ]);
    expect(rendered.join("\n")).not.toContain("return parsed + 1");
    expect(rendered.join("\n")).not.toContain("console.log");
  });

  test("combines signatures and exports without duplicate function output", () => {
    const source = `
      export function run(): void {
        console.log("body should not render");
      }
    `;
    const adapter = createTsFamilyAdapter({
      id: "ts",
      extensions: [".ts"],
      fenceLang: "ts",
    });
    const result = runExtractors({
      adapter,
      context: buildContext(source),
      extractOrder: ["signatures", "exports"],
    });
    const rendered = result.entries.flatMap((entry) => entry.lines).join("\n");

    expect(rendered).toBe("export function run(): void;");
    expect(rendered).not.toContain("console.log");
  });

  test("extracts CommonJS export assignments", () => {
    const source = `
      const local = 1;
      module.exports = local;
      exports.foo = foo;
      module.exports.bar = bar;
      notExports.foo = foo;
    `;
    const extractor = createExportsExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      "module.exports = local;",
      "exports.foo = foo;",
      "module.exports.bar = bar;",
    ]);
  });
});

describe("createImportsExtractor", () => {
  test("extracts import declarations only", () => {
    const source = `
      import fs from "node:fs";
      import { readFile } from "node:fs/promises";
      import type { User } from "./types";

      const x = 1;
    `;
    const extractor = createImportsExtractor();
    const result = extractor.extract(buildContext(source));

    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => entry.kind)).toEqual([
      "imports",
      "imports",
      "imports",
    ]);
    expect(result.entries.map((entry) => entry.lines[0])).toEqual([
      'import fs from "node:fs";',
      'import { readFile } from "node:fs/promises";',
      'import type { User } from "./types";',
    ]);
  });
});
