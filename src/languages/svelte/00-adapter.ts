import type {
  ExtractKind,
  Extractor,
  LanguageAdapter,
  TsParseContext,
} from "../../00-core-types.js";
import { createSvelteParseContext } from "./01-context.js";
import {
  createCommentsExtractor,
  createExportsExtractor,
  createImportsExtractor,
  createInterfacesExtractor,
  createSignaturesExtractor,
  createTypesExtractor,
  createVariablesExtractor,
} from "../typescript/03-extractors.js";

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

export function createSvelteAdapter(): LanguageAdapter<TsParseContext> {
  const extractors = buildExtractors();

  return {
    id: "svelte",
    extensions: [".svelte"],
    fenceLang: "svelte",
    extractors,
    buildContext({
      source,
      filePath,
    }: {
      source: string;
      filePath: string;
    }): TsParseContext {
      return createSvelteParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
