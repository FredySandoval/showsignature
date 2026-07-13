import type {
  ExtractEntry,
  Extractor,
  RustParseContext,
  SingleExtractResult,
} from "../../00-core-types.js";
import { RustHelpers } from "./02-helpers.js";

function toResult(entries: ExtractEntry[]): SingleExtractResult {
  return { entries, warnings: [] };
}

function toEntry(kind: ExtractEntry["kind"], lines: string[], sourcePos: number, filePath: string): ExtractEntry {
  return { kind, lines, metadata: { filePath, sourcePos } };
}

function isTopLevel(depths: readonly number[], lineIndex: number): boolean {
  return (depths[lineIndex] ?? 0) === 0;
}

function isPublic(text: string): boolean {
  return /^pub(?:\([^)]*\))?\s+/u.test(text.trim());
}

function normalizeBlockLines(lines: readonly string[]): string[] {
  return lines.filter((line) => line.trim().length > 0).map((line) => line.trimEnd());
}

function declarationName(text: string): string | undefined {
  return /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+|unsafe\s+|const\s+|extern\s+)*(?:fn|struct|enum|union|trait|type|const|static|mod)\s+([A-Za-z_][A-Za-z0-9_]*)\b/u.exec(text.trim())?.[1];
}

function createDeclarationEntries(context: RustParseContext, kind: "interfaces" | "types", pattern: RegExp): ExtractEntry[] {
  const entries: ExtractEntry[] = [];
  const depths = RustHelpers.topLevelLineStates(context);
  for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
    const raw = context.lines[lineIndex] ?? "";
    if (!isTopLevel(depths, lineIndex)) continue;
    const trimmed = RustHelpers.stripLineCommentOutsideStrings(raw).trimStart();
    if (!pattern.test(trimmed)) continue;
    const block = RustHelpers.collectUntilTerminator(context, lineIndex);
    entries.push(toEntry(kind, normalizeBlockLines(block.lines), block.sourcePos, context.filePath));
    lineIndex = block.endLine;
  }
  return entries;
}

function collectFnEntries(context: RustParseContext): ExtractEntry[] {
  const entries: ExtractEntry[] = [];
  const depths = RustHelpers.topLevelLineStates(context);
  const fnPattern = /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+|unsafe\s+|const\s+|extern\s+)*(?:"[^"]+"\s+)?fn\b/u;
  for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
    const raw = context.lines[lineIndex] ?? "";
    if (!isTopLevel(depths, lineIndex)) continue;
    const trimmed = RustHelpers.stripLineCommentOutsideStrings(raw).trimStart();
    if (!fnPattern.test(trimmed)) continue;
    const header = RustHelpers.collectUntilTerminator(context, lineIndex);
    entries.push(toEntry("signatures", [RustHelpers.renderSignature(header.text)], header.sourcePos, context.filePath));
    lineIndex = header.endLine;
  }
  return entries;
}

export function createSignaturesExtractor(): Extractor<RustParseContext> {
  return {
    kind: "signatures",
    extract(context) {
      const entries = collectFnEntries(context);
      // Type declarations (trait/struct/enum/union/type) belong in the default
      // map like TS classes do; rendered identically to the interfaces/types
      // extractors so overlapping --only selections dedupe.
      for (const entry of [
        ...createInterfacesExtractor().extract(context).entries,
        ...createTypesExtractor().extract(context).entries,
      ]) {
        entries.push({ ...entry, kind: "signatures" });
      }
      return toResult(entries);
    },
  };
}

export function createInterfacesExtractor(): Extractor<RustParseContext> {
  return {
    kind: "interfaces",
    extract(context) {
      return toResult(createDeclarationEntries(context, "interfaces", /^(?:pub(?:\([^)]*\))?\s+)?(?:unsafe\s+)?trait\b/u));
    },
  };
}

export function createTypesExtractor(): Extractor<RustParseContext> {
  return {
    kind: "types",
    extract(context) {
      return toResult(createDeclarationEntries(context, "types", /^(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|union|type)\b/u));
    },
  };
}

