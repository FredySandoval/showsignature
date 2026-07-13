import type {
  ExtractEntry,
  Extractor,
  GoParseContext,
  SingleExtractResult,
} from "../../00-core-types.js";
import { GoHelpers } from "./02-helpers.js";

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

function isInterfaceType(text: string): boolean {
  return /^type\s+(?:[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]+\])?\s*=\s*)?[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]+\])?\s+interface\b/u.test(
    text,
  );
}

function normalizeBlockLines(lines: readonly string[]): string[] {
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.trimEnd());
}

function isExportedIdentifier(name: string): boolean {
  return /^\p{Lu}/u.test(name);
}

function readIdentifier(text: string): string | undefined {
  return /^[\p{L}_][\p{L}\p{N}_]*/u.exec(text.trimStart())?.[0];
}

function getGoFunctionName(header: string): string | undefined {
  const match = /^func\s+(?:\([^)]*\)\s*)?([\p{L}_][\p{L}\p{N}_]*)/u.exec(
    header,
  );
  return match?.[1];
}

function getGoDeclaredName(statement: string, keyword: "const" | "type" | "var"): string | undefined {
  const cleaned = GoHelpers.stripLineCommentOutsideStrings(statement).trim();
  if (!cleaned.startsWith(keyword)) return undefined;
  return readIdentifier(cleaned.slice(keyword.length));
}

function isExportedGoDeclaration(statement: string, keyword: "const" | "type" | "var"): boolean {
  const name = getGoDeclaredName(statement, keyword);
  return name ? isExportedIdentifier(name) : false;
}

function groupedTypeEntries(
  context: GoParseContext,
  startLine: number,
): ExtractEntry[] {
  const block = GoHelpers.collectDeclarationBlock(context, startLine);
  const entries: ExtractEntry[] = [];

  for (let index = startLine + 1; index < block.endLine; index += 1) {
    const raw = context.lines[index] ?? "";
    const line = GoHelpers.stripLineCommentOutsideStrings(raw).trim();
    if (!line || line === ")") continue;
    const text = `type ${line}`;
    const kind =
      /^type\s+[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]+\])?\s+interface\b/u.test(text)
        ? "interfaces"
        : "types";
    entries.push(
      toEntry(
        kind,
        [text],
        GoHelpers.lineStartAt(context, index) + raw.indexOf(raw.trimStart()),
        context.filePath,
      ),
    );
  }

  return entries.length > 0
    ? entries
    : [
        toEntry(
          "types",
          normalizeBlockLines(block.lines),
          block.sourcePos,
          context.filePath,
        ),
      ];
}

export function createSignaturesExtractor(): Extractor<GoParseContext> {
  return {
    kind: "signatures",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = GoHelpers.topLevelLineStates(context);

      for (
        let lineIndex = 0;
        lineIndex < context.lines.length;
        lineIndex += 1
      ) {
        const line = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex) || !/^\s*func\b/u.test(line))
          continue;
        const header = GoHelpers.collectFuncHeader(context, lineIndex);
        entries.push(
          toEntry(
            "signatures",
            [header.text],
            header.sourcePos,
            context.filePath,
          ),
        );
        lineIndex = header.endLine;
      }

      // Type declarations (struct/interface) belong in the default map like
      // TS classes do; rendered identically to the interfaces/types
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

export function createInterfacesExtractor(): Extractor<GoParseContext> {
  return {
    kind: "interfaces",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = GoHelpers.topLevelLineStates(context);

      for (
        let lineIndex = 0;
        lineIndex < context.lines.length;
        lineIndex += 1
      ) {
        const line = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex) || !/^\s*type\b/u.test(line))
          continue;
        const trimmed = line.trimStart();
        if (/^type\s*\(/u.test(trimmed)) {
          entries.push(
            ...groupedTypeEntries(context, lineIndex).filter(
              (entry) => entry.kind === "interfaces",
            ),
          );
          continue;
        }
        const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
        if (isInterfaceType(block.text)) {
          entries.push(
            toEntry(
              "interfaces",
              normalizeBlockLines(block.lines),
              block.sourcePos,
              context.filePath,
            ),
          );
          lineIndex = block.endLine;
        }
      }

      return toResult(entries);
    },
  };
}

