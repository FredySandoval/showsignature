import type {
  ExtractKind,
  Extractor,
  LanguageAdapter,
  LuaParseContext,
} from "../../00-core-types.js";
import { createLuaParseContext } from "./01-context.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "./03-extractors.js";

export interface CreateLuaAdapterOptions {
  id: string;
  extensions: readonly string[];
  fenceLang: string;
}

function buildExtractors(): ReadonlyMap<ExtractKind, Extractor<LuaParseContext>> {
  const extractors: Extractor<LuaParseContext>[] = [
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

export function createLuaAdapter(
  options: CreateLuaAdapterOptions,
): LanguageAdapter<LuaParseContext> {
  const extractors = buildExtractors();
  return {
    id: options.id,
    extensions: options.extensions,
    fenceLang: options.fenceLang,
    extractors,
    buildContext({ source, filePath }): LuaParseContext {
      return createLuaParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
