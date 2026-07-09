import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildCli } from "@/src/01-main.js";
import {
  buildSymbolSummaryLines,
  escapeSymbolToken,
  isSymbolSummaryKind,
} from "@/src/03-symbol-summary.js";

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalStdoutIsTTY = process.stdout.isTTY;

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
  const dirPath = await mkdtemp(path.join(os.tmpdir(), "showcode-symsum-"));
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

async function runCli(args: string[]): Promise<void> {
  installOutputCapture();
  await buildCli().run(["showsignature", ...args]);
}

afterEach(async () => {
  process.chdir(originalCwd);
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalStdoutIsTTY,
    configurable: true,
  });
  process.exitCode = 0;

  await Promise.all(
    tempDirs
      .splice(0)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

const TS_FIXTURE = `import { runMigrations, MigrationLock } from "./migrate.js";

// TODO: mentionedOnlyInComment should never appear
export const POOL_MAX = 10;

export function createPool(schemaVersion: string): void {
  runMigrations();
}
`;

describe("map --symbol-summary", () => {
  test("emits one extractor:path line with pipe-joined verbatim tokens", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(dir, "pool.ts", TS_FIXTURE);

    await runCli(["map", "--symbol-summary", filePath]);

    const lines = stdoutBuffer.trim().split("\n");
    const signaturesLine = lines.find((line) =>
      line.startsWith("signatures:"),
    );
    const importsLine = lines.find((line) => line.startsWith("imports:"));

    expect(signaturesLine).toBeDefined();
    expect(importsLine).toBeDefined();
    expect(signaturesLine!).toContain("createPool|schemaVersion");
    expect(importsLine!).toContain("runMigrations|MigrationLock");
    expect(process.exitCode).toBe(0);
  });

  test("filters language keywords and primitive types, keeps chosen names", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(dir, "pool.ts", TS_FIXTURE);

    await runCli(["map", "--symbol-summary", filePath]);

    const payloads = stdoutBuffer
      .trim()
      .split("\n")
      .map((line) => line.slice(line.lastIndexOf(": ") + 2));
    const tokens = payloads.flatMap((payload) => payload.split("|"));

    for (const stopword of ["export", "function", "const", "string", "void"]) {
      expect(tokens).not.toContain(stopword);
    }
    expect(tokens).toContain("createPool");
  });

  test("never emits line numbers, even with the default line-number setting", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(dir, "pool.ts", TS_FIXTURE);

    await runCli(["map", "--symbol-summary", filePath]);

    for (const line of stdoutBuffer.trim().split("\n")) {
      expect(line).toMatch(/^[a-z:]+:.+: \S/u);
      expect(line).not.toMatch(/^\d/u);
    }
  });

  test("comments never contribute tokens", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(dir, "pool.ts", TS_FIXTURE);

    await runCli(["map", "--symbol-summary", filePath]);

    expect(stdoutBuffer).not.toContain("mentionedOnlyInComment");
  });

  test("markdown files contribute nothing; json:shape keys are included", async () => {
    const dir = await createTempDir();
    await writeFixtureFile(dir, "README.md", "# Migrations\n\nProse here.\n");
    await writeFixtureFile(
      dir,
      "config.json",
      `{ "db": { "host": "localhost", "poolMax": 5 } }\n`,
    );

    await runCli(["map", "--symbol-summary", dir]);

    expect(stdoutBuffer).not.toContain("Migrations");
    expect(stdoutBuffer).not.toContain("md:");
    const jsonLine = stdoutBuffer
      .trim()
      .split("\n")
      .find((line) => line.startsWith("json:shape:"));
    expect(jsonLine).toBeDefined();
    expect(jsonLine!).toContain("db");
    expect(jsonLine!).toContain("poolMax");
    // shape type names are syntax, not vocabulary
    expect(jsonLine!.split(": ").at(-1)!.split("|")).not.toContain("string");
  });

  test("errors when --only names an excluded extractor", async () => {
    const dir = await createTempDir();
    await writeFixtureFile(dir, "pool.ts", TS_FIXTURE);

    installOutputCapture();
    await expect(
      buildCli().run([
        "showsignature",
        "map",
        "--symbol-summary",
        "--only",
        "comments",
        dir,
      ]),
    ).rejects.toThrow(/prose extractor/u);
  });

  test("--skip/--take page over output lines and the trailer names the exact resume command", async () => {
    const dir = await createTempDir();
    await writeFixtureFile(dir, "a.ts", TS_FIXTURE);
    await writeFixtureFile(dir, "b.ts", TS_FIXTURE);

    await runCli(["map", "--symbol-summary", "--take", "1", dir]);

    const [firstLine, noteLine] = stdoutBuffer.trim().split("\n");
    expect(firstLine).toMatch(/^(signatures|imports):/u);
    expect(noteLine).toContain(
      `rerun with --symbol-summary --skip 1 --take 1 ${dir}`,
    );
  });

  test("output is deterministic across runs", async () => {
    const dir = await createTempDir();
    await writeFixtureFile(dir, "a.ts", TS_FIXTURE);
    await writeFixtureFile(dir, "nested/b.ts", TS_FIXTURE);
    await writeFixtureFile(dir, "config.json", `{ "key": 1 }\n`);

    await runCli(["map", "--symbol-summary", dir]);
    const firstRun = stdoutBuffer;
    await runCli(["map", "--symbol-summary", dir]);

    expect(stdoutBuffer).toBe(firstRun);
  });

  test("every emitted token exists verbatim in the source file", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(dir, "pool.ts", TS_FIXTURE);

    await runCli(["map", "--symbol-summary", filePath]);

    for (const line of stdoutBuffer.trim().split("\n")) {
      const payload = line.slice(line.lastIndexOf(": ") + 2);
      for (const token of payload.split("|")) {
        const literal = token.replace(/\\(.)/gu, "$1");
        expect(TS_FIXTURE).toContain(literal);
      }
    }
  });
});

describe("symbol-summary internals", () => {
  test("escapeSymbolToken keeps payloads valid regex patterns", () => {
    expect(escapeSymbolToken("$name")).toBe("\\$name");
    expect(escapeSymbolToken("plain_token")).toBe("plain_token");
    expect(() => new RegExp(escapeSymbolToken("$name"))).not.toThrow();
  });

  test("isSymbolSummaryKind excludes prose extractors only", () => {
    for (const kind of ["signatures", "imports", "exports", "json:shape"]) {
      expect(isSymbolSummaryKind(kind as never)).toBe(true);
    }
    for (const kind of [
      "comments",
      "md:headings",
      "md:tables",
      "md:codeblocks",
    ]) {
      expect(isSymbolSummaryKind(kind as never)).toBe(false);
    }
  });

  test("dedupes within a line but preserves repeats across lines", () => {
    const lines = buildSymbolSummaryLines(
      [
        {
          filePath: "a.ts",
          lang: "ts",
          warnings: [],
          entries: [
            {
              kind: "exports" as never,
              lines: ["export const runMigrations = runMigrations;"],
            },
            {
              kind: "imports" as never,
              lines: ["import { runMigrations } from './b.js';"],
            },
          ],
        },
      ],
      ["exports", "imports"] as never[],
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]!.payload).toBe("runMigrations");
    expect(lines[1]!.payload).toContain("runMigrations");
  });
});
