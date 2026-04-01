export { buildCli, runCli } from './01-cli';
export {
  BUILT_IN_EXTRACT_KINDS,
  toPluginExtractKind,
  type AggregatedExtractResult,
  type BuiltInExtractKind,
  type CombinedExtractEntry,
  type DetectFenceLanguageOptions,
  type DiscoverFilesOptions,
  type ExtractEntry,
  type ExtractEntryMetadata,
  type ExtractFromSourceOptions,
  type ExtractKind,
  type ExtractWarning,
  type FileSection,
  type FormatFinalOutputOptions,
  type LanguageAdapter,
  type LanguageAdapterMetadata,
  type LanguageRegistry,
  type ParseContext,
  type PipelineDiagnostics,
  type PipelineError,
  type PipelineMeta,
  type PipelineResult,
  type PluginExtractKind,
  type ProcessFileOptions,
  type Range,
  type RunPipelineOptions,
  type SingleExtractResult,
  type TsParseContext,
} from './00-core-types';
export { createLanguageRegistry, buildDefaultRegistry } from './03-language-registry';
export { discoverFiles, getSupportedGlobs, isTestFile } from './04-file-discovery';
export { extractFromSource, processFile, runPipeline } from './05-pipeline';
export {
  detectFenceLanguage,
  formatFinalOutput,
  formatPlainOutput,
  toDisplayPath,
  toMarkdownCodeBlock,
} from './10-output-formatting';
