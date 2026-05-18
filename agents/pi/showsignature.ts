import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const extensionFilePath = fileURLToPath(import.meta.url);
const extensionFolderPath = path.dirname(extensionFilePath);
const webfetchHelp = fs.readFileSync(
  path.join(extensionFolderPath, "SYSTEM.md"),
  "utf8",
);

export default function ddgExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt: `${event.systemPrompt}\n\n${webfetchHelp}`,
    };
  });
}
