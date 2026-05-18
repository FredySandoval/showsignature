import type { GoParseContext } from "../../00-core-types.js";

export interface GoBlock {
  lines: string[];
  text: string;
  startLine: number;
  endLine: number;
  sourcePos: number;
}

interface ScanState {
  braceDepth: number;
  parenDepth: number;
  bracketDepth: number;
  inBlockComment: boolean;
  inRawString: boolean;
}

function cloneState(state: ScanState): ScanState {
  return { ...state };
}

export namespace GoHelpers {
  export function isBlank(line: string): boolean {
    return line.trim().length === 0;
  }

  export function lineStartAt(
    context: GoParseContext,
    lineIndex: number,
  ): number {
    return context.lineStarts[lineIndex] ?? context.source.length;
  }

  export function stripLineCommentOutsideStrings(line: string): string {
    const index = findLineCommentIndex(line);
    return index < 0 ? line.trimEnd() : line.slice(0, index).trimEnd();
  }

  export function findLineCommentIndex(line: string): number {
    let quote: '"' | "'" | "`" | null = null;
    let escaped = false;

    for (let index = 0; index < line.length; index += 1) {
      const current = line[index];
      const next = line[index + 1];

      if (quote) {
        if (quote !== "`" && escaped) {
          escaped = false;
          continue;
        }
        if (quote !== "`" && current === "\\") {
          escaped = true;
          continue;
        }
        if (current === quote) {
          quote = null;
        }
        continue;
      }

      if (current === '"' || current === "'" || current === "`") {
        quote = current;
        continue;
      }

      if (current === "/" && next === "/") {
        return index;
      }
    }

    return -1;
  }

  export function scanLine(state: ScanState, line: string): ScanState {
    const nextState = cloneState(state);
    let quote: '"' | "'" | null = null;
    let escaped = false;

    for (let index = 0; index < line.length; index += 1) {
      const current = line[index];
      const next = line[index + 1];

      if (nextState.inBlockComment) {
        if (current === "*" && next === "/") {
          nextState.inBlockComment = false;
          index += 1;
        }
        continue;
      }

      if (nextState.inRawString) {
        if (current === "`") {
          nextState.inRawString = false;
        }
        continue;
      }

      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (current === "\\") {
          escaped = true;
          continue;
        }
        if (current === quote) {
          quote = null;
        }
        continue;
      }

      if (current === "/" && next === "/") {
        break;
      }
      if (current === "/" && next === "*") {
        nextState.inBlockComment = true;
        index += 1;
        continue;
      }
      if (current === "`") {
        nextState.inRawString = true;
        continue;
      }
      if (current === '"' || current === "'") {
        quote = current;
        continue;
      }

      if (current === "{") nextState.braceDepth += 1;
      if (current === "}") nextState.braceDepth -= 1;
      if (current === "(") nextState.parenDepth += 1;
      if (current === ")") nextState.parenDepth -= 1;
      if (current === "[") nextState.bracketDepth += 1;
      if (current === "]") nextState.bracketDepth -= 1;
    }

    return nextState;
  }

  export function topLevelLineStates(context: GoParseContext): number[] {
    const depths: number[] = [];
    let state: ScanState = {
      braceDepth: 0,
      parenDepth: 0,
      bracketDepth: 0,
      inBlockComment: false,
      inRawString: false,
    };

    for (const line of context.lines) {
      depths.push(state.braceDepth);
      state = scanLine(state, line);
    }

    return depths;
  }

  export function collectDeclarationBlock(
    context: GoParseContext,
    startLine: number,
  ): GoBlock {
    const lines: string[] = [];
    let state: ScanState = {
      braceDepth: 0,
      parenDepth: 0,
      bracketDepth: 0,
      inBlockComment: false,
      inRawString: false,
    };
    let endLine = startLine;

    for (let index = startLine; index < context.lines.length; index += 1) {
      const line = context.lines[index] ?? "";
      lines.push(line.trimEnd());
      state = scanLine(state, line);
      endLine = index;

      const trimmed = stripLineCommentOutsideStrings(line).trimEnd();
      if (
        !state.inBlockComment &&
        !state.inRawString &&
        state.braceDepth <= 0 &&
        state.parenDepth <= 0 &&
        state.bracketDepth <= 0 &&
        (trimmed.length > 0 || lines.length > 1)
      ) {
        break;
      }
    }

    return {
      lines,
      text: lines
        .map((line) => line.trim())
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim(),
      startLine,
      endLine,
      sourcePos: lineStartAt(context, startLine),
    };
  }

  export function collectFuncHeader(
    context: GoParseContext,
    startLine: number,
  ): GoBlock {
    const block = collectDeclarationBlock(context, startLine);
    const headerLines = block.lines.join("\n");
    const bodyIndex = headerLines.indexOf("{");
    const text = (
      bodyIndex >= 0 ? headerLines.slice(0, bodyIndex) : headerLines
    )
      .split("\n")
      .map((line) => line.trim())
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();

    return { ...block, text };
  }

  export function summarizeValue(rawValue: string): string {
    const value = stripLineCommentOutsideStrings(rawValue).trim();
    if (!value) return "...";
    if (
      /^(?:`[\s\S]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])+'|-?\d+(?:\.\d+)?|true|false|nil)$/u.test(
        value,
      )
    ) {
      return value;
    }
    if (/^\[[^\]]*\].*\{/u.test(value) || /^\[[^\]]*\{/u.test(value)) {
      return "[...]";
    }
    if (
      value.startsWith("{") ||
      /\{\s*\}?$/u.test(value) ||
      /^(?:map|struct)\b[\s\S]*\{/u.test(value) ||
      /^[A-Za-z_][A-Za-z0-9_.]*(?:\[[^\]]+\])?\s*\{/u.test(value)
    ) {
      return "{...}";
    }
    return "...";
  }
}
