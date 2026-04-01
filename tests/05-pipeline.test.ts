import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  ExtractEntry,
  ExtractKind,
  ExtractWarning,
  LanguageAdapter,
  ParseContext,
  SingleExtractResult,
} from "@/src/00-core-types.js";
import { extractFromSource, processFile, runPipeline } from "@/src/main.js";
import { createLanguageRegistry } from "@/src/main.js";

const tempDirs: string[] = [];

function createExtractor(
  kind: ExtractKind,
  options: {
    entries?: ExtractEntry[];
    warnings?: ExtractWarning[];
  } = {},
) {
  return {
    kind,
    extract(): SingleExtractResult {
      return {
        entries: options.entries ?? [],
        warnings: options.warnings ?? [],
      };
    },
  };
}

function createMockAdapter(options: {
  id: string;
  extensions: readonly string[];
  extractors?: ReadonlyMap<ExtractKind, ReturnType<typeof createExtractor>>;
}): LanguageAdapter<ParseContext> {
  const extractors =
    options.extractors ??
    new Map([["signatures", createExtractor("signatures")]]);

  return {
    id: options.id,
    extensions: options.extensions,
    fenceLang: options.id,
    extractors,
    buildContext({ source, filePath }) {
      return { source, filePath };
    },
    supportsKind(kind) {
      return extractors.has(kind);
    },
  };
}

async function createTempDir(): Promise<string> {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), "showcode-pipeline-"));
  tempDirs.push(dirPath);
  return dirPath;
}

async function writeFixtureFile(
  rootDir: string,
  relativePath: string,
  content: string,
): Promise<string> {
  const fullPath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
  return fullPath;
}

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

describe("extractFromSource", () => {
  test("combines extractors in source order by default", () => {
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        extractors: new Map([
          [
            "comments",
            createExtractor("comments", {
              entries: [
                {
                  kind: "comments",
                  lines: ["// second"],
                  metadata: { sourcePos: 20 },
                },
              ],
            }),
          ],
          [
            "signatures",
            createExtractor("signatures", {
              entries: [
                {
                  kind: "signatures",
                  lines: ["function first(): void;"],
                  metadata: { sourcePos: 10 },
                },
              ],
            }),
          ],
        ]),
      }),
    );

    const result = extractFromSource({
      registry,
      lang: "ts",
      filePath: "/repo/file.ts",
      source: "ignored",
      extractOrder: ["comments", "signatures"],
    });

    expect(result.entries).toEqual([
      {
        kind: "signatures",
        lines: ["function first(): void;"],
      },
      {
        kind: "comments",
        lines: ["// second"],
      },
    ]);
  });

  test("sorts by source position in combined mode", () => {
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        extractors: new Map([
          [
            "comments",
            createExtractor("comments", {
              entries: [
                {
                  kind: "comments",
                  lines: ["// second"],
                  metadata: { sourcePos: 20 },
                },
              ],
            }),
          ],
          [
            "signatures",
            createExtractor("signatures", {
              entries: [
                {
                  kind: "signatures",
                  lines: ["function first(): void;"],
                  metadata: { sourcePos: 10 },
                },
              ],
            }),
          ],
        ]),
      }),
    );

    const result = extractFromSource({
      registry,
      lang: "ts",
      filePath: "/repo/file.ts",
      source: "ignored",
      extractOrder: ["comments", "signatures"],
    });

    expect(result.entries).toEqual([
      { kind: "signatures", lines: ["function first(): void;"] },
      { kind: "comments", lines: ["// second"] },
    ]);
  });

  test("throws when the adapter is not loaded", () => {
    const registry = createLanguageRegistry();

    expect(() =>
      extractFromSource({
        registry,
        lang: "ts",
        filePath: "/repo/file.ts",
        source: "",
        extractOrder: ["signatures"],
      }),
    ).toThrow('Language adapter not loaded for "ts"');
  });
});

