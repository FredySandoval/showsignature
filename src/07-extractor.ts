// ============================================================================
// Extractor                            [Step 6b — extraction units]
// ============================================================================
import type {
  AggregatedExtractResult,
  CombinedExtractEntry,
  ExtractEntry,
  ExtractKind,
  ExtractWarning,
  LanguageAdapter,
  ParseContext,
  SingleExtractResult,
} from './00-core-types';
import {
  mergeAndSortEntries,
  stripCombinedPositions,
} from './08-entry-merging';

export interface Extractor<TContext extends ParseContext = ParseContext> {
  readonly kind: ExtractKind;
  extract(context: TContext): SingleExtractResult;
}

export interface RunExtractorsOptions<TContext extends ParseContext = ParseContext> {
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
    severity: 'warning',
    kind,
    code: 'EXTRACTOR_UNSUPPORTED_KIND',
  };
}

function withEntryMetadata(entry: ExtractEntry, context: ParseContext): ExtractEntry {
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
    const entries = result.entries.map((entry) => withEntryMetadata(entry, context));

    warnings.push(...result.warnings);
    combinedGroups.push(toCombinedEntries(entries, context));
  }

  const entries = stripCombinedPositions(mergeAndSortEntries(combinedGroups));
  return { entries, warnings };
}
