import type {
  ExtractEntry,
  Extractor,
  LuaParseContext,
  SingleExtractResult,
} from "../../00-core-types.js";
import { LuaHelpers } from "./02-helpers.js";

function toResult(entries: ExtractEntry[]): SingleExtractResult {
  return { entries, warnings: [] };
}

function toEntry(
  kind: ExtractEntry["kind"],
  lines: string[],
  sourcePos: number,
  filePath: string,
): ExtractEntry {
  return { kind, lines, metadata: { filePath, sourcePos } };
}

function isTopLevel(depths: readonly number[], lineIndex: number): boolean {
  return (depths[lineIndex] ?? 0) === 0;
}

function getFunctionName(header: string): string | undefined {
  return /^(?:local\s+)?function\s+([A-Za-z_][A-Za-z0-9_:.]*)\b/u.exec(header)?.[1]
    ?? /^([A-Za-z_][A-Za-z0-9_.:]*)\s*=\s*function\b/u.exec(header)?.[1];
}

function isExportedName(name: string): boolean {
  return !name.startsWith("_");
}

function toExportEntry(entry: ExtractEntry): ExtractEntry {
  return { ...entry, kind: "exports" };
}

export function createSignaturesExtractor(): Extractor<LuaParseContext> {
  return {
    kind: "signatures",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = LuaHelpers.topLevelLineStates(context);
      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const line = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex)) continue;
        const trimmed = LuaHelpers.stripLineCommentOutsideStrings(line).trim();
        if (!/^(?:local\s+)?function\s+|^[A-Za-z_][A-Za-z0-9_.:]*\s*=\s*function\b/u.test(trimmed)) continue;
        const header = LuaHelpers.collectFunctionHeader(context, lineIndex);
        entries.push(toEntry("signatures", [header.text], header.sourcePos, context.filePath));
      }
      return toResult(entries);
    },
  };
}

export function createInterfacesExtractor(): Extractor<LuaParseContext> {
  return { kind: "interfaces", extract: () => toResult([]) };
}

export function createTypesExtractor(): Extractor<LuaParseContext> {
  return { kind: "types", extract: () => toResult([]) };
}

export function createVariablesExtractor(): Extractor<LuaParseContext> {
  return {
    kind: "variables",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = LuaHelpers.topLevelLineStates(context);
      const pattern = /^(local\s+)?([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*=\s*(.+)$/u;
      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const raw = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex)) continue;
        const trimmed = LuaHelpers.stripLineCommentOutsideStrings(raw).trim();
        if (!trimmed || trimmed.startsWith("function ") || trimmed.startsWith("local function ")) continue;
        if (/^(?:if|for|while|repeat|return|require)\b/u.test(trimmed)) continue;
        if (/^[A-Za-z_][A-Za-z0-9_.:]*\s*=\s*function\b/u.test(trimmed)) continue;
        const match = pattern.exec(trimmed);
        if (!match) continue;
        const prefix = match[1] ?? "";
        const names = match[2] ?? "";
        const value = LuaHelpers.summarizeValue(match[3] ?? "");
        entries.push(toEntry("variables", [`${prefix}${names} = ${value}`], LuaHelpers.lineStartAt(context, lineIndex) + raw.indexOf(raw.trimStart()), context.filePath));
      }
      return toResult(entries);
    },
  };
}

export function createCommentsExtractor(): Extractor<LuaParseContext> {
  return {
    kind: "comments",
    extract(context) {
      const entries: ExtractEntry[] = [];
      let inBlock = false;
      let blockLines: string[] = [];
      let blockLine = 0;
      let blockStart = 0;
      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const line = context.lines[lineIndex] ?? "";
        for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
          if (inBlock) {
            const end = line.indexOf("]]", charIndex);
            if (end < 0) { blockLines.push(line.slice(charIndex)); break; }
            blockLines.push(line.slice(charIndex, end + 2));
            entries.push(toEntry("comments", blockLines, LuaHelpers.lineStartAt(context, blockLine) + blockStart, context.filePath));
            blockLines = []; inBlock = false; charIndex = end + 1; continue;
          }
          const current = line[charIndex];
          const next = line[charIndex + 1];
          if (current === "-" && next === "-") {
            if (line.slice(charIndex, charIndex + 4) === "--[[") {
              const end = line.indexOf("]]", charIndex + 4);
              if (end >= 0) entries.push(toEntry("comments", [line.slice(charIndex, end + 2)], LuaHelpers.lineStartAt(context, lineIndex) + charIndex, context.filePath));
              else { inBlock = true; blockLines = [line.slice(charIndex)]; blockLine = lineIndex; blockStart = charIndex; }
            } else entries.push(toEntry("comments", [line.slice(charIndex)], LuaHelpers.lineStartAt(context, lineIndex) + charIndex, context.filePath));
            break;
          }
          if (current === '"' || current === "'") {
            const quote = current;
            charIndex += 1;
            while (charIndex < line.length && (line[charIndex] !== quote || line[charIndex - 1] === "\\")) charIndex += 1;
          }
        }
      }
      return toResult(entries);
    },
  };
}

export function createImportsExtractor(): Extractor<LuaParseContext> {
  return {
    kind: "imports",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = LuaHelpers.topLevelLineStates(context);
      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const raw = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex)) continue;
        const trimmed = LuaHelpers.stripLineCommentOutsideStrings(raw).trim();
        if (!/require\s*\(/u.test(trimmed) && !/require\s*["']/u.test(trimmed)) continue;
        entries.push(toEntry("imports", [trimmed], LuaHelpers.lineStartAt(context, lineIndex) + raw.indexOf(raw.trimStart()), context.filePath));
      }
      return toResult(entries);
    },
  };
}

export function createExportsExtractor(): Extractor<LuaParseContext> {
  return {
    kind: "exports",
    extract(context) {
      const entries: ExtractEntry[] = [];
      for (const entry of createSignaturesExtractor().extract(context).entries) {
        const name = getFunctionName(entry.lines[0] ?? "");
        if (name && !entry.lines[0]?.startsWith("local ") && isExportedName(name.split(/[.:]/u).pop() ?? name)) entries.push(toExportEntry(entry));
      }
      for (const entry of createVariablesExtractor().extract(context).entries) {
        const line = entry.lines[0] ?? "";
        if (!line.startsWith("local ") && isExportedName(line.split("=")[0]?.trim() ?? "")) entries.push(toExportEntry(entry));
      }
      return toResult(entries);
    },
  };
}
