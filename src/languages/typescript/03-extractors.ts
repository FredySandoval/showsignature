import * as ts from "typescript";

import type {
  ExtractEntry,
  Extractor,
  SingleExtractResult,
  TsParseContext,
} from "../../00-core-types.js";
import { TsAstHelpers } from "./02-ast-helpers.js";

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
    extract(context: TsParseContext): SingleExtractResult {
      const entries: ExtractEntry[] = [];
      const { sourceFile, filePath } = context;

      for (const statement of sourceFile.statements) {
        if (ts.isClassDeclaration(statement)) {
          entries.push(
            toEntry(
              "signatures",
              renderClassSignature(statement, sourceFile),
              statement.getStart(sourceFile),
              filePath,
            ),
          );
          continue;
        }

        if (ts.isFunctionDeclaration(statement)) {
          entries.push(
            toEntry(
              "signatures",
              [renderFunctionSignature(statement, sourceFile)],
              statement.getStart(sourceFile),
              filePath,
            ),
          );
        }
      }
      return toResult(entries);
    },
  };
}

export function createInterfacesExtractor(): Extractor<TsParseContext> {
  return {
    kind: "interfaces",
    extract(context: TsParseContext): SingleExtractResult {
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
    extract(context: TsParseContext): SingleExtractResult {
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
  options: { compactMultilineInitializer?: boolean } = {},
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

  const initializerText = declaration.initializer.getText(sourceFile);
  const initializer =
    options.compactMultilineInitializer && /\r?\n/u.test(initializerText)
      ? "..."
      : TsAstHelpers.summarizeInitializer(declaration.initializer, sourceFile);
  return `${modifierPrefix}${keyword} ${name}${typePart} = ${initializer};`;
}

export function createVariablesExtractor(): Extractor<TsParseContext> {
  return {
    kind: "variables",
    extract(context: TsParseContext): SingleExtractResult {
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
    extract(context: TsParseContext): SingleExtractResult {
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
    extract(context: TsParseContext): SingleExtractResult {
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

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  return (
    ts
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
    false
  );
}

function isExportedTopLevelDeclaration(
  statement: ts.Statement,
): statement is
  | ts.ClassDeclaration
  | ts.EnumDeclaration
  | ts.FunctionDeclaration
  | ts.InterfaceDeclaration
  | ts.ModuleDeclaration
  | ts.TypeAliasDeclaration
  | ts.VariableStatement {
  if (!hasExportModifier(statement)) {
    return false;
  }

  return (
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isModuleDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isVariableStatement(statement)
  );
}

function isModuleExportsAccess(expression: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "exports" &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "module"
  );
}

function isCommonJsExportTarget(expression: ts.Expression): boolean {
  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }

  if (isModuleExportsAccess(expression)) {
    return true;
  }

  if (
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "exports"
  ) {
    return true;
  }

  return isModuleExportsAccess(expression.expression);
}

function isCommonJsExportAssignment(statement: ts.Statement): boolean {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isBinaryExpression(statement.expression) &&
    statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    isCommonJsExportTarget(statement.expression.left)
  );
}

function isExportStatement(statement: ts.Statement): boolean {
  return (
    ts.isExportDeclaration(statement) ||
    ts.isExportAssignment(statement) ||
    isExportedTopLevelDeclaration(statement) ||
    isCommonJsExportAssignment(statement)
  );
}

function renderModuleDeclaration(
  node: ts.ModuleDeclaration,
  sourceFile: ts.SourceFile,
): string {
  const modifiers = TsAstHelpers.getModifiers(node).join(" ");
  const modifierPrefix = modifiers.length > 0 ? `${modifiers} ` : "";
  const keyword =
    node.flags & ts.NodeFlags.Namespace ? "namespace" : "module";
  const name = node.name.getText(sourceFile);

  return `${modifierPrefix}${keyword} ${name} { ... }`;
}

function renderCompactExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
): string {
  if (ts.isCallExpression(expression)) {
    const callee = expression.expression.getText(sourceFile);
    const typeArguments = expression.typeArguments
      ? `<${expression.typeArguments
          .map((typeArgument) => typeArgument.getText(sourceFile))
          .join(", ")}>`
      : "";
    const args = expression.arguments
      .map((argument) => renderCompactExpression(argument, sourceFile))
      .join(", ");

    return `${callee}${typeArguments}(${args})`;
  }

  if (ts.isArrowFunction(expression)) {
    const typeParameters = expression.typeParameters
      ? TsAstHelpers.printTypeParams(expression.typeParameters, sourceFile)
      : "";
    const parameters = expression.parameters.length === 1
      ? expression.parameters[0]?.getText(sourceFile) ?? ""
      : `(${TsAstHelpers.printParams(expression.parameters, sourceFile)})`;
    const returnType = TsAstHelpers.printType(expression, sourceFile);
    const returnPart = returnType.length > 0 ? `: ${returnType}` : "";
    const body = ts.isBlock(expression.body)
      ? "{ ... }"
      : renderCompactExpression(expression.body, sourceFile);

    return `${typeParameters}${parameters}${returnPart} => ${body}`;
  }

  if (ts.isFunctionExpression(expression)) {
    const asyncPrefix = TsAstHelpers.hasAsyncModifier(expression) ? "async " : "";
    const name = expression.name ? ` ${expression.name.getText(sourceFile)}` : "";
    const typeParams = TsAstHelpers.printTypeParams(
      expression.typeParameters,
      sourceFile,
    );
    const params = TsAstHelpers.printParams(expression.parameters, sourceFile);
    const returnType = TsAstHelpers.printType(expression, sourceFile);
    const returnPart = returnType.length > 0 ? `: ${returnType}` : "";

    return `${asyncPrefix}function${name}${typeParams}(${params})${returnPart} { ... }`;
  }

  if (ts.isClassExpression(expression)) {
    const name = expression.name ? ` ${expression.name.getText(sourceFile)}` : "";
    return `class${name} { ... }`;
  }

  if (ts.isObjectLiteralExpression(expression)) {
    return /\r?\n/u.test(expression.getText(sourceFile))
      ? "{ ... }"
      : expression.getText(sourceFile);
  }

  if (ts.isArrayLiteralExpression(expression)) {
    return /\r?\n/u.test(expression.getText(sourceFile))
      ? "[...]"
      : expression.getText(sourceFile);
  }

  const text = expression.getText(sourceFile);
  return /\r?\n/u.test(text) ? "..." : text;
}

function renderExportStatementLines(
  statement: ts.Statement,
  sourceFile: ts.SourceFile,
): string[] {
  if (ts.isFunctionDeclaration(statement)) {
    return [renderFunctionSignature(statement, sourceFile)];
  }

  if (ts.isClassDeclaration(statement)) {
    return renderClassSignature(statement, sourceFile);
  }

  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) =>
      renderVariableDeclaration(statement, declaration, sourceFile, {
        compactMultilineInitializer: true,
      }),
    );
  }

  if (ts.isModuleDeclaration(statement)) {
    return [renderModuleDeclaration(statement, sourceFile)];
  }

  if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
    return [
      `export default ${renderCompactExpression(statement.expression, sourceFile)};`,
    ];
  }

  return statement.getText(sourceFile).split(/\r?\n/u);
}

export function createExportsExtractor(): Extractor<TsParseContext> {
  return {
    kind: "exports",
    extract(context: TsParseContext): SingleExtractResult {
      const entries = context.sourceFile.statements
        .filter(isExportStatement)
        .map((statement) =>
          toEntry(
            "exports",
            renderExportStatementLines(statement, context.sourceFile),
            statement.getStart(context.sourceFile),
            context.filePath,
          ),
        );

      return toResult(entries);
    },
  };
}
