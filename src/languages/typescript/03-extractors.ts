import * as ts from "typescript";

import type {
  ExtractEntry,
  Extractor,
  SingleExtractResult,
  TsParseContext,
} from "../../00-core-types";
import { TsAstHelpers } from "./02-ast-helpers";

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

function renderFunctionSignature(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
): string {
  const modifiers = TsAstHelpers.getModifiers(node).join(" ");
  const modifierPrefix = modifiers.length > 0 ? `${modifiers} ` : "";
  const asyncPrefix =
    TsAstHelpers.hasAsyncModifier(node) && !modifiers.includes("async")
      ? "async "
      : "";
  const generator = node.asteriskToken ? "*" : "";
  const name = node.name ? node.name.getText(sourceFile) : "";
  const typeParams = TsAstHelpers.printTypeParams(
    node.typeParameters,
    sourceFile,
  );
  const params = TsAstHelpers.printParams(node.parameters, sourceFile);
  const returnType = TsAstHelpers.printType(node, sourceFile);
  const returnPart = returnType.length > 0 ? `: ${returnType}` : "";

  return `${modifierPrefix}${asyncPrefix}function ${generator}${name}${typeParams}(${params})${returnPart};`;
}

function renderConstructorSignature(
  node: ts.ConstructorDeclaration,
  sourceFile: ts.SourceFile,
): string {
  const params = TsAstHelpers.printParams(node.parameters, sourceFile);
  return `constructor(${params});`;
}

function renderMethodSignature(
  node: ts.MethodDeclaration,
  sourceFile: ts.SourceFile,
): string {
  const modifiers = TsAstHelpers.getModifiers(node).join(" ");
  const modifierPrefix = modifiers.length > 0 ? `${modifiers} ` : "";
  const asyncPrefix =
    TsAstHelpers.hasAsyncModifier(node) && !modifiers.includes("async")
      ? "async "
      : "";
  const generator = node.asteriskToken ? "*" : "";
  const name = node.name.getText(sourceFile);
  const optional = node.questionToken ? "?" : "";
  const typeParams = TsAstHelpers.printTypeParams(
    node.typeParameters,
    sourceFile,
  );
  const params = TsAstHelpers.printParams(node.parameters, sourceFile);
  const returnType = TsAstHelpers.printType(node, sourceFile);
  const returnPart = returnType.length > 0 ? `: ${returnType}` : "";

  return `${modifierPrefix}${asyncPrefix}${generator}${name}${optional}${typeParams}(${params})${returnPart};`;
}

function renderClassSignature(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
): string[] {
  const modifiers = TsAstHelpers.getModifiers(node).join(" ");
  const modifierPrefix = modifiers.length > 0 ? `${modifiers} ` : "";
  const name = node.name ? node.name.getText(sourceFile) : "";
  const typeParams = TsAstHelpers.printTypeParams(
    node.typeParameters,
    sourceFile,
  );

  const heritage = node.heritageClauses
    ?.map((clause) => {
      const keyword =
        clause.token === ts.SyntaxKind.ExtendsKeyword
          ? "extends"
          : "implements";
      const types = clause.types
        .map((heritageType) => heritageType.getText(sourceFile))
        .join(", ");
      return `${keyword} ${types}`;
    })
    .join(" ");
  const heritagePart = heritage && heritage.length > 0 ? ` ${heritage}` : "";

  const classHeader = `${modifierPrefix}class ${name}${typeParams}${heritagePart} {`;
  const memberLines = node.members.flatMap((member) => {
    if (ts.isConstructorDeclaration(member)) {
      return [`  ${renderConstructorSignature(member, sourceFile)}`];
    }

    if (ts.isMethodDeclaration(member)) {
      return [`  ${renderMethodSignature(member, sourceFile)}`];
    }

    return [];
  });

  return [classHeader, ...memberLines, "}"];
}

export function createSignaturesExtractor(): Extractor<TsParseContext> {
  return {
    kind: "signatures",
    extract(context): SingleExtractResult {
      const entries: ExtractEntry[] = [];
      const { sourceFile, filePath } = context;

      function visit(node: ts.Node): void {
        if (ts.isClassDeclaration(node)) {
          entries.push(
            toEntry(
              "signatures",
              renderClassSignature(node, sourceFile),
              node.getStart(sourceFile),
              filePath,
            ),
          );
          return;
        }

        if (ts.isFunctionDeclaration(node)) {
          entries.push(
            toEntry(
              "signatures",
              [renderFunctionSignature(node, sourceFile)],
              node.getStart(sourceFile),
              filePath,
            ),
          );
          return;
        }

        ts.forEachChild(node, visit);
      }

      ts.forEachChild(sourceFile, visit);
      return toResult(entries);
    },
  };
}

