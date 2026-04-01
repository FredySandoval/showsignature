import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { TsAstHelpers } from '../../../src/languages/typescript/02-ast-helpers';
import { createTsParseContext } from '../../../src/languages/typescript/01-context';

function parse(source: string, filePath = '/tmp/example.ts'): ts.SourceFile {
  return createTsParseContext({ source, filePath }).sourceFile;
}

function findFirst<T extends ts.Node>(
  sourceFile: ts.SourceFile,
  predicate: (node: ts.Node) => node is T,
): T {
  let found: T | undefined;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }

    if (predicate(node)) {
      found = node;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!found) {
    throw new Error('Expected node was not found in source file.');
  }

  return found;
}

describe('TsAstHelpers.getModifiers', () => {
  test('returns textual modifiers in declaration order', () => {
    const sourceFile = parse('export abstract class User {}');
    const classDecl = findFirst(sourceFile, ts.isClassDeclaration);

    expect(TsAstHelpers.getModifiers(classDecl)).toEqual(['export', 'abstract']);
  });
});

describe('TsAstHelpers.printType', () => {
  test('prints explicit type annotation when available', () => {
    const sourceFile = parse('const id: string = "x";');
    const variableDecl = findFirst(sourceFile, ts.isVariableDeclaration);

    expect(TsAstHelpers.printType(variableDecl, sourceFile)).toBe('string');
  });

  test('returns empty string when node has no type annotation', () => {
    const sourceFile = parse('const id = "x";');
    const variableDecl = findFirst(sourceFile, ts.isVariableDeclaration);

    expect(TsAstHelpers.printType(variableDecl, sourceFile)).toBe('');
  });
});

describe('TsAstHelpers.printTypeParams', () => {
  test('prints generic parameters with angle brackets', () => {
    const sourceFile = parse('function wrap<T extends User, K = string>() {}');
    const fnDecl = findFirst(sourceFile, ts.isFunctionDeclaration);

    expect(TsAstHelpers.printTypeParams(fnDecl.typeParameters, sourceFile)).toBe(
      '<T extends User, K = string>',
    );
  });

  test('returns empty string for undefined type params', () => {
    const sourceFile = parse('function plain() {}');
    const fnDecl = findFirst(sourceFile, ts.isFunctionDeclaration);

    expect(TsAstHelpers.printTypeParams(fnDecl.typeParameters, sourceFile)).toBe(
      '',
    );
  });
});

describe('TsAstHelpers.printParams', () => {
  test('prints full parameter text preserving modifiers and defaults', () => {
    const sourceFile = parse(
      'class User { constructor(public id: number, name = "a") {} }',
    );
    const ctorDecl = findFirst(sourceFile, ts.isConstructorDeclaration);

    expect(TsAstHelpers.printParams(ctorDecl.parameters, sourceFile)).toBe(
      'public id: number, name = "a"',
    );
  });
});

describe('TsAstHelpers.getDeclarationKeyword', () => {
  test('detects const, let, and var keywords', () => {
    const constFile = parse('const x = 1;');
    const letFile = parse('let y = 2;');
    const varFile = parse('var z = 3;');

    const constList = findFirst(constFile, ts.isVariableDeclarationList);
    const letList = findFirst(letFile, ts.isVariableDeclarationList);
    const varList = findFirst(varFile, ts.isVariableDeclarationList);

    expect(TsAstHelpers.getDeclarationKeyword(constList)).toBe('const');
    expect(TsAstHelpers.getDeclarationKeyword(letList)).toBe('let');
    expect(TsAstHelpers.getDeclarationKeyword(varList)).toBe('var');
  });
});

describe('TsAstHelpers.hasAsyncModifier', () => {
  test('returns true only for async declarations', () => {
    const asyncFile = parse('async function run() {}');
    const syncFile = parse('function run() {}');

    const asyncFn = findFirst(asyncFile, ts.isFunctionDeclaration);
    const syncFn = findFirst(syncFile, ts.isFunctionDeclaration);

    expect(TsAstHelpers.hasAsyncModifier(asyncFn)).toBe(true);
    expect(TsAstHelpers.hasAsyncModifier(syncFn)).toBe(false);
  });
});

describe('TsAstHelpers.summarizeInitializer', () => {
  test('summarizes complex literals and preserves scalar literals', () => {
    const sourceFile = parse(`
      const objectValue = { a: 1 };
      const arrayValue = [1, 2, 3];
      const textValue = "hello";
      const numValue = 42;
      const boolValue = true;
      const nullValue = null;
      const callback = () => 1;
      const computed = createThing();
    `);

    const declarations = sourceFile.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => statement.declarationList.declarations);

    const values = declarations.map((decl) =>
      TsAstHelpers.summarizeInitializer(decl.initializer!, sourceFile),
    );

    expect(values).toEqual([
      '{...}',
      '[...]',
      '"hello"',
      '42',
      'true',
      'null',
      '...',
      '...',
    ]);
  });
});

describe('TsAstHelpers comment range helpers', () => {
  test('excludes comment-like text inside strings/templates/regex and masks it', () => {
    const source = `
      const s = "not // comment";
      const t = \`not /* comment */ either\`;
      const r = /not \\/\\/ comment/;
      // real comment
    `;
    const sourceFile = parse(source);

    const ranges = TsAstHelpers.buildCommentExclusionRanges(sourceFile);
    const masked = TsAstHelpers.maskExcludedRanges(source, ranges);

    expect(ranges.length).toBeGreaterThan(0);
    expect(masked).toContain('// real comment');
    expect(masked).not.toContain('not // comment');
    expect(masked).not.toContain('not /* comment */ either');

    const realCommentStart = source.indexOf('// real comment');
    const stringLikeStart = source.indexOf('"not // comment"');

    expect(TsAstHelpers.isRangeExcluded(realCommentStart, realCommentStart + 2, ranges)).toBe(false);
    expect(TsAstHelpers.isRangeExcluded(stringLikeStart, stringLikeStart + 2, ranges)).toBe(true);
  });
});
