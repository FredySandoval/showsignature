import type { PyParseContext } from "../../00-core-types.js";

export interface PyHeader {
  text: string;
  startLine: number;
  endLine: number;
  sourcePos: number;
}

export interface PyClassHeader extends PyHeader {
  name: string;
}

export namespace PyHelpers {
  export function isBlank(line: string): boolean {
    return line.trim().length === 0;
  }

  export function getIndent(line: string): number {
    let indent = 0;

    for (const char of line) {
      if (char === " ") {
        indent += 1;
        continue;
      }

      if (char === "\t") {
        indent += 4;
        continue;
      }

      break;
    }

    return indent;
  }

  export function isDecorator(line: string): boolean {
    return line.trimStart().startsWith("@");
  }

  export function isCommentLine(line: string): boolean {
    return line.trimStart().startsWith("#");
  }

  export function isTopLevelStatement(line: string): boolean {
    return getIndent(line) === 0 && !isBlank(line) && !isCommentLine(line);
  }

  export function lineAt(
    context: PyParseContext,
    lineIndex: number,
  ): string | undefined {
    return context.lines[lineIndex];
  }

  export function lineStartAt(
    context: PyParseContext,
    lineIndex: number,
  ): number {
    return context.lineStarts[lineIndex] ?? context.source.length;
  }

  export function startsClass(line: string): boolean {
    return /^class\b/u.test(line.trimStart());
  }

  export function startsFunction(line: string): boolean {
    return /^(?:async\s+)?def\b/u.test(line.trimStart());
  }

  export function normalizeHeader(text: string): string {
    return text
      .replace(/\s+/gu, " ")
      .trim()
      .replace(/\(\s+/gu, "(")
      .replace(/\s+\)/gu, ")")
      .replace(/\s+,/gu, ",")
      .replace(/,\s+\)/gu, ")")
      .replace(/\s+:/gu, ":");
  }

  export function countBracketDelta(text: string): number {
    let delta = 0;
    let quote: string | null = null;
    let inTripleQuote: string | null = null;

    for (let index = 0; index < text.length; index += 1) {
      const current = text[index];
      const next3 = text.slice(index, index + 3);
      const previous = index > 0 ? text[index - 1] : "";

      if (inTripleQuote) {
        if (next3 === inTripleQuote) {
          inTripleQuote = null;
          index += 2;
        }
        continue;
      }

      if (quote) {
        if (current === quote && previous !== "\\") {
          quote = null;
        }
        continue;
      }

      if (current === "#") {
        break;
      }

      if (next3 === '"""' || next3 === "'''") {
        inTripleQuote = next3;
        index += 2;
        continue;
      }

      if (current === '"' || current === "'") {
        quote = current;
        continue;
      }

      if (current === "(" || current === "[" || current === "{") {
        delta += 1;
      }

      if (current === ")" || current === "]" || current === "}") {
        delta -= 1;
      }
    }

    return delta;
  }

  export function collectStatement(
    context: PyParseContext,
    startLine: number,
    options: { endsWithColon?: boolean } = {},
  ): PyHeader | null {
    const firstLine = lineAt(context, startLine);
    if (firstLine === undefined) {
      return null;
    }

    const parts: string[] = [];
    let bracketDepth = 0;
    let endLine = startLine;

    for (
      let lineIndex = startLine;
      lineIndex < context.lines.length;
      lineIndex += 1
    ) {
      const line = context.lines[lineIndex];
      if (line === undefined) {
        break;
      }

      parts.push(line.trim());
      bracketDepth += countBracketDelta(line);
      endLine = lineIndex;

      const trimmedLine = line.trimEnd();
      const expectsColon = options.endsWithColon === true;
      const hasLineContinuation = trimmedLine.endsWith("\\");
      const hasExpectedEnding = expectsColon ? trimmedLine.endsWith(":") : true;

      if (bracketDepth <= 0 && !hasLineContinuation && hasExpectedEnding) {
        break;
      }
    }

    return {
      text: normalizeHeader(parts.join(" ")),
      startLine,
      endLine,
      sourcePos: lineStartAt(context, startLine),
    };
  }

  export function collectHeader(
    context: PyParseContext,
    startLine: number,
  ): PyHeader | null {
    return collectStatement(context, startLine, { endsWithColon: true });
  }

  export function parseClassHeader(
    context: PyParseContext,
    startLine: number,
  ): PyClassHeader | null {
    const header = collectHeader(context, startLine);
    if (!header) {
      return null;
    }

    const match = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\b/u.exec(header.text);
    if (!match?.[1]) {
      return null;
    }

    return {
      ...header,
      name: match[1],
    };
  }

  export function stripInlineComment(value: string): string {
    let quote: string | null = null;
    let tripleQuote: string | null = null;

    for (let index = 0; index < value.length; index += 1) {
      const current = value[index];
      const next3 = value.slice(index, index + 3);
      const previous = index > 0 ? value[index - 1] : "";

      if (tripleQuote) {
        if (next3 === tripleQuote) {
          tripleQuote = null;
          index += 2;
        }
        continue;
      }

      if (quote) {
        if (current === quote && previous !== "\\") {
          quote = null;
        }
        continue;
      }

      if (next3 === '"""' || next3 === "'''") {
        tripleQuote = next3;
        index += 2;
        continue;
      }

      if (current === '"' || current === "'") {
        quote = current;
        continue;
      }

      if (current === "#") {
        return value.slice(0, index).trimEnd();
      }
    }

    return value.trimEnd();
  }

  export function summarizeValue(rawValue: string): string {
    const value = stripInlineComment(rawValue).trim();

    if (value.length === 0) {
      return "...";
    }

    if (value.startsWith("{")) {
      return "{...}";
    }

    if (value.startsWith("[")) {
      return "[...]";
    }

    if (value.startsWith("(")) {
      return "(...)";
    }

    if (/^lambda\b/u.test(value)) {
      return "...";
    }

    if (
      /^([rubf]|br|rb|fr|rf)*(["']).*\2$/iu.test(value) ||
      /^(?:-?\d+(?:\.\d+)?|True|False|None)$/u.test(value)
    ) {
      return value;
    }

    return "...";
  }
}
