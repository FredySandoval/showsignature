// Dev-time registration of the showsignature tools for opencode sessions in
// this repo (requires a build: pnpm build). Users get the same tools from the
// npm package via package.json exports["./server"]. Do not also enable the
// npm plugin in this repo's opencode config — both register
// showsignature_map / showsignature_read and would collide.
// original source file at: src/adapters/opencode.ts
export { map, read } from "../../dist/adapters/opencode.js";
