// ============================================================================
// Core Types
// ============================================================================
import type * as ts from "typescript";

export type BuiltInExtractKind =
  | "signatures"
  | "interfaces"
  | "types"
  | "variables"
  | "comments"
  | "imports";

export const BUILT_IN_EXTRACT_KINDS: readonly BuiltInExtractKind[] = [
  "signatures",
  "interfaces",
  "types",
  "variables",
  "comments",
  "imports",
] as const;

declare const pluginExtractKindBrand: unique symbol;

export type PluginExtractKind = string & {
  readonly [pluginExtractKindBrand]: true;
};

export type ExtractKind = BuiltInExtractKind | PluginExtractKind;

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface ExtractEntryMetadata {
  filePath?: string;
  sourcePos?: number;
}

export interface ExtractEntry {
  kind: ExtractKind;
  lines: string[];
  metadata?: ExtractEntryMetadata;
}

export interface ExtractWarning {
  message: string;
  filePath: string;
  severity?: DiagnosticSeverity;
  kind?: ExtractKind;
  pos?: number;
  code?: string;
}

export interface SingleExtractResult {
  entries: ExtractEntry[];
  warnings: ExtractWarning[];
}

export interface AggregatedExtractResult {
  entries: ExtractEntry[];
  warnings: ExtractWarning[];
}

export interface FileSection {
  filePath: string;
  lang: string;
  entries: ExtractEntry[];
  warnings: ExtractWarning[];
}

export interface PipelineError {
  message: string;
  filePath?: string;
  code?: string;
  exitCode?: number;
}

export interface PipelineDiagnostics {
  warnings: ExtractWarning[];
  errors: PipelineError[];
}

export interface PipelineMeta {
  seenLangs: readonly string[];
}

export interface PipelineResult {
  success: boolean;
  sections: FileSection[];
  diagnostics: PipelineDiagnostics;
  meta: PipelineMeta;
}

// Base — language-agnostic
export interface ParseContext {
  readonly source: string;
  readonly filePath: string;
}

// TS/JS specific — extends base
export interface TsParseContext extends ParseContext {
  readonly sourceFile: ts.SourceFile;
  readonly scriptKind: ts.ScriptKind;
}
// Future: each language defines its own context
// interface PyParseContext extends ParseContext { readonly ast: PythonAST; }
// interface GoParseContext extends ParseContext { readonly ast: GoAST; }

export interface LanguageAdapterMetadata {
  id: string;
  extensions: readonly string[];
  fenceLang: string;
  displayName?: string;
  version?: string;
  experimental?: boolean;
}

export interface LazyLanguageAdapterRegistration {
  id: string;
  extensions: readonly string[];
  load: () => LanguageAdapter | Promise<LanguageAdapter>;
}

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

export interface LanguageRegistry {
  register(adapter: LanguageAdapter): void;
  registerLazy(registration: LazyLanguageAdapterRegistration): void;
  unregister(langId: string): boolean;
  has(langId: string): boolean;
  get(langId: string): LanguageAdapter | undefined;
  getOrLoad(langId: string): Promise<LanguageAdapter | undefined>;
  listAdapters(): readonly LanguageAdapter[];
  listAdapterMetadata(): readonly LanguageAdapterMetadata[];
  inferFromFile(filePath: string): string | undefined;
  supportedExtensions(): string[];
  supportedLanguages(): string[];
}

export type DiscoverFilesOptions =
  | {
      registry: LanguageRegistry;
      file: string;
      folder?: never;
      includeTests?: boolean;
    }
  | {
      registry: LanguageRegistry;
      folder: string;
      file?: never;
      includeTests?: boolean;
    }
  | {
      registry: LanguageRegistry;
      file?: never;
      folder?: never;
      includeTests?: boolean;
    };

export interface RunPipelineOptions {
  registry: LanguageRegistry;
  files: string[];
  explicitLang?: string;
  extractOrder: ExtractKind[];
}

export interface ProcessFileOptions {
  registry: LanguageRegistry;
  filePath: string;
  explicitLang?: string;
  extractOrder: ExtractKind[];
}

export interface ExtractFromSourceOptions {
  adapter?: LanguageAdapter;
  registry?: LanguageRegistry;
  lang?: string;
  filePath: string;
  source: string;
  extractOrder: ExtractKind[];
}

export interface CombinedExtractEntry {
  kind: ExtractKind;
  lines: string[];
  pos: number;
}

export interface Range {
  start: number;
  end: number;
}

export interface DetectFenceLanguageOptions {
  registry: LanguageRegistry;
  explicitLang?: string;
  seenLangs: readonly string[];
}

export interface FormatFinalOutputOptions {
  registry: LanguageRegistry;
  sections: FileSection[];
  explicitLang?: string;
  outputPath?: string;
  seenLangs: readonly string[];
}

export interface CliProgram {
  run(argv?: readonly string[]): Promise<void>;
}

export interface ParsedCliArgs {
  file?: string;
  folder?: string;
  lang?: string;
  extract?: string;
  output?: string;
  includeTests: boolean;
}

export interface ExitCodeError extends Error {
  exitCode?: number;
}

export interface PackageMetadata {
  name?: string;
  version?: string;
}

export interface ResolvedInputTarget {
  files: string[];
}

export interface OutputTarget {
  path?: string;
}

export interface ExecutionPlan {
  registry: LanguageRegistry;
  explicitLang?: string;
  extractOrder: ExtractKind[];
  input: ResolvedInputTarget;
  output: OutputTarget;
}
