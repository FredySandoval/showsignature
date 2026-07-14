import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  MAP_ARG_DOCS    ,
  MAP_DESCRIPTION ,
  MAP_PROMPT      ,
  READ_ARG_DOCS   ,
  READ_DESCRIPTION,
  READ_PROMPT     ,
  buildMapArgv    ,
  buildReadArgv   ,
  runCli          ,
  type MapParams ,
  type ReadParams,
} from "../../dist/04-tools-core.js";

// pi adapter: registers map / outline_read as structured
// tools over the agent-neutral core shipped in dist/04-tools-core.js. The
// tool descriptions carry the full when-to-use workflow, so no system-prompt
// injection is needed. The dist import is deliberate: this file ships in the
// npm package, which contains dist/ but not src/ (rebuild after core changes).

const MAP_PARAMS = Type.Object({
  paths         : Type.Optional(Type.Array(Type.String(),{description:MAP_ARG_DOCS.paths})) ,
  only          : Type.Optional(Type.String({description:MAP_ARG_DOCS.only}))               ,
  skip          : Type.Optional(Type.Number({description:MAP_ARG_DOCS.skip}))               ,
  take          : Type.Optional(Type.Number({description:MAP_ARG_DOCS.take}))               ,
  maxDepth      : Type.Optional(Type.Number({description:MAP_ARG_DOCS.maxDepth}))           ,
  lang          : Type.Optional(Type.String({description:MAP_ARG_DOCS.lang}))               ,
  includeTests  : Type.Optional(Type.Boolean({description:MAP_ARG_DOCS.includeTests}))      ,
  symbolSummary : Type.Optional(Type.Boolean({description:MAP_ARG_DOCS.symbolSummary}))     ,
  noLineNumber  : Type.Optional(Type.Boolean({description:MAP_ARG_DOCS.noLineNumber}))      ,
});

const READ_PARAMS = Type.Object({
  file    : Type.String({description:READ_ARG_DOCS.file})                  ,
  offset  : Type.Optional(Type.Number({description:READ_ARG_DOCS.offset})) ,
  limit   : Type.Optional(Type.Number({description:READ_ARG_DOCS.limit}))  ,
  outline : Type.Optional(Type.String({description:READ_ARG_DOCS.outline})),
  framing : Type.Optional(Type.String({description:READ_ARG_DOCS.framing})),
  lang    : Type.Optional(Type.String({description:READ_ARG_DOCS.lang}))   ,
});

// Some models prepend @ to path arguments; built-in tools strip it, so do we.
function stripAt(value:string):string{
  return value.startsWith("@")?value.slice(1):value;
}

export default function (pi:ExtensionAPI) {
  pi.registerTool({
    name             : "map",
    label            : "Map",
    description      : MAP_DESCRIPTION    ,
    parameters       : MAP_PARAMS         ,
    promptSnippet    : MAP_PROMPT.snippet         ,
    promptGuidelines : [...MAP_PROMPT.guidelines] ,
    async execute(_toolCallId,params:MapParams,signal,_onUpdate,ctx) {
      const argv = buildMapArgv({...params,paths:params.paths?.map(stripAt)}) ;
      const text = await runCli(argv,ctx.cwd,signal??undefined)               ;
      return {content:[{type:"text",text}],details:{}} ;
    },
  });

  pi.registerTool({
    name             : "outline_read" ,
    label            : "Outline read" ,
    description      : READ_DESCRIPTION     ,
    parameters       : READ_PARAMS          ,
    promptSnippet    : READ_PROMPT.snippet         ,
    promptGuidelines : [...READ_PROMPT.guidelines] ,
    async execute(_toolCallId,params:ReadParams,signal,_onUpdate,ctx){
      const argv = buildReadArgv({...params,file:stripAt(params.file)}) ;
      const text = await runCli(argv,ctx.cwd,signal??undefined)         ;
      return { content: [{ type: "text", text }], details: {} };
    },
  });
}