export function createTypesExtractor(): Extractor<GoParseContext> {
  return {
    kind: "types",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = GoHelpers.topLevelLineStates(context);

      for (
        let lineIndex = 0;
        lineIndex < context.lines.length;
        lineIndex += 1
      ) {
        const line = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex) || !/^\s*type\b/u.test(line))
          continue;
        const trimmed = line.trimStart();
        if (/^type\s*\(/u.test(trimmed)) {
          entries.push(
            ...groupedTypeEntries(context, lineIndex).filter(
              (entry) => entry.kind === "types",
            ),
          );
          continue;
        }
        const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
        if (!isInterfaceType(block.text)) {
          entries.push(
            toEntry(
              "types",
              normalizeBlockLines(block.lines),
              block.sourcePos,
              context.filePath,
            ),
          );
          lineIndex = block.endLine;
        }
      }

      return toResult(entries);
    },
  };
}

function variableEntriesFromGroup(
  context: GoParseContext,
  startLine: number,
  keyword: "const" | "var",
): ExtractEntry[] {
  const block = GoHelpers.collectDeclarationBlock(context, startLine);
  const entries: ExtractEntry[] = [];
  for (let index = startLine + 1; index < block.endLine; index += 1) {
    const raw = context.lines[index] ?? "";
    const line = GoHelpers.stripLineCommentOutsideStrings(raw).trim();
    if (!line || line === ")") continue;
    entries.push(
      toEntry(
        "variables",
        [renderVariableLine(`${keyword} ${line}`)],
        GoHelpers.lineStartAt(context, index) + raw.indexOf(raw.trimStart()),
        context.filePath,
      ),
    );
  }
  return entries;
}

function renderVariableLine(statement: string): string {
  const cleaned = GoHelpers.stripLineCommentOutsideStrings(statement).trim();
  const match = /^(const|var)\s+(.+?)\s*=\s*([\s\S]+)$/u.exec(cleaned);
  if (!match) return cleaned;
  return `${match[1]} ${(match[2] ?? "").trim()} = ${GoHelpers.summarizeValue(match[3] ?? "")}`;
}

export function createVariablesExtractor(): Extractor<GoParseContext> {
  return {
    kind: "variables",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = GoHelpers.topLevelLineStates(context);
      for (
        let lineIndex = 0;
        lineIndex < context.lines.length;
        lineIndex += 1
      ) {
        const line = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex)) continue;
        const trimmed = line.trimStart();
        const group = /^(const|var)\s*\(/u.exec(trimmed);
        if (group?.[1] === "const" || group?.[1] === "var") {
          const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
          entries.push(
            ...variableEntriesFromGroup(context, lineIndex, group[1]),
          );
          lineIndex = block.endLine;
          continue;
        }
        if (/^(const|var)\s+/u.test(trimmed)) {
          const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
          entries.push(
            toEntry(
              "variables",
              [renderVariableLine(block.text)],
              block.sourcePos,
              context.filePath,
            ),
          );
          lineIndex = block.endLine;
        }
      }
      return toResult(entries);
    },
  };
}

export function createExportsExtractor(): Extractor<GoParseContext> {
  return {
    kind: "exports",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = GoHelpers.topLevelLineStates(context);

      for (
        let lineIndex = 0;
        lineIndex < context.lines.length;
        lineIndex += 1
      ) {
        const line = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex)) continue;

        const trimmed = line.trimStart();

        if (/^func\b/u.test(trimmed)) {
          const header = GoHelpers.collectFuncHeader(context, lineIndex);
          const name = getGoFunctionName(header.text);
          if (name && isExportedIdentifier(name)) {
            entries.push(
              toEntry("exports", [header.text], header.sourcePos, context.filePath),
            );
          }
          lineIndex = header.endLine;
          continue;
        }

        const typeGroup = /^type\s*\(/u.test(trimmed);
        if (typeGroup) {
          const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
          entries.push(
            ...groupedTypeEntries(context, lineIndex)
              .filter((entry) =>
                isExportedGoDeclaration(entry.lines[0] ?? "", "type"),
              )
              .map((entry) => ({ ...entry, kind: "exports" as const })),
          );
          lineIndex = block.endLine;
          continue;
        }

        if (/^type\s+/u.test(trimmed)) {
          const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
          if (isExportedGoDeclaration(block.text, "type")) {
            entries.push(
              toEntry(
                "exports",
                normalizeBlockLines(block.lines),
                block.sourcePos,
                context.filePath,
              ),
            );
          }
          lineIndex = block.endLine;
          continue;
        }

        const variableGroup = /^(const|var)\s*\(/u.exec(trimmed);
        if (variableGroup?.[1] === "const" || variableGroup?.[1] === "var") {
          const keyword = variableGroup[1];
          const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
          entries.push(
            ...variableEntriesFromGroup(context, lineIndex, keyword)
              .filter((entry) =>
                isExportedGoDeclaration(entry.lines[0] ?? "", keyword),
              )
              .map((entry) => ({ ...entry, kind: "exports" as const })),
          );
          lineIndex = block.endLine;
          continue;
        }

        if (/^(const|var)\s+/u.test(trimmed)) {
          const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
          const keyword = trimmed.startsWith("const") ? "const" : "var";
          const rendered = renderVariableLine(block.text);
          if (isExportedGoDeclaration(rendered, keyword)) {
            entries.push(
              toEntry("exports", [rendered], block.sourcePos, context.filePath),
            );
          }
          lineIndex = block.endLine;
        }
      }

      return toResult(entries);
    },
  };
}

