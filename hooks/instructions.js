import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillPath = resolve(__dirname, "../skills/showsignature/SKILL.md");

export async function getInstructions() {
  const content = await readFile(skillPath, "utf8");
  return content.replace(/^---[\s\S]*?---\s*/, "");
}
