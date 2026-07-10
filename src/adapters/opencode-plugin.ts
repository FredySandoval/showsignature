import type { Plugin } from "@opencode-ai/plugin";
import { map, read } from "./opencode.js";

// opencode server-plugin entry, wired to package.json exports["./server"].
// Users enable it with: { "plugin": ["showsignature"] } in opencode.json.
// Only the plugin function may be exported here: opencode's loader treats
// this module's exports as plugin instances.
export const ShowsignaturePlugin: Plugin = async () => ({
  tool: {
    showsignature_map: map,
    showsignature_read: read,
  },
});
