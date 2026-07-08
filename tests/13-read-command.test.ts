import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import {
  buildCli,
  buildEnclosingChain,
  degradeOutlineByDepth,
} from "@/src/01-main.js";
import type { ExtractEntry } from "@/src/00-core-types.js";

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

function installStdin(content: string): void {
  const stdin = Readable.from([content]) as Readable & { isTTY?: boolean };
  stdin.isTTY = false;
  Object.defineProperty(process, "stdin", {
    value: stdin,
    configurable: true,
  });
}

async function createTempDir(): Promise<string> {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), "showcode-read-"));
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

const WINDOW_FIXTURE = [
  "function first(): void {}",
  "function second(): void {",
  "  return;",
  "}",
  "function third(): void {}",
  "",
].join("\n");

describe("read command", () => {
  test("errors with a map hint when the target is a directory", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.ts", "const x = 1;\n");
    process.chdir(rootDir);

    await expect(buildCli().run(["showcode", "read", "src"])).rejects.toThrow(
      "'read' requires a file target; run 'showsignature map src' for a directory overview.",
    );
  });

  test("rejects more than one file operand", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "read", "a.ts", "b.ts"]),
    ).rejects.toThrow("'read' takes exactly one file; run one invocation per file");
  });

  test("reads a whole small file: full range tag, no outlines, no note", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "src/app.ts",
      "function greet(): void {\n  return;\n}\n",
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "read", "src/app.ts"]);

    expect(stdoutBuffer).toBe(
      '<content lines="1-3 of 3">\nfunction greet(): void {\n  return;\n}\n</content>\n',
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("windows with --offset/--limit: literal content framed by outlines", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.ts", WINDOW_FIXTURE);
    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "read",
      "--offset",
      "2",
      "--limit",
      "3",
      "src/app.ts",
    ]);

    expect(stdoutBuffer).toContain(
      '<outline region="before" note="signatures — display context, not file content">',
    );
    expect(stdoutBuffer).toContain("1 function first(): void;");
    expect(stdoutBuffer).toContain(
      '<content lines="2-4 of 5">\nfunction second(): void {\n  return;\n}\n</content>',
    );
    expect(stdoutBuffer).toContain('<outline region="after"');
    expect(stdoutBuffer).toContain("5 function third(): void;");
    expect(stdoutBuffer).toContain(
      "note: showing lines 2-4 of 5; continue with: showsignature read --offset 5 src/app.ts",
    );
    expect(stderrBuffer).toContain("note: showing lines 2-4 of 5");
    expect(process.exitCode).toBe(0);
  });

  test("--framing none emits the content only: no tags, no outline", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.ts", WINDOW_FIXTURE);
    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "read",
      "--offset",
      "2",
      "--limit",
      "3",
      "--framing",
      "none",
      "src/app.ts",
    ]);

    expect(stdoutBuffer).toBe(
      "function second(): void {\n  return;\n}\nnote: showing lines 2-4 of 5; continue with: showsignature read --offset 5 src/app.ts\n",
    );
    expect(stdoutBuffer).not.toContain("<content");
    expect(stdoutBuffer).not.toContain("<outline");
    expect(process.exitCode).toBe(0);
  });

  test("rejects an unknown --framing mode", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "read", "--framing", "bogus", "a.ts"]),
    ).rejects.toThrow("Option --framing must be one of: tags, none (got 'bogus')");
  });

  test("applies the default cap with an after-outline and continuation note", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    const lines = [
      "function early(): void {}",
      ...Array.from({ length: 2498 }, () => "// filler"),
      "function late(): void {}",
    ];
    await writeFixtureFile(rootDir, "big.ts", `${lines.join("\n")}\n`);
    process.chdir(rootDir);

    await buildCli().run(["showcode", "read", "big.ts"]);

    expect(stdoutBuffer).toContain('<content lines="1-2000 of 2500">');
    expect(stdoutBuffer).toContain('<outline region="after"');
    expect(stdoutBuffer).toContain("2500 function late(): void;");
    expect(stdoutBuffer).not.toContain('<outline region="before"');
    expect(stdoutBuffer).toContain(
      "note: showing lines 1-2000 of 2500; continue with: showsignature read --offset 2001 big.ts",
    );
    expect(process.exitCode).toBe(0);
  });

  test("clamps an explicit --limit to the hard cap unless --all is given", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "big.ts",
      `${Array.from({ length: 2500 }, () => "// filler").join("\n")}\n`,
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "read", "--limit", "2400", "big.ts"]);

    expect(stdoutBuffer).toContain('<content lines="1-2000 of 2500">');
    expect(stdoutBuffer).toContain("continue with: showsignature read --offset 2001");
    expect(process.exitCode).toBe(0);
  });

  test("--all reads the whole file without caps or notes", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "big.ts",
      `${Array.from({ length: 2500 }, () => "// filler").join("\n")}\n`,
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "read", "--all", "big.ts"]);

    expect(stdoutBuffer).toContain('<content lines="1-2500 of 2500">');
    expect(stdoutBuffer).not.toContain("note:");
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("reads stdin without --lang: frame and note, no outlines", async () => {
    installOutputCapture();
    installStdin("line one\nline two\nline three\n");

    await buildCli().run(["showcode", "read", "-", "--limit", "2"]);

    expect(stdoutBuffer).toContain(
      '<content lines="1-2 of 3">\nline one\nline two\n</content>',
    );
    expect(stdoutBuffer).not.toContain("<outline");
    expect(stdoutBuffer).toContain(
      "note: showing lines 1-2 of 3; continue with: showsignature read --offset 3 -",
    );
    expect(process.exitCode).toBe(0);
  });

  test("reads stdin with --lang: outlines frame the window", async () => {
    installOutputCapture();
    installStdin("def a():\n    pass\ndef b():\n    pass\ndef c():\n    pass\n");

    await buildCli().run([
      "showcode",
      "read",
      "-",
      "--lang",
      "py",
      "--offset",
      "3",
      "--limit",
      "2",
    ]);

    expect(stdoutBuffer).toContain('<outline region="before"');
    expect(stdoutBuffer).toContain("1 def a(): ...");
    expect(stdoutBuffer).toContain(
      '<content lines="3-4 of 6">\ndef b():\n    pass\n</content>',
    );
    expect(stdoutBuffer).toContain('<outline region="after"');
    expect(stdoutBuffer).toContain("5 def c(): ...");
    expect(process.exitCode).toBe(0);
  });

  test("marks redacted windows on the content tag and in the note", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      "config.ts",
      'const apiKey = "sk-abc123";\nconst x = 1;\n',
    );
    process.chdir(rootDir);

    await buildCli().run(["showcode", "read", "config.ts"]);

    expect(stdoutBuffer).toContain('<content lines="1-2 of 2" redacted="true">');
    expect(stdoutBuffer).toContain("const apiKey = [redacted];");
    expect(stdoutBuffer).toContain(
      "note: 1 secret redacted; pass --no-redact for literal bytes",
    );
    expect(process.exitCode).toBe(0);
  });

  test("--no-redact restores byte-identical window content", async () => {
    installOutputCapture();

    const source = 'const apiKey = "sk-abc123";\nconst x = 1;\n';
    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "config.ts", source);
    process.chdir(rootDir);

    await buildCli().run(["showcode", "read", "--no-redact", "config.ts"]);

    expect(stdoutBuffer).toBe(
      `<content lines="1-2 of 2">\n${source}</content>\n`,
    );
    expect(stderrBuffer).toBe("");
    expect(process.exitCode).toBe(0);
  });

  test("--no-line-number strips outline prefixes but keeps content raw", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.ts", WINDOW_FIXTURE);
    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "read",
      "--no-line-number",
      "--offset",
      "2",
      "--limit",
      "3",
      "src/app.ts",
    ]);

    expect(stdoutBuffer).toContain("function first(): void;");
    expect(stdoutBuffer).not.toContain("1 function first");
    expect(stdoutBuffer).not.toContain("5 function third");
    expect(stdoutBuffer).toContain(
      '<content lines="2-4 of 5">\nfunction second(): void {\n  return;\n}\n</content>',
    );
    expect(process.exitCode).toBe(0);
  });

  test("outline honors --outline for markdown windows", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    const markdown = [
      "# Title",
      "",
      "intro text",
      "more text",
      "even more text",
      "",
      "## Section",
      "",
      "body",
      "",
    ].join("\n");
    await writeFixtureFile(rootDir, "guide.md", markdown);
    process.chdir(rootDir);

    await buildCli().run([
      "showcode",
      "read",
      "--outline",
      "md:headings",
      "--offset",
      "3",
      "--limit",
      "2",
      "guide.md",
    ]);

    expect(stdoutBuffer).toContain('<outline region="before"');
    expect(stdoutBuffer).toContain("1 # Title");
    expect(stdoutBuffer).toContain(
      '<content lines="3-4 of 9">\nintro text\nmore text\n</content>',
    );
    expect(stdoutBuffer).toContain('<outline region="after"');
    expect(stdoutBuffer).toContain("7 ## Section");
    expect(process.exitCode).toBe(0);
  });

  test("errors when --offset is beyond the end of the input", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, "src/app.ts", "const x = 1;\n");
    process.chdir(rootDir);

    await expect(
      buildCli().run(["showcode", "read", "--offset", "9", "src/app.ts"]),
    ).rejects.toThrow("--offset 9 is beyond the end of the input (1 lines)");
  });

  test("rejects a zero --offset (line offsets are 1-indexed)", async () => {
    installOutputCapture();

    await expect(
      buildCli().run(["showcode", "read", "--offset", "0", "a.ts"]),
    ).rejects.toThrow(
      "Option --offset must be a positive integer (1-indexed first line)",
    );
  });
});

