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
const originalStdoutIsTTY = process.stdout.isTTY;
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

  // The CLI mirrors trailer notes to stderr only when stdout is not a TTY;
  // pin the piped-consumer behavior so results don't depend on the terminal.
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    configurable: true,
  });

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
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalStdoutIsTTY,
    configurable: true,
  });
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

  test("prints help with examples and exits 1 when invoked without a command", async () => {
    installOutputCapture();

    await buildCli().run(["showsignature"]);

    expect(stdoutBuffer).toContain(
      "showsignature — extract the useful structure from source files",
    );
    expect(stdoutBuffer).toContain("showsignature map  [OPTION]... [PATH]...");
    expect(stdoutBuffer).toContain("Getting started:");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(1);
  });

  test("root, map, and read help match their snapshots", async () => {
    const helps: Record<string, string> = {};

    for (const args of [["--help"], ["map", "--help"], ["read", "--help"]]) {
      installOutputCapture();
      await buildCli().run(["showsignature", ...args]);
      helps[args.join(" ")] = stdoutBuffer;
      expect(stderrBuffer).toBe("");
    }

    expect(helps).toMatchSnapshot();
  });

  test("suggests the map command for old-form invocations", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showsignature", "src/app.ts"]),
    ).rejects.toThrow(
      "unknown command 'src/app.ts'. Did you mean: showsignature map src/app.ts?",
    );

    await expect(buildCli().run(["showsignature", "./src"])).rejects.toThrow(
      "unknown command './src'. Did you mean: showsignature map ./src?",
    );
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

    await buildCli().run(["showcode", "map", "src/app.ts"]);

    expect(stdoutBuffer).toBe(
      ["// src/app.ts", "1 function greet(name: string): string;", ""].join(
        "\n",
      ),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("advertises the line number opt-out flag in help", async () => {
    installOutputCapture();

    await buildCli().run(["showsignature", "map", "--help"]);

    expect(stdoutBuffer).toContain("--no-line-number");
    expect(stdoutBuffer).not.toContain("-n, --line-number");
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
        "showcode", "map",
        "src/app.ts",
        "--output",
        "artifacts/output.txt",
      ]),
    ).rejects.toThrow("unknown option '--output'");
  });

  test("optionally hides source line numbers", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      ["const hidden = 1;", "", "function greet(): void {}"].join("\n"),
    );

    process.chdir(rootDir);

    await buildCli().run([
      "showcode", "map",
      "--only=signatures",
      "--no-line-number",
      "src/app.ts",
    ]);

    expect(stdoutBuffer).toBe(
      ["// src/app.ts", "function greet(): void;", ""].join("\n"),
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
      buildCli().run(["showcode", "map", "src/app.ts", "--lang", "rb"]),
    ).rejects.toThrow("rb not supported");
  });

  test("does not advertise removed file, folder, and stdin options", async () => {
    installOutputCapture();

    await buildCli().run(["showsignature", "map", "--help"]);

    expect(stdoutBuffer).toContain("showsignature map [OPTION]... [PATH]...");
    expect(stdoutBuffer).not.toContain("--file");
    expect(stdoutBuffer).not.toContain("--folder");
    expect(stdoutBuffer).not.toContain("--stdin");
  });

  test("reads source from stdin when - and --lang are provided", async () => {
    installOutputCapture();
    installStdin("function greet(name: string): string {\n  return name;\n}\n");

    await buildCli().run(["showcode", "map", "-", "--lang", "ts"]);

    expect(stdoutBuffer).toBe(
      ["// <stdin>.ts", "1 function greet(name: string): string;", ""].join(
        "\n",
      ),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("throws when removed --stdin option is used", async () => {
    installOutputCapture();
    installStdin("function greet(): void {}\n");

    await expect(
      buildCli().run(["showcode", "map", "--stdin", "--lang", "ts"]),
    ).rejects.toThrow("unknown option '--stdin'");
  });

  test("throws when - is used without --lang", async () => {
    installOutputCapture();
    installStdin("function greet(): void {}\n");

    await expect(buildCli().run(["showcode", "map", "-"])).rejects.toThrow(
      "Stdin operand '-' requires --lang",
    );
  });

  test("throws when - and file operands are both provided", async () => {
    installOutputCapture();
    installStdin("function greet(): void {}\n");

    await expect(
      buildCli().run(["showcode", "map", "-", "--lang", "ts", "src/app.ts"]),
    ).rejects.toThrow("Stdin operand '-' cannot be mixed with file operands");
  });

  test("throws when - is repeated", async () => {
    installOutputCapture();
    installStdin("function greet(): void {}\n");

    await expect(
      buildCli().run(["showcode", "map", "-", "-", "--lang", "ts"]),
    ).rejects.toThrow("Stdin operand '-' may only be provided once");
  });

  test("reads piped markdown input without --stdin when extract kinds are markdown-only", async () => {
    installOutputCapture();
    installStdin("# Hello\n\n## World\n");

    await buildCli().run(["showcode", "map", "--only", "md:headings"]);

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

    await buildCli().run(["showcode", "map", "--only", "md:headings"]);

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
      buildCli().run(["showcode", "map", "--only", "signatures"]),
    ).rejects.toThrow(
      "Could not infer stdin language. Please use --lang. Example: --lang ts",
    );
  });

  test("sets exit code and prints pipeline errors for unsupported files", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.txt", "hello");
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "src/app.txt"]);

    expect(stdoutBuffer).toBe("");
    expect(stderrBuffer).toContain("File is not supported");
    expect(stderrBuffer).toContain('extension ".txt" is not supported');
    expect(process.exitCode).toBe(1);
  });

  test("supports .tsx files with default TypeScript extractors", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/component.tsx",
      "export const App = () => (<Layout><Header /></Layout>);",
    );
    process.chdir(rootDir);

    await buildCli().run([
      "showcode", "map",
      "src/component.tsx",
      "--only",
      "exports,variables",
    ]);

    expect(stderrBuffer).toBe("");
    expect(stdoutBuffer).toContain("export const App");
    expect(process.exitCode).toBe(0);
  });

  test("supports .svelte files with default TypeScript extractors", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/Component.svelte",
      [
        '<script context="module" lang="ts">',
        "  export interface PageData { title: string }",
        "</script>",
        '<script lang="ts">',
        "  export let title: string;",
        "</script>",
        "<h1>{title}</h1>",
      ].join("\n"),
    );
    process.chdir(rootDir);

    await buildCli().run([
      "showcode", "map",
      "src/Component.svelte",
      "--only",
      "interfaces,variables",
    ]);

    expect(stderrBuffer).toBe("");
    expect(stdoutBuffer).toContain("export interface PageData");
    expect(stdoutBuffer).toContain("export let title: string;");
    expect(process.exitCode).toBe(0);
  });

  test("discovers files when a directory operand is provided", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      "function greet(): void {}\n",
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "src"]);

    expect(stdoutBuffer).toBe(
      ["// src/app.ts", "1 function greet(): void;", ""].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("processes mixed file and directory operands in operand order", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "b.ts", "function second(): void {}\n");
    await writeFixtureFile(rootDir, "src/a.ts", "function first(): void {}\n");
    await writeFixtureFile(rootDir, "src/c.ts", "function third(): void {}\n");
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "b.ts", "src"]);

    expect(stdoutBuffer).toBe(
      [
        "// b.ts",
        "1 function second(): void;",
        "",
        "// src/a.ts",
        "1 function first(): void;",
        "",
        "// src/c.ts",
        "1 function third(): void;",
        "",
      ].join("\n"),
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("throws a clear error when an operand cannot be accessed", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    process.chdir(rootDir);

    await expect(
      buildCli().run(["showcode", "map", "src/missing.ts"]),
    ).rejects.toThrow("Could not access path: src/missing.ts");
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
      "showcode", "map",
      "--only=signatures",
      "--include-tests",
      "tests/fixtures",
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

    await buildCli().run(["showcode", "map", "--max-depth", "2"]);

    expect(stdoutBuffer).toContain("// top.ts");
    expect(stdoutBuffer).toContain("// src/one.ts");
    expect(stdoutBuffer).not.toContain("// src/nested/two.ts");
    expect(stdoutBuffer).toContain(
      "note: depth limit 2 reached; 1 more file(s) at depth 3 — pass --max-depth 3 or --all",
    );
    expect(process.exitCode).toBe(0);
  });

  test("applies a default max depth of 2 to directory scans and notes the truncation", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "top.ts", "function top(): void {}\n");
    await writeFixtureFile(rootDir, "src/one.ts", "function one(): void {}\n");
    await writeFixtureFile(
      rootDir,
      "src/nested/two.ts",
      "function two(): void {}\n",
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "."]);

    expect(stdoutBuffer).toContain("// top.ts");
    expect(stdoutBuffer).toContain("// src/one.ts");
    expect(stdoutBuffer).not.toContain("two.ts");
    expect(stdoutBuffer).toContain(
      "note: directory scan depth-limited to 2 by default; pass --max-depth <n> to go deeper",
    );
    expect(stderrBuffer).toContain(
      "note: directory scan depth-limited to 2 by default",
    );
    expect(process.exitCode).toBe(0);
  });

  test("emits no depth notice when the default depth is not hit", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "top.ts", "function top(): void {}\n");
    await writeFixtureFile(rootDir, "src/one.ts", "function one(): void {}\n");
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "."]);

    expect(stdoutBuffer).toContain("// top.ts");
    expect(stdoutBuffer).toContain("// src/one.ts");
    expect(stdoutBuffer).not.toContain("note:");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("explicit --max-depth overrides the default without a notice", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/nested/deep/three.ts",
      "function three(): void {}\n",
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "--max-depth", "5", "."]);

    expect(stdoutBuffer).toContain("// src/nested/deep/three.ts");
    expect(stdoutBuffer).not.toContain("note:");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("caps map output and summarizes remaining files with a note trailer", async () => {
    installOutputCapture();

    const manyFunctions = (prefix: string, count: number): string =>
      Array.from(
        { length: count },
        (_, index) => `function ${prefix}${index}(): void {}`,
      ).join("\n");

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "a.ts", manyFunctions("a", 1500));
    await writeFixtureFile(rootDir, "b.ts", manyFunctions("b", 1500));
    await writeFixtureFile(rootDir, "c.ts", manyFunctions("c", 1500));
    process.chdir(rootDir);

    await buildCli().run([
      "showcode", "map",
      "--no-line-number",
      "a.ts",
      "b.ts",
      "c.ts",
    ]);

    expect(stdoutBuffer).toContain("// a.ts");
    expect(stdoutBuffer).toContain("function a1499(): void;");
    expect(stdoutBuffer).toContain("// output capped — remaining files:");
    expect(stdoutBuffer).toContain("// b.ts (1500 entries)");
    expect(stdoutBuffer).toContain("// c.ts (1500 entries)");
    expect(stdoutBuffer).not.toContain("function b0(): void;");
    expect(stdoutBuffer).toContain(
      "note: output capped at 2000 lines (2 of 3 files summarized).",
    );
    expect(stdoutBuffer).toContain("--all disables the cap");
    expect(stderrBuffer).toContain("note: output capped at 2000 lines");
    expect(process.exitCode).toBe(0);
  });

  test("caps a single pathological file by keeping whole entries until the budget is spent", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "big.ts",
      Array.from(
        { length: 2500 },
        (_, index) => `function b${index}(): void {}`,
      ).join("\n"),
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "--no-line-number", "big.ts"]);

    expect(stdoutBuffer).toContain("function b0(): void;");
    expect(stdoutBuffer).toContain("function b1998(): void;");
    expect(stdoutBuffer).not.toContain("function b1999(): void;");
    expect(stdoutBuffer).toContain("// big.ts (501 more entries)");
    expect(stdoutBuffer).toContain(
      "note: output capped at 2000 lines (1 of 1 files summarized).",
    );
    expect(process.exitCode).toBe(0);
  });

  test("--all disables the output caps", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "big.ts",
      Array.from(
        { length: 2500 },
        (_, index) => `function big${index}(): void {}`,
      ).join("\n"),
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "--all", "big.ts"]);

    expect(stdoutBuffer).toContain("function big2499(): void;");
    expect(stdoutBuffer).not.toContain("note:");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("windows map entries with --skip and --take", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      [
        "function first(): void {}",
        "function second(): void {}",
        "function third(): void {}",
        "function fourth(): void {}",
      ].join("\n"),
    );
    process.chdir(rootDir);

    await buildCli().run([
      "showcode", "map",
      "--skip",
      "1",
      "--take",
      "2",
      "src/app.ts",
    ]);

    expect(stdoutBuffer).not.toContain("function first(): void;");
    expect(stdoutBuffer).toContain("2 function second(): void;");
    expect(stdoutBuffer).toContain("3 function third(): void;");
    expect(stdoutBuffer).not.toContain("function fourth(): void;");
    expect(stdoutBuffer).toContain(
      "note: showing entries 2-3 of 4; continue with --skip 3",
    );
    expect(stderrBuffer).toContain("note: showing entries 2-3 of 4");
    expect(process.exitCode).toBe(0);
  });

  test("notes when --skip skips every extracted entry", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.ts", "function one(): void {}\n");
    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "--skip", "9", "src/app.ts"]);

    expect(stdoutBuffer).toContain(
      "note: --skip 9 skips all 1 extracted entries",
    );
    expect(stdoutBuffer).not.toContain("function one(): void;");
    expect(process.exitCode).toBe(0);
  });

  test("rejects invalid --skip and --take values", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "map", "--skip", "-1", "."]),
    ).rejects.toThrow("Option --skip must be a non-negative integer");

    await expect(
      buildCli().run(["showcode", "map", "--take", "0", "."]),
    ).rejects.toThrow("Option --take must be a positive integer");
  });

  test("throws for removed --ignore-folder option", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "map", "--ignore-folder", "generated"]),
    ).rejects.toThrow("unknown option '--ignore-folder'");
  });

  test("throws when --max-depth is not a non-negative integer", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "map", "--max-depth", "-1"]),
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

    await buildCli().run(["showcode", "map", "--lang", "ts"]);

    expect(stdoutBuffer).toBe(
      ["// src/app.ts", "1 export function greet(): void;", ""].join("\n"),
    );
    expect(stdoutBuffer).not.toContain("// README.md");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("maps markdown files with the md defaults when no --only is given", async () => {
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

    await buildCli().run(["showcode", "map", "README.md"]);

    expect(stdoutBuffer).toContain("// README.md");
    expect(stdoutBuffer).toContain("1 # The API Guide");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("throws when obsolete markdown full-document options are requested", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "README.md",
      ["# Title", "", "Body"].join("\n"),
    );
    process.chdir(rootDir);

    await expect(
      buildCli().run(["showcode", "map", "README.md", "--only=md"]),
    ).rejects.toThrow("Unsupported extract option: md.");

    await expect(
      buildCli().run(["showcode", "map", "README.md", "--only=md:all"]),
    ).rejects.toThrow("Unsupported extract option: md:all.");
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

    await buildCli().run(["showcode", "map", "--only=md:headings"]);

    expect(stdoutBuffer).toContain("// README.md");
    expect(stdoutBuffer).toContain("// docs/guide.md");
    expect(stdoutBuffer).not.toContain("// src/app.ts");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });
});

