// ============================================================================
// Symbol Summary                       [map --symbol-summary]
// Keyword-discovery mode: emits the identifier vocabulary that literally
// exists in the code, one line per (extractor, file) pair, tokens separated
// by single spaces (paths containing spaces are double-quoted):
//
//   exports:src/db/pool.ts PgPool createPool POOL_MAX acquireConn
//
// Output contract: every token is a valid ripgrep pattern in default
// (regex) mode and exists verbatim in the source file (modulo escaping).
// ============================================================================
import type { ExtractKind, FileSection } from "./00-core-types.js";

// Only extractors whose output is symbols — names that verifiably exist in
// code or config — may contribute. Prose extractors (comments, Markdown) can
// reference names that no longer exist and would need natural-language
// stopword handling.
const SYMBOL_SUMMARY_EXCLUDED_KINDS = new Set<string>([
  "comments",
  "md:headings",
  "md:tables",
  "md:codeblocks",
]);

export function isSymbolSummaryKind(kind: ExtractKind): boolean {
  return !SYMBOL_SUMMARY_EXCLUDED_KINDS.has(kind);
}

export function listExcludedSymbolSummaryKinds(
  kinds: readonly ExtractKind[],
): ExtractKind[] {
  return kinds.filter((kind) => !isSymbolSummaryKind(kind));
}

// Stopwords are purely syntactic: language keywords, primitive/builtin type
// names, and structural noise. If it's a name someone chose, keep it; if
// it's syntax, drop it. Never filter semantically.
const TS_FAMILY_STOPWORDS = [
  // keywords
  "abstract", "any", "as", "async", "await", "break", "case", "catch",
  "class", "const", "constructor", "continue", "debugger", "declare",
  "default", "delete", "do", "else", "enum", "export", "extends", "finally",
  "for", "from", "function", "get", "if", "implements", "import", "in",
  "infer", "instanceof", "interface", "is", "keyof", "let", "namespace",
  "new", "of", "override", "private", "protected", "public", "readonly",
  "return", "satisfies", "set", "static", "super", "switch", "this", "throw",
  "try", "type", "typeof", "var", "while", "with", "yield",
  // primitive/builtin types and literals
  "bigint", "boolean", "false", "never", "null", "number", "object",
  "string", "symbol", "true", "undefined", "unknown", "void",
  // builtin globals and TS utility types ("self" is the global scope in
  // browsers/workers, same structural noise as "this")
  "self",
  "Array", "Awaited", "Boolean", "Date", "Error", "Map", "Number", "Object",
  "Omit", "Partial", "Pick", "Promise", "Readonly", "ReadonlyArray",
  "ReadonlyMap", "ReadonlySet", "Record", "RegExp", "Required", "Set",
  "String", "Symbol",
];

const PYTHON_STOPWORDS = [
  // keywords
  "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
  "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass",
  "raise", "return", "try", "while", "with", "yield",
  // builtins/literals and structural noise
  "bool", "bytes", "cls", "dict", "float", "int", "list", "self", "set",
  "str", "tuple", "False", "None", "True",
];

const GO_STOPWORDS = [
  // keywords
  "break", "case", "chan", "const", "continue", "default", "defer", "else",
  "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
  "map", "package", "range", "return", "select", "struct", "switch", "type",
  "var",
  // predeclared identifiers
  "any", "bool", "byte", "complex64", "complex128", "error", "false",
  "float32", "float64", "int", "int8", "int16", "int32", "int64", "iota",
  "nil", "rune", "string", "true", "uint", "uint8", "uint16", "uint32",
  "uint64", "uintptr",
];

const RUST_STOPWORDS = [
  // keywords
  "as", "async", "await", "break", "const", "continue", "crate", "dyn",
  "else", "enum", "extern", "fn", "for", "if", "impl", "in", "let", "loop",
  "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self",
  "static", "struct", "super", "trait", "type", "unsafe", "use", "where",
  "while",
  // primitive types and literals
  "bool", "char", "f32", "f64", "false", "i8", "i16", "i32", "i64", "i128",
  "isize", "str", "true", "u8", "u16", "u32", "u64", "u128", "usize",
];

const LUA_STOPWORDS = [
  // keywords
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return",
  "self", "then", "true", "until", "while",
];

// json:shape prints keys plus type names; only the type names are syntax.
// "..." is shapeOf()'s truncation marker (keys past the cap, depth cap) —
// it never exists in the source file, so it must not become a token. The
// renderer discloses the truncation in the trailing note.
const JSON_STOPWORDS = [
  "array", "boolean", "false", "null", "number", "object", "string", "true",
  "...",
];

const STOPWORDS_BY_LANGUAGE: ReadonlyMap<string, ReadonlySet<string>> =
  new Map([
    ["ts", new Set(TS_FAMILY_STOPWORDS)],
    ["js", new Set(TS_FAMILY_STOPWORDS)],
    ["tsx", new Set(TS_FAMILY_STOPWORDS)],
    ["svelte", new Set(TS_FAMILY_STOPWORDS)],
    ["py", new Set(PYTHON_STOPWORDS)],
    ["go", new Set(GO_STOPWORDS)],
    ["rs", new Set(RUST_STOPWORDS)],
    ["lua", new Set(LUA_STOPWORDS)],
    ["json", new Set(JSON_STOPWORDS)],
  ]);

