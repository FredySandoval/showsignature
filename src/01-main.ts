// ============================================================================
// CLI                                  [Step 1 — entry point]
// Uses commanderjs to parse CLI arguments and run the pipeline
// ============================================================================
import { readFile, realpath, stat } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import path from "node:path";
import { Command, CommanderError } from "commander";
import { globby } from "globby";
import {
  BUILT_IN_EXTRACT_KINDS,
  type AggregatedExtractResult,
  type BuiltInExtractKind,
  type CliProgram,
  type CombinedExtractEntry,
  type DetectFenceLanguageOptions,
  type Diagnostic,
  type DiscoverFilesOptions,
  type ExecutionPlan,
  type ExitCodeError,
  type ExtractEntry,
  type ExtractFromSourceOptions,
  type ExtractKind,
  type ExtractWarning,
  type FileSection,
  type FormatFinalOutputOptions,
  type LanguageAdapter,
  type LanguageAdapterMetadata,
  type LanguageRegistry,
  type LazyLanguageAdapterRegistration,
  type PackageMetadata,
  type ParseContext,
  type ParsedCliArgs,
  type PipelineError,
  type PipelineResult,
  type ProcessFileOptions,
  type ResolvedInputTarget,
  type RunPipelineOptions,
} from "./00-core-types.js";
import { createGoAdapter } from "./languages/go/00-adapter.js";
import { createLuaAdapter } from "./languages/lua/00-adapter.js";
import { createMarkdownAdapter } from "./languages/markdown/00-adapter.js";
import { createPythonAdapter } from "./languages/python/00-adapter.js";
import { createRustAdapter } from "./languages/rust/00-adapter.js";
import { createTsxAdapter } from "./languages/tsx/00-adapter.js";
import { createTsFamilyAdapter } from "./languages/typescript/00-adapter.js";

export type { Extractor, LanguageAdapter } from "./00-core-types.js";

const DEFAULT_EXTRACT_ORDER: ExtractKind[] = ["signatures"];
const require = createRequire(import.meta.url);
const packageMetadata = require("../package.json") as PackageMetadata;
const CLI_NAME = packageMetadata.name ?? "showsignature";
const CLI_VERSION = packageMetadata.version ?? "0.0.0";

