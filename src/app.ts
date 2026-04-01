#!/usr/bin/env node
import { runCli } from "./index.js";

async function main() {
  await runCli();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
