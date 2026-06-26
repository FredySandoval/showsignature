import * as ts from "typescript";

import type { Range } from "../../00-core-types.js";

const MAX_LITERAL_INITIALIZER_PREVIEW_LENGTH = 80;
const MAX_ASSERTION_SUFFIX_PREVIEW_LENGTH = 40;

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

function normalizePreviewText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function previewAssertionSuffix(text: string): string {
  const normalized = text.replace(/\s+/gu, " ");

  if (normalized.length <= MAX_ASSERTION_SUFFIX_PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_ASSERTION_SUFFIX_PREVIEW_LENGTH - 3)}...`;
}

function previewInitializerText(
  text: string,
  suffix = "",
  options: { preserveClosingDelimiter?: boolean } = {},
): string {
  const normalized = normalizePreviewText(text);
  const normalizedSuffix = previewAssertionSuffix(suffix);

  if (
    normalized.length + normalizedSuffix.length <=
    MAX_LITERAL_INITIALIZER_PREVIEW_LENGTH
  ) {
    return `${normalized}${normalizedSuffix}`;
  }

  const closingDelimiter =
    options.preserveClosingDelimiter === false
      ? ""
      : closingDelimiterFor(normalized[0] ?? "");
  const previewSuffix = `...${closingDelimiter}${normalizedSuffix}`;
  const previewLength = Math.max(
    0,
    MAX_LITERAL_INITIALIZER_PREVIEW_LENGTH - previewSuffix.length,
  );

  return `${normalized.slice(0, previewLength)}${previewSuffix}`;
}

function isAssertionLikeExpression(
  expression: ts.Expression,
): expression is
  | ts.AsExpression
  | ts.TypeAssertion
  | ts.NonNullExpression
  | ts.SatisfiesExpression {
  return (
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  );
}

function unwrapAssertionLikeExpression(
  initializer: ts.Expression,
  sourceFile: ts.SourceFile,
): { expression: ts.Expression; suffix: string } {
  let expression = initializer;
  let suffix = "";

  while (isAssertionLikeExpression(expression)) {
    const outerExpression = expression;
    expression = expression.expression;

    let removedParentheses = false;
    while (ts.isParenthesizedExpression(expression)) {
      removedParentheses = true;
      expression = expression.expression;
    }

    if (!ts.isTypeAssertionExpression(outerExpression)) {
      const rawSuffix = sourceFile.text.slice(
        expression.getEnd(),
        outerExpression.getEnd(),
      );
      suffix = `${removedParentheses ? rawSuffix.replace(/^\)/u, "") : rawSuffix}${suffix}`;
    }
  }

  return { expression, suffix: suffix.trimEnd() };
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
    const { expression, suffix } = unwrapAssertionLikeExpression(
      initializer,
      sourceFile,
    );

    if (ts.isArrowFunction(expression)) {
      if (ts.isBlock(expression.body)) {
        return "...";
      }

      const params = expression.parameters
        .map((param) => param.getText(sourceFile))
        .join(", ");
      const expressionText = expression.getText(sourceFile);
      const paramText =
        expression.parameters.length === 1 && !expressionText.startsWith("(")
          ? params
          : `(${params})`;

      return previewInitializerText(
        `${paramText} => ${expression.body.getText(sourceFile)}`,
        suffix,
        { preserveClosingDelimiter: false },
      );
    }

    if (ts.isFunctionExpression(expression) || ts.isClassExpression(expression)) {
      return "...";
    }

    if (
      ts.isObjectLiteralExpression(expression) ||
      ts.isArrayLiteralExpression(expression) ||
      ts.isCallExpression(expression)
    ) {
      return previewInitializerText(expression.getText(sourceFile), suffix);
    }

    if (
      ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression) ||
      ts.isNumericLiteral(expression) ||
      ts.isBigIntLiteral(expression) ||
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      expression.kind === ts.SyntaxKind.NullKeyword ||
      ts.isRegularExpressionLiteral(expression)
    ) {
      return previewInitializerText(expression.getText(sourceFile), suffix);
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