function createCliError(message: string, exitCode = 1): ExitCodeError {
  const error = new Error(message) as ExitCodeError;
  error.exitCode = exitCode;
  return error;
}
// secret patterns to prevent showing them for security
const CONTROL_CHARS_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const MARKDOWN_META_PATTERN = /[`<>]/gu;
const REDACTED_SECRET = "[redacted]";
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu;
const GITHUB_TOKEN_PATTERN =
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/gu;
const AWS_ACCESS_KEY_PATTERN = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu;
const SLACK_TOKEN_PATTERN = /\bxox(?:a|b|p|r|s)-[A-Za-z0-9-]{10,}\b/gu;
const PRIVATE_KEY_INLINE_PATTERN =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gu;
const PRIVATE_KEY_BOUNDARY_PATTERN =
  /-----(?:BEGIN|END) [A-Z0-9 ]*PRIVATE KEY-----/gu;
const SECRET_KEYWORD_PATTERN =
  "(?:api[_-]?key|token|secret|password|passwd|credential|private[_-]?key|access[_-]?key|auth)";
const SECRET_NAME_PATTERN = `(?:${SECRET_KEYWORD_PATTERN}|[A-Za-z_][A-Za-z0-9_]*${SECRET_KEYWORD_PATTERN})[A-Za-z0-9_]*`;
const ENV_SECRET_ASSIGNMENT_PATTERN = new RegExp(
  `(^|\\b)(${SECRET_NAME_PATTERN}\\s*=\\s*)([^\\s#;]+)`,
  "giu",
);
const QUOTED_SECRET_PROPERTY_PATTERN = new RegExp(
  `(["']?${SECRET_NAME_PATTERN}["']?\\s*[:=]\\s*)(["'])([^"']+)(\\2)`,
  "giu",
);
const SECRET_VARIABLE_ASSIGNMENT_PATTERN = new RegExp(
  `\\b(${SECRET_NAME_PATTERN}\\s*[:=]\\s*)([^\\s,;)]+)`,
  "giu",
);

export function redactSecrets(value: string): string {
  return value
    .replace(PRIVATE_KEY_INLINE_PATTERN, REDACTED_SECRET)
    .replace(PRIVATE_KEY_BOUNDARY_PATTERN, REDACTED_SECRET)
    .replace(JWT_PATTERN, REDACTED_SECRET)
    .replace(GITHUB_TOKEN_PATTERN, REDACTED_SECRET)
    .replace(AWS_ACCESS_KEY_PATTERN, REDACTED_SECRET)
    .replace(SLACK_TOKEN_PATTERN, REDACTED_SECRET)
    .replace(
      QUOTED_SECRET_PROPERTY_PATTERN,
      (
        _match,
        key: string,
        quote: string,
        _secret: string,
        closeQuote: string,
      ) => `${key}${quote}${REDACTED_SECRET}${closeQuote}`,
    )
    .replace(
      ENV_SECRET_ASSIGNMENT_PATTERN,
      (_match, prefix: string, key: string) =>
        `${prefix}${key}${REDACTED_SECRET}`,
    )
    .replace(
      SECRET_VARIABLE_ASSIGNMENT_PATTERN,
      (_match, key: string) => `${key}${REDACTED_SECRET}`,
    );
}

function sanitizeAndMaybeRedactForDisplay(
  value: string,
  redact = true,
): string {
  return sanitizeForDisplay(redact ? redactSecrets(value) : value);
}

function sanitizeForDisplay(value: string): string {
  if (
    value.includes("\n") ||
    value.includes("\r") ||
    value.match(ANSI_ESCAPE_PATTERN) ||
    value.match(CONTROL_CHARS_PATTERN)
  ) {
    return "[unsafe text omitted]";
  }

  return value;
}

function sanitizeForMarkdown(value: string): string {
  return sanitizeForDisplay(value).replace(
    MARKDOWN_META_PATTERN,
    (char) => `\\${char}`,
  );
}

function isPathWithin(basePath: string, targetPath: string): boolean {
  const relativePath = path.relative(basePath, targetPath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

async function resolveSafeInputPath(
  targetPath: string,
): Promise<string | null> {
  const resolvedPath = path.resolve(targetPath);
  const cwdRealPath = await realpath(process.cwd());
  const realTargetPath = await realpath(resolvedPath);

  if (!isPathWithin(cwdRealPath, realTargetPath)) {
    return null;
  }

  const targetStats = await stat(realTargetPath);
  if (!targetStats.isFile()) {
    return null;
  }

  return realTargetPath;
}

function stripArgvPrefix(argv: readonly string[]): string[] {
  const args = [...argv];

  while (args[0] && !args[0].startsWith("-")) {
    args.shift();
  }

  return args;
}

function normalizeCommanderErrorMessage(message: string): string {
  return message.startsWith("error: ")
    ? message.slice("error: ".length)
    : message;
}

function isMarkdownExtractKind(kind: ExtractKind): boolean {
  return kind === "md" || kind.startsWith("md:");
}

function usesOnlyMarkdownExtractKinds(kinds: readonly ExtractKind[]): boolean {
  return kinds.length > 0 && kinds.every((kind) => isMarkdownExtractKind(kind));
}

function listSupportedExtractKinds(registry: LanguageRegistry): ExtractKind[] {
  const kinds = new Set<ExtractKind>(BUILT_IN_EXTRACT_KINDS);

  for (const adapter of registry.listAdapters()) {
    for (const kind of adapter.extractors.keys()) {
      kinds.add(kind);
    }
  }

  return [...kinds];
}

function buildShowOnlyOptionHelp(kinds: readonly string[]): string {
  const uniqueKinds = [...new Set(kinds)];
  const codeKinds = BUILT_IN_EXTRACT_KINDS.filter((kind) =>
    uniqueKinds.includes(kind),
  );
  const markdownKinds = uniqueKinds.filter(
    (kind) => kind === "md" || kind.startsWith("md:"),
  );
  const tsxKinds = uniqueKinds.filter((kind) =>
    ["html", "csshidden"].includes(kind),
  );
  const otherPluginKinds = uniqueKinds
    .filter(
      (kind) =>
        !BUILT_IN_EXTRACT_KINDS.includes(kind as BuiltInExtractKind) &&
        !markdownKinds.includes(kind) &&
        !tsxKinds.includes(kind),
    )
    .sort();

  const sections = ["comma-separated extract kinds to include"];

  if (codeKinds.length > 0) {
    sections.push(`code: ${codeKinds.join(", ")}`);
  }

  if (tsxKinds.length > 0) {
    sections.push(`tsx/jsx: ${tsxKinds.sort().join(", ")}`);
  }

  if (otherPluginKinds.length > 0) {
    sections.push(`plugins: ${otherPluginKinds.join(", ")}`);
  }

  if (markdownKinds.length > 0) {
    sections.push(`markdown: ${markdownKinds.sort().join(", ")}`);
  }

  sections.push("default: signatures --line-number");
  return sections.join("\n");
}

function formatSupportedExtensionsHelp(extensions: readonly string[]): string {
  return [...extensions].sort().join(", ");
}

function buildLangOnlyOptionHelp(extensions: readonly string[]): string {
  return [
    "only process files for the provided language",
    "(optional) inferred from file extension if not provided",
    `supported extensions: ${formatSupportedExtensionsHelp(extensions)}`,
  ].join("\n");
}

function formatUnsupportedFileMessage(
  filePath: string,
  registry: LanguageRegistry,
): string {
  const extension = normalizeExtension(path.extname(filePath));
  const supportedExtensions = formatSupportedExtensionsHelp(
    registry.supportedExtensions(),
  );

  if (extension) {
    return `File is not supported: extension "${extension}" is not supported. Supported extensions: ${supportedExtensions}`;
  }

  return `File is not supported: could not infer a language from the file name. Supported extensions: ${supportedExtensions}`;
}

function collectOptionValue(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function parseCliArgs(argv: readonly string[]): ParsedCliArgs | null {
  const registry = buildDefaultRegistry();
  const showOnlyOptionHelp = buildShowOnlyOptionHelp(
    listSupportedExtractKinds(registry),
  );
  const langOnlyOptionHelp = buildLangOnlyOptionHelp(
    registry.supportedExtensions(),
  );

  const program = new Command()
    .name(CLI_NAME)
    .usage("[options]")
    .version(CLI_VERSION)
    .option("--lang-only <lang>", langOnlyOptionHelp)
    .option("--show-only <options>", showOnlyOptionHelp)
    .option("--file <file>", "process a single file")
    .option(
      "--folder <folder>",
      "process files from a folder (.gitignore files are respected)",
    )
    .option("--stdin", "read source from standard input", false)
    .option("--no-redact", "disable built-in secret redaction")
    .option(
      "--max-depth <number>",
      "maximum folder discovery depth for recursive scans",
      Number,
    )
    .option(
      "--include-tests",
      "include files under test directories during discovery",
      false,
    )
    .option(
      "--ignore-folder <folder>",
      "ignore a folder path or folder name during recursive discovery",
      collectOptionValue,
    )
    .option(
      "-n, --line-number",
      "prefix each extracted entry with its source line number",
      true,
    )
    .exitOverride();

  try {
    program.parse(stripArgvPrefix(argv), { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (
        error.code === "commander.helpDisplayed" ||
        error.code === "commander.version"
      ) {
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
  if (
    args.maxDepth !== undefined &&
    (!Number.isInteger(args.maxDepth) || args.maxDepth < 0)
  ) {
    throw createCliError("Option --max-depth must be a non-negative integer");
  }

  if (args.file && args.folder) {
    throw createCliError("Options --file and --folder cannot be used together");
  }

  if (args.stdin && args.file) {
    throw createCliError("Options --stdin and --file cannot be used together");
  }

  if (args.stdin && args.folder) {
    throw createCliError(
      "Options --stdin and --folder cannot be used together",
    );
  }

  if (args.stdin && !args.langOnly?.trim()) {
    throw createCliError("Option --stdin requires --lang-only");
  }
}

function isExitCodeError(error: unknown): error is ExitCodeError {
  return error instanceof Error && "exitCode" in error;
}

async function assertPathExists(
  targetPath: string,
  label: string,
): Promise<void> {
  try {
    await stat(targetPath);
  } catch (error) {
    throw createCliError(
      `Could not access ${label}: ${targetPath} (${stringifyError(error)})`,
    );
  }
}

async function validateInputPaths(args: ParsedCliArgs): Promise<void> {
  if (args.file) {
    const resolvedFilePath = path.resolve(args.file);

    try {
      const target = await stat(resolvedFilePath);
      if (target.isDirectory()) {
        throw createCliError(
          "Option --file expects a file path; use --folder for directories",
        );
      }
      if (!target.isFile()) {
        throw createCliError("Option --file expects a regular file path");
      }
    } catch (error) {
      if (isExitCodeError(error)) {
        throw error;
      }

      throw createCliError(
        `Could not access file: ${args.file} (${stringifyError(error)})`,
      );
    }
  }

  if (args.folder) {
    const resolvedFolderPath = path.resolve(args.folder);

    try {
      const target = await stat(resolvedFolderPath);
      if (!target.isDirectory()) {
        throw createCliError(
          "Option --folder expects a directory path; use --file for files",
        );
      }
    } catch (error) {
      if (isExitCodeError(error)) {
        throw error;
      }

      throw createCliError(
        `Could not access folder: ${args.folder} (${stringifyError(error)})`,
      );
    }
  }
}

function formatDiagnostic(diagnostic: Diagnostic, redact = true): string {
  const level = diagnostic.level ?? diagnostic.severity ?? "error";
  const safeMessage = sanitizeAndMaybeRedactForDisplay(
    diagnostic.message,
    redact,
  );
  const safeFilePath = diagnostic.filePath
    ? sanitizeAndMaybeRedactForDisplay(diagnostic.filePath, redact)
    : undefined;

  return safeFilePath
    ? `[${level}] ${safeFilePath}: ${safeMessage}`
    : `[${level}] ${safeMessage}`;
}

function emitDiagnostic(diagnostic: Diagnostic, redact = true): void {
  process.stderr.write(`${formatDiagnostic(diagnostic, redact)}\n`);
}

function emitDiagnostics(
  diagnostics: readonly Diagnostic[],
  redact = true,
): void {
  for (const diagnostic of diagnostics) {
    emitDiagnostic(diagnostic, redact);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of process.stdin) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function toStdinVirtualFilePath(lang: string): string {
  return `<stdin>.${normalizeExtension(lang).slice(1)}`;
}

function shouldTryImplicitStdin(args: ParsedCliArgs): boolean {
  return (
    !args.stdin && !args.file && !args.folder && process.stdin.isTTY !== true
  );
}

function inferImplicitStdinLanguage(
  extractOrder: readonly ExtractKind[],
  explicitLang?: string,
): string | undefined {
  if (explicitLang) {
    return explicitLang;
  }

  if (usesOnlyMarkdownExtractKinds(extractOrder)) {
    return "md";
  }

  return undefined;
}

async function resolveInputTarget(
  args: ParsedCliArgs,
  registry: LanguageRegistry,
  extractOrder: readonly ExtractKind[],
  explicitLang?: string,
): Promise<ResolvedInputTarget> {
  if (args.stdin) {
    const stdinLang = explicitLang ?? args.langOnly!.trim();

    return {
      files: [],
      stdinSource: await readStdin(),
      stdinFilePath: toStdinVirtualFilePath(stdinLang),
    };
  }

  if (shouldTryImplicitStdin(args)) {
    const stdinSource = await readStdin();

    if (stdinSource.length > 0) {
      const stdinLang = inferImplicitStdinLanguage(extractOrder, explicitLang);
      if (!stdinLang) {
        throw createCliError(
          "Could not infer stdin language. Please use --lang-only. Example: --lang-only .ts",
        );
      }

      return {
        files: [],
        stdinSource,
        stdinFilePath: toStdinVirtualFilePath(stdinLang),
      };
    }
  }

  if (args.file) {
    const resolvedFilePath = await resolveSafeInputPath(args.file);
    return { files: resolvedFilePath ? [resolvedFilePath] : [] };
  }

  if (args.folder) {
    const cwdRealPath = await realpath(process.cwd());
    const folderRealPath = await realpath(path.resolve(args.folder));
    if (!isPathWithin(cwdRealPath, folderRealPath)) {
      return { files: [] };
    }
  }

  const discoveredFiles = await discoverFiles(
    args.folder
      ? {
          registry,
          folder: args.folder,
          includeTests: args.includeTests,
          ignoreFolders: args.ignoreFolder ?? [],
          ...(args.maxDepth !== undefined ? { maxDepth: args.maxDepth } : {}),
        }
      : {
          registry,
          includeTests: args.includeTests,
          ignoreFolders: args.ignoreFolder ?? [],
          ...(args.maxDepth !== undefined ? { maxDepth: args.maxDepth } : {}),
        },
  );

  const files = explicitLang
    ? discoveredFiles.filter(
        (filePath) => registry.inferFromFile(filePath) === explicitLang,
      )
    : discoveredFiles;

  if (!usesOnlyMarkdownExtractKinds(extractOrder)) {
    return { files };
  }

  return {
    files: files.filter(
      (filePath) => registry.inferFromFile(filePath) === "md",
    ),
  };
}

async function resolveExecutionPlan(
  args: ParsedCliArgs,
): Promise<ExecutionPlan> {
  validateCliArgs(args);
  await validateInputPaths(args);

  const registry = buildDefaultRegistry();
  const rawLang = args.langOnly?.trim();
  const explicitLang = rawLang
    ? resolveLanguageId(registry, rawLang)
    : undefined;

  if (rawLang && !explicitLang) {
    throw createCliError(`${rawLang} not supported`);
  }

  const extractOrder = args.showOnly
    ? parseExtractOptions(args.showOnly, listSupportedExtractKinds(registry))
    : DEFAULT_EXTRACT_ORDER;

  const input = await resolveInputTarget(
    args,
    registry,
    extractOrder,
    explicitLang,
  );

  return {
    registry,
    ...(explicitLang ? { explicitLang } : {}),
    extractOrder,
    input,
    output: {
      ...(args.lineNumber ? { includeLineNumbers: true } : {}),
      ...(args.redact === false ? { redact: false } : {}),
    },
  };
}

function renderPipelineOutput(
  plan: ExecutionPlan,
  result: PipelineResult,
): string {
  return formatFinalOutput({
    registry: plan.registry,
    sections: result.sections,
    ...(plan.explicitLang ? { explicitLang: plan.explicitLang } : {}),
    ...(plan.output.includeLineNumbers ? { includeLineNumbers: true } : {}),
    ...(plan.output.redact === false ? { redact: false } : {}),
    seenLangs: result.meta.seenLangs,
  });
}

async function emitPipelineResult(
  plan: ExecutionPlan,
  result: PipelineResult,
  formattedOutput: string,
): Promise<void> {
  if (formattedOutput) {
    process.stdout.write(`${formattedOutput}\n`);
  }

  emitDiagnostics(result.diagnostics.warnings, plan.output.redact !== false);

  if (result.diagnostics.errors.length > 0) {
    emitDiagnostics(result.diagnostics.errors, plan.output.redact !== false);
    process.exitCode = 1;
  }
}

async function runPlannedPipeline(
  plan: ExecutionPlan,
): Promise<PipelineResult> {
  if (plan.input.stdinSource !== undefined) {
    const filePath =
      plan.input.stdinFilePath ?? toStdinVirtualFilePath(plan.explicitLang!);
    const lang = plan.explicitLang ?? plan.registry.inferFromFile(filePath);
    const adapter = lang ? await plan.registry.getOrLoad(lang) : undefined;

    if (!adapter || !lang) {
      throw new Error(`Language "${lang}" is not supported`);
    }

    const extracted = extractFromSource({
      adapter,
      filePath,
      source: plan.input.stdinSource,
      extractOrder: plan.extractOrder,
    });

    return {
      success: true,
      sections: [
        {
          filePath,
          lang: lang!,
          entries: extracted.entries,
          warnings: extracted.warnings,
        },
      ],
      diagnostics: {
        warnings: extracted.warnings,
        errors: [],
      },
      meta: {
        seenLangs: [lang!],
      },
    };
  }

  return runPipeline({
    registry: plan.registry,
    files: plan.input.files,
    ...(plan.explicitLang ? { explicitLang: plan.explicitLang } : {}),
    extractOrder: plan.extractOrder,
  });
}

async function execute(argv: readonly string[]): Promise<void> {
  const args = parseCliArgs(argv);

  if (!args) {
    return;
  }

  const plan = await resolveExecutionPlan(args);
  const result = await runPlannedPipeline(plan);
  const formattedOutput = renderPipelineOutput(plan, result);

  await emitPipelineResult(plan, result, formattedOutput);
}

function handleCliFailure(error: unknown): void {
  const diagnostic = toDiagnostic(error, { level: "error" });
  emitDiagnostic(diagnostic);

  const entryScript = process.argv[1] ?? "";
  const isCliProcess =
    entryScript.endsWith(`${path.sep}02-cli.js`) ||
    entryScript.endsWith("/02-cli.js");

  if (isCliProcess) {
    process.exitCode = diagnostic.exitCode ?? 1;
  }
}

export function buildCli(): CliProgram {
  return {
    run(argv = process.argv): Promise<void> {
      return execute(argv);
    },
  };
}

export async function runCli(
  argv: readonly string[] = process.argv,
): Promise<void> {
  try {
    await execute(argv);
  } catch (error) {
    handleCliFailure(error);
  }
}

// ============================================================================
// Utility — Config Shaping             [Step 2 — option parsing]
// ============================================================================
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasStringProp<T extends string>(
  value: Record<string, unknown>,
  key: T,
): value is Record<T, string> {
  return typeof value[key] === "string";
}

function hasNumberProp<T extends string>(
  value: Record<string, unknown>,
  key: T,
): value is Record<T, number> {
  return typeof value[key] === "number";
}

export function parseExtractOptions(
  rawValue: string,
  supportedKinds: readonly ExtractKind[],
): ExtractKind[] {
  const tokens = rawValue
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    throw new Error("No extract options were provided");
  }

  const supportedSet = new Set<string>(supportedKinds);
  const selected: ExtractKind[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (!supportedSet.has(token)) {
      const available = [...supportedSet].sort().join(", ");
      throw new Error(
        `Unsupported extract option: ${token}. Supported options: ${available}`,
      );
    }

    if (seen.has(token)) {
      continue;
    }

    selected.push(token as ExtractKind);
    seen.add(token);
  }

  return selected;
}

export function stringifyError(err: unknown): string {
  if (typeof err === "string") {
    return err;
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (isRecord(err) && hasStringProp(err, "message")) {
    return err.message;
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function toDiagnostic(
  err: unknown,
  options?: {
    level?: "warning" | "error";
    filePath?: string;
  },
): Diagnostic {
  const normalized: Diagnostic = {
    level: options?.level ?? "error",
    message: stringifyError(err),
    cause: err,
  };

  if (options?.filePath) {
    normalized.filePath = options.filePath;
  }

  if (!isRecord(err)) {
    return normalized;
  }

  if (!normalized.filePath && hasStringProp(err, "filePath")) {
    normalized.filePath = err.filePath;
  }

  if (hasStringProp(err, "code")) {
    normalized.code = err.code;
  }

  if (hasNumberProp(err, "exitCode")) {
    normalized.exitCode = err.exitCode;
  }

  if (hasStringProp(err, "kind")) {
    normalized.kind = err.kind as ExtractKind;
  }

  if (hasNumberProp(err, "pos")) {
    normalized.pos = err.pos;
  }

  return normalized;
}

export function toPipelineError(
  err: unknown,
  filePath?: string,
): PipelineError {
  const normalized: PipelineError = {
    message: stringifyError(err),
  };

  if (filePath) {
    normalized.filePath = filePath;
  }

  if (!isRecord(err)) {
    return normalized;
  }

  if (!normalized.filePath && hasStringProp(err, "filePath")) {
    normalized.filePath = err.filePath;
  }

  if (hasStringProp(err, "code")) {
    normalized.code = err.code;
  }

  if (hasNumberProp(err, "exitCode")) {
    normalized.exitCode = err.exitCode;
  }

  return normalized;
}

// ============================================================================
// Language Registry                    [Step 2b — registry setup]
// ============================================================================
function normalizeExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

function adapterToMetadata(adapter: LanguageAdapter): LanguageAdapterMetadata {
  if (adapter.metadata) {
    return adapter.metadata;
  }

  return {
    id: adapter.id,
    extensions: adapter.extensions,
    fenceLang: adapter.fenceLang,
  };
}

function getRegistryMetadata(
  registry: LanguageRegistry,
  langId: string,
): LanguageAdapterMetadata | undefined {
  return registry
    .listAdapterMetadata()
    .find((metadata) => metadata.id === langId);
}

function resolveLanguageId(
  registry: LanguageRegistry,
  rawLang: string,
): string | undefined {
  const normalized = rawLang.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (registry.has(normalized)) {
    return normalized;
  }

  const extension = normalizeExtension(normalized);

  for (const metadata of registry.listAdapterMetadata()) {
    if (
      metadata.extensions.some(
        (candidate) => normalizeExtension(candidate) === extension,
      )
    ) {
      return metadata.id;
    }
  }

  return undefined;
}

export function createLanguageRegistry(): LanguageRegistry {
  const adapters = new Map<string, LanguageAdapter>();
  const lazyAdapters = new Map<string, LazyLanguageAdapterRegistration>();

  const api: LanguageRegistry = {
    register(adapter: LanguageAdapter): void {
      adapters.set(adapter.id, adapter);
      lazyAdapters.delete(adapter.id);
    },

    registerLazy(registration: LazyLanguageAdapterRegistration): void {
      lazyAdapters.set(registration.id, registration);
      adapters.delete(registration.id);
    },

    unregister(langId: string): boolean {
      const hadEager = adapters.delete(langId);
      const hadLazy = lazyAdapters.delete(langId);
      return hadEager || hadLazy;
    },

    has(langId: string): boolean {
      return adapters.has(langId) || lazyAdapters.has(langId);
    },

    get(langId: string): LanguageAdapter | undefined {
      return adapters.get(langId);
    },

    async getOrLoad(langId: string): Promise<LanguageAdapter | undefined> {
      const existing = adapters.get(langId);
      if (existing) {
        return existing;
      }

      const registration = lazyAdapters.get(langId);
      if (!registration) {
        return undefined;
      }

      const loaded = await registration.load();

      if (loaded.id !== registration.id) {
        throw new Error(
          `Lazy adapter id mismatch: expected "${registration.id}" but got "${loaded.id}"`,
        );
      }

      api.register(loaded);
      return loaded;
    },

    listAdapters(): readonly LanguageAdapter[] {
      return [...adapters.values()];
    },

    listAdapterMetadata(): readonly LanguageAdapterMetadata[] {
      const eagerMetadata = [...adapters.values()].map(adapterToMetadata);
      const lazyMetadata = [...lazyAdapters.values()]
        .filter((registration) => !adapters.has(registration.id))
        .map((registration) => ({
          id: registration.id,
          extensions: registration.extensions,
          fenceLang: registration.id,
        }));

      return [...eagerMetadata, ...lazyMetadata];
    },

    inferFromFile(filePath: string): string | undefined {
      const ext = normalizeExtension(path.extname(filePath));
      if (!ext) {
        return undefined;
      }

      for (const adapter of adapters.values()) {
        if (
          adapter.extensions.some(
            (candidate) => normalizeExtension(candidate) === ext,
          )
        ) {
          return adapter.id;
        }
      }

      for (const registration of lazyAdapters.values()) {
        if (
          registration.extensions.some(
            (candidate) => normalizeExtension(candidate) === ext,
          )
        ) {
          return registration.id;
        }
      }

      return undefined;
    },

    supportedExtensions(): string[] {
      const extensions = new Set<string>();

      for (const adapter of adapters.values()) {
        for (const extension of adapter.extensions) {
          extensions.add(normalizeExtension(extension));
        }
      }

      for (const registration of lazyAdapters.values()) {
        for (const extension of registration.extensions) {
          extensions.add(normalizeExtension(extension));
        }
      }

      return [...extensions].filter((ext) => ext.length > 0);
    },

    supportedLanguages(): string[] {
      const ids = new Set<string>();
      for (const id of adapters.keys()) {
        ids.add(id);
      }
      for (const id of lazyAdapters.keys()) {
        ids.add(id);
      }
      return [...ids];
    },
  };

  return api;
}

export function buildDefaultRegistry(): LanguageRegistry {
  const registry = createLanguageRegistry();

  registry.register(
    createTsFamilyAdapter({
      id: "ts",
      extensions: [".ts", ".mts", ".cts"],
      fenceLang: "ts",
    }),
  );

  registry.register(
    createTsFamilyAdapter({
      id: "js",
      extensions: [".js", ".mjs", ".cjs"],
      fenceLang: "js",
    }),
  );

  registry.register(createTsxAdapter());

  registry.register(
    createPythonAdapter({
      id: "py",
      extensions: [".py"],
      fenceLang: "python",
    }),
  );

  registry.register(
    createGoAdapter({
      id: "go",
      extensions: [".go"],
      fenceLang: "go",
    }),
  );

  registry.register(
    createLuaAdapter({
      id: "lua",
      extensions: [".lua"],
      fenceLang: "lua",
    }),
  );

  registry.register(
    createRustAdapter({
      id: "rs",
      extensions: [".rs"],
      fenceLang: "rust",
    }),
  );

  registry.register(
    createMarkdownAdapter({
      id: "md",
      extensions: [".md"],
      fenceLang: "markdown",
    }),
  );

  return registry;
}

// ============================================================================
// File Discovery                       [Step 3 — resolve files]
// Uses globby to discover files
// ============================================================================
function normalizePathForMatch(filePath: string): string {
  return filePath.replace(/\\/g, "/").toLowerCase();
}

function compareFilesLogical(left: string, right: string): number {
  const leftNormalized = normalizePathForMatch(
    path.isAbsolute(left) ? path.relative(process.cwd(), left) : left,
  );
  const rightNormalized = normalizePathForMatch(
    path.isAbsolute(right) ? path.relative(process.cwd(), right) : right,
  );

  const leftDepth = leftNormalized.split("/").length;
  const rightDepth = rightNormalized.split("/").length;

  if (leftDepth !== rightDepth) {
    return leftDepth - rightDepth;
  }

  return leftNormalized.localeCompare(rightNormalized);
}

export function getSupportedGlobs(registry: LanguageRegistry): string[] {
  const extensions = registry.supportedExtensions();
  const globs = new Set<string>();

  for (const extension of extensions) {
    const normalized = normalizeExtension(extension);
    if (!normalized) {
      continue;
    }
    globs.add(`**/*${normalized}`);
  }

  return [...globs].sort();
}

export function isTestFile(filePath: string): boolean {
  const normalized = normalizePathForMatch(filePath);
  const segments = normalized.split("/");

  if (
    segments.some(
      (segment) =>
        segment === "test" || segment === "tests" || segment === "__tests__",
    )
  ) {
    return true;
  }

  const fileName = path.basename(normalized);

  return (
    /(?:\.|_|-)test\.[^/]+$/i.test(fileName) ||
    /(?:\.|_|-)spec\.[^/]+$/i.test(fileName)
  );
}

function inferDirectory(options: DiscoverFilesOptions): string {
  if ("folder" in options && typeof options.folder === "string") {
    return path.resolve(options.folder);
  }

  return process.cwd();
}

function toIgnoredFolderGlobs(
  ignoredFolders: readonly string[] | undefined,
  cwd: string,
): string[] {
  const globs: string[] = [];

  for (const ignoredFolder of ignoredFolders ?? []) {
    const trimmed = ignoredFolder.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.replace(/\\/g, "/").replace(/\/+$/u, "");
    const relative = path.isAbsolute(normalized)
      ? path.relative(cwd, normalized).replace(/\\/g, "/")
      : normalized.replace(/^\.\//u, "");

    if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) {
      continue;
    }

    globs.push(`${relative}/**`);

    if (!relative.includes("/")) {
      globs.push(`**/${relative}/**`);
    }
  }

  return globs;
}

export async function discoverFiles(
  options: DiscoverFilesOptions,
): Promise<string[]> {
  if ("file" in options && typeof options.file === "string") {
    const resolved = path.resolve(options.file);
    return options.registry.inferFromFile(resolved) ? [resolved] : [];
  }

  const globs = getSupportedGlobs(options.registry);
  if (globs.length === 0) {
    return [];
  }

  const cwd = inferDirectory(options);
  await assertPathExists(cwd, "folder");

  const discovered = await globby(globs, {
    cwd,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    gitignore: true,
    ignore: toIgnoredFolderGlobs(options.ignoreFolders, cwd),
    ...(options.maxDepth !== undefined ? { deep: options.maxDepth } : {}),
  });

  return (
    options.includeTests
      ? discovered
      : discovered.filter((filePath) => !isTestFile(filePath))
  ).sort(compareFilesLogical);
}

// ============================================================================
// Extraction Pipeline                  [Step 4-6 — per-file processing]
// ============================================================================
function uniqueInOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function resolveExtractAdapter(
  options: ExtractFromSourceOptions,
): LanguageAdapter {
  if (options.adapter) {
    return options.adapter;
  }

  if (options.registry && options.lang) {
    const adapter = options.registry.get(options.lang);
    if (adapter) {
      return adapter;
    }

    throw new Error(`Language adapter not loaded for "${options.lang}"`);
  }

  throw new Error(
    "extractFromSource requires either { adapter } or { registry, lang }",
  );
}

export function extractFromSource(
  options: ExtractFromSourceOptions,
): AggregatedExtractResult {
  const { filePath, source, extractOrder } = options;
  const adapter = resolveExtractAdapter(options);
  const context = adapter.buildContext({ source, filePath });

  return runExtractors({
    adapter,
    context,
    extractOrder,
  });
}

export async function processFile(
  options: ProcessFileOptions,
): Promise<FileSection> {
  const { registry, filePath, explicitLang, extractOrder } = options;
  const source = await readFile(filePath, "utf8");
  const lang = explicitLang ?? registry.inferFromFile(filePath);

  if (!lang) {
    throw new Error(formatUnsupportedFileMessage(filePath, registry));
  }

  const adapter = await registry.getOrLoad(lang);
  if (!adapter) {
    throw new Error(`Language "${lang}" is not supported`);
  }

  const extracted = extractFromSource({
    adapter,
    filePath,
    source,
    extractOrder,
  });

  return {
    filePath,
    lang,
    entries: extracted.entries,
    warnings: extracted.warnings,
  };
}

export async function runPipeline(
  options: RunPipelineOptions,
): Promise<PipelineResult> {
  const sections: FileSection[] = [];
  const errors: PipelineError[] = [];

  for (const filePath of options.files) {
    try {
      sections.push(
        await processFile({
          registry: options.registry,
          filePath,
          ...(options.explicitLang
            ? { explicitLang: options.explicitLang }
            : {}),
          extractOrder: options.extractOrder,
        }),
      );
    } catch (err) {
      errors.push(toPipelineError(err, filePath));
    }
  }

  const warnings = sections.flatMap((section) => section.warnings);
  const seenLangs = uniqueInOrder(sections.map((section) => section.lang));

  return {
    success: errors.length === 0,
    sections,
    diagnostics: {
      warnings,
      errors,
    },
    meta: {
      seenLangs,
    },
  };
}

// ============================================================================
// Extractor                            [Step 6b — extraction units]
// ============================================================================
export interface RunExtractorsOptions<
  TContext extends ParseContext = ParseContext,
> {
  adapter: LanguageAdapter<TContext>;
  context: TContext;
  extractOrder: ExtractKind[];
}

const FALLBACK_COMBINED_POS = Number.MAX_SAFE_INTEGER;

function toLineStarts(source: string): number[] {
  const starts = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }

  return starts;
}

function toLineNumberFromStarts(
  lineStarts: readonly number[],
  position: number,
): number {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if ((lineStarts[mid] ?? 0) <= position) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return high + 1;
}

function withEntryMetadata(
  entry: ExtractEntry,
  context: ParseContext,
  getSourceLine: (sourcePos: number) => number,
): ExtractEntry {
  const sourcePos = entry.metadata?.sourcePos;

  return {
    ...entry,
    metadata: {
      ...entry.metadata,
      filePath: entry.metadata?.filePath ?? context.filePath,
      ...(sourcePos === undefined
        ? {}
        : {
            sourceLine: entry.metadata?.sourceLine ?? getSourceLine(sourcePos),
          }),
    },
  };
}

function toCombinedEntries(entries: ExtractEntry[]): CombinedExtractEntry[] {
  return entries.map((entry) => ({
    kind: entry.kind,
    lines: entry.lines,
    pos: entry.metadata?.sourcePos ?? FALLBACK_COMBINED_POS,
    ...(entry.metadata ? { metadata: entry.metadata } : {}),
  }));
}

export function runExtractors<TContext extends ParseContext = ParseContext>(
  options: RunExtractorsOptions<TContext>,
): AggregatedExtractResult {
  const { adapter, context, extractOrder } = options;
  const combinedGroups: CombinedExtractEntry[][] = [];
  const warnings: ExtractWarning[] = [];
  const supportedKinds = extractOrder.filter((kind) =>
    adapter.extractors.has(kind),
  );

  if (supportedKinds.length === 0) {
    return { entries: [], warnings: [] };
  }

  const lineStarts = toLineStarts(context.source);
  const getSourceLine = (sourcePos: number) =>
    toLineNumberFromStarts(lineStarts, sourcePos);

  for (const kind of supportedKinds) {
    const extractor = adapter.extractors.get(kind);
    if (!extractor) {
      continue;
    }

    const result = extractor.extract(context);
    const entries = result.entries.map((entry) =>
      withEntryMetadata(entry, context, getSourceLine),
    );

    warnings.push(...result.warnings);
    combinedGroups.push(toCombinedEntries(entries));
  }

  const entries = stripCombinedPositions(
    dedupeCombinedEntries(mergeAndSortEntries(combinedGroups)),
  );
  return { entries, warnings };
}

// ============================================================================
// Utility — Entry Merging              [Step 6d — combined mode]
// ============================================================================
export function flattenExtractEntries(
  entryGroups: ExtractEntry[][],
): ExtractEntry[] {
  return entryGroups.flatMap((entries) => entries);
}

export function mergeAndSortEntries(
  entryGroups: CombinedExtractEntry[][],
): CombinedExtractEntry[] {
  return entryGroups
    .flatMap((entries, groupIndex) =>
      entries.map((entry, entryIndex) => ({ entry, groupIndex, entryIndex })),
    )
    .sort((left, right) => {
      if (left.entry.pos !== right.entry.pos) {
        return left.entry.pos - right.entry.pos;
      }

      if (left.groupIndex !== right.groupIndex) {
        return left.groupIndex - right.groupIndex;
      }

      return left.entryIndex - right.entryIndex;
    })
    .map(({ entry }) => entry);
}

function dedupeCombinedEntries(
  entries: readonly CombinedExtractEntry[],
): CombinedExtractEntry[] {
  const seen = new Set<string>();
  const uniqueEntries: CombinedExtractEntry[] = [];

  for (const entry of entries) {
    const key = JSON.stringify({
      filePath: entry.metadata?.filePath,
      sourcePos: entry.metadata?.sourcePos ?? entry.pos,
      lines: entry.lines,
    });

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueEntries.push(entry);
  }

  return uniqueEntries;
}

export function stripCombinedPositions(
  entries: CombinedExtractEntry[],
): ExtractEntry[] {
  return entries.map(({ kind, lines, metadata }) => ({
    kind,
    lines,
    ...(metadata ? { metadata } : {}),
  }));
}

// ============================================================================
// Output Formatting                    [Step 8 — format + sink]
// ============================================================================
export function toDisplayPath(filePath: string): string {
  const normalized = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath)
    : filePath;

  return sanitizeForDisplay(normalized.split(path.sep).join("/"));
}

function formatEntryLines(
  entry: ExtractEntry,
  includeLineNumbers: boolean,
  redact = true,
): string {
  const entryContent = entry.lines.join("\n");
  const displayContent = redact ? redactSecrets(entryContent) : entryContent;
  const lines = displayContent
    .split("\n")
    .map((line) => sanitizeForDisplay(line));
  const content = lines.join("\n");

  if (!includeLineNumbers) {
    return content;
  }

  const sourceLine = entry.metadata?.sourceLine;
  if (sourceLine === undefined) {
    return content;
  }

  const prefix = `${String(sourceLine)} `;
  const continuationPrefix = " ".repeat(prefix.length);

  return lines
    .map((line, index) => `${index === 0 ? prefix : continuationPrefix}${line}`)
    .join("\n");
}

export function formatPlainOutput(
  sections: FileSection[],
  options: { includeLineNumbers?: boolean; redact?: boolean } = {},
): string {
  const parts: string[] = [];

  for (const section of sections) {
    if (section.entries.length === 0) {
      continue;
    }

    parts.push(`// ${toDisplayPath(section.filePath)}`);

    for (const entry of section.entries) {
      parts.push(
        formatEntryLines(
          entry,
          options.includeLineNumbers === true,
          options.redact !== false,
        ),
      );
    }

    parts.push("");
  }

  return parts.join("\n").trimEnd();
}

export function detectFenceLanguage(
  options: DetectFenceLanguageOptions,
): string | undefined {
  const { registry, explicitLang, seenLangs } = options;

  if (explicitLang) {
    return (
      getRegistryMetadata(registry, explicitLang)?.fenceLang ?? explicitLang
    );
  }

  if (seenLangs.length === 1) {
    const lang = seenLangs[0];
    if (lang) {
      return getRegistryMetadata(registry, lang)?.fenceLang ?? lang;
    }
  }

  return undefined;
}

export function toMarkdownCodeBlock(
  content: string,
  fenceLanguage: string | undefined,
): string {
  const openFence = fenceLanguage ? `\`\`\`${fenceLanguage}` : "```";
  const body = content.split(/\r?\n/u).map(sanitizeForMarkdown).join("\n");
  return `${openFence}\n${body.endsWith("\n") ? body : `${body}\n`}\`\`\``;
}

export function formatFinalOutput(options: FormatFinalOutputOptions): string {
  const { sections } = options;

  const plainOutput = formatPlainOutput(sections, {
    ...(options.includeLineNumbers ? { includeLineNumbers: true } : {}),
    ...(options.redact === false ? { redact: false } : {}),
  });

  if (!plainOutput) {
    return "";
  }

  return plainOutput;
}

// ============================================================================
// Utility — Internal Helpers           [Internal-only]
// ============================================================================
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}
