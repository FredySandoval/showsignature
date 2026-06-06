import type {
  ExtractKind,
  Extractor,
  LanguageAdapter,
  RustParseContext,
} from "../../00-core-types.js";
import { createRustParseContext } from "./01-context.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "./03-extractors.js";

export interface CreateRustAdapterOptions {
  id: string;
  extensions: readonly string[];
  fenceLang: string;
}

function buildExtractors(): ReadonlyMap<ExtractKind, Extractor<RustParseContext>> {
  const extractors: Extractor<RustParseContext>[] = [
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

export function createRustAdapter(options: CreateRustAdapterOptions): LanguageAdapter<RustParseContext> {
  const extractors = buildExtractors();
  return {
    id: options.id,
    extensions: options.extensions,
    fenceLang: options.fenceLang,
    extractors,
    buildContext({ source, filePath }): RustParseContext {
      return createRustParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
