import type {
  ExtractKind,
  Extractor,
  LanguageAdapter,
  TsParseContext,
} from "../../00-core-types.js";
import { createTsParseContext } from "./01-context.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "./03-extractors.js";

export interface CreateTsFamilyAdapterOptions {
  id: string;
  extensions: readonly string[];
  fenceLang: string;
}

function buildExtractors(): ReadonlyMap<
  ExtractKind,
  Extractor<TsParseContext>
> {
  const extractors: Extractor<TsParseContext>[] = [
    createSignaturesExtractor(),
    createInterfacesExtractor(),
    createTypesExtractor(),
    createVariablesExtractor(),
    createCommentsExtractor(),
    createImportsExtractor(),
    createExportsExtractor(),
  ];

  return new Map(extractors.map((extractor) => [extractor.kind, extractor]));
}

export function createTsFamilyAdapter(
  options: CreateTsFamilyAdapterOptions,
): LanguageAdapter<TsParseContext> {
  const extractors = buildExtractors();

  return {
    id: options.id,
    extensions: options.extensions,
    fenceLang: options.fenceLang,
    extractors,
    buildContext({
      source,
      filePath,
    }: {
      source: string;
      filePath: string;
    }): TsParseContext {
      return createTsParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
