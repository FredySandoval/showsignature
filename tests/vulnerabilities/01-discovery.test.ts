import { afterEach, describe, expect, test } from "bun:test";
import { execFile as execFileCallback } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { buildCli, runCli } from "@/src/01-main.js";

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const execFile = promisify(execFileCallback);

async function createTempDir(prefix: string): Promise<string> {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dirPath);
  return dirPath;
}

async function createDirOutsideTmp(prefix: string): Promise<string> {
  const dirPath = await mkdtemp(path.join(originalCwd, prefix));
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
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

describe("vulnerability discovery", () => {
  test("reads a TypeScript file outside the current working directory", async () => {
    const projectDir = await createTempDir("showsignature-vuln-project-");
    const victimDir = await createTempDir("showsignature-vuln-secret-");
    const secretFile = await writeFixtureFile(
      victimDir,
      "secret.ts",
      "// SECRET_TOKEN=top-secret\nexport const token = 'top-secret';\n",
    );

    const cli = buildCli();
    const stdoutChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    process.chdir(projectDir);

    try {
      await cli.run([
        "showsignature",
        "map",
        secretFile,
        "--only",
        "comments,variables",
      ]);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    const output = stdoutChunks.join("");
    expect(
      output,
      "Files outside the current working directory should be readable like any other read tool.",
    ).toContain("token");
    expect(output).toContain(path.basename(victimDir));
  });

  test("shows the relative path of external files in output headers", async () => {
    const projectDir = await createTempDir("showsignature-vuln-project-");
    const victimDir = await createTempDir("showsignature-vuln-pathleak-");
    const externalFile = await writeFixtureFile(
      victimDir,
      "nested/secret.ts",
      "export function leaked(): void {}\n",
    );

    const stdoutChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    process.chdir(projectDir);

    try {
      await buildCli().run(["showsignature", "map", externalFile]);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    const output = stdoutChunks.join("");
    expect(
      output,
      "External files should be mapped and labelled with their path.",
    ).toContain("function leaked");
  });

  test("follows a project-local symlink to a file outside the current working directory", async () => {
    const projectDir = await createTempDir("showsignature-vuln-project-");
    const victimDir = await createTempDir("showsignature-vuln-symlink-read-");
    const victimFile = await writeFixtureFile(
      victimDir,
      "secret.ts",
      "// SYMLINK_SECRET=outside\nexport const token = 'outside';\n",
    );

    await symlink(victimFile, path.join(projectDir, "linked-secret.ts"));

    const stdoutChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    process.chdir(projectDir);

    try {
      await buildCli().run([
        "showsignature",
        "map",
        "linked-secret.ts",
        "--only",
        "comments,variables",
      ]);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    const output = stdoutChunks.join("");
    expect(
      output,
      "Symlinked inputs should resolve and be readable even when the target is outside the current working directory.",
    ).toContain("token");
  });

  test("scans a directory outside the current working directory", async () => {
    const projectDir = await createTempDir("showsignature-vuln-project-");
    const victimDir = await createTempDir("showsignature-vuln-folder-");
    await writeFixtureFile(
      victimDir,
      "src/secret.ts",
      "// FOLDER_SECRET=outside\nexport const secret = 1;\n",
    );

    const stdoutChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    process.chdir(projectDir);

    try {
      await buildCli().run([
        "showsignature",
        "map",
        victimDir,
        "--only",
        "comments,variables",
      ]);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    const output = stdoutChunks.join("");
    expect(
      output,
      "Folder scans outside the current working directory should work like any other read tool.",
    ).toContain("secret");
    expect(output).toContain(path.basename(victimDir));
  });

  test("scans a relative path that traverses outside the current working directory", async () => {
    const projectDir = await createTempDir("showsignature-vuln-project-");
    const victimParentDir = await createTempDir(
      "showsignature-vuln-folder-parent-",
    );
    const nestedVictimDir = path.join(victimParentDir, "nested");

    await writeFixtureFile(
      nestedVictimDir,
      "src/secret.ts",
      "export const traversed = 1;\n",
    );

    const stdoutChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    process.chdir(projectDir);

    try {
      await buildCli().run([
        "showsignature",
        "map",
        path.join("..", path.basename(victimParentDir), "nested"),
        "--only",
        "variables",
      ]);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    expect(
      stdoutChunks.join(""),
      "Relative paths that traverse outside the current working directory should be scannable.",
    ).toContain("traversed");
  });

  test("fails if removed --output option is used", async () => {
    const projectDir = await createTempDir("showsignature-vuln-project-");

    await writeFixtureFile(
      projectDir,
      "src/app.ts",
      "export function greet(name: string): string { return name; }\n",
    );

    process.chdir(projectDir);

    await expect(
      buildCli().run(["showsignature", "map", "src/app.ts", "--output", "owned.txt"]),
    ).rejects.toThrow("unknown option '--output'");
  });

  test("fails if --output accepts absolute paths outside the current working directory", async () => {
    const projectDir = await createTempDir("showsignature-vuln-project-");
    const victimDir = await createDirOutsideTmp(
      ".showsignature-vuln-absolute-",
    );
    const victimFile = path.join(victimDir, "absolute-owned.txt");

    await writeFixtureFile(
      projectDir,
      "src/app.ts",
      "export const leaked = 1;\n",
    );

    process.chdir(projectDir);

    await expect(
      buildCli().run([
        "showsignature",
        "map",
        "src/app.ts",
        "--only",
        "variables",
        "--output",
        victimFile,
      ]),
      "Security issue discovered: --output should reject absolute paths outside the current working directory unless they point into the allowed temp directory.",
    ).rejects.toThrow();

    await expect(
      readFile(victimFile, "utf8"),
      "Security issue discovered: --output should not allow absolute paths outside the current working directory.",
    ).rejects.toThrow();
  });

  test("fails if --output can follow a symlink inside the project and overwrite files outside the current working directory", async () => {
    const projectDir = await createTempDir("showsignature-vuln-project-");
    const victimDir = await createDirOutsideTmp(".showsignature-vuln-symlink-");
    const victimFile = path.join(victimDir, "symlink-owned.txt");
    const symlinkPath = path.join(projectDir, "report.txt");

    await writeFixtureFile(
      projectDir,
      "src/app.ts",
      "export const leaked = 1;\n",
    );
    await symlink(victimFile, symlinkPath);

    process.chdir(projectDir);

    await expect(
      buildCli().run([
        "showsignature",
        "map",
        "src/app.ts",
        "--only",
        "variables",
        "--output",
        "report.txt",
      ]),
      "Security issue discovered: --output should reject symlinked output paths that resolve outside the current working directory and outside the allowed temp directory.",
    ).rejects.toThrow();

    await expect(
      readFile(victimFile, "utf8"),
      "Security issue discovered: --output should not follow symlinks to files outside the current working directory.",
    ).rejects.toThrow();
  });

  test("fails if attacker-controlled FIFOs can make the CLI hang instead of being rejected", async () => {
    const projectDir = await createTempDir("showsignature-vuln-fifo-");
    const fifoPath = path.join(projectDir, "blocked.ts");
    const cliPath = path.join(originalCwd, "dist/02-cli.js");

    const result = await execFile(
      "bash",
      [
        "-lc",
        `mkfifo ${JSON.stringify(fifoPath)} && timeout 1s node ${JSON.stringify(cliPath)} map ${JSON.stringify(fifoPath)}`,
      ],
      { cwd: projectDir },
    ).catch(
      (error: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) =>
        error,
    );

    expect(
      result,
      "Security issue discovered: CLI should reject FIFOs immediately instead of hanging until timeout.",
    ).not.toHaveProperty("code", 124);
  });

  test("fails if writing output to an attacker-controlled FIFO can make the CLI hang", async () => {
    const projectDir = await createTempDir("showsignature-vuln-output-fifo-");
    const fifoPath = path.join(projectDir, "report.txt");
    const cliPath = path.join(originalCwd, "dist/02-cli.js");

    await writeFixtureFile(
      projectDir,
      "src/app.ts",
      "export const leaked = 1;\n",
    );

    const result = await execFile(
      "bash",
      [
        "-lc",
        `mkfifo ${JSON.stringify(fifoPath)} && timeout 1s node ${JSON.stringify(cliPath)} map src/app.ts --only variables --output report.txt`,
      ],
      { cwd: projectDir },
    ).catch(
      (error: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) =>
        error,
    );

    expect(
      result,
      "Security issue discovered: CLI should reject FIFOs as output targets instead of hanging during write.",
    ).not.toHaveProperty("code", 124);
  });

  test("fails if can block on special device files like /dev/random", async () => {
    const cliPath = path.join(originalCwd, "dist/02-cli.js");

    const result = await execFile(
      "bash",
      ["-lc", `timeout 1s node ${JSON.stringify(cliPath)} map /dev/random`],
      { cwd: originalCwd },
    ).catch(
      (error: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) =>
        error,
    );

    expect(
      result,
      "Security issue discovered: CLI should reject blocking device files instead of hanging while reading them.",
    ).not.toHaveProperty("code", 124);
  });

  test("fails if plain output includes terminal escape injection from untrusted comments", async () => {
    const projectDir = await createTempDir("showsignature-vuln-terminal-");
    const payload = "\u001b[2J\u001b[HOWNED";
    const sourceFile = await writeFixtureFile(
      projectDir,
      "src/terminal.ts",
      `// ${payload}\nexport function safe(): void {}\n`,
    );

    const stdoutChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    process.chdir(projectDir);

    try {
      await buildCli().run([
        "showsignature",
        "map",
        sourceFile,
        "--only",
        "comments,signatures",
      ]);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    expect(
      stdoutChunks.join(""),
      "Security issue discovered: plain output should sanitize terminal escape sequences from untrusted comments.",
    ).not.toContain(payload);
  });

  test("fails if output headers allow newline injection from attacker-controlled file names", async () => {
    const projectDir = await createTempDir("showsignature-vuln-filename-");
    const injectedFileName = "evil\nexport const PWNED = true;\n.ts";
    const filePath = await writeFixtureFile(
      projectDir,
      injectedFileName,
      "export function safe(): void {}\n",
    );

    const stdoutChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    process.chdir(projectDir);

    try {
      await buildCli().run(["showsignature", "map", filePath]);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    const output = stdoutChunks.join("");
    expect(
      output,
      "Security issue discovered: file headers should sanitize embedded newlines from attacker-controlled file names.",
    ).not.toContain("export const PWNED = true;");
  });

  test("fails if plain output includes terminal escape injection from attacker-controlled file names", async () => {
    const projectDir = await createTempDir("showsignature-vuln-filename-ansi-");
    const payload = "\u001b[2J\u001b[H";
    const filePath = await writeFixtureFile(
      projectDir,
      `evil${payload}.ts`,
      "export const safe = 1;\n",
    );

    const stdoutChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    process.chdir(projectDir);

    try {
      await buildCli().run([
        "showsignature",
        "map",
        filePath,
        "--only",
        "variables",
      ]);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    expect(
      stdoutChunks.join(""),
      "Security issue discovered: file headers should sanitize terminal escape sequences embedded in file names.",
    ).not.toContain(payload);
  });

  test("fails if stderr includes terminal escape injection from attacker-controlled paths", async () => {
    const stderrChunks: string[] = [];
    const originalStderrWrite = process.stderr.write;
    const payload = "missing\u001b[2J.ts";

    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stderr.write;

    try {
      await runCli(["showsignature", "map", payload]);
    } finally {
      process.stderr.write = originalStderrWrite;
    }

    expect(
      stderrChunks.join(""),
      "Security issue discovered: error diagnostics should sanitize terminal escape sequences from attacker-controlled paths.",
    ).not.toContain("\u001b[2J");
  });

  test("fails if stderr allows newline injection from attacker-controlled paths", async () => {
    const stderrChunks: string[] = [];
    const originalStderrWrite = process.stderr.write;
    const payload = "missing\n[forged].ts";

    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stderr.write;

    try {
      await runCli(["showsignature", "map", payload]);
    } finally {
      process.stderr.write = originalStderrWrite;
    }

    expect(
      stderrChunks.join(""),
      "Security issue discovered: error diagnostics should sanitize embedded newlines from attacker-controlled paths.",
    ).not.toContain("[forged].ts");
  });
});
