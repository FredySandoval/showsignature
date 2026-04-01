// ============================================================================
// Extraction Pipeline                  [Step 4-6 — per-file processing]
// ============================================================================
import { readFile } from 'node:fs/promises';

import type {
  AggregatedExtractResult,
  ExtractFromSourceOptions,
  FileSection,
  PipelineResult,
  ProcessFileOptions,
  RunPipelineOptions,
} from './00-core-types';
import { toPipelineError } from './02-config-utils';
import { runExtractors } from './07-extractor';

function uniqueInOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
}

export function extractFromSource(
  options: ExtractFromSourceOptions,
): AggregatedExtractResult {
  const { registry, lang, filePath, source, extractOrder } = options;
  const adapter = registry.get(lang);

  if (!adapter) {
    throw new Error(`Language adapter not loaded for "${lang}"`);
  }

  const context = adapter.buildContext({ source, filePath });

  return runExtractors({
    adapter,
    context,
    extractOrder,
  });
}

export async function processFile(
  options: ProcessFileOptions,
): Promise<FileSection> {
  const { registry, filePath, explicitLang, extractOrder } = options;
  const source = await readFile(filePath, 'utf8');
  const lang = explicitLang ?? registry.inferFromFile(filePath);

  if (!lang) {
    throw new Error(`Could not infer language for file: ${filePath}`);
  }

  const adapter = await registry.getOrLoad(lang);
  if (!adapter) {
    throw new Error(`Language "${lang}" is not supported`);
  }

  const extracted = extractFromSource({
    registry,
    lang,
    filePath,
    source,
    extractOrder,
  });

  return {
    filePath,
    lang,
    entries: extracted.entries,
    warnings: extracted.warnings,
  };
}

export async function runPipeline(
  options: RunPipelineOptions,
): Promise<PipelineResult> {
  const sections: FileSection[] = [];
  const errors = [];

  for (const filePath of options.files) {
    try {
      sections.push(
        await processFile({
          registry: options.registry,
          filePath,
          explicitLang: options.explicitLang,
          extractOrder: options.extractOrder,
        }),
      );
    } catch (err) {
      errors.push(toPipelineError(err, filePath));
    }
  }

  const warnings = sections.flatMap((section) => section.warnings);
  const seenLangs = uniqueInOrder(sections.map((section) => section.lang));

  return {
    success: errors.length === 0,
    sections,
    diagnostics: {
      warnings,
      errors,
    },
    meta: {
      seenLangs,
    },
  };
}
