// ============================================================================
// Utility — Config Shaping             [Step 2 — option parsing]
// ============================================================================
import type { ExtractKind, PipelineError } from './00-core-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStringProp<T extends string>(
  value: Record<string, unknown>,
  key: T,
): value is Record<T, string> {
  return typeof value[key] === 'string';
}

function hasNumberProp<T extends string>(
  value: Record<string, unknown>,
  key: T,
): value is Record<T, number> {
  return typeof value[key] === 'number';
}

export function parseExtractOptions(
  rawValue: string,
  supportedKinds: readonly ExtractKind[],
): ExtractKind[] {
  const tokens = rawValue
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    throw new Error('No extract options were provided');
  }

  const supportedSet = new Set<string>(supportedKinds);
  const selected: ExtractKind[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (!supportedSet.has(token)) {
      const available = [...supportedSet].sort().join(', ');
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
  if (typeof err === 'string') {
    return err;
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (isRecord(err) && hasStringProp(err, 'message')) {
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

  if (!normalized.filePath && hasStringProp(err, 'filePath')) {
    normalized.filePath = err.filePath;
  }

  if (hasStringProp(err, 'code')) {
    normalized.code = err.code;
  }

  if (hasNumberProp(err, 'exitCode')) {
    normalized.exitCode = err.exitCode;
  }

  return normalized;
}
