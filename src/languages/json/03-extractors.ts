import type {
  ExtractEntry,
  ExtractKind,
  Extractor,
  JsonParseContext,
  SingleExtractResult,
} from "../../00-core-types.js";

export const JSON_SHAPE_KIND = "json:shape" as ExtractKind;

export const JSON_SHAPE_MAX_DEPTH = 5;
export const JSON_SHAPE_MAX_OBJECT_KEYS = 20;

function toResult(
  entries: ExtractEntry[],
  warnings: SingleExtractResult["warnings"] = [],
): SingleExtractResult {
  return { entries, warnings };
}

function toEntry(
  lines: string[],
  filePath: string,
  sourcePos: number,
): ExtractEntry {
  return {
    kind: JSON_SHAPE_KIND,
    lines,
    metadata: {
      filePath,
      sourcePos,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalarShape(value: unknown): string | undefined {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return undefined;
  }
}

function shapeOf(value: unknown, depth = 0): string {
  const scalar = scalarShape(value);
  if (scalar !== undefined) {
    return scalar;
  }

  if (depth >= JSON_SHAPE_MAX_DEPTH) {
    return Array.isArray(value) ? "[...]" : "{...}";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    return `[${shapeOf(value[0], depth + 1)}]`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) {
      return "{}";
    }

    const renderedKeys = keys
      .slice(0, JSON_SHAPE_MAX_OBJECT_KEYS)
      .map((key) => `${key}: ${shapeOf(value[key], depth + 1)}`);

    if (keys.length > JSON_SHAPE_MAX_OBJECT_KEYS) {
      renderedKeys.push("...");
    }

    return `{ ${renderedKeys.join(", ")} }`;
  }

  return "unknown";
}

export function createShapeExtractor(): Extractor<JsonParseContext> {
  return {
    kind: JSON_SHAPE_KIND,
    extract(context: JsonParseContext): SingleExtractResult {
      try {
        const parsed = JSON.parse(context.source) as unknown;
        return toResult([toEntry([shapeOf(parsed)], context.filePath, 0)]);
      } catch (cause) {
        return toResult(
          [],
          [
            {
              level: "warning",
              severity: "warning",
              message: "Invalid JSON: unable to parse strict JSON input",
              filePath: context.filePath,
              kind: JSON_SHAPE_KIND,
              cause,
            },
          ],
        );
      }
    },
  };
}
