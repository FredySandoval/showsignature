import type { RustParseContext } from "../../00-core-types.js";

export interface RustCollectedBlock {
  text: string;
  lines: string[];
  sourcePos: number;
  endLine: number;
}

export namespace RustHelpers {
  export function lineStartAt(context: RustParseContext, lineIndex: number): number {
    return context.lineStarts[lineIndex] ?? context.source.length;
  }

  export function stripLineCommentOutsideStrings(line: string): string {
    let quote: '"' | "'" | null = null;
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
      const current = line[index];
      const next = line[index + 1];
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (current === "\\") { escaped = true; continue; }
        if (current === quote) quote = null;
        continue;
      }
      if (current === '"' || current === "'") { quote = current; continue; }
      if (current === "/" && next === "/") return line.slice(0, index);
      if (current === "/" && next === "*") return line.slice(0, index);
    }
    return line;
  }

  export function topLevelLineStates(context: RustParseContext): number[] {
    const depths: number[] = [];
    let depth = 0;
    let inBlockComment = false;
    for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
      const raw = context.lines[lineIndex] ?? "";
      depths.push(depth);
      let line = raw;
      if (inBlockComment) {
        const end = line.indexOf("*/");
        if (end < 0) continue;
        line = line.slice(end + 2);
        inBlockComment = false;
      }
      const blockStart = line.indexOf("/*");
      if (blockStart >= 0) {
        const end = line.indexOf("*/", blockStart + 2);
        line = end >= 0 ? line.slice(0, blockStart) + line.slice(end + 2) : line.slice(0, blockStart);
        if (end < 0) inBlockComment = true;
      }
      line = stripLineCommentOutsideStrings(line);
      for (const char of line) {
        if (char === "{") depth += 1;
        else if (char === "}") depth = Math.max(0, depth - 1);
      }
    }
    return depths;
  }

  export function collectUntilTerminator(context: RustParseContext, startLine: number): RustCollectedBlock {
    const lines: string[] = [];
    let paren = 0;
    let angle = 0;
    let endLine = startLine;
    for (let index = startLine; index < context.lines.length; index += 1) {
      const raw = context.lines[index] ?? "";
      const cleaned = stripLineCommentOutsideStrings(raw).trimEnd();
      lines.push(cleaned.trim());
      for (const char of cleaned) {
        if (char === "(" || char === "[") paren += 1;
        else if (char === ")" || char === "]") paren = Math.max(0, paren - 1);
        else if (char === "<") angle += 1;
        else if (char === ">") angle = Math.max(0, angle - 1);
      }
      endLine = index;
      if ((cleaned.includes("{") || cleaned.trimEnd().endsWith(";") || cleaned.includes("=")) && paren === 0) break;
    }
    const first = context.lines[startLine] ?? "";
    const text = lines.join(" ").replace(/\s+/gu, " ").trim();
    return {
      text,
      lines: [text],
      sourcePos: lineStartAt(context, startLine) + first.indexOf(first.trimStart()),
      endLine,
    };
  }

  export function renderSignature(text: string): string {
    return `${text.replace(/\s*\{[\s\S]*$/u, "").replace(/;$/u, "").trim()} ...`;
  }

  export function summarizeValue(value: string): string {
    const trimmed = stripLineCommentOutsideStrings(value).trim().replace(/;$/u, "");
    if (!trimmed) return "...";
    if (trimmed.startsWith("{") || trimmed.startsWith("vec![") || trimmed.startsWith("[")) return "[...]";
    if (/^["'].+["']$/u.test(trimmed)) return trimmed;
    if (/^(?:true|false|None|Some\([^)]*\)|\d+(?:\.\d+)?)$/u.test(trimmed)) return trimmed;
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
  }
}
