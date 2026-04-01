// ============================================================================
// Utility — Internal Helpers           [Internal-only]
// ============================================================================
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}