describe("outline helpers", () => {
  const entry = (line: number, text: string): ExtractEntry => ({
    kind: "signatures",
    lines: [text],
    metadata: { sourceLine: line },
  });

  test("degrades by depth: drops nested entries first, keeps every top-level symbol", () => {
    const entries: ExtractEntry[] = [];
    for (let outer = 0; outer < 10; outer += 1) {
      entries.push(entry(outer * 10 + 1, `def top${outer}():`));
      for (let inner = 0; inner < 6; inner += 1) {
        entries.push(entry(outer * 10 + 2 + inner, `  def inner${outer}_${inner}():`));
      }
    }

    const { chain, deepest } = buildEnclosingChain(entries);
    const kept = degradeOutlineByDepth(entries, chain);

    // 10 top-level entries plus the chain's deepest nested entry survive.
    expect(kept.length).toBe(11);
    for (let outer = 0; outer < 10; outer += 1) {
      expect(kept.some((e) => e.lines[0] === `def top${outer}():`)).toBe(true);
    }
    expect(deepest?.lines[0]).toBe("  def inner9_5():");
    expect(kept).toContain(deepest!);
    expect(kept.some((e) => e.lines[0] === "  def inner0_0():")).toBe(false);
  });

  test("never cuts positionally: an over-budget flat outline is kept complete", () => {
    const entries = Array.from({ length: 80 }, (_, index) =>
      entry(index + 1, `def top${index}():`),
    );

    const kept = degradeOutlineByDepth(entries, new Set());

    expect(kept.length).toBe(80);
  });

  test("enclosing chain tracks the open scopes at the window start", () => {
    const entries = [
      entry(1, "class A:"),
      entry(2, "  def m1():"),
      entry(10, "  def m2():"),
      entry(20, "class B:"),
      entry(21, "  def m3():"),
    ];

    const { chain, deepest } = buildEnclosingChain(entries);

    expect(deepest?.lines[0]).toBe("  def m3():");
    expect([...chain].map((e) => e.lines[0])).toEqual(["class B:", "  def m3():"]);
  });
});

