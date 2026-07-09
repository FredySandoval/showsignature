// ============================================================================
// Symbol Summary                       [map --symbol-summary]
// Keyword-discovery mode: emits the identifier vocabulary that literally
// exists in the code as ready-to-use ripgrep alternation patterns, one line
// per (extractor, file) pair:
//
//   exports:src/db/pool.ts: PgPool|createPool|POOL_MAX|acquireConn
//
// Output contract: the token payload of every line is a valid ripgrep
// pattern in default (regex) mode.
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
  // builtin globals and TS utility types
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
const JSON_STOPWORDS = [
  "array", "boolean", "false", "null", "number", "object", "string", "true",
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
const REGEX_METACHARS_PATTERN = /[\\^$.*+?()[\]{}|]/gu;

export function escapeSymbolToken(token: string): string {
  return token.replace(REGEX_METACHARS_PATTERN, "\\$&");
}

function collectLineTokens(
  lines: readonly string[],
  stopwords: ReadonlySet<string>,
  seen: Set<string>,
): string[] {
  const tokens: string[] = [];

  for (const line of lines) {
    for (const match of line.matchAll(IDENTIFIER_PATTERN)) {
      const token = match[0];
      if (stopwords.has(token) || seen.has(token)) {
        continue;
      }
      seen.add(token);
      tokens.push(escapeSymbolToken(token));
    }
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
export function buildSymbolSummaryLines(
  sections: readonly FileSection[],
  extractOrder: readonly ExtractKind[],
): SymbolSummaryLine[] {
  const summaryLines: SymbolSummaryLine[] = [];

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
        tokens.push(...collectLineTokens(entry.lines, stopwords, seen));
      }

      if (tokens.length === 0) {
        continue;
      }

      summaryLines.push({
        kind,
        filePath: section.filePath,
        payload: tokens.join("|"),
      });
    }
  }

  return summaryLines;
}
