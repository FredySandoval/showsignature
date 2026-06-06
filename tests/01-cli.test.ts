import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { buildCli } from "@/src/01-main.js";

const require = createRequire(import.meta.url);
const packageMetadata = require("../package.json") as { version: string };

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalStdin = process.stdin;

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

function installStdin(content: string): void {
  const stdin = Readable.from([content]) as Readable & { isTTY?: boolean };
  stdin.isTTY = false;
  Object.defineProperty(process, "stdin", {
    value: stdin,
    configurable: true,
  });
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
  Object.defineProperty(process, "stdin", {
    value: originalStdin,
    configurable: true,
  });
  process.exitCode = 0;

  await Promise.all(
    tempDirs
      .splice(0)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

describe("buildCli", () => {
  test("prints version without an error diagnostic", async () => {
    installOutputCapture();

    await buildCli().run(["showsignature", "--version"]);

    expect(stdoutBuffer).toBe(`${packageMetadata.version}\n`);
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

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
      ["// src/app.ts", "1 function greet(name: string): string;", ""].join(
        "\n",
      ),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("throws for removed --output option", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      `function greet(): void {}\n`,
    );

    process.chdir(rootDir);

    await expect(
      buildCli().run([
        "showcode",
        "--file",
        "src/app.ts",
        "--output",
        "artifacts/output.txt",
      ]),
    ).rejects.toThrow("unknown option '--output'");
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
      ["// src/app.ts", "3 function greet(): void;", ""].join("\n"),
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
      buildCli().run(["showcode", "--file", "src/app.ts", "--lang-only", "rb"]),
    ).rejects.toThrow("rb not supported");
  });

  test("throws when file and folder are both provided", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "--file", "src/app.ts", "--folder", "src"]),
    ).rejects.toThrow("Options --file and --folder cannot be used together");
  });

  test("reads source from stdin when --stdin and --lang-only are provided", async () => {
    installOutputCapture();
    installStdin("function greet(name: string): string {\n  return name;\n}\n");

    await buildCli().run(["showcode", "--stdin", "--lang-only", "ts"]);

    expect(stdoutBuffer).toBe(
      ["// <stdin>.ts", "1 function greet(name: string): string;", ""].join(
        "\n",
      ),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("throws when --stdin is used without --lang-only", async () => {
    installOutputCapture();
    installStdin("function greet(): void {}\n");

    await expect(buildCli().run(["showcode", "--stdin"])).rejects.toThrow(
      "Option --stdin requires --lang-only",
    );
  });

  test("throws when --stdin and --file are both provided", async () => {
    installOutputCapture();
    installStdin("function greet(): void {}\n");

    await expect(
      buildCli().run([
        "showcode",
        "--stdin",
        "--file",
        "src/app.ts",
        "--lang-only",
        "ts",
      ]),
    ).rejects.toThrow("Options --stdin and --file cannot be used together");
  });

  test("reads piped markdown input without --stdin when extract kinds are markdown-only", async () => {
    installOutputCapture();
    installStdin("# Hello\n\n## World\n");

    await buildCli().run(["showcode", "--show-only", "md:headings"]);

    expect(stdoutBuffer).toBe(
      ["// <stdin>.md", "1 # Hello", "3 ## World", ""].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("falls back to cwd discovery when implicit stdin is empty", async () => {
    installOutputCapture();
    installStdin("");

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "README.md", "# Title\n\n## Install\n");
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--show-only", "md:headings"]);

    expect(stdoutBuffer).toBe(
      ["// README.md", "1 # Title", "3 ## Install", ""].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("throws when implicit stdin has content but its language is ambiguous", async () => {
    installOutputCapture();
    installStdin("function greet(): void {}\n");

    await expect(
      buildCli().run(["showcode", "--show-only", "signatures"]),
    ).rejects.toThrow(
      "Could not infer stdin language. Please use --lang-only. Example: --lang-only .ts",
    );
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

  test("supports .tsx files with JSX html extraction", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/component.tsx",
      "export const App = () => (<Layout><Header /></Layout>);",
    );
    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "--file",
      "src/component.tsx",
      "--show-only",
      "html",
    ]);

    expect(stderrBuffer).toBe("");
    expect(stdoutBuffer).toContain("<Layout>");
    expect(stdoutBuffer).toContain("<Header />");
    expect(stdoutBuffer).toContain("</Layout>");
    expect(process.exitCode).toBe(0);
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
        "1 function fixtureCase(): void;",
        "",
      ].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("limits recursive discovery with --max-depth", async () => {
    installOutputCapture();
    installStdin("");

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "top.ts", "function top(): void {}\n");
    await writeFixtureFile(rootDir, "src/one.ts", "function one(): void {}\n");
    await writeFixtureFile(
      rootDir,
      "src/nested/two.ts",
      "function two(): void {}\n",
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--max-depth", "2"]);

    expect(stdoutBuffer).toContain("// top.ts");
    expect(stdoutBuffer).toContain("// src/one.ts");
    expect(stdoutBuffer).not.toContain("// src/nested/two.ts");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("ignores folders during recursive discovery with --ignore-folder", async () => {
    installOutputCapture();
    installStdin("");

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.ts", "function app(): void {}\n");
    await writeFixtureFile(
      rootDir,
      "src/generated/drop.ts",
      "function generated(): void {}\n",
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--ignore-folder", "generated"]);

    expect(stdoutBuffer).toContain("// src/app.ts");
    expect(stdoutBuffer).not.toContain("// src/generated/drop.ts");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("throws when --max-depth is not a non-negative integer", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "--max-depth", "-1"]),
    ).rejects.toThrow("Option --max-depth must be a non-negative integer");
  });

  test("filters recursive discovery by explicit language", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      "export function greet(): void {}\n",
    );
    await writeFixtureFile(
      rootDir,
      "README.md",
      ["# Title", "", "Body"].join("\n"),
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--lang-only", "ts"]);

    expect(stdoutBuffer).toBe(
      ["// src/app.ts", "1 export function greet(): void;", ""].join("\n"),
    );
    expect(stdoutBuffer).not.toContain("// README.md");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("skips markdown files when default signatures are requested", async () => {
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

    expect(stdoutBuffer).toBe("");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("renders full markdown documents when md is requested", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "README.md",
      ["# Title", "", "Body"].join("\n"),
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--file", "README.md", "--show-only=md"]);

    expect(stdoutBuffer).toBe(
      ["// README.md", "1 # Title", "  ", "  Body", ""].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("scans only markdown files when only markdown extract kinds are requested", async () => {
    installOutputCapture();
    installStdin("");

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "README.md",
      ["# Root", "", "Body"].join("\n"),
    );
    await writeFixtureFile(
      rootDir,
      "docs/guide.md",
      ["## Guide", "", "Text"].join("\n"),
    );
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      "function greet(): void {}\n",
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "--show-only=md"]);

    expect(stdoutBuffer).toContain("// README.md");
    expect(stdoutBuffer).toContain("// docs/guide.md");
    expect(stdoutBuffer).not.toContain("// src/app.ts");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });
});