describe("read round-2 regressions", () => {
  test("omits the window annotation when the window is not inside the last entry", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    const filePath = await writeFixtureFile(
      rootDir,
      "w.py",
      "def a():\n    pass\n\n\nx = 1\ny = 2\nz = 3\n",
    );

    await buildCli().run([
      "showcode", "read",
      "--offset",
      "5",
      "--limit",
      "1",
      filePath,
    ]);

    expect(stdoutBuffer).toContain("def a()");
    expect(stdoutBuffer).not.toContain("← window opens inside this");
  });

  test("keeps the window annotation when the window is indented inside the entry", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    const filePath = await writeFixtureFile(
      rootDir,
      "in.py",
      "def a():\n    x = 1\n    y = 2\n    z = 3\n",
    );

    await buildCli().run([
      "showcode", "read",
      "--offset",
      "3",
      "--limit",
      "1",
      filePath,
    ]);

    expect(stdoutBuffer).toContain("← window opens inside this");
  });

  test("skips empty outline tag pairs", async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    const filePath = await writeFixtureFile(
      rootDir,
      "w.py",
      "def a():\n    pass\n\n\nx = 1\ny = 2\nz = 3\n",
    );

    await buildCli().run([
      "showcode", "read",
      "--offset",
      "5",
      "--limit",
      "1",
      filePath,
    ]);

    expect(stdoutBuffer).toContain('<outline region="before"');
    expect(stdoutBuffer).not.toContain('<outline region="after"');
  });
});
