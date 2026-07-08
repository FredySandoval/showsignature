import { describe, expect, test } from "bun:test";
import path from "node:path";

import type {
  ExtractKind,
  FileSection,
  LanguageAdapter,
  ParseContext,
  SingleExtractResult,
} from "@/src/00-core-types.js";
import { createLanguageRegistry } from "@/src/01-main.js";
import {
  detectFenceLanguage,
  formatFinalOutput,
  formatPlainOutput,
  redactSecrets,
  toDisplayPath,
  toMarkdownCodeBlock,
} from "@/src/01-main.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createNoopExtractor(kind: ExtractKind) {
  return {
    kind,
    extract(): SingleExtractResult {
      return { entries: [], warnings: [] };
    },
  };
}

function createMockAdapter(options: {
  id: string;
  extensions: readonly string[];
  fenceLang?: string;
}): LanguageAdapter<ParseContext> {
  return {
    id: options.id,
    extensions: options.extensions,
    fenceLang: options.fenceLang ?? options.id,
    extractors: new Map([["signatures", createNoopExtractor("signatures")]]),
    buildContext({ source, filePath }) {
      return { source, filePath };
    },
    supportsKind(kind) {
      return this.extractors.has(kind);
    },
  };
}

function makeSection(
  overrides: Partial<FileSection> & { filePath: string },
): FileSection {
  return {
    lang: "ts",
    entries: [],
    warnings: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// redactSecrets
// ---------------------------------------------------------------------------

describe("redactSecrets", () => {
  test("redacts common secret token patterns", () => {
    const fakeGithubToken = [
      "gho",
      "abcdefghijklmnopqrstuvwxyz1234567890",
    ].join("_");
    const fakeAwsKey = ["ASIA", "ABCDEFGHIJKLMNOP"].join("");
    const fakeSlackToken = ["xoxp", "123456789012", "abcdefghijklmnop"].join(
      "-",
    );
    const fakeJwtHeader = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const fakeJwt = [
      fakeJwtHeader,
      "eyJpc3MiOiJzaG93c2lnbmF0dXJlIn0",
      "signaturepart123456789",
    ].join(".");
    const value = [
      `github=${fakeGithubToken}`,
      `aws=${fakeAwsKey}`,
      `slack=${fakeSlackToken}`,
      `jwt=${fakeJwt}`,
    ].join("\n");

    const result = redactSecrets(value);

    expect(result).not.toContain(fakeGithubToken);
    expect(result).not.toContain(fakeAwsKey);
    expect(result).not.toContain(fakeSlackToken);
    expect(result).not.toContain(fakeJwtHeader);
    expect(result.match(/\[redacted\]/gu)?.length).toBe(4);
  });

  test("redacts Anthropic API keys regardless of variable name", () => {
    const fakeAnthropicKey = ["sk-ant", "api03", "abcdefghijklmnop123456"].join(
      "-",
    );

    const result = redactSecrets(`const key = "${fakeAnthropicKey}";`);

    expect(result).not.toContain(fakeAnthropicKey);
    expect(result).toContain("[redacted]");
  });

  test("redacts secret-like variable and .env assignments", () => {
    expect(redactSecrets("PASSWORD=hunter2")).toBe("PASSWORD=[redacted]");
    expect(redactSecrets('const api_key = "abc123";')).toBe(
      "const api_key = [redacted];",
    );
    expect(redactSecrets("auth: 'bearer-token'")).toBe("auth: [redacted]");
    expect(redactSecrets("AUTH_TOKEN=abc")).toBe("AUTH_TOKEN=[redacted]");
    expect(redactSecrets('authorization: "Bearer abc"')).toBe(
      "authorization: [redacted]",
    );
  });

  test("does not redact benign names that merely start with a keyword", () => {
    expect(redactSecrets('"author": "Fredy <x@y.dev>"')).toBe(
      '"author": "Fredy <x@y.dev>"',
    );
    expect(redactSecrets('tokenizer = "gpt"')).toBe('tokenizer = "gpt"');
  });
});

// ---------------------------------------------------------------------------
// toDisplayPath
// ---------------------------------------------------------------------------

describe("toDisplayPath", () => {
  test("returns a relative path unchanged", () => {
    expect(toDisplayPath("src/foo.ts")).toBe("src/foo.ts");
  });

  test("converts an absolute path relative to cwd", () => {
    const cwd = process.cwd();
    const absolute = `${cwd}/src/bar.ts`;
    expect(toDisplayPath(absolute)).toBe("src/bar.ts");
  });

  test("handles a plain filename", () => {
    expect(toDisplayPath("index.ts")).toBe("index.ts");
  });

  test("keeps an absolute path above the cwd absolute instead of ../ chains", () => {
    const outside = path.join(path.dirname(process.cwd()), "elsewhere", "baz.ts");
    expect(toDisplayPath(outside)).toBe(outside.split(path.sep).join("/"));
  });
});

// ---------------------------------------------------------------------------
// formatPlainOutput
// ---------------------------------------------------------------------------

describe("formatPlainOutput", () => {
  test("renders a single section with header and entries", () => {
    const section = makeSection({
      filePath: "src/app.ts",
      entries: [
        { kind: "signatures", lines: ["function greet(): void;"] },
        { kind: "comments", lines: ["// hello"] },
      ],
    });

    const result = formatPlainOutput([section]);

    expect(result).toBe(
      ["// src/app.ts", "function greet(): void;", "// hello"].join("\n"),
    );
  });

  test("renders multiple sections separated by blank lines", () => {
    const sectionA = makeSection({
      filePath: "a.ts",
      entries: [{ kind: "signatures", lines: ["function a(): void;"] }],
    });
    const sectionB = makeSection({
      filePath: "b.ts",
      entries: [{ kind: "signatures", lines: ["function b(): void;"] }],
    });

    const result = formatPlainOutput([sectionA, sectionB]);

    expect(result).toBe(
      [
        "// a.ts",
        "function a(): void;",
        "",
        "// b.ts",
        "function b(): void;",
      ].join("\n"),
    );
  });

  test("skips sections with no entries", () => {
    const empty = makeSection({ filePath: "empty.ts", entries: [] });
    const filled = makeSection({
      filePath: "filled.ts",
      entries: [{ kind: "imports", lines: ['import fs from "node:fs";'] }],
    });

    const result = formatPlainOutput([empty, filled]);

    expect(result).toBe(
      ["// filled.ts", 'import fs from "node:fs";'].join("\n"),
    );
  });

  test("redacts secret-like entry lines by default", () => {
    const fakeGithubToken = [
      "ghp",
      "abcdefghijklmnopqrstuvwxyz1234567890",
    ].join("_");
    const fakeJwtHeader = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const fakeJwt = [
      fakeJwtHeader,
      "eyJzdWIiOiIxMjM0NTY3ODkwIn0",
      "abcdefghijklmnopqrstuvwxyz",
    ].join(".");
    const fakeAwsKey = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
    const fakeSlackToken = ["xoxb", "123456789012", "abcdefghijklmnop"].join(
      "-",
    );
    const privateKeyHeader = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
    const section = makeSection({
      filePath: "src/secrets.ts",
      entries: [
        {
          kind: "comments",
          lines: [
            `// token = ${fakeGithubToken}`,
            `const jwt = '${fakeJwt}';`,
            `AWS_ACCESS_KEY_ID=${fakeAwsKey}`,
            `SLACK_TOKEN=${fakeSlackToken}`,
            `private_key: "${privateKeyHeader}"`,
          ],
        },
      ],
    });

    const result = formatPlainOutput([section]);

    expect(result).toContain("[redacted]");
    expect(result).not.toContain(fakeGithubToken);
    expect(result).not.toContain(fakeJwtHeader);
    expect(result).not.toContain(fakeAwsKey);
    expect(result).not.toContain(fakeSlackToken);
    expect(result).not.toContain(privateKeyHeader);
  });

  test("can disable entry redaction", () => {
    const fakeApiKey = ["sk", "test", "secret"].join("-");
    const section = makeSection({
      filePath: "src/secrets.ts",
      entries: [
        {
          kind: "variables",
          lines: [`const api_key = "${fakeApiKey}";`],
        },
      ],
    });

    const result = formatPlainOutput([section], { redact: false });

    expect(result).toContain(fakeApiKey);
  });

  test("returns empty string when all sections are empty", () => {
    expect(formatPlainOutput([])).toBe("");
    expect(
      formatPlainOutput([makeSection({ filePath: "x.ts", entries: [] })]),
    ).toBe("");
  });

  test("preserves multi-line entry content", () => {
    const section = makeSection({
      filePath: "multi.ts",
      entries: [
        {
          kind: "comments",
          lines: ["/*", "  multi-line comment", "*/"],
        },
      ],
    });

    const result = formatPlainOutput([section]);

    expect(result).toBe(
      ["// multi.ts", "/*\n  multi-line comment\n*/"].join("\n"),
    );
  });

  test("preserves embedded newlines inside extractor lines", () => {
    const section = makeSection({
      filePath: "src/adapter.ts",
      entries: [
        {
          kind: "imports",
          lines: [
            [
              "import type {",
              "  ExtractKind,",
              "  Extractor,",
              '} from "../../00-core-types.js";',
            ].join("\n"),
          ],
          metadata: { sourceLine: 1 },
        },
      ],
    });

    const result = formatPlainOutput([section], { includeLineNumbers: true });

    expect(result).toBe(
      [
        "// src/adapter.ts",
        "1 import type {",
        "    ExtractKind,",
        "    Extractor,",
        '  } from "../../00-core-types.js";',
      ].join("\n"),
    );
  });

  test("optionally prefixes entries with source line numbers", () => {
    const section = makeSection({
      filePath: "src/app.ts",
      entries: [
        {
          kind: "signatures",
          lines: ["function greet(): void;"],
          metadata: { sourceLine: 12 },
        },
      ],
    });

    const result = formatPlainOutput([section], { includeLineNumbers: true });

    expect(result).toBe(
      ["// src/app.ts", "12 function greet(): void;"].join("\n"),
    );
  });

  test("indents multi-line entries when line numbers are enabled", () => {
    const section = makeSection({
      filePath: "src/app.ts",
      entries: [
        {
          kind: "signatures",
          lines: ["class Command {", "  constructor();", "}"],
          metadata: { sourceLine: 15 },
        },
      ],
    });

    const result = formatPlainOutput([section], { includeLineNumbers: true });

    expect(result).toBe(
      [
        "// src/app.ts",
        "15 class Command {",
        "     constructor();",
        "   }",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// detectFenceLanguage
// ---------------------------------------------------------------------------

describe("detectFenceLanguage", () => {
  test("returns adapter fenceLang when explicitLang matches a registered adapter", () => {
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        fenceLang: "typescript",
      }),
    );

    const result = detectFenceLanguage({
      registry,
      explicitLang: "ts",
      seenLangs: [],
    });

    expect(result).toBe("typescript");
  });

  test("returns raw explicitLang when no adapter matches", () => {
    const registry = createLanguageRegistry();

    const result = detectFenceLanguage({
      registry,
      explicitLang: "ruby",
      seenLangs: [],
    });

    expect(result).toBe("ruby");
  });

  test("returns fenceLang of the single seen language", () => {
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        fenceLang: "typescript",
      }),
    );

    const result = detectFenceLanguage({
      registry,
      seenLangs: ["ts"],
    });

    expect(result).toBe("typescript");
  });

  test("returns raw seenLang when adapter is not registered", () => {
    const registry = createLanguageRegistry();

    const result = detectFenceLanguage({
      registry,
      seenLangs: ["go"],
    });

    expect(result).toBe("go");
  });

  test("returns undefined when multiple languages were seen", () => {
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        fenceLang: "typescript",
      }),
    );
    registry.register(
      createMockAdapter({ id: "py", extensions: [".py"], fenceLang: "python" }),
    );

    const result = detectFenceLanguage({
      registry,
      seenLangs: ["ts", "py"],
    });

    expect(result).toBeUndefined();
  });

  test("returns undefined when no seenLangs and no explicitLang", () => {
    const registry = createLanguageRegistry();

    const result = detectFenceLanguage({
      registry,
      seenLangs: [],
    });

    expect(result).toBeUndefined();
  });

  test("explicitLang takes precedence over seenLangs", () => {
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        fenceLang: "typescript",
      }),
    );
    registry.register(
      createMockAdapter({ id: "py", extensions: [".py"], fenceLang: "python" }),
    );

    const result = detectFenceLanguage({
      registry,
      explicitLang: "py",
      seenLangs: ["ts"],
    });

    expect(result).toBe("python");
  });
});

