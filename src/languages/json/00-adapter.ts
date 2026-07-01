import type {
  ExtractKind,
  Extractor,
  JsonParseContext,
  LanguageAdapter,
} from "../../00-core-types.js";
import { createJsonParseContext } from "./01-context.js";
import { createShapeExtractor } from "./03-extractors.js";

export interface CreateJsonAdapterOptions {
  id: string;
  extensions: readonly string[];
  fenceLang: string;
}

function buildExtractors(): ReadonlyMap<
  ExtractKind,
  Extractor<JsonParseContext>
> {
  const extractors: Extractor<JsonParseContext>[] = [createShapeExtractor()];

  return new Map(extractors.map((extractor) => [extractor.kind, extractor]));
}

export function createJsonAdapter(
  options: CreateJsonAdapterOptions,
): LanguageAdapter<JsonParseContext> {
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
    }): JsonParseContext {
      return createJsonParseContext({ source, filePath });
    },
    supportsKind(kind: ExtractKind): boolean {
      return extractors.has(kind);
    },
  };
}
