import { describe, expect, test } from 'bun:test';

import type { ParseContext } from '../src/00-core-types';

function readContextSummary(context: ParseContext): string {
  return `${context.filePath}:${context.source.length}`;
}

describe('ParseContext', () => {
  test('defines source and filePath fields', () => {
    const context: ParseContext = {
      source: 'export const value = 1;',
      filePath: '/tmp/example.ts',
    };

    expect(context.source).toBe('export const value = 1;');
    expect(context.filePath).toBe('/tmp/example.ts');
  });

  test('is compatible with consumers that depend on the base context contract', () => {
    const summary = readContextSummary({
      source: 'const x = 1;',
      filePath: '/tmp/file.ts',
    });

    expect(summary).toBe('/tmp/file.ts:12');
  });
});