export function createVariablesExtractor(): Extractor<RustParseContext> {
  return {
    kind: "variables",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = RustHelpers.topLevelLineStates(context);
      const pattern = /^(?:(pub(?:\([^)]*\))?)\s+)?(const|static|let)\s+([^=;]+?)(?:\s*=\s*(.+))?;?$/u;
      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const raw = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex)) continue;
        const trimmed = RustHelpers.stripLineCommentOutsideStrings(raw).trim();
        const match = pattern.exec(trimmed);
        if (!match) continue;
        const pub = match[1] ? `${match[1]} ` : "";
        const keyword = match[2] ?? "";
        const lhs = (match[3] ?? "").trim();
        const rhs = match[4] ? ` = ${RustHelpers.summarizeValue(match[4])}` : "";
        entries.push(toEntry("variables", [`${pub}${keyword} ${lhs}${rhs}`], RustHelpers.lineStartAt(context, lineIndex) + raw.indexOf(raw.trimStart()), context.filePath));
      }
      return toResult(entries);
    },
  };
}

export function createCommentsExtractor(): Extractor<RustParseContext> {
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
        let quote: '"' | "'" | null = null;
        let escaped = false;
        for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
          const current = line[charIndex];
          const next = line[charIndex + 1];
          if (inBlock) {
            const end = line.indexOf("*/", charIndex);
            if (end < 0) { blockLines.push(line.slice(charIndex)); break; }
            blockLines.push(line.slice(charIndex, end + 2));
            entries.push(toEntry("comments", blockLines, RustHelpers.lineStartAt(context, blockLine) + blockStart, context.filePath));
            blockLines = []; inBlock = false; charIndex = end + 1; continue;
          }
          if (quote) {
            if (escaped) { escaped = false; continue; }
            if (current === "\\") { escaped = true; continue; }
            if (current === quote) quote = null;
            continue;
          }
          if (current === '"' || current === "'") { quote = current; continue; }
          if (current === "/" && next === "/") {
            entries.push(toEntry("comments", [line.slice(charIndex)], RustHelpers.lineStartAt(context, lineIndex) + charIndex, context.filePath));
            break;
          }
          if (current === "/" && next === "*") {
            const end = line.indexOf("*/", charIndex + 2);
            blockStart = charIndex; blockLine = lineIndex;
            if (end >= 0) entries.push(toEntry("comments", [line.slice(charIndex, end + 2)], RustHelpers.lineStartAt(context, lineIndex) + charIndex, context.filePath));
            else { inBlock = true; blockLines = [line.slice(charIndex)]; break; }
          }
        }
      }
      return toResult(entries);
    },
  };
}

export function createImportsExtractor(): Extractor<RustParseContext> {
  return {
    kind: "imports",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = RustHelpers.topLevelLineStates(context);
      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const raw = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex)) continue;
        const trimmed = RustHelpers.stripLineCommentOutsideStrings(raw).trimStart();
        if (!/^(?:pub\s+)?(?:use|mod|extern\s+crate)\b/u.test(trimmed)) continue;
        const block = RustHelpers.collectUntilTerminator(context, lineIndex);
        entries.push(toEntry("imports", normalizeBlockLines(block.lines), block.sourcePos, context.filePath));
        lineIndex = block.endLine;
      }
      return toResult(entries);
    },
  };
}

export function createExportsExtractor(): Extractor<RustParseContext> {
  return {
    kind: "exports",
    extract(context) {
      const entries: ExtractEntry[] = [];
      for (const entry of collectFnEntries(context)) if (isPublic(entry.lines[0] ?? "")) entries.push({ ...entry, kind: "exports" });
      for (const entry of createInterfacesExtractor().extract(context).entries) if (isPublic(entry.lines[0] ?? "") && declarationName(entry.lines[0] ?? "")) entries.push({ ...entry, kind: "exports" });
      for (const entry of createTypesExtractor().extract(context).entries) if (isPublic(entry.lines[0] ?? "") && declarationName(entry.lines[0] ?? "")) entries.push({ ...entry, kind: "exports" });
      for (const entry of createVariablesExtractor().extract(context).entries) if (isPublic(entry.lines[0] ?? "") && declarationName(entry.lines[0] ?? "")) entries.push({ ...entry, kind: "exports" });
      for (const entry of createImportsExtractor().extract(context).entries) if (/^pub\s+/u.test(entry.lines[0] ?? "")) entries.push({ ...entry, kind: "exports" });
      // Keep the `pub` prefix: identical lines let the combined-mode dedupe
      // collapse the same item selected via two extractors (e.g. a pub trait
      // under --only interfaces,exports).
      return toResult(entries);
    },
  };
}
