// ============================================================================
// File Discovery                       [Step 3 — resolve files]
// Uses fast-glob to discover files 
// ============================================================================
import path from 'node:path';

import fg from 'fast-glob';

import type { DiscoverFilesOptions, LanguageRegistry } from './00-core-types';

function normalizeExtension(extension: string): string {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function normalizePathForMatch(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase();
}

export function getSupportedGlobs(registry: LanguageRegistry): string[] {
  const extensions = registry.supportedExtensions();
  const globs = new Set<string>();

  for (const extension of extensions) {
    const normalized = normalizeExtension(extension);
    if (!normalized) {
      continue;
    }
    globs.add(`**/*${normalized}`);
  }

  return [...globs].sort();
}

export function isTestFile(filePath: string): boolean {
  const normalized = normalizePathForMatch(filePath);
  const segments = normalized.split('/');

  if (
    segments.some(
      (segment) =>
        segment === 'test' || segment === 'tests' || segment === '__tests__',
    )
  ) {
    return true;
  }

  const fileName = path.basename(normalized);

  return (
    /(?:\.|_|-)test\.[^/]+$/i.test(fileName) ||
    /(?:\.|_|-)spec\.[^/]+$/i.test(fileName)
  );
}

function inferDirectory(options: DiscoverFilesOptions): string {
  if ('folder' in options && typeof options.folder === 'string') {
    return path.resolve(options.folder);
  }

  return process.cwd();
}

export async function discoverFiles(options: DiscoverFilesOptions): Promise<string[]> {
  if ('file' in options && typeof options.file === 'string') {
    const resolved = path.resolve(options.file);
    return options.registry.inferFromFile(resolved) ? [resolved] : [];
  }

  const globs = getSupportedGlobs(options.registry);
  if (globs.length === 0) {
    return [];
  }

  const cwd = inferDirectory(options);
  const discovered = await fg(globs, {
    cwd,
    absolute: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
  });

  return (options.includeTests
    ? discovered
    : discovered.filter((filePath) => !isTestFile(filePath))
  ).sort();
}
