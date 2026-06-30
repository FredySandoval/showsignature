#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getInstructions } from "./instructions.js";

const execFileAsync = promisify(execFile);

async function getVersion() {
  try {
    const { stdout } = await execFileAsync("showsignature", ["--version"], {
      timeout: 3000,
      windowsHide: true
    });

    const version = stdout.trim();

    return {
      available: true,
      version: version || "version unknown"
    };
  } catch {
    return {
      available: false,
      version: null
    };
  }
}

function writeSessionContext(additionalContext) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext
      }
    })}\n`
  );
}

async function main() {
  const [versionInfo, instructions] = await Promise.all([
    getVersion(),
    getInstructions()
  ]);

  const availability = versionInfo.available
    ? `showsignature is installed: ${versionInfo.version}`
    : "showsignature was not found. Proceed using normal file inspection.";

  writeSessionContext(`${availability}\n\n${instructions}`);
}

main().catch((error) => {
  writeSessionContext(
    `showsignature Claude Code hook failed softly: ${error.message}\n\nProceed using normal file inspection.`
  );
});
