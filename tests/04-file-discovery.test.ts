import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  ExtractKind,
  LanguageAdapter,
  ParseContext,
  SingleExtractResult,
} from "@/src/00-core-types.js";
import { discoverFiles, getSupportedGlobs, isTestFile } from "@/src/01-main.js";
import { createLanguageRegistry } from "@/src/01-main.js";

const tempDirs: string[] = [];

function createNoopExtractor(kind: ExtractKind) {
  return {
    kind,
    extract(): SingleExtractResult {
      return { entries: [], warnings: [] };
    },
  };
}

function createMockAdapter(options: {
  id: string;
  extensions: readonly string[];
}): LanguageAdapter<ParseContext> {
  return {
    id: options.id,
    extensions: options.extensions,
    fenceLang: options.id,
    extractors: new Map([["signatures", createNoopExtractor("signatures")]]),
    buildContext({ source, filePath }) {
      return { source, filePath };
    },
    supportsKind(kind) {
      return this.extractors.has(kind);
    },
  };
}

async function createTempDir(): Promise<string> {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), "showcode-discovery-"));
  tempDirs.push(dirPath);
  return dirPath;
}

async function writeFixtureFile(
  rootDir: string,
  relativePath: string,
): Promise<string> {
  const fullPath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, "// fixture");
  return fullPath;
}

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

describe("getSupportedGlobs", () => {
  test("returns sorted, deduplicated globs from registry extensions", () => {
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({ id: "ts", extensions: ["ts", ".tsx", ".ts"] }),
    );
    registry.register(createMockAdapter({ id: "js", extensions: [".js"] }));

    const globs = getSupportedGlobs(registry);

    expect(globs).toEqual(["**/*.js", "**/*.ts", "**/*.tsx"]);
  });
});

describe("isTestFile", () => {
  test("detects common test file patterns and directories", () => {
    expect(isTestFile("/repo/src/user.test.ts")).toBe(true);
    expect(isTestFile("/repo/src/user_spec.ts")).toBe(true);
    expect(isTestFile("/repo/src/user-spec.ts")).toBe(true);
    expect(isTestFile("/repo/__tests__/user.ts")).toBe(true);
    expect(isTestFile("/repo/tests/user.ts")).toBe(true);
    expect(isTestFile("/repo/src/user.ts")).toBe(false);
  });

  test("with a baseDir, only matches test directory segments below it", () => {
    expect(
      isTestFile("/repo/tests/fixtures/user.ts", "/repo/tests/fixtures"),
    ).toBe(false);
    expect(isTestFile("/repo/tests/fixtures/user.ts", "/repo")).toBe(true);
    // Filename patterns still apply regardless of baseDir.
    expect(
      isTestFile("/repo/tests/fixtures/user.test.ts", "/repo/tests/fixtures"),
    ).toBe(true);
  });
});

