import { z } from "zod";
import type { ToolContext } from "@opencode-ai/plugin";
import {
  MAP_ARG_DOCS    ,
  MAP_DESCRIPTION ,
  READ_ARG_DOCS   ,
  READ_DESCRIPTION,
  buildMapArgv    ,
  buildReadArgv   ,
  runCli          ,
} from "../04-tools-core.js";

// opencode adapter: zod schemas over the agent-neutral core in 04-tools-core.

const mapArgs = {
  paths        : z.array(z.string()).default(["."]).describe(MAP_ARG_DOCS.paths),
  only         : z.string() .optional().describe(MAP_ARG_DOCS.only)             ,
  skip         : z.number() .optional().describe(MAP_ARG_DOCS.skip)             ,
  take         : z.number() .optional().describe(MAP_ARG_DOCS.take)             ,
  maxDepth     : z.number() .optional().describe(MAP_ARG_DOCS.maxDepth)         ,
  lang         : z.string() .optional().describe(MAP_ARG_DOCS.lang)             ,
  includeTests : z.boolean().optional().describe(MAP_ARG_DOCS.includeTests)     ,
  symbolSummary: z.boolean().optional().describe(MAP_ARG_DOCS.symbolSummary)    ,
  noLineNumber : z.boolean().optional().describe(MAP_ARG_DOCS.noLineNumber)     ,
};

export const map = {
  description: MAP_DESCRIPTION,
  args: mapArgs,
  async execute(args: z.infer<z.ZodObject<typeof mapArgs>>, context: ToolContext): Promise<string> {
    return runCli(buildMapArgv(args), context.directory, context.abort);
  },
};

const readArgs = {
  file   : z.string() .describe(READ_ARG_DOCS.file)              ,
  offset : z.number() .optional().describe(READ_ARG_DOCS.offset) ,
  limit  : z.number() .optional().describe(READ_ARG_DOCS.limit)  ,
  outline: z.string() .optional().describe(READ_ARG_DOCS.outline),
  framing: z.string() .optional().describe(READ_ARG_DOCS.framing),
  lang   : z.string() .optional().describe(READ_ARG_DOCS.lang)   ,
};

export const read = {
  description: READ_DESCRIPTION,
  args: readArgs,
  async execute(args: z.infer<z.ZodObject<typeof readArgs>>, context: ToolContext): Promise<string> {
    return runCli(buildReadArgv(args), context.directory, context.abort);
  },
};
