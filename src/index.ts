// ============================================================================
// CLI                                  [Step 1 — entry point]
// Uses commanderjs to parse CLI arguments and run the pipeline
// ============================================================================
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { Command, CommanderError } from "commander";
import { BUILT_IN_EXTRACT_KINDS } from "./00-core-types.js";

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

interface PackageMetadata {
  name?: string;
  version?: string;
}

const DEFAULT_EXTRACT_ORDER: ExtractKind[] = ["signatures"];
const require = createRequire(import.meta.url);
const packageMetadata = require("../package.json") as PackageMetadata;
const CLI_NAME = packageMetadata.name ?? "showcode";
const CLI_VERSION = packageMetadata.version ?? "0.0.0";

function createCliError(message: string, exitCode = 1): ExitCodeError {
  const error = new Error(message) as ExitCodeError;
  error.exitCode = exitCode;
  return error;
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

function parseCliArgs(argv: readonly string[]): ParsedCliArgs | null {
  const program = new Command()
    .name(CLI_NAME)
    .usage("[options]")
    .version(CLI_VERSION)
    .option("--lang <lang>", "language to use when resolving files")
    .option("--extract <options>", "comma-separated extract options")
    .option("--file <file>", "process a single file")
    .option("--folder <folder>", "process files from a folder")
    .option("--output <name>", "write formatted output to a file")
    .option(
      "--include-tests",
      "include files under test directories during discovery",
      false,
    )
    .exitOverride();

  try {
    program.parse(stripArgvPrefix(argv), { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed") {
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
    throw createCliError("Options --file and --folder cannot be used together");
  }
}

function isExitCodeError(error: unknown): error is ExitCodeError {
  return error instanceof Error && "exitCode" in error;
}

async function validateInputPaths(args: ParsedCliArgs): Promise<void> {
  if (!args.file) {
    return;
  }

  const resolvedFilePath = path.resolve(args.file);

  try {
    const target = await stat(resolvedFilePath);
    if (target.isDirectory()) {
      throw createCliError(
        "Option --file expects a file path; use --folder for directories",
      );
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

function formatDiagnostic(
  prefix: "warning" | "error",
  message: string,
  filePath?: string,
): string {
  return filePath
    ? `[${prefix}] ${filePath}: ${message}`
    : `[${prefix}] ${message}`;
}

async function writeOutputFile(
  outputPath: string,
  content: string,
): Promise<void> {
  const resolvedOutputPath = path.resolve(outputPath);
  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, content, "utf8");
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
              ? {
                  registry,
                  folder: args.folder,
                  includeTests: args.includeTests,
                }
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
          `${formatDiagnostic("warning", warning.message, warning.filePath)}\n`,
        );
      }

      if (result.diagnostics.errors.length > 0) {
        for (const error of result.diagnostics.errors) {
          process.stderr.write(
            `${formatDiagnostic("error", error.message, error.filePath)}\n`,
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
      typeof err === "object" &&
      err !== null &&
      "exitCode" in err &&
      typeof err.exitCode === "number"
        ? err.exitCode
        : 1;

    process.exitCode = exitCode;
  }
}

// ============================================================================
// Utility — Config Shaping             [Step 2 — option parsing]
// ============================================================================
import type { ExtractKind, PipelineError } from "./00-core-types.js";

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
    .map((token) => token.trim())
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
import type {
  LanguageAdapterMetadata,
  LanguageRegistry,
  LazyLanguageAdapterRegistration,
} from "./00-core-types.js";
import { createTsFamilyAdapter } from "./languages/typescript/00-adapter.js";

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
      extensions: [".ts", ".tsx", ".mts", ".cts"],
      fenceLang: "ts",
    }),
  );

  registry.register(
    createTsFamilyAdapter({
      id: "js",
      extensions: [".js", ".jsx", ".mjs", ".cjs"],
      fenceLang: "js",
    }),
  );

  return registry;
}

// ============================================================================
// File Discovery                       [Step 3 — resolve files]
// Uses fast-glob to discover files
// ============================================================================
import fg from "fast-glob";
import type { DiscoverFilesOptions } from "./00-core-types.js";

function normalizePathForMatch(filePath: string): string {
  return filePath.replace(/\\/g, "/").toLowerCase();
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
  const discovered = await fg(globs, {
    cwd,
    absolute: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
  });

  return (
    options.includeTests
      ? discovered
      : discovered.filter((filePath) => !isTestFile(filePath))
  ).sort();
}

// ============================================================================
// Extraction Pipeline                  [Step 4-6 — per-file processing]
// ============================================================================
import { readFile } from "node:fs/promises";

import type {
  AggregatedExtractResult,
  ExtractFromSourceOptions,
  FileSection,
  PipelineResult,
  ProcessFileOptions,
  RunPipelineOptions,
} from "./00-core-types.js";

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

export function extractFromSource(
  options: ExtractFromSourceOptions,
): AggregatedExtractResult {
  const { registry, lang, filePath, source, extractOrder } = options;
  const adapter = registry.get(lang);

  if (!adapter) {
    throw new Error(`Language adapter not loaded for "${lang}"`);
  }

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
    throw new Error(`Could not infer language for file: ${filePath}`);
  }

  const adapter = await registry.getOrLoad(lang);
  if (!adapter) {
    throw new Error(`Language "${lang}" is not supported`);
  }

  const extracted = extractFromSource({
    registry,
    lang,
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
          explicitLang: options.explicitLang,
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
// Language Adapter                     [Step 6 — adapter + extractors]
// ============================================================================
import type { SingleExtractResult, ParseContext } from "./00-core-types.js";

export interface Extractor<TContext extends ParseContext = ParseContext> {
  readonly kind: ExtractKind;
  extract(context: TContext): SingleExtractResult;
}

export interface LanguageAdapter<TContext extends ParseContext = ParseContext> {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly fenceLang: string;
  readonly metadata?: LanguageAdapterMetadata;
  readonly extractors: ReadonlyMap<ExtractKind, Extractor<TContext>>;

  buildContext(options: { source: string; filePath: string }): TContext;

  supportsKind(kind: ExtractKind): boolean;
}

// ============================================================================
// Extractor                            [Step 6b — extraction units]
// ============================================================================
import type {
  CombinedExtractEntry,
  ExtractEntry,
  ExtractWarning,
} from "./00-core-types.js";
// import {
//   mergeAndSortEntries,
//   stripCombinedPositions,
// } from './08-entry-merging';

export interface Extractor<TContext extends ParseContext = ParseContext> {
  readonly kind: ExtractKind;
  extract(context: TContext): SingleExtractResult;
}

export interface RunExtractorsOptions<
  TContext extends ParseContext = ParseContext,
> {
  adapter: LanguageAdapter<TContext>;
  context: TContext;
  extractOrder: ExtractKind[];
}

const FALLBACK_COMBINED_POS = Number.MAX_SAFE_INTEGER;

function toUnsupportedKindWarning(
  kind: ExtractKind,
  context: ParseContext,
): ExtractWarning {
  return {
    message: `Extractor not supported for kind "${kind}"`,
    filePath: context.filePath,
    severity: "warning",
    kind,
    code: "EXTRACTOR_UNSUPPORTED_KIND",
  };
}

function withEntryMetadata(
  entry: ExtractEntry,
  context: ParseContext,
): ExtractEntry {
  return {
    ...entry,
    metadata: {
      ...entry.metadata,
      filePath: entry.metadata?.filePath ?? context.filePath,
    },
  };
}

function toCombinedEntries(
  entries: ExtractEntry[],
  context: ParseContext,
): CombinedExtractEntry[] {
  return entries.map((entry) => {
    const normalized = withEntryMetadata(entry, context);
    return {
      kind: normalized.kind,
      lines: normalized.lines,
      pos: normalized.metadata?.sourcePos ?? FALLBACK_COMBINED_POS,
    };
  });
}

export function runExtractors<TContext extends ParseContext = ParseContext>(
  options: RunExtractorsOptions<TContext>,
): AggregatedExtractResult {
  const { adapter, context, extractOrder } = options;
  const combinedGroups: CombinedExtractEntry[][] = [];
  const warnings: ExtractWarning[] = [];

  for (const kind of extractOrder) {
    const extractor = adapter.extractors.get(kind);
    if (!extractor) {
      warnings.push(toUnsupportedKindWarning(kind, context));
      continue;
    }

    const result = extractor.extract(context);
    const entries = result.entries.map((entry) =>
      withEntryMetadata(entry, context),
    );

    warnings.push(...result.warnings);
    combinedGroups.push(toCombinedEntries(entries, context));
  }

  const entries = stripCombinedPositions(mergeAndSortEntries(combinedGroups));
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

export function stripCombinedPositions(
  entries: CombinedExtractEntry[],
): ExtractEntry[] {
  return entries.map(({ kind, lines }) => ({ kind, lines }));
}
// ============================================================================
// Output Formatting                    [Step 8 — format + sink]
// ============================================================================
import type {
  DetectFenceLanguageOptions,
  FormatFinalOutputOptions,
} from "./00-core-types.js";

export function toDisplayPath(filePath: string): string {
  const normalised = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath)
    : filePath;

  return normalised.split(path.sep).join("/");
}

export function formatPlainOutput(sections: FileSection[]): string {
  const parts: string[] = [];

  for (const section of sections) {
    if (section.entries.length === 0) {
      continue;
    }

    parts.push(`// ${toDisplayPath(section.filePath)}`);

    for (const entry of section.entries) {
      parts.push(entry.lines.join("\n"));
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
    const adapter = registry.get(explicitLang);
    return adapter ? adapter.fenceLang : explicitLang;
  }

  if (seenLangs.length === 1) {
    const lang = seenLangs[0];
    if (lang) {
      const adapter = registry.get(lang);
      return adapter ? adapter.fenceLang : lang;
    }
  }

  return undefined;
}

export function toMarkdownCodeBlock(
  content: string,
  fenceLanguage: string | undefined,
): string {
  const openFence = fenceLanguage ? `\`\`\`${fenceLanguage}` : "```";
  const body = content.endsWith("\n") ? content : `${content}\n`;
  return `${openFence}\n${body}\`\`\``;
}

export function formatFinalOutput(options: FormatFinalOutputOptions): string {
  const { registry, sections, explicitLang, outputPath, seenLangs } = options;

  const plainOutput = formatPlainOutput(sections);

  if (!outputPath) {
    return plainOutput;
  }

  const fenceLang = detectFenceLanguage({ registry, explicitLang, seenLangs });
  return toMarkdownCodeBlock(plainOutput, fenceLang);
}
// ============================================================================
// Utility — Internal Helpers           [Internal-only]
// ============================================================================
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}
