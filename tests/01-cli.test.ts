import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { buildCli } from '../src/01-cli';

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

let stdoutBuffer = '';
let stderrBuffer = '';

function captureWrite(chunk: string | Uint8Array): string {
  return typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
}

function installOutputCapture(): void {
  stdoutBuffer = '';
  stderrBuffer = '';
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
  const dirPath = await mkdtemp(path.join(os.tmpdir(), 'showcode-cli-'));
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
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

afterEach(async () => {
  process.chdir(originalCwd);
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  process.exitCode = 0;

  await Promise.all(
    tempDirs.splice(0).map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

describe('buildCli', () => {
  test('prints signature output to stdout by default', async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      'src/app.ts',
      `function greet(name: string): string {\n  return name;\n}\nconst hidden = 1;\n`,
    );

    process.chdir(rootDir);

    await buildCli().run(['showcode', '--file', 'src/app.ts']);

    expect(stdoutBuffer).toBe(
      ['// src/app.ts', 'function greet(name: string): string;', ''].join('\n'),
    );
    expect(stderrBuffer).toBe('');
    expect(process.exitCode).toBe(0);
  });

  test('writes markdown output to a file and uses combined ordering by default', async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      'src/app.ts',
      `// before\nfunction greet(): void {}\n`,
    );

    process.chdir(rootDir);

    await buildCli().run([
      'showcode',
      '--file',
      'src/app.ts',
      '--extract=signatures,comments',
      '--output',
      'artifacts/output.md',
    ]);

    const output = await readFile(path.join(rootDir, 'artifacts/output.md'), 'utf8');

    expect(output).toBe(
      ['```ts', '// src/app.ts', '// before', 'function greet(): void;', '```'].join(
        '\n',
      ),
    );
    expect(stdoutBuffer).toBe('');
    expect(stderrBuffer).toBe('');
  });

  test('throws for unsupported explicit languages', async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, 'src/app.ts', 'const value = 1;');
    process.chdir(rootDir);

    await expect(
      buildCli().run(['showcode', '--file', 'src/app.ts', '--lang', 'go']),
    ).rejects.toThrow('go not supported');
  });

  test('throws when file and folder are both provided', async () => {
    installOutputCapture();

    await expect(
      buildCli().run(['showcode', '--file', 'src/app.ts', '--folder', 'src']),
    ).rejects.toThrow('Options --file and --folder cannot be used together');
  });

  test('sets exit code and prints pipeline errors for unsupported files', async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(rootDir, 'src/app.txt', 'hello');
    process.chdir(rootDir);

    await buildCli().run(['showcode', '--file', 'src/app.txt']);

    expect(stdoutBuffer).toBe('');
    expect(stderrBuffer).toContain('Could not infer language for file');
    expect(process.exitCode).toBe(1);
  });

  test('throws when --file points to a directory', async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await mkdir(path.join(rootDir, 'tests', 'fixtures'), { recursive: true });
    process.chdir(rootDir);

    await expect(
      buildCli().run(['showcode', '--file', 'tests/fixtures']),
    ).rejects.toThrow('Option --file expects a file path; use --folder for directories');
  });

  test('includes test fixtures when explicitly requested', async () => {
    installOutputCapture();

    const rootDir = await createTempDir();
    await writeFixtureFile(
      rootDir,
      'tests/fixtures/example.ts',
      `function fixtureCase(): void {}\n`,
    );
    process.chdir(rootDir);

    await buildCli().run([
      'showcode',
      '--folder',
      'tests/fixtures',
      '--extract=signatures',
      '--include-tests',
    ]);

    expect(stdoutBuffer).toBe(
      ['// tests/fixtures/example.ts', 'function fixtureCase(): void;', ''].join('\n'),
    );
    expect(stderrBuffer).toBe('');
    expect(process.exitCode).toBe(0);
  });
});
