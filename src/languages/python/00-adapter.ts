import type {
  ExtractKind,
  Extractor,
  LanguageAdapter,
  PyParseContext,
} from "../../00-core-types.js";
import { createPyParseContext } from "./01-context.js";
import {
  createCommentsExtractor,
  createImportsExtractor,
  createSignaturesExtractor,
  createVariablesExtractor,
} from "./03-extractors.js";

export interface CreatePythonAdapterOptions {
  id: string;
  extensions: readonly string[];
  fenceLang: string;
}

function buildExtractors(): ReadonlyMap<
  ExtractKind,
  Extractor<PyParseContext>
> {
  const extractors: Extractor<PyParseContext>[] = [
    createSignaturesExtractor(),
    createVariablesExtractor(),
    createCommentsExtractor(),
    createImportsExtractor(),
  ];

  return new Map(extractors.map((extractor) => [extractor.kind, extractor]));
}

export function createPythonAdapter(
  options: CreatePythonAdapterOptions,
): LanguageAdapter<PyParseContext> {
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
    }): PyParseContext {
      return createPyParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
