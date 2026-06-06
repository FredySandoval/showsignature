import * as ts from "typescript";

import type {
  ExtractEntry,
  ExtractKind,
  Extractor,
  SingleExtractResult,
  TsParseContext,
} from "../../00-core-types.js";

const HTML_KIND = "html" as ExtractKind;
const CSSHIDDEN_KIND = "csshidden" as ExtractKind;

function toResult(entries: ExtractEntry[]): SingleExtractResult {
  return { entries, warnings: [] };
}

function toEntry(
  kind: ExtractKind,
  lines: string[],
  sourcePos: number,
  filePath: string,
): ExtractEntry {
  return { kind, lines, metadata: { filePath, sourcePos } };
}

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function lineStartForPosition(starts: readonly number[], position: number): number {
  let result = starts[0] ?? 0;
  for (const start of starts) {
    if (start > position) break;
    result = start;
  }
  return result;
}

function nodeText(source: string, node: ts.Node): string {
  return source.slice(node.getStart(), node.getEnd()).trim();
}

function tagNameText(source: string, name: ts.JsxTagNameExpression): string {
  return source.slice(name.getStart(), name.getEnd()).trim();
}

function openingText(source: string, node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  return source.slice(node.getStart(), node.getEnd()).trim();
}

function isJsxNode(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node);
}

function renderJsx(
  source: string,
  node: ts.Node,
  depth: number,
  entries: ExtractEntry[],
  filePath: string,
  starts: readonly number[],
): void {
  const indent = "  ".repeat(depth);

  if (ts.isJsxSelfClosingElement(node)) {
    entries.push(toEntry(HTML_KIND, [indent + openingText(source, node)], lineStartForPosition(starts, node.getStart()), filePath));
    return;
  }

  if (ts.isJsxFragment(node)) {
    entries.push(toEntry(HTML_KIND, [indent + "<>"], lineStartForPosition(starts, node.getStart()), filePath));
    for (const child of node.children) renderJsxChild(source, child, depth + 1, entries, filePath, starts);
    entries.push(toEntry(HTML_KIND, [indent + "</>"], lineStartForPosition(starts, node.closingFragment.getStart()), filePath));
    return;
  }

  if (ts.isJsxElement(node)) {
    entries.push(toEntry(HTML_KIND, [indent + openingText(source, node.openingElement)], lineStartForPosition(starts, node.openingElement.getStart()), filePath));
    for (const child of node.children) renderJsxChild(source, child, depth + 1, entries, filePath, starts);
    const close = `</${tagNameText(source, node.closingElement.tagName)}>`;
    entries.push(toEntry(HTML_KIND, [indent + close], lineStartForPosition(starts, node.closingElement.getStart()), filePath));
  }
}

function renderJsxChild(
  source: string,
  child: ts.JsxChild,
  depth: number,
  entries: ExtractEntry[],
  filePath: string,
  starts: readonly number[],
): void {
  if (ts.isJsxText(child)) return;
  if (ts.isJsxExpression(child)) {
    const expression = child.expression;
    if (!expression) return;
    const jsxChildren: ts.Node[] = [];
    const visit = (node: ts.Node): void => {
      if (isJsxNode(node)) {
        jsxChildren.push(node);
        return;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(expression, visit);

    if (jsxChildren.length > 0) {
      const raw = nodeText(source, expression);
      const placeholder = raw.includes(".map") ? raw.replace(/\.map\([\s\S]*$/u, ".map(...)") : raw.replace(/<[^]*$/u, "...");
      entries.push(toEntry(HTML_KIND, ["  ".repeat(depth) + `{${placeholder}}`], lineStartForPosition(starts, child.getStart()), filePath));
      for (const jsx of jsxChildren) renderJsx(source, jsx, depth + 1, entries, filePath, starts);
    } else {
      const raw = nodeText(source, child);
      if (raw.trim()) entries.push(toEntry(HTML_KIND, ["  ".repeat(depth) + raw], lineStartForPosition(starts, child.getStart()), filePath));
    }
    return;
  }
  renderJsx(source, child, depth, entries, filePath, starts);
}

export function createHtmlExtractor(): Extractor<TsParseContext> {
  return {
    kind: HTML_KIND,
    extract(context: TsParseContext): SingleExtractResult {
      const starts = lineStarts(context.source);
      const entries: ExtractEntry[] = [];
      const roots = new Set<ts.Node>();

      const visit = (node: ts.Node): void => {
        if (isJsxNode(node)) {
          roots.add(node);
          return;
        }
        ts.forEachChild(node, visit);
      };

      ts.forEachChild(context.sourceFile, visit);
      for (const root of roots) renderJsx(context.source, root, 0, entries, context.filePath, starts);
      return toResult(entries);
    },
  };
}

function redactCssNoise(source: string): string {
  return source
    .replace(/\b(className|class)\s*=\s*"[^"]*"/gu, '$1="..."')
    .replace(/\b(className|class)\s*=\s*'[^']*'/gu, "$1=\"...\"")
    .replace(/\b(className|class)\s*=\s*`[^`]*`/gu, "$1={`...`}")
    .replace(/\b(className|class)\s*=\s*\{[^}]*\}/gu, "$1={...}")
    .replace(/\bstyle\s*=\s*\{\{[\s\S]*?\}\}/gu, "style={...}")
    .replace(/\bstyle\s*=\s*\{[^}]*\}/gu, "style={...}");
}

export function createCssHiddenExtractor(): Extractor<TsParseContext> {
  return {
    kind: CSSHIDDEN_KIND,
    extract(context: TsParseContext): SingleExtractResult {
      return toResult([toEntry(CSSHIDDEN_KIND, redactCssNoise(context.source).split("\n"), 0, context.filePath)]);
    },
  };
}
