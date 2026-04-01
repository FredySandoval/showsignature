// ============================================================================
// Language Adapter                     [Step 6 — adapter + extractors]
// ============================================================================
import type {
  ExtractKind,
  LanguageAdapterMetadata,
  SingleExtractResult,
  ParseContext,
} from './00-core-types';

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
