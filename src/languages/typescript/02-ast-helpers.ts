import * as ts from "typescript";

import type { Range } from "../../00-core-types.js";

const MAX_LITERAL_INITIALIZER_PREVIEW_LENGTH = 80;

function closingDelimiterFor(openingDelimiter: string): string {
  switch (openingDelimiter) {
    case '"':
    case "'":
    case "`":
      return openingDelimiter;
    case "[":
      return "]";
    case "{":
      return "}";
    case "(":
      return ")";
    default:
      return "";
  }
}

function previewInitializerText(text: string): string {
  const normalized = text.replace(/\r?\n/gu, "\\n");

  if (normalized.length <= MAX_LITERAL_INITIALIZER_PREVIEW_LENGTH) {
    return normalized;
  }

  const closingDelimiter = closingDelimiterFor(normalized[0] ?? "");
  const suffix = `...${closingDelimiter}`;
  const previewLength = Math.max(
    0,
    MAX_LITERAL_INITIALIZER_PREVIEW_LENGTH - suffix.length,
  );

  return `${normalized.slice(0, previewLength)}${suffix}`;
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) {
    return ranges;
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const first = sorted[0];
  if (!first) {
    return [];
  }

  const merged: Range[] = [{ start: first.start, end: first.end }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const previous = merged[merged.length - 1];

    if (!current || !previous) {
      continue;
    }

    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
      continue;
    }

    merged.push({ start: current.start, end: current.end });
  }

  return merged;
}

export namespace TsAstHelpers {
  export function getModifiers(node: ts.Node): string[] {
    if (!ts.canHaveModifiers(node)) {
      return [];
    }

    const modifiers = ts.getModifiers(node);
    if (!modifiers || modifiers.length === 0) {
      return [];
    }

    return modifiers.map((modifier) => modifier.getText());
  }

  export function printType(node: ts.Node, sourceFile: ts.SourceFile): string {
    const nodeWithType = node as ts.Node & {
      type?: ts.TypeNode;
    };

    if (!nodeWithType.type) {
      return "";
    }

    return nodeWithType.type.getText(sourceFile);
  }

  export function printTypeParams(
    typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
    sourceFile: ts.SourceFile,
  ): string {
    if (!typeParams || typeParams.length === 0) {
      return "";
    }

    const rendered = typeParams
      .map((typeParam) => typeParam.getText(sourceFile))
      .join(", ");

    return `<${rendered}>`;
  }

  export function printParams(
    params: ts.NodeArray<ts.ParameterDeclaration>,
    sourceFile: ts.SourceFile,
  ): string {
    return params.map((param) => param.getText(sourceFile)).join(", ");
  }

  export function getDeclarationKeyword(
    declarationList: ts.VariableDeclarationList,
  ): string {
    if (declarationList.flags & ts.NodeFlags.Const) {
      return "const";
    }

    if (declarationList.flags & ts.NodeFlags.Let) {
      return "let";
    }

    return "var";
  }

  export function hasAsyncModifier(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) {
      return false;
    }

    const modifiers = ts.getModifiers(node);
    if (!modifiers) {
      return false;
    }

    return modifiers.some(
      (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
    );
  }

  export function summarizeInitializer(
    initializer: ts.Expression,
    sourceFile: ts.SourceFile,
  ): string {
    if (
      ts.isObjectLiteralExpression(initializer) ||
      ts.isArrayLiteralExpression(initializer)
    ) {
      return previewInitializerText(initializer.getText(sourceFile));
    }

    if (
      ts.isArrowFunction(initializer) ||
      ts.isFunctionExpression(initializer) ||
      ts.isClassExpression(initializer)
    ) {
      return "...";
    }

    if (
      ts.isStringLiteral(initializer) ||
      ts.isNoSubstitutionTemplateLiteral(initializer) ||
      ts.isNumericLiteral(initializer) ||
      ts.isBigIntLiteral(initializer) ||
      initializer.kind === ts.SyntaxKind.TrueKeyword ||
      initializer.kind === ts.SyntaxKind.FalseKeyword ||
      initializer.kind === ts.SyntaxKind.NullKeyword ||
      ts.isRegularExpressionLiteral(initializer)
    ) {
      return previewInitializerText(initializer.getText(sourceFile));
    }

    return "...";
  }

  export function buildCommentExclusionRanges(
    sourceFile: ts.SourceFile,
  ): Range[] {
    const ranges: Range[] = [];

    function addRange(node: ts.Node): void {
      ranges.push({ start: node.getStart(sourceFile), end: node.getEnd() });
    }

    function visit(node: ts.Node): void {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isRegularExpressionLiteral(node)
      ) {
        addRange(node);
      } else if (ts.isTemplateExpression(node)) {
        addRange(node);
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return mergeRanges(ranges);
  }

  export function maskExcludedRanges(source: string, ranges: Range[]): string {
    if (ranges.length === 0 || source.length === 0) {
      return source;
    }

    const masked = source.split("");
    const mergedRanges = mergeRanges(ranges);

    for (const range of mergedRanges) {
      const start = Math.max(0, range.start);
      const end = Math.min(source.length, range.end);

      for (let i = start; i < end; i += 1) {
        if (masked[i] !== "\n" && masked[i] !== "\r") {
          masked[i] = " ";
        }
      }
    }

    return masked.join("");
  }

  export function isRangeExcluded(
    start: number,
    end: number,
    ranges: Range[],
  ): boolean {
    return ranges.some((range) => start < range.end && end > range.start);
  }
}
