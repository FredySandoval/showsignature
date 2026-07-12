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
const originalStderrIsTTY = process.stderr.isTTY;

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
  Object.defineProperty(process.stderr, "isTTY", {
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
  Object.defineProperty(process.stderr, "isTTY", {
    value: originalStderrIsTTY,
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
  test("emits one extractor:path line with space-separated verbatim tokens", async () => {
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
    expect(signaturesLine!).toContain("createPool schemaVersion");
    expect(importsLine!).toContain("runMigrations MigrationLock");
    expect(process.exitCode).toBe(0);
  });

  test("drops the Go blank-identifier import alias but keeps its specifier", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(
      dir,
      "main.go",
      `package main

import (
    alias "example.com/pkg"
    _ "net/http"
)
`,
    );

    await runCli(["map", "--symbol-summary", filePath]);

    const importsLine = stdoutBuffer
      .trim()
      .split("\n")
      .find((line) => line.startsWith("imports:"));
    expect(importsLine).toBeDefined();
    const tokens = importsLine!.split(" ").slice(1);

    expect(tokens).toContain("alias");
    expect(tokens).toContain("net/http");
    expect(tokens).not.toContain("_");
  });

  test("import specifiers are one whole token: relative paths reduced to basename, packages verbatim", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(
      dir,
      "helpers.ts",
      `import * as ts from "typescript";
import type { Range } from "../../00-core-types.js";
`,
    );

    await runCli(["map", "--symbol-summary", filePath]);

    const importsLine = stdoutBuffer
      .trim()
      .split("\n")
      .find((line) => line.startsWith("imports:"));
    expect(importsLine).toBeDefined();
    const tokens = importsLine!.split(" ").slice(1);

    // whole specifiers, metacharacters escaped; digit-leading basename kept
    expect(tokens).toContain("typescript");
    expect(tokens).toContain("00-core-types\\.js");
    // no path fragments, no relative-prefix remnants
    for (const fragment of ["core", "types", "js", "00"]) {
      expect(tokens).not.toContain(fragment);
    }
    // imported names still tokenize normally around the specifier
    expect(tokens).toContain("ts");
    expect(tokens).toContain("Range");
  });

  test("filters language keywords and primitive types, keeps chosen names", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(dir, "pool.ts", TS_FIXTURE);

    await runCli(["map", "--symbol-summary", filePath]);

    const tokens = stdoutBuffer
      .trim()
      .split("\n")
      .flatMap((line) => line.split(" ").slice(1));

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
      expect(line).toMatch(/^[a-z:]+:\S+ \S/u);
      expect(line).not.toMatch(/^\d/u);
    }
  });

  test("double-quotes paths containing spaces", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(dir, "my pool.ts", TS_FIXTURE);

    await runCli(["map", "--symbol-summary", filePath]);

    const lines = stdoutBuffer.trim().split("\n");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/^[a-z:]+:"[^"]* [^"]*" \S/u);
    }
  });

  test("secret values are redacted from tokens and disclosed in the note", async () => {
    // Concatenated so this file never contains a contiguous secret-shaped
    // token (GitHub push protection).
    const awsKey = "AKIA" + "IOSFODNN7EXAMPLE";
    const fixture = `export const AWS_SECRET = "${awsKey}";\nexport const dbPassword = "hunter2secretvalue123456";\n`;
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(dir, "secrets.ts", fixture);

    await runCli(["map", "--symbol-summary", "--only", "variables", filePath]);

    expect(stdoutBuffer).toContain("AWS_SECRET");
    expect(stdoutBuffer).toContain("dbPassword");
    expect(stdoutBuffer).not.toContain(awsKey);
    expect(stdoutBuffer).not.toContain("hunter2secretvalue123456");
    expect(stdoutBuffer).not.toContain("redacted;pass"); // sanity
    expect(stdoutBuffer).toMatch(/note: .*secrets? redacted; pass --no-redact/u);

    await runCli([
      "map",
      "--symbol-summary",
      "--only",
      "variables",
      "--no-redact",
      filePath,
    ]);
    expect(stdoutBuffer).toContain(awsKey);
    expect(stdoutBuffer).toContain("hunter2secretvalue123456");
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
    expect(jsonLine!.split(" ").slice(1)).not.toContain("string");
  });

  test("JSON keys with non-identifier characters stay whole, escaped", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(
      dir,
      "weird.json",
      `{ "pool.max": 5, "a|b": 1, "e$f": [2] }\n`,
    );

    await runCli(["map", "--symbol-summary", filePath]);

    const jsonLine = stdoutBuffer
      .trim()
      .split("\n")
      .find((line) => line.startsWith("json:shape:"));
    expect(jsonLine).toBeDefined();
    const tokens = jsonLine!.split(" ").slice(1);
    expect(tokens).toContain("pool\\.max");
    expect(tokens).toContain("a\\|b");
    expect(tokens).toContain("e\\$f");
    // no fragments
    expect(tokens).not.toContain("pool");
    expect(tokens).not.toContain("max");
  });

  test("json:shape truncation marker never becomes a token and is disclosed in the note", async () => {
    const dir = await createTempDir();
    const wide: Record<string, number> = {};
    for (let i = 0; i < 40; i++) {
      wide[`key${i}`] = i;
    }
    const filePath = await writeFixtureFile(
      dir,
      "wide.json",
      JSON.stringify(wide),
    );

    await runCli(["map", "--symbol-summary", filePath]);

    const tokens = stdoutBuffer
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("json:shape:"))
      .flatMap((line) => line.split(" ").slice(1));

    expect(tokens).not.toContain("\\.\\.\\.");
    expect(tokens).not.toContain("...");
    expect(stdoutBuffer).toContain("note: json:shape truncation");
  });

  test("scanning a directory with no supported files emits an explanatory note", async () => {
    const dir = await createTempDir();
    await writeFixtureFile(dir, "notes.txt", "unsupported\n");

    await runCli(["map", "--symbol-summary", dir]);
    expect(stdoutBuffer).toContain(`note: no supported files found in`);
    expect(process.exitCode).toBe(0);

    await runCli(["map", dir]);
    expect(stdoutBuffer).toContain(`note: no supported files found in`);
    expect(process.exitCode).toBe(0);
  });

  test("numeric literals assigned to secret-looking names are not counted as redactions", async () => {
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(
      dir,
      "nums.ts",
      "export const uniqueToken_1_1 = 5;\nexport const retryToken = true;\n",
    );

    await runCli(["map", "--only", "variables,exports", filePath]);

    expect(stdoutBuffer).toContain("uniqueToken_1_1 = 5");
    expect(stdoutBuffer).not.toContain("[redacted]");
    expect(stdoutBuffer).not.toContain("secrets redacted");
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

  test("relative specifier ending in a slash still contributes one token", async () => {
    // README "Symbol summary" spec TOKEN RULES: "The quoted module specifier in an
    // imports/exports entry contributes exactly one token". A trailing-slash
    // specifier like "./dir/" must not silently drop its token.
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(
      dir,
      "slash.ts",
      `import slash from "./dir/";\n`,
    );

    await runCli(["map", "--symbol-summary", filePath]);

    const importsLine = stdoutBuffer
      .trim()
      .split("\n")
      .find((line) => line.startsWith("imports:"));
    expect(importsLine).toBeDefined();
    const tokens = importsLine!.split(" ").slice(1);
    expect(tokens).toContain("slash");
    // the specifier must contribute a token (basename "dir")
    expect(tokens).toContain("dir");
  });

  test("quoted strings containing spaces do not break the space-delimited token format", async () => {
    // README "Symbol summary" spec OUTPUT FORMAT: "tokens separated by single
    // spaces"; TOKEN RULES: "A token appears at most once per line".
    // A quoted string value with a space ("b c") is emitted as one pseudo
    // token containing a space, so the identifiers b and c are not marked
    // seen and re-appear -> observable duplicate fields on one line.
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(
      dir,
      "spacestr.ts",
      `export const a = "b c";\nexport const b = 1;\nexport const c = 2;\n`,
    );

    await runCli(["map", "--symbol-summary", "--only", "exports", filePath]);

    const exportsLine = stdoutBuffer
      .trim()
      .split("\n")
      .find((line) => line.startsWith("exports:"));
    expect(exportsLine).toBeDefined();
    const fields = exportsLine!.split(" ").slice(1);
    expect(new Set(fields).size).toBe(fields.length);
  });

  test("import specifier containing a space contributes exactly one unambiguous token", async () => {
    // README "Symbol summary" spec TOKEN RULES: the specifier contributes "exactly
    // one token, never path fragments". With `import sp from "./has
    // space.js"` the output line reads `sp has space\.js` — three
    // space-separated fields, so the fragment `has` leaks as a token.
    const dir = await createTempDir();
    const filePath = await writeFixtureFile(
      dir,
      "spacespec.ts",
      `import sp from "./has space.js";\n`,
    );

    await runCli(["map", "--symbol-summary", filePath]);

    const importsLine = stdoutBuffer
      .trim()
      .split("\n")
      .find((line) => line.startsWith("imports:"));
    expect(importsLine).toBeDefined();
    const fields = importsLine!.split(" ").slice(1);
    // one token for the local name, exactly one for the specifier
    expect(fields).toHaveLength(2);
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
      for (const token of line.split(" ").slice(1)) {
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
