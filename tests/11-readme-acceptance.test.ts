import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildCli } from "@/src/01-main.js";

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

let stdoutBuffer = "";
let stderrBuffer = "";

function captureWrite(chunk: string | Uint8Array): string {
  return typeof chunk === "string"
    ? chunk
    : Buffer.from(chunk).toString("utf8");
}

function installOutputCapture(): void {
  stdoutBuffer = "";
  stderrBuffer = "";
  process.exitCode = 0;

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutBuffer += captureWrite(chunk);
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrBuffer += captureWrite(chunk);
    return true;
  }) as typeof process.stderr.write;
}

async function createTempDir(): Promise<string> {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), "showcode-readme-"));
  tempDirs.push(dirPath);
  return dirPath;
}

async function writeFixtureFile(
  rootDir: string,
  relativePath: string,
  content: string,
): Promise<string> {
  const filePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return filePath;
}

afterEach(async () => {
  process.chdir(originalCwd);
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  process.exitCode = 0;

  await Promise.all(
    tempDirs
      .splice(0)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

describe("README acceptance", () => {
  test("extracts every documented feature and skips test files during recursive folder traversal", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/nested/feature.ts",
      [
        'import fs from "node:fs";',
        'import type { UserShape } from "./types";',
        "",
        "// Env setup",
        "export interface User {",
        "  id: number;",
        "}",
        "",
        "export type UserId = string | number;",
        "",
        'export const API_URL = "https://example.com";',
        "let cache: Map<string, User> = new Map();",
        'const settings = { theme: "dark", compact: true };',
        "",
        "export abstract class UserAccount<T extends User> implements User {",
        "  constructor(public id: number) {}",
        "  getProfile(): string {",
        '    return "something";',
        "  }",
        "}",
        "",
        "export function printUserInfo<T extends User>(user: T): void {",
        "  console.log(user);",
        "}",
        "",
      ].join("\n"),
    );
    await writeFixtureFile(
      rootDir,
      "src/nested/feature.test.ts",
      "export function shouldNotAppear(): void {}\n",
    );
    await writeFixtureFile(
      rootDir,
      "src/tests/ignored.ts",
      "export function shouldAlsoNotAppear(): void {}\n",
    );

    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "--folder",
      "src",
      "--show-only=imports,comments,interfaces,types,variables,signatures",
    ]);

    expect(stdoutBuffer).toBe(
      [
        "// src/nested/feature.ts",
        'import fs from "node:fs";',
        'import type { UserShape } from "./types";',
        "// Env setup",
        "export interface User {",
        "  id: number;",
        "}",
        "export type UserId = string | number;",
        'export const API_URL = "https://example.com";',
        "let cache: Map<string, User> = ...;",
        "const settings = {...};",
        "export abstract class UserAccount<T extends User> implements User {",
        "  constructor(public id: number);",
        "  getProfile(): string;",
        "}",
        "export function printUserInfo<T extends User>(user: T): void;",
        "",
      ].join("\n"),
    );
    expect(stdoutBuffer).not.toContain("shouldNotAppear");
    expect(stdoutBuffer).not.toContain("shouldAlsoNotAppear");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });
});
