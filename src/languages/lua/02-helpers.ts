import type { LuaParseContext } from "../../00-core-types.js";

export namespace LuaHelpers {
  export function lineStartAt(context: LuaParseContext, lineIndex: number): number {
    return context.lineStarts[lineIndex] ?? context.source.length;
  }

  export function stripLineCommentOutsideStrings(line: string): string {
    let quote: '"' | "'" | null = null;
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
      const current = line[index];
      const next = line[index + 1];
      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (current === "\\") {
          escaped = true;
          continue;
        }
        if (current === quote) quote = null;
        continue;
      }
      if (current === '"' || current === "'") {
        quote = current;
        continue;
      }
      if (current === "-" && next === "-") return line.slice(0, index);
    }
    return line;
  }

  export function summarizeValue(value: string): string {
    const trimmed = stripLineCommentOutsideStrings(value).trim();
    if (!trimmed) return "...";
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) return "{...}";
    if (/^(?:function\b|function\s*\()/u.test(trimmed)) return "function(...) ... end";
    if (/^["'].*["']$/u.test(trimmed)) return trimmed;
    if (/^(?:true|false|nil|\d+(?:\.\d+)?)$/u.test(trimmed)) return trimmed;
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
  }

  export function topLevelLineStates(context: LuaParseContext): number[] {
    const depths: number[] = [];
    let depth = 0;
    for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
      const raw = context.lines[lineIndex] ?? "";
      const line = stripLineCommentOutsideStrings(raw).trim();
      depths.push(depth);
      if (!line) continue;
      if (/\b(?:function|then|do|repeat)\b/u.test(line)) depth += 1;
      if (/\bend\b/u.test(line)) depth = Math.max(0, depth - 1);
      if (/^until\b/u.test(line)) depth = Math.max(0, depth - 1);
    }
    return depths;
  }

  export function collectFunctionHeader(context: LuaParseContext, startLine: number) {
    const raw = context.lines[startLine] ?? "";
    const text = stripLineCommentOutsideStrings(raw).trim();
    return {
      text: `${text} ... end`,
      sourcePos: lineStartAt(context, startLine) + raw.indexOf(raw.trimStart()),
      endLine: startLine,
    };
  }
}
