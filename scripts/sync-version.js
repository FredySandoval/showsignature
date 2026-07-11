#!/usr/bin/env node
// Syncs the package.json version into .claude-plugin/plugin.json and README.md.
// Runs automatically via the "version" lifecycle script during `pnpm version`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const pluginPath = join(root, ".claude-plugin", "plugin.json");
const plugin = readFileSync(pluginPath, "utf8");
writeFileSync(pluginPath, plugin.replace(/"version":\s*"[^"]+"/, `"version": "${version}"`));

const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
writeFileSync(readmePath, readme.replace(/showsignature@\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?/g, `showsignature@${version}`));

console.log(`Synced version ${version} to plugin.json and README.md`);
