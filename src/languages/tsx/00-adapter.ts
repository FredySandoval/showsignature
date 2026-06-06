import type {
  ExtractKind,
  Extractor,
  LanguageAdapter,
  TsParseContext,
} from "../../00-core-types.js";
import { createTsParseContext } from "../typescript/01-context.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "../typescript/03-extractors.js";
import { createCssHiddenExtractor, createHtmlExtractor } from "./03-extractors.js";

function buildExtractors(): ReadonlyMap<ExtractKind, Extractor<TsParseContext>> {
  const extractors: Extractor<TsParseContext>[] = [
    createSignaturesExtractor(),
    createInterfacesExtractor(),
    createTypesExtractor(),
    createVariablesExtractor(),
    createCommentsExtractor(),
    createImportsExtractor(),
    createExportsExtractor(),
    createHtmlExtractor(),
    createCssHiddenExtractor(),
  ];

  return new Map(extractors.map((extractor) => [extractor.kind, extractor]));
}

export function createTsxAdapter(): LanguageAdapter<TsParseContext> {
  const extractors = buildExtractors();

  return {
    id: "tsx",
    extensions: [".tsx", ".jsx"],
    fenceLang: "tsx",
    extractors,
    buildContext({ source, filePath }: { source: string; filePath: string }): TsParseContext {
      return createTsParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
