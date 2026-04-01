// ============================================================================
// CLI                                  [Step 1 — entry point]
// Uses commanderjs to parse CLI arguments and run the pipeline
// ============================================================================
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command, CommanderError } from 'commander';

import { BUILT_IN_EXTRACT_KINDS, type ExtractKind } from './00-core-types';
import { parseExtractOptions, stringifyError } from './02-config-utils';
import { buildDefaultRegistry } from './03-language-registry';
import { discoverFiles } from './04-file-discovery';
import { runPipeline } from './05-pipeline';
import { formatFinalOutput } from './10-output-formatting';

export interface CliProgram {
  run(argv?: readonly string[]): Promise<void>;
}

interface ParsedCliArgs {
  file?: string;
  folder?: string;
  lang?: string;
  extract?: string;
  output?: string;
  includeTests: boolean;
}

interface ExitCodeError extends Error {
  exitCode?: number;
}

const DEFAULT_EXTRACT_ORDER: ExtractKind[] = ['signatures'];

function createCliError(message: string, exitCode = 1): ExitCodeError {
  const error = new Error(message) as ExitCodeError;
  error.exitCode = exitCode;
  return error;
}

function stripArgvPrefix(argv: readonly string[]): string[] {
  const args = [...argv];

  while (args[0] && !args[0].startsWith('-')) {
    args.shift();
  }

  return args;
}

function normalizeCommanderErrorMessage(message: string): string {
  return message.startsWith('error: ') ? message.slice('error: '.length) : message;
}

function parseCliArgs(argv: readonly string[]): ParsedCliArgs | null {
  const program = new Command()
    .name('showcode')
    .usage('[options]')
    .option('--lang <lang>', 'language to use when resolving files')
    .option('--extract <options>', 'comma-separated extract options')
    .option('--file <file>', 'process a single file')
    .option('--folder <folder>', 'process files from a folder')
    .option('--output <name>', 'write formatted output to a file')
    .option('--include-tests', 'include files under test directories during discovery', false)
    .exitOverride();

  try {
    program.parse(stripArgvPrefix(argv), { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed') {
        return null;
      }

      throw createCliError(
        normalizeCommanderErrorMessage(error.message),
        error.exitCode ?? 1,
      );
    }

    throw error;
  }

  return program.opts<ParsedCliArgs>();
}

function validateCliArgs(args: ParsedCliArgs): void {
  if (args.file && args.folder) {
    throw createCliError('Options --file and --folder cannot be used together');
  }
}

async function validateInputPaths(args: ParsedCliArgs): Promise<void> {
  if (!args.file) {
    return;
  }

  try {
    const target = await stat(path.resolve(args.file));
    if (target.isDirectory()) {
      throw createCliError('Option --file expects a file path; use --folder for directories');
    }
  } catch (error) {
    if (error instanceof Error && 'exitCode' in error) {
      throw error;
    }
  }
}

function formatDiagnostic(prefix: 'warning' | 'error', message: string, filePath?: string): string {
  return filePath ? `[${prefix}] ${filePath}: ${message}` : `[${prefix}] ${message}`;
}

async function writeOutputFile(outputPath: string, content: string): Promise<void> {
  const resolvedOutputPath = path.resolve(outputPath);
  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, content, 'utf8');
}

export function buildCli(): CliProgram {
  return {
    async run(argv = process.argv): Promise<void> {
      const args = parseCliArgs(argv);

      if (!args) {
        return;
      }

      validateCliArgs(args);
      await validateInputPaths(args);

      const registry = buildDefaultRegistry();

      if (args.lang && !registry.has(args.lang)) {
        throw createCliError(`${args.lang} not supported`);
      }

      const extractOrder = args.extract
        ? parseExtractOptions(args.extract, BUILT_IN_EXTRACT_KINDS)
        : DEFAULT_EXTRACT_ORDER;

      const files = args.file
        ? [path.resolve(args.file)]
        : await discoverFiles(
            args.folder
              ? { registry, folder: args.folder, includeTests: args.includeTests }
              : { registry, includeTests: args.includeTests },
          );

      const result = await runPipeline({
        registry,
        files,
        explicitLang: args.lang,
        extractOrder,
      });

      const formattedOutput = formatFinalOutput({
        registry,
        sections: result.sections,
        explicitLang: args.lang,
        outputPath: args.output,
        seenLangs: result.meta.seenLangs,
      });

      if (args.output) {
        await writeOutputFile(args.output, formattedOutput);
      } else if (formattedOutput) {
        process.stdout.write(`${formattedOutput}\n`);
      }

      for (const warning of result.diagnostics.warnings) {
        process.stderr.write(
          `${formatDiagnostic('warning', warning.message, warning.filePath)}\n`,
        );
      }

      if (result.diagnostics.errors.length > 0) {
        for (const error of result.diagnostics.errors) {
          process.stderr.write(
            `${formatDiagnostic('error', error.message, error.filePath)}\n`,
          );
        }

        process.exitCode = 1;
      }
    },
  };
}

export async function runCli(): Promise<void> {
  try {
    await buildCli().run(process.argv);
  } catch (err) {
    const message = stringifyError(err);
    process.stderr.write(`${message}\n`);

    const exitCode =
      typeof err === 'object' &&
      err !== null &&
      'exitCode' in err &&
      typeof err.exitCode === 'number'
        ? err.exitCode
        : 1;

    process.exitCode = exitCode;
  }
}
