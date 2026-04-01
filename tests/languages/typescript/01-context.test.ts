import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { createTsParseContext } from '../../../src/languages/typescript/01-context';

describe('createTsParseContext', () => {
  test('creates a ts context for .ts files', () => {
    const source = 'const x: number = 1;';
    const filePath = '/tmp/example.ts';

    const context = createTsParseContext({ source, filePath });

    expect(context.source).toBe(source);
    expect(context.filePath).toBe(filePath);
    expect(context.scriptKind).toBe(ts.ScriptKind.TS);
    expect(context.sourceFile.fileName).toBe(filePath);
    expect(context.sourceFile.text).toBe(source);
  });

  test('infers TSX script kind from .tsx extension', () => {
    const context = createTsParseContext({
      source: 'export const App = () => <div />;',
      filePath: '/tmp/App.tsx',
    });

    expect(context.scriptKind).toBe(ts.ScriptKind.TSX);
  });

  test('falls back to TS when extension is unknown', () => {
    const context = createTsParseContext({
      source: 'export type UserId = string;',
      filePath: '/tmp/schema.custom',
    });

    expect(context.scriptKind).toBe(ts.ScriptKind.TS);
  });
});

