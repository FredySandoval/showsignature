import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  const dirPath = await mkdtemp(path.join(os.tmpdir(), "showcode-cli-"));
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

describe("buildCli", () => {
  test("prints signature output to stdout by default", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      `function greet(name: string): string {\n  return name;\n}\nconst hidden = 1;\n`,
    );

    process.chdir(rootDir);

    await buildCli().run(["showcode", "--file", "src/app.ts"]);

    expect(stdoutBuffer).toBe(
      ["// src/app.ts", "function greet(name: string): string;", ""].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("writes markdown output to a .md file and uses combined ordering by default", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      `// before\nfunction greet(): void {}\n`,
    );

    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "--file",
      "src/app.ts",
      "--show-only=signatures,comments",
      "--output",
      "artifacts/output.md",
    ]);

    const output = await readFile(
      path.join(rootDir, "artifacts/output.md"),
      "utf8",
    );

    expect(output).toBe(
      [
        "```ts",
        "// src/app.ts",
        "// before",
        "function greet(): void;",
        "```",
      ].join("\n"),
    );
    expect(stdoutBuffer).toBe("");
    expect(stderrBuffer).toBe("");
  });

  test("writes plain output to a non-markdown file", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      `function greet(): void {}\n`,
    );

    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "--file",
      "src/app.ts",
      "--output",
      "artifacts/output.txt",
    ]);

    const output = await readFile(
      path.join(rootDir, "artifacts/output.txt"),
      "utf8",
    );

    expect(output).toBe(
      ["// src/app.ts", "function greet(): void;"].join("\n"),
    );
    expect(stdoutBuffer).toBe("");
    expect(stderrBuffer).toBe("");
  });

  test("optionally prints source line numbers", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      ["const hidden = 1;", "", "function greet(): void {}"].join("\n"),
    );

    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "--file",
      "src/app.ts",
      "--show-only=signatures",
      "--line-number",
    ]);

    expect(stdoutBuffer).toBe(
      ["// src/app.ts", "   3 function greet(): void;", ""].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("throws for unsupported explicit languages", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.ts", "const value = 1;");
    process.chdir(rootDir);

    await expect(
      buildCli().run(["showcode", "--file", "src/app.ts", "--lang", "go"]),
    ).rejects.toThrow("go not supported");
  });

  test("throws when file and folder are both provided", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "--file", "src/app.ts", "--folder", "src"]),
    ).rejects.toThrow("Options --file and --folder cannot be used together");
  });

  test("sets exit code and prints pipeline errors for unsupported files", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.txt", "hello");
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--file", "src/app.txt"]);

    expect(stdoutBuffer).toBe("");
    expect(stderrBuffer).toContain("File is not supported");
    expect(stderrBuffer).toContain('extension ".txt" is not supported');
    expect(process.exitCode).toBe(1);
  });

  test("prints a clear unsupported extension error for .tsx files", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/component.tsx",
      "export const App = <div />;",
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--file", "src/component.tsx"]);

    expect(stdoutBuffer).toBe("");
    expect(stderrBuffer).toContain("File is not supported");
    expect(stderrBuffer).toContain('extension ".tsx" is not supported');
    expect(stderrBuffer).toContain(
      "Supported extensions: .cjs, .cts, .js, .md, .mjs, .mts, .py, .ts",
    );
    expect(process.exitCode).toBe(1);
  });

  test("throws when --file points to a directory", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await mkdir(path.join(rootDir, "tests", "fixtures"), { recursive: true });
    process.chdir(rootDir);

    await expect(
      buildCli().run(["showcode", "--file", "tests/fixtures"]),
    ).rejects.toThrow(
      "Option --file expects a file path; use --folder for directories",
    );
  });

  test("throws a clear error when --file cannot be accessed", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    process.chdir(rootDir);

    await expect(
      buildCli().run(["showcode", "--file", "src/missing.ts"]),
    ).rejects.toThrow("Could not access file: src/missing.ts");
  });

  test("includes test fixtures when explicitly requested", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "tests/fixtures/example.ts",
      `function fixtureCase(): void {}\n`,
    );
    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "--folder",
      "tests/fixtures",
      "--show-only=signatures",
      "--include-tests",
    ]);

    expect(stdoutBuffer).toBe(
      [
        "// tests/fixtures/example.ts",
        "function fixtureCase(): void;",
        "",
      ].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("simplifies markdown files with caveman", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "README.md",
      [
        "# The API Guide",
        "- The guide is basically here: [The API Guide](https://example.com/docs).",
        "> The API is basically slow because it renders everything.",
        "",
      ].join("\n"),
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--file", "README.md"]);

    expect(stdoutBuffer).toBe(
      [
        "// README.md",
        "# API Guide",
        "- guide is here: [The API Guide](https://example.com/docs)",
        "> API is slow. it renders everything",
        "",
      ].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });
});