describe("discoverFiles", () => {
  test("discovers recursively and excludes test files", async () => {
    const rootDir = await createTempDir();
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({ id: "ts", extensions: [".ts", ".tsx"] }),
    );

    const keepA = await writeFixtureFile(rootDir, "src/keep-a.ts");
    const keepB = await writeFixtureFile(rootDir, "src/keep-b.tsx");
    await writeFixtureFile(rootDir, "src/drop.test.ts");
    await writeFixtureFile(rootDir, "src/drop.spec.tsx");
    await writeFixtureFile(rootDir, "tests/drop.ts");
    await writeFixtureFile(rootDir, "__tests__/drop.ts");
    await writeFixtureFile(rootDir, "src/ignore.md");

    const files = await discoverFiles({ registry, folder: rootDir });

    expect(files).toEqual([keepA, keepB].sort());
  });

  test("follows symlinked files and directories in folder scans", async () => {
    const rootDir = await createTempDir();
    const outsideDir = await createTempDir();
    const registry = createLanguageRegistry();
    registry.register(createMockAdapter({ id: "ts", extensions: [".ts"] }));

    const direct = await writeFixtureFile(rootDir, "direct.ts");
    const linkedFileTarget = await writeFixtureFile(outsideDir, "target.ts");
    await writeFixtureFile(outsideDir, "linked-dir/inner.ts");

    const fileLink = path.join(rootDir, "link.ts");
    const dirLink = path.join(rootDir, "linked-dir");
    await symlink(linkedFileTarget, fileLink);
    await symlink(path.join(outsideDir, "linked-dir"), dirLink);

    const files = await discoverFiles({ registry, folder: rootDir });

    // Paths stay as scanned (through the link), never the link target.
    expect(files).toEqual(
      [direct, fileLink, path.join(dirLink, "inner.ts")].sort(),
    );
  });

  test("tolerates broken and cyclic symlinks in folder scans", async () => {
    const rootDir = await createTempDir();
    const registry = createLanguageRegistry();
    registry.register(createMockAdapter({ id: "ts", extensions: [".ts"] }));

    const kept = await writeFixtureFile(rootDir, "kept.ts");
    await symlink(path.join(rootDir, "missing.ts"), path.join(rootDir, "broken.ts"));
    await symlink(rootDir, path.join(rootDir, "cycle"));

    const files = await discoverFiles({ registry, folder: rootDir });

    expect(files).toContain(kept);
    expect(files).not.toContain(path.join(rootDir, "broken.ts"));
  });

  test("limits recursive folder discovery with maxDepth", async () => {
    const rootDir = await createTempDir();
    const registry = createLanguageRegistry();
    registry.register(createMockAdapter({ id: "ts", extensions: [".ts"] }));

    const topLevel = await writeFixtureFile(rootDir, "top.ts");
    const oneLevel = await writeFixtureFile(rootDir, "src/one.ts");
    await writeFixtureFile(rootDir, "src/nested/two.ts");

    const files = await discoverFiles({
      registry,
      folder: rootDir,
      maxDepth: 2,
    });

    expect(files).toEqual([topLevel, oneLevel]);
  });

  test("can include test files when explicitly requested", async () => {
    const rootDir = await createTempDir();
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({ id: "ts", extensions: [".ts", ".tsx"] }),
    );

    const kept = await writeFixtureFile(rootDir, "src/keep.ts");
    const fromTests = await writeFixtureFile(rootDir, "tests/fixture.ts");
    const fromNamedTest = await writeFixtureFile(
      rootDir,
      "src/component.test.ts",
    );

    const files = await discoverFiles({
      registry,
      folder: rootDir,
      includeTests: true,
    });

    expect(files).toEqual([fromNamedTest, fromTests, kept].sort());
  });

  test("returns supported explicit file even if it matches test naming", async () => {
    const rootDir = await createTempDir();
    const registry = createLanguageRegistry();
    registry.register(createMockAdapter({ id: "ts", extensions: [".ts"] }));

    const explicitFile = await writeFixtureFile(
      rootDir,
      "src/component.test.ts",
    );

    await expect(
      discoverFiles({ registry, file: explicitFile }),
    ).resolves.toEqual([explicitFile]);
  });

  test("returns empty list for explicit file with unsupported extension", async () => {
    const rootDir = await createTempDir();
    const registry = createLanguageRegistry();
    registry.register(createMockAdapter({ id: "ts", extensions: [".ts"] }));

    const unsupportedFile = await writeFixtureFile(rootDir, "src/readme.md");

    await expect(
      discoverFiles({ registry, file: unsupportedFile }),
    ).resolves.toEqual([]);
  });

  test("uses current working directory when no file/folder is provided", async () => {
    const rootDir = await createTempDir();
    const registry = createLanguageRegistry();
    registry.register(createMockAdapter({ id: "ts", extensions: [".ts"] }));

    const kept = await writeFixtureFile(rootDir, "file.ts");
    await writeFixtureFile(rootDir, "file.test.ts");

    const previousCwd = process.cwd();
    process.chdir(rootDir);

    try {
      const files = await discoverFiles({ registry });
      expect(files).toEqual([kept]);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
