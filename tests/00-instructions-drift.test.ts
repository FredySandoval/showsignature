import { expect, test } from "bun:test";
import { join } from "node:path";

// SKILL.md and the README generated block are written from
// src/00-instructions.ts. This test fails when either was hand-edited or
// the source changed without running `pnpm gen`.
test("generated instruction files are in sync with src/00-instructions.ts", () => {
  const root = join(import.meta.dir, "..");
  const result = Bun.spawnSync(
    ["bun", join(root, "scripts/build-instructions.ts"), "--check"],
    { cwd: root },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
