#!/usr/bin/env bun
// Writes the two instruction surfaces that live outside src/ from the single
// instruction source src/00-instructions.ts:
//
//   skills/showsignature/SKILL.md          <- SKILL_MD (verbatim)
//   README.md generated block              <- README_USAGE (between markers)
//
//   bun scripts/build-instructions.ts           write outputs
//   bun scripts/build-instructions.ts --check   exit 1 if any output is stale
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { README_USAGE, SKILL_MD } from "../src/00-instructions.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkMode = process.argv.includes("--check");

const START = "<!-- generated:instructions:start -->";
const END = "<!-- generated:instructions:end -->";

function renderReadme(current: string): string {
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`README.md is missing the ${START} / ${END} markers`);
  }
  const before = current.slice(0, start + START.length);
  const after = current.slice(end);
  return `${before}\n<!-- Everything until the end marker is GENERATED from src/00-instructions.ts — edit there and run \`pnpm gen\`. -->\n\n${README_USAGE.trimEnd()}\n\n${after}`;
}

const outputs = [
  { path: "skills/showsignature/SKILL.md", content: SKILL_MD },
  { path: "README.md", content: renderReadme(readFileSync(join(root, "README.md"), "utf8")) },
];

const stale: string[] = [];
for (const { path, content } of outputs) {
  let current: string | null = null;
  try {
    current = readFileSync(join(root, path), "utf8");
  } catch {
    current = null;
  }
  if (current === content) continue;
  if (checkMode) {
    stale.push(path);
  } else {
    writeFileSync(join(root, path), content);
    console.log(`wrote ${path}`);
  }
}

if (checkMode && stale.length > 0) {
  console.error(`stale generated instruction files (run \`pnpm gen\`):\n  ${stale.join("\n  ")}`);
  process.exit(1);
}
if (checkMode) console.log("generated instruction files are up to date");
