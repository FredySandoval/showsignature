import type {
  ExtractEntry,
  Extractor,
  PyParseContext,
  SingleExtractResult,
} from "../../00-core-types.js";
import { PyHelpers } from "./02-helpers.js";

function toResult(entries: ExtractEntry[]): SingleExtractResult {
  return { entries, warnings: [] };
}

function toEntry(
  kind: ExtractEntry["kind"],
  lines: string[],
  sourcePos: number,
  filePath: string,
): ExtractEntry {
  return {
    kind,
    lines,
    metadata: {
      filePath,
      sourcePos,
    },
  };
}

function renderFunctionSignature(header: string): string {
  return `${header} ...`;
}

function renderClassSignature(
  header: string,
  methodSignatures: readonly string[],
): string[] {
  return [header, ...methodSignatures.map((line) => `    ${line}`)];
}

function createTopLevelFunctionEntries(context: PyParseContext): ExtractEntry[] {
  const entries: ExtractEntry[] = [];

  for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
    const line = context.lines[lineIndex];
    if (!line || PyHelpers.getIndent(line) !== 0 || !PyHelpers.startsFunction(line)) {
      continue;
    }

    const header = PyHelpers.collectHeader(context, lineIndex);
    if (!header) {
      continue;
    }

    entries.push(
      toEntry(
        "signatures",
        [renderFunctionSignature(header.text)],
        header.sourcePos,
        context.filePath,
      ),
    );

    lineIndex = header.endLine;
  }

  return entries;
}

function createClassEntries(context: PyParseContext): ExtractEntry[] {
  const entries: ExtractEntry[] = [];

  for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
    const line = context.lines[lineIndex];
    if (!line || PyHelpers.getIndent(line) !== 0 || !PyHelpers.startsClass(line)) {
      continue;
    }

    const classHeader = PyHelpers.parseClassHeader(context, lineIndex);
    if (!classHeader) {
      continue;
    }

    const methodSignatures: string[] = [];
    const classIndent = PyHelpers.getIndent(line);
    let memberLineIndex = classHeader.endLine + 1;

    while (memberLineIndex < context.lines.length) {
      const memberLine = context.lines[memberLineIndex];
      if (memberLine === undefined) {
        break;
      }

      if (PyHelpers.isBlank(memberLine) || PyHelpers.isCommentLine(memberLine)) {
        memberLineIndex += 1;
        continue;
      }

      const memberIndent = PyHelpers.getIndent(memberLine);
      if (memberIndent <= classIndent) {
        break;
      }

      if (PyHelpers.isDecorator(memberLine)) {
        memberLineIndex += 1;
        continue;
      }

      if (PyHelpers.startsFunction(memberLine)) {
        const header = PyHelpers.collectHeader(context, memberLineIndex);
        if (header) {
          methodSignatures.push(renderFunctionSignature(header.text));
          memberLineIndex = header.endLine + 1;
          continue;
        }
      }

      memberLineIndex += 1;
    }

    entries.push(
      toEntry(
        "signatures",
        renderClassSignature(classHeader.text, methodSignatures),
        classHeader.sourcePos,
        context.filePath,
      ),
    );

    lineIndex = classHeader.endLine;
  }

  return entries;
}

export function createSignaturesExtractor(): Extractor<PyParseContext> {
  return {
    kind: "signatures",
    extract(context: PyParseContext): SingleExtractResult {
      return toResult([
        ...createClassEntries(context),
        ...createTopLevelFunctionEntries(context),
      ]);
    },
  };
}

export function createVariablesExtractor(): Extractor<PyParseContext> {
  return {
    kind: "variables",
    extract(context: PyParseContext): SingleExtractResult {
      const entries: ExtractEntry[] = [];
      const statementPattern =
        /^([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)(\s*:\s*[^=]+)?\s*=\s*(.+)$/u;

      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const line = context.lines[lineIndex];
        if (!line || PyHelpers.getIndent(line) !== 0) {
          continue;
        }

        const trimmed = line.trim();
        if (
          trimmed.length === 0 ||
          trimmed.startsWith("#") ||
          trimmed.startsWith("def ") ||
          trimmed.startsWith("async def ") ||
          trimmed.startsWith("class ") ||
          trimmed.startsWith("if ") ||
          trimmed.startsWith("for ") ||
          trimmed.startsWith("while ") ||
          trimmed.startsWith("with ") ||
          trimmed.startsWith("try:") ||
          trimmed.startsWith("match ") ||
          trimmed.startsWith("return ") ||
          trimmed.startsWith("yield ") ||
          trimmed.startsWith("import ") ||
          trimmed.startsWith("from ")
        ) {
          continue;
        }

        const match = statementPattern.exec(trimmed);
        if (!match) {
          continue;
        }

        const names = match[1];
        const annotation = match[2]?.trim() ?? "";
        const value = PyHelpers.stripInlineComment(match[3] ?? "");
        const sourcePos = PyHelpers.lineStartAt(context, lineIndex);
        const typePart = annotation.length > 0 ? annotation : "";

        entries.push(
          toEntry(
            "variables",
            [`${names}${typePart} = ${PyHelpers.summarizeValue(value)}`],
            sourcePos,
            context.filePath,
          ),
        );
      }

      return toResult(entries);
    },
  };
}

export function createCommentsExtractor(): Extractor<PyParseContext> {
  return {
    kind: "comments",
    extract(context: PyParseContext): SingleExtractResult {
      const entries: ExtractEntry[] = [];
      let blockQuote: string | null = null;

      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const line = context.lines[lineIndex] ?? "";
        let quote: string | null = blockQuote;
        let commentIndex = -1;

        for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
          const current = line[charIndex];
          const next3 = line.slice(charIndex, charIndex + 3);
          const previous = charIndex > 0 ? line[charIndex - 1] : "";

          if (quote && (quote === "'''" || quote === '"""')) {
            if (next3 === quote) {
              quote = null;
              charIndex += 2;
            }
            continue;
          }

          if (quote && (quote === "'" || quote === '"')) {
            if (current === quote && previous !== "\\") {
              quote = null;
            }
            continue;
          }

          if (next3 === "'''" || next3 === '"""') {
            quote = next3;
            charIndex += 2;
            continue;
          }

          if (current === "'" || current === '"') {
            quote = current;
            continue;
          }

          if (current === "#") {
            commentIndex = charIndex;
            break;
          }
        }

        blockQuote = quote === "'''" || quote === '"""' ? quote : null;

        if (commentIndex < 0) {
          continue;
        }

        entries.push(
          toEntry(
            "comments",
            [line.slice(commentIndex)],
            PyHelpers.lineStartAt(context, lineIndex) + commentIndex,
            context.filePath,
          ),
        );
      }

      return toResult(entries);
    },
  };
}

export function createImportsExtractor(): Extractor<PyParseContext> {
  return {
    kind: "imports",
    extract(context: PyParseContext): SingleExtractResult {
      const entries: ExtractEntry[] = [];

      for (let lineIndex = 0; lineIndex < context.lines.length; lineIndex += 1) {
        const line = context.lines[lineIndex];
        if (!line || PyHelpers.getIndent(line) !== 0) {
          continue;
        }

        const trimmed = line.trimStart();
        if (!trimmed.startsWith("import ") && !trimmed.startsWith("from ")) {
          continue;
        }

        const statement = PyHelpers.collectStatement(context, lineIndex);
        if (!statement) {
          continue;
        }

        entries.push(
          toEntry(
            "imports",
            [statement.text],
            statement.sourcePos,
            context.filePath,
          ),
        );

        lineIndex = statement.endLine;
      }

      return toResult(entries);
    },
  };
}