export function createCommentsExtractor(): Extractor<GoParseContext> {
  return {
    kind: "comments",
    extract(context) {
      const entries: ExtractEntry[] = [];
      let inBlock = false;
      let blockLines: string[] = [];
      let blockStart = 0;
      let blockLine = 0;
      let inRaw = false;

      for (
        let lineIndex = 0;
        lineIndex < context.lines.length;
        lineIndex += 1
      ) {
        const line = context.lines[lineIndex] ?? "";
        let quote: '"' | "'" | null = null;
        let escaped = false;
        for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
          const current = line[charIndex];
          const next = line[charIndex + 1];
          if (inBlock) {
            const end = line.indexOf("*/", charIndex);
            if (end < 0) {
              blockLines.push(line.slice(charIndex));
              break;
            }
            blockLines.push(line.slice(charIndex, end + 2));
            entries.push(
              toEntry(
                "comments",
                blockLines,
                GoHelpers.lineStartAt(context, blockLine) + blockStart,
                context.filePath,
              ),
            );
            blockLines = [];
            inBlock = false;
            charIndex = end + 1;
            continue;
          }
          if (inRaw) {
            if (current === "`") inRaw = false;
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
            if (current === quote) quote = null;
            continue;
          }
          if (current === "`") {
            inRaw = true;
            continue;
          }
          if (current === '"' || current === "'") {
            quote = current;
            continue;
          }
          if (current === "/" && next === "/") {
            entries.push(
              toEntry(
                "comments",
                [line.slice(charIndex)],
                GoHelpers.lineStartAt(context, lineIndex) + charIndex,
                context.filePath,
              ),
            );
            break;
          }
          if (current === "/" && next === "*") {
            const end = line.indexOf("*/", charIndex + 2);
            blockStart = charIndex;
            blockLine = lineIndex;
            if (end >= 0) {
              entries.push(
                toEntry(
                  "comments",
                  [line.slice(charIndex, end + 2)],
                  GoHelpers.lineStartAt(context, lineIndex) + charIndex,
                  context.filePath,
                ),
              );
              charIndex = end + 1;
            } else {
              inBlock = true;
              blockLines = [line.slice(charIndex)];
              break;
            }
          }
        }
      }
      return toResult(entries);
    },
  };
}

export function createImportsExtractor(): Extractor<GoParseContext> {
  return {
    kind: "imports",
    extract(context) {
      const entries: ExtractEntry[] = [];
      const depths = GoHelpers.topLevelLineStates(context);
      for (
        let lineIndex = 0;
        lineIndex < context.lines.length;
        lineIndex += 1
      ) {
        const line = context.lines[lineIndex] ?? "";
        if (!isTopLevel(depths, lineIndex) || !/^\s*import\b/u.test(line))
          continue;
        const block = GoHelpers.collectDeclarationBlock(context, lineIndex);
        entries.push(
          toEntry(
            "imports",
            normalizeBlockLines(block.lines),
            block.sourcePos,
            context.filePath,
          ),
        );
        lineIndex = block.endLine;
      }
      return toResult(entries);
    },
  };
}
