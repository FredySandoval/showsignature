import type {
  ExtractKind,
  Extractor,
  LanguageAdapter,
  ParseContext,
} from "../../00-core-types.js";
import { createMarkdownParseContext } from "./01-context.js";
import { createSignaturesExtractor } from "./03-extractors.js";

export interface CreateMarkdownAdapterOptions {
  id: string;
  extensions: readonly string[];
  fenceLang: string;
}

function buildExtractors(): ReadonlyMap<ExtractKind, Extractor<ParseContext>> {
  const extractors: Extractor<ParseContext>[] = [createSignaturesExtractor()];
  return new Map(extractors.map((extractor) => [extractor.kind, extractor]));
}

export function createMarkdownAdapter(
  options: CreateMarkdownAdapterOptions,
): LanguageAdapter<ParseContext> {
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
    }): ParseContext {
      return createMarkdownParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
