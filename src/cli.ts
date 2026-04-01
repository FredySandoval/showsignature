#!/usr/bin/env node
import { runCli } from "./main.js";

async function main() {
  await runCli();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
