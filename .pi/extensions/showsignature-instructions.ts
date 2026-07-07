import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillPath = resolve(__dirname, "../../skills/showsignature/SKILL.md");
const execFileAsync = promisify(execFile);

let cachedBody: string | null = null;

async function getInstructions(): Promise<string> {
  if (cachedBody) return cachedBody;
  const content = await readFile(skillPath, "utf8");
  cachedBody = content.replace(/^---[\s\S]*?---\s*/, "");
  return cachedBody;
}

async function getVersion(): Promise<{ available: boolean; version: string | null }> {
  try {
    const { stdout } = await execFileAsync("showsignature", ["--version"], {
      timeout: 3000,
      windowsHide: true,
    });
    const version = stdout.trim();
    return { available: true, version: version || "version unknown" };
  } catch {
    return { available: false, version: null };
  }
}

export default async function (pi: ExtensionAPI) {
  let availabilityLine: string;

  pi.on("session_start", async (_event, ctx) => {
    const [versionInfo, body] = await Promise.all([
      getVersion(),
      getInstructions(),
    ]);
    availabilityLine = versionInfo.available
      ? `showsignature is installed: ${versionInfo.version}`
      : "showsignature was not found. Proceed using normal file inspection.";

    cachedBody = `${availabilityLine}\n\n${body}`;

    ctx.ui?.notify?.("showsignature instructions loaded", "info");
  });

  pi.on("before_agent_start", async (event) => {
    if (!cachedBody) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${cachedBody}` };
  });
}