describe("cli round-2 regressions", () => {
  test("skips explicit files whose detected language mismatches --lang, with a note", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.py", "def greet():\n    pass\n");

    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "--lang", "go", "src/app.py"]);

    expect(stdoutBuffer).toContain(
      'skipped src/app.py: detected language "py" does not match --lang go',
    );
    expect(stdoutBuffer).not.toContain("def greet");
    expect(process.exitCode).toBe(0);
  });

  test("notes zero-entry results instead of printing nothing", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "basic.lua", "local x = 1\n");

    process.chdir(rootDir);

    await buildCli().run([
      "showcode", "map",
      "--only",
      "interfaces",
      "basic.lua",
    ]);

    expect(stdoutBuffer).toContain("note: 0 interfaces entries in 1 file");
    expect(process.exitCode).toBe(0);
  });

  test("map discloses redaction with the same note as read", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "config.py",
      'API_KEY = "sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n',
    );

    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "--only", "variables", "config.py"]);

    expect(stdoutBuffer).toContain("[redacted]");
    expect(stdoutBuffer).toContain(
      "note: 1 secret redacted; pass --no-redact for literal bytes",
    );
  });

  test("json:shape truncation is disclosed with a note naming the fixed cap", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "deep.json",
      '{"a":{"b":{"c":{"d":{"e":{"f":1}}}}}}\n',
    );

    process.chdir(rootDir);

    await buildCli().run(["showcode", "map", "deep.json"]);

    expect(stdoutBuffer).toContain("{...}");
    expect(stdoutBuffer).toContain(
      'note: json:shape elides nested detail as "..." past depth 5 or 20 object keys; this cap is fixed (--all does not lift it)',
    );
  });

  test("unknown options are reported once, not twice", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "map", "--bogus"]),
    ).rejects.toThrow("unknown option '--bogus'");

    expect(stderrBuffer).not.toContain("error: unknown option");
  });
});
