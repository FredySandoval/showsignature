# REPORT

❯ issue with pi,

  $ pi
  Error: Failed to load extension "/home/fredy/.pi/agent/git/github.com/FredySandoval/showsignature/.pi/extensions/showsignature-tools.ts": Tool "map" conflicts with
  /home/fredy/Documents/MyProjects_development/04_showsignature/.pi/extensions/showsignature-tools.ts
  Error: Failed to load extension "/home/fredy/.pi/agent/git/github.com/FredySandoval/showsignature/.pi/extensions/showsignature-tools.ts": Tool "outline_read" conflicts with
  /home/fredy/Documents/MyProjects_development/04_showsignature/.pi/extensions/showsignature-tools.ts
  Hint: Start without extensions using "pi -ne".



  when pi is installed already, and we open pi in this same folder, pi attempts to reregister the tool

  please show possible solutions to this problematic


  What's happening

  Your global ~/.pi/agent/settings.json has git:github.com/FredySandoval/showsignature in packages, so pi always loads the extension from the clone at ~/.pi/agent/git/.... When you open pi
  inside the dev repo, pi also loads the project-local .pi/extensions/showsignature-tools.ts (that one wins — it registers first), then the global copy fails with the conflict. It's noisy
  but not fatal: you're actually running the local dev copy, which is what you want.

  Make the extension yield to a project-local copy (fixes it for every dev/user, ships with the package).
  Add a guard at the top of the default export: if this file is not the copy in the current project, but the current project has its own copy, skip registration silently:

  import { existsSync, realpathSync } from "node:fs";
  import { fileURLToPath } from "node:url";
  import path from "node:path";

  export default function (pi: ExtensionAPI) {
    const here  = realpathSync(fileURLToPath(import.meta.url));
    const local = path.join(process.cwd(), ".pi", "extensions", "showsignature-tools.ts");
    if (existsSync(local) && realpathSync(local) !== here) return; // project copy takes over

    pi.registerTool({ ... });
    ...
  }

  This works regardless of load order: the globally-installed copy sees the repo's copy and steps aside; the local copy sees here === local and registers. (Caveat: it keys off cwd, so it
  only dedupes when pi is started from the repo root — which is exactly the conflicting case you hit.)