const IDENTIFIER_PATTERN = /[$_\p{L}][$_\p{L}\p{N}]*/gu;
// json:shape lines are `{ key: type, key: [type] }` and keys may contain
// non-identifier characters (`pool.max`, `a|b`). Keep keys whole: a token is
// any run of characters that isn't whitespace or shape syntax.
const JSON_TOKEN_PATTERN = /[^\s{}[\],:]+/gu;
const REGEX_METACHARS_PATTERN = /[\\^$.*+?()[\]{}|]/gu;

// imports/exports lines carry a quoted module specifier. It is emitted as
// one whole token, never path fragments: fragments (`core`, `types`, `js`)
// are useless grep targets, and digit-leading segments (`00`) would vanish
// under IDENTIFIER_PATTERN entirely. Relative specifiers are reduced to
// their basename — the `./`/`../` prefix varies per importing file and
// would break cross-file correlation; package/module names stay verbatim.
const QUOTED_SPECIFIER_PATTERN = /"([^"\n]+)"|'([^'\n]+)'/gu;

function specifierToken(specifier: string): string | undefined {
  const value = specifier.startsWith(".")
    ? specifier.slice(specifier.lastIndexOf("/") + 1)
    : specifier;
  return value.length > 0 ? value : undefined;
}

export function escapeSymbolToken(token: string): string {
  return token.replace(REGEX_METACHARS_PATTERN, "\\$&");
}

function collectLineTokens(
  lines: readonly string[],
  stopwords: ReadonlySet<string>,
  seen: Set<string>,
  tokenPattern: RegExp = IDENTIFIER_PATTERN,
  wholeSpecifiers = false,
): string[] {
  const tokens: string[] = [];

  const pushToken = (token: string): void => {
    if (stopwords.has(token) || seen.has(token)) {
      return;
    }
    seen.add(token);
    tokens.push(escapeSymbolToken(token));
  };

  for (const line of lines) {
    if (!wholeSpecifiers) {
      for (const match of line.matchAll(tokenPattern)) {
        pushToken(match[0]);
      }
      continue;
    }

    // Walk quoted specifiers and plain segments in source order so the
    // first-occurrence ordering rule holds across both token kinds.
    let cursor = 0;
    const emitPlain = (segment: string): void => {
      for (const match of segment.matchAll(tokenPattern)) {
        pushToken(match[0]);
      }
    };
    for (const match of line.matchAll(QUOTED_SPECIFIER_PATTERN)) {
      emitPlain(line.slice(cursor, match.index));
      cursor = match.index + match[0].length;
      const token = specifierToken(match[1] ?? match[2] ?? "");
      if (token !== undefined) {
        pushToken(token);
      }
    }
    emitPlain(line.slice(cursor));
  }

  return tokens;
}

export interface SymbolSummaryLine {
  kind: ExtractKind;
  filePath: string;
  payload: string;
}

// One line per (extractor, file) pair, file order first, extractor order
// second (mirroring extractOrder), fixed across runs. Tokens appear in
// first-occurrence source order and are deduped within a line only —
// repetition across lines is information (who defines vs. who uses).
export interface BuildSymbolSummaryOptions {
  // Applied to each entry line BEFORE tokenization. Redaction must happen
  // here: secret patterns match on assignment context (`SECRET = "..."`),
  // which tokenization strips away.
  redactLine?: (line: string) => string;
}

export function buildSymbolSummaryLines(
  sections: readonly FileSection[],
  extractOrder: readonly ExtractKind[],
  options: BuildSymbolSummaryOptions = {},
): SymbolSummaryLine[] {
  const summaryLines: SymbolSummaryLine[] = [];
  const { redactLine } = options;

  for (const section of sections) {
    const stopwords =
      STOPWORDS_BY_LANGUAGE.get(section.lang) ?? new Set<string>();

    for (const kind of extractOrder) {
      if (!isSymbolSummaryKind(kind)) {
        continue;
      }

      const seen = new Set<string>();
      const tokens: string[] = [];

      for (const entry of section.entries) {
        if (entry.kind !== kind) {
          continue;
        }
        const lines = redactLine ? entry.lines.map(redactLine) : entry.lines;
        tokens.push(
          ...collectLineTokens(
            lines,
            stopwords,
            seen,
            section.lang === "json" ? JSON_TOKEN_PATTERN : undefined,
            section.lang !== "json" &&
              (kind === "imports" || kind === "exports"),
          ),
        );
      }

      if (tokens.length === 0) {
        continue;
      }

      summaryLines.push({
        kind,
        filePath: section.filePath,
        payload: tokens.join(" "),
      });
    }
  }

  return summaryLines;
}
