// ============================================================================
// Language Registry                    [Step 2b — registry setup]
// ============================================================================
import path from 'node:path';

import type {
  LanguageAdapter,
  LanguageAdapterMetadata,
  LanguageRegistry,
  LazyLanguageAdapterRegistration,
} from './00-core-types';
import { createTsFamilyAdapter } from './languages/typescript/00-adapter';

function normalizeExtension(extension: string): string {
  const lowered = extension.trim().toLowerCase();
  if (!lowered) {
    return lowered;
  }

  return lowered.startsWith('.') ? lowered : `.${lowered}`;
}

function adapterToMetadata(adapter: LanguageAdapter): LanguageAdapterMetadata {
  if (adapter.metadata) {
    return adapter.metadata;
  }

  return {
    id: adapter.id,
    extensions: adapter.extensions,
    fenceLang: adapter.fenceLang,
  };
}

export function createLanguageRegistry(): LanguageRegistry {
  const adapters = new Map<string, LanguageAdapter>();
  const lazyAdapters = new Map<string, LazyLanguageAdapterRegistration>();

  const api: LanguageRegistry = {
    register(adapter) {
      adapters.set(adapter.id, adapter);
      lazyAdapters.delete(adapter.id);
    },

    registerLazy(registration) {
      lazyAdapters.set(registration.id, registration);
      adapters.delete(registration.id);
    },

    unregister(langId) {
      const hadEager = adapters.delete(langId);
      const hadLazy = lazyAdapters.delete(langId);
      return hadEager || hadLazy;
    },

    has(langId) {
      return adapters.has(langId) || lazyAdapters.has(langId);
    },

    get(langId) {
      return adapters.get(langId);
    },

    async getOrLoad(langId) {
      const existing = adapters.get(langId);
      if (existing) {
        return existing;
      }

      const registration = lazyAdapters.get(langId);
      if (!registration) {
        return undefined;
      }

      const loaded = await registration.load();

      if (loaded.id !== registration.id) {
        throw new Error(
          `Lazy adapter id mismatch: expected "${registration.id}" but got "${loaded.id}"`,
        );
      }

      api.register(loaded);
      return loaded;
    },

    listAdapters() {
      return [...adapters.values()];
    },

    listAdapterMetadata() {
      const eagerMetadata = [...adapters.values()].map(adapterToMetadata);
      const lazyMetadata = [...lazyAdapters.values()]
        .filter((registration) => !adapters.has(registration.id))
        .map((registration) => ({
          id: registration.id,
          extensions: registration.extensions,
          fenceLang: registration.id,
        }));

      return [...eagerMetadata, ...lazyMetadata];
    },

    inferFromFile(filePath) {
      const ext = normalizeExtension(path.extname(filePath));
      if (!ext) {
        return undefined;
      }

      for (const adapter of adapters.values()) {
        if (adapter.extensions.some((candidate) => normalizeExtension(candidate) === ext)) {
          return adapter.id;
        }
      }

      for (const registration of lazyAdapters.values()) {
        if (
          registration.extensions.some(
            (candidate) => normalizeExtension(candidate) === ext,
          )
        ) {
          return registration.id;
        }
      }

      return undefined;
    },

    supportedExtensions() {
      const extensions = new Set<string>();

      for (const adapter of adapters.values()) {
        for (const extension of adapter.extensions) {
          extensions.add(normalizeExtension(extension));
        }
      }

      for (const registration of lazyAdapters.values()) {
        for (const extension of registration.extensions) {
          extensions.add(normalizeExtension(extension));
        }
      }

      return [...extensions].filter((ext) => ext.length > 0);
    },

    supportedLanguages() {
      const ids = new Set<string>();
      for (const id of adapters.keys()) {
        ids.add(id);
      }
      for (const id of lazyAdapters.keys()) {
        ids.add(id);
      }
      return [...ids];
    },
  };

  return api;
}

export function buildDefaultRegistry(): LanguageRegistry {
  const registry = createLanguageRegistry();

  registry.register(
    createTsFamilyAdapter({
      id: 'ts',
      extensions: ['.ts', '.tsx', '.mts', '.cts'],
      fenceLang: 'ts',
    }),
  );

  registry.register(
    createTsFamilyAdapter({
      id: 'js',
      extensions: ['.js', '.jsx', '.mjs', '.cjs'],
      fenceLang: 'js',
    }),
  );

  return registry;
}
