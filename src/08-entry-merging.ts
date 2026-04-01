// ============================================================================
// Utility — Entry Merging              [Step 6d — combined mode]
// ============================================================================
import type { CombinedExtractEntry, ExtractEntry } from './00-core-types';

export function flattenExtractEntries(entryGroups: ExtractEntry[][]): ExtractEntry[] {
  return entryGroups.flatMap((entries) => entries);
}

export function mergeAndSortEntries(
  entryGroups: CombinedExtractEntry[][]
): CombinedExtractEntry[] {
  return entryGroups
    .flatMap((entries, groupIndex) =>
      entries.map((entry, entryIndex) => ({ entry, groupIndex, entryIndex }))
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

export function stripCombinedPositions(entries: CombinedExtractEntry[]): ExtractEntry[] {
  return entries.map(({ kind, lines }) => ({ kind, lines }));
}
