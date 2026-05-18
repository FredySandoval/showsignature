import type {
  ExtractKind,
  Extractor,
  GoParseContext,
  LanguageAdapter,
} from "../../00-core-types.js";
import { createGoParseContext } from "./01-context.js";
import {
  createCommentsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "./03-extractors.js";

export interface CreateGoAdapterOptions {
  id: string;
  extensions: readonly string[];
  fenceLang: string;
}

function buildExtractors(): ReadonlyMap<
  ExtractKind,
  Extractor<GoParseContext>
> {
  const extractors: Extractor<GoParseContext>[] = [
    createSignaturesExtractor(),
    createInterfacesExtractor(),
    createTypesExtractor(),
    createVariablesExtractor(),
    createCommentsExtractor(),
    createImportsExtractor(),
  ];

  return new Map(extractors.map((extractor) => [extractor.kind, extractor]));
}

export function createGoAdapter(
  options: CreateGoAdapterOptions,
): LanguageAdapter<GoParseContext> {
  const extractors = buildExtractors();

  return {
    id: options.id,
    extensions: options.extensions,
    fenceLang: options.fenceLang,
    extractors,
    buildContext({ source, filePath }): GoParseContext {
      return createGoParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