// ---------------------------------------------------------------------------
// toMarkdownCodeBlock
// ---------------------------------------------------------------------------

describe("toMarkdownCodeBlock", () => {
  test("wraps content with a language-tagged fence", () => {
    const result = toMarkdownCodeBlock("function greet(): void;", "typescript");

    expect(result).toBe(
      ["```typescript", "function greet(): void;", "```"].join("\n"),
    );
  });

  test("wraps content without a language tag when fenceLanguage is undefined", () => {
    const result = toMarkdownCodeBlock("hello\nworld", undefined);

    expect(result).toBe(["```", "hello", "world", "```"].join("\n"));
  });

  test("does not double-add trailing newline when content already ends with newline", () => {
    const result = toMarkdownCodeBlock("line1\nline2\n", "ts");

    expect(result).toBe(["```ts", "line1", "line2", "```"].join("\n"));
  });

  test("handles empty content", () => {
    const result = toMarkdownCodeBlock("", "ts");

    expect(result).toBe(["```ts", "", "```"].join("\n"));
  });
});

// ---------------------------------------------------------------------------
// formatFinalOutput
// ---------------------------------------------------------------------------

describe("formatFinalOutput", () => {
  test("returns plain output when no outputPath is specified", () => {
    const registry = createLanguageRegistry();
    registry.register(
      createMockAdapter({
        id: "ts",
        extensions: [".ts"],
        fenceLang: "typescript",
      }),
    );

    const section = makeSection({
      filePath: "src/index.ts",
      entries: [{ kind: "signatures", lines: ["function main(): void;"] }],
    });

    const result = formatFinalOutput({
      registry,
      sections: [section],
      seenLangs: ["ts"],
    });

    expect(result).toBe(
      ["// src/index.ts", "function main(): void;"].join("\n"),
    );
  });

  test("returns empty string when all sections have no entries and no outputPath", () => {
    const registry = createLanguageRegistry();

    const result = formatFinalOutput({
      registry,
      sections: [],
      seenLangs: [],
    });

    expect(result).toBe("");
  });
});