export function createInterfacesExtractor(): Extractor<TsParseContext> {
  return {
    kind: "interfaces",
    extract(context): SingleExtractResult {
      const entries = context.sourceFile.statements
        .filter(ts.isInterfaceDeclaration)
        .map((declaration) =>
          toEntry(
            "interfaces",
            declaration.getText(context.sourceFile).split(/\r?\n/u),
            declaration.getStart(context.sourceFile),
            context.filePath,
          ),
        );

      return toResult(entries);
    },
  };
}

export function createTypesExtractor(): Extractor<TsParseContext> {
  return {
    kind: "types",
    extract(context): SingleExtractResult {
      const entries = context.sourceFile.statements
        .filter(ts.isTypeAliasDeclaration)
        .map((declaration) =>
          toEntry(
            "types",
            declaration.getText(context.sourceFile).split(/\r?\n/u),
            declaration.getStart(context.sourceFile),
            context.filePath,
          ),
        );

      return toResult(entries);
    },
  };
}

function renderVariableDeclaration(
  statement: ts.VariableStatement,
  declaration: ts.VariableDeclaration,
  sourceFile: ts.SourceFile,
): string {
  const modifiers = TsAstHelpers.getModifiers(statement).join(" ");
  const modifierPrefix = modifiers.length > 0 ? `${modifiers} ` : "";
  const keyword = TsAstHelpers.getDeclarationKeyword(statement.declarationList);
  const name = declaration.name.getText(sourceFile);
  const type = TsAstHelpers.printType(declaration, sourceFile);
  const typePart = type.length > 0 ? `: ${type}` : "";

  if (!declaration.initializer) {
    return `${modifierPrefix}${keyword} ${name}${typePart};`;
  }

  const initializer = TsAstHelpers.summarizeInitializer(
    declaration.initializer,
    sourceFile,
  );
  return `${modifierPrefix}${keyword} ${name}${typePart} = ${initializer};`;
}

export function createVariablesExtractor(): Extractor<TsParseContext> {
  return {
    kind: "variables",
    extract(context): SingleExtractResult {
      const entries: ExtractEntry[] = [];

      for (const statement of context.sourceFile.statements) {
        if (!ts.isVariableStatement(statement)) {
          continue;
        }

        for (const declaration of statement.declarationList.declarations) {
          entries.push(
            toEntry(
              "variables",
              [
                renderVariableDeclaration(
                  statement,
                  declaration,
                  context.sourceFile,
                ),
              ],
              declaration.getStart(context.sourceFile),
              context.filePath,
            ),
          );
        }
      }

      return toResult(entries);
    },
  };
}

export function createCommentsExtractor(): Extractor<TsParseContext> {
  return {
    kind: "comments",
    extract(context): SingleExtractResult {
      const ranges = TsAstHelpers.buildCommentExclusionRanges(
        context.sourceFile,
      );
      const maskedSource = TsAstHelpers.maskExcludedRanges(
        context.source,
        ranges,
      );
      const commentPattern = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gu;
      const entries: ExtractEntry[] = [];

      for (const match of maskedSource.matchAll(commentPattern)) {
        const comment = match[0];
        const start = match.index ?? 0;
        const end = start + comment.length;

        if (TsAstHelpers.isRangeExcluded(start, end, ranges)) {
          continue;
        }

        entries.push(
          toEntry(
            "comments",
            context.source.slice(start, end).split(/\r?\n/u),
            start,
            context.filePath,
          ),
        );
      }

      return toResult(entries);
    },
  };
}

export function createImportsExtractor(): Extractor<TsParseContext> {
  return {
    kind: "imports",
    extract(context): SingleExtractResult {
      const entries = context.sourceFile.statements
        .filter(ts.isImportDeclaration)
        .map((declaration) =>
          toEntry(
            "imports",
            [declaration.getText(context.sourceFile)],
            declaration.getStart(context.sourceFile),
            context.filePath,
          ),
        );

      return toResult(entries);
    },
  };
}