describe("processFile", () => {
  test("reads a file, infers its language, and returns a section", async () => {
    const rootDir = await createTempDir();
    const filePath = await writeFixtureFile(
      rootDir,
      "src/app.ts",
      "const value = 1;",
    );
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        extractors: new Map([
          [
            "variables",
            createExtractor("variables", {
              entries: [
                {
                  kind: "variables",
                  lines: ["const value = ...;"],
                  metadata: { sourcePos: 0 },
                },
              ],
              warnings: [
                {
                  message: "variable summary warning",
                  filePath,
                  severity: "warning",
                },
              ],
            }),
          ],
        ]),
      }),
    );

    await expect(
      processFile({
        registry,
        filePath,
        extractOrder: ["variables"],
      }),
    ).resolves.toEqual({
      filePath,
      lang: "ts",
      entries: [
        {
          kind: "variables",
          lines: ["const value = ...;"],
        },
      ],
      warnings: [
        {
          message: "variable summary warning",
          filePath,
          severity: "warning",
        },
      ],
    });
  });

  test("loads a lazy adapter before extraction", async () => {
    const rootDir = await createTempDir();
    const filePath = await writeFixtureFile(
      rootDir,
      "src/app.py",
      'print("hi")',
    );
    const registry = createLanguageRegistry();

    registry.registerLazy({
      id: "py",
      extensions: [".py"],
      load: () =>
        createMockAdapter({
          id: "py",
          extensions: [".py"],
          extractors: new Map([
            [
              "signatures",
              createExtractor("signatures", {
                entries: [{ kind: "signatures", lines: ["def main():"] }],
              }),
            ],
          ]),
        }),
    });

    const section = await processFile({
      registry,
      filePath,
      extractOrder: ["signatures"],
    });

    expect(section.lang).toBe("py");
    expect(section.entries).toEqual([
      {
        kind: "signatures",
        lines: ["def main():"],
      },
    ]);
    expect(registry.get("py")).toBeDefined();
  });

  test("throws when language inference fails", async () => {
    const rootDir = await createTempDir();
    const filePath = await writeFixtureFile(rootDir, "src/notes.txt", "hello");
    const registry = createLanguageRegistry();

    await expect(
      processFile({
        registry,
        filePath,
        extractOrder: ["signatures"],
      }),
    ).rejects.toThrow(`Could not infer language for file: ${filePath}`);
  });

  test("throws when explicit language is unsupported", async () => {
    const rootDir = await createTempDir();
    const filePath = await writeFixtureFile(
      rootDir,
      "src/app.ts",
      "const value = 1;",
    );
    const registry = createLanguageRegistry();

    await expect(
      processFile({
        registry,
        filePath,
        explicitLang: "go",
        extractOrder: ["signatures"],
      }),
    ).rejects.toThrow('Language "go" is not supported');
  });
});

describe("runPipeline", () => {
  test("collects sections, warnings, and seen languages", async () => {
    const rootDir = await createTempDir();
    const fileA = await writeFixtureFile(rootDir, "a.ts", "const a = 1;");
    const fileB = await writeFixtureFile(rootDir, "b.ts", "const b = 2;");
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        extractors: new Map([
          [
            "variables",
            createExtractor("variables", {
              entries: [{ kind: "variables", lines: ["const value = ...;"] }],
              warnings: [
                {
                  message: "shared warning",
                  filePath: fileA,
                  severity: "warning",
                },
              ],
            }),
          ],
        ]),
      }),
    );

    const result = await runPipeline({
      registry,
      files: [fileA, fileB],
      extractOrder: ["variables"],
    });

    expect(result.success).toBe(true);
    expect(result.sections).toHaveLength(2);
    expect(result.diagnostics.errors).toEqual([]);
    expect(result.diagnostics.warnings).toEqual([
      {
        message: "shared warning",
        filePath: fileA,
        severity: "warning",
      },
      {
        message: "shared warning",
        filePath: fileA,
        severity: "warning",
      },
    ]);
    expect(result.meta.seenLangs).toEqual(["ts"]);
  });

  test("continues processing after per-file failures", async () => {
    const rootDir = await createTempDir();
    const goodFile = await writeFixtureFile(
      rootDir,
      "good.ts",
      "const good = 1;",
    );
    const badFile = await writeFixtureFile(rootDir, "bad.txt", "no adapter");
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        extractors: new Map([
          [
            "variables",
            createExtractor("variables", {
              entries: [{ kind: "variables", lines: ["const good = ...;"] }],
            }),
          ],
        ]),
      }),
    );

    const result = await runPipeline({
      registry,
      files: [goodFile, badFile],
      extractOrder: ["variables"],
    });

    expect(result.success).toBe(false);
    expect(result.sections).toEqual([
      {
        filePath: goodFile,
        lang: "ts",
        entries: [
          {
            kind: "variables",
            lines: ["const good = ...;"],
          },
        ],
        warnings: [],
      },
    ]);
    expect(result.diagnostics.errors).toEqual([
      {
        message: `Could not infer language for file: ${badFile}`,
        filePath: badFile,
      },
    ]);
    expect(result.meta.seenLangs).toEqual(["ts"]);
  });
});
