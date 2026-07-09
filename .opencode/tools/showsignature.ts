import { tool } from "@opencode-ai/plugin";
import { z } from "zod";

export const map = tool({
  description: [
    "Structural overview of code, Markdown, and JSON. Use INSTEAD of read/grep/cat for the FIRST look at any unfamiliar file or folder: returns signatures, imports, exports, types, interfaces, variables, comments, Markdown headings, and JSON shapes at a fraction of the token cost, each entry prefixed with its real source line number.",
    "Supported: .ts/.mts/.cts .js/.mjs/.cjs .tsx/.jsx .svelte .go .py .rs .lua .md .json — for other file types use read/grep directly.",
    "Workflow: map first to see what exists, then jump to exact lines with showsignature_read using the line numbers from the map. Before grepping for a name you are guessing at, run with symbolSummary to get the identifiers that literally exist (each token is a valid ripgrep pattern).",
    "If the output ends with a 'note:' line, it was capped, depth-limited, or filtered — the note names the exact follow-up flags; never ignore it.",
  ].join(" "),
    args: {
        paths:         z.array(z.string()).default(["."]).describe("One or more files and/or directories to map"),
        only:          z.string().optional().describe("Comma-separated extractors, e.g. 'imports,exports', 'interfaces,types', 'md:headings', 'json:shape'"),
        skip:          z.number().optional().describe("Skip N entries (pagination)"),
        take:          z.number().optional().describe("Take N entries (pagination)"),
        maxDepth:      z.number().optional().describe("Directory scan depth (default 2)"),
        lang:          z.string().optional().describe("Restrict to one language, e.g. 'go', 'py', 'ts'"),
        includeTests:  z.boolean().optional().describe("Include test files (excluded by default)"),
        symbolSummary: z.boolean().optional().describe("Keyword-discovery mode: one line per (extractor, file) listing identifiers"),
        all:           z.boolean().optional().describe("Lift output caps (entry limit and 2000-line/50 KB cap)"),
        noLineNumber:  z.boolean().optional().describe("Hide source line-number prefixes (cleaner text for piping)"),
    },
    async execute(args, context) {
        const argv: string[] = [];
        if (args.only) argv.push("--only", args.only);
        if (args.skip !== undefined) argv.push("--skip", String(args.skip));
        if (args.take !== undefined) argv.push("--take", String(args.take));
        if (args.maxDepth !== undefined) argv.push("--max-depth", String(args.maxDepth));
        if (args.lang) argv.push("--lang", args.lang);
        if (args.includeTests) argv.push("--include-tests");
        if (args.symbolSummary) argv.push("--symbol-summary");
        if (args.all) argv.push("--all");
        if (args.noLineNumber) argv.push("--no-line-number");
        argv.push(...args.paths);

        const result = await Bun.$`showsignature map ${argv}`.cwd(context.directory).nothrow().quiet();
        const out = result.stdout.toString() + result.stderr.toString();
        if (result.exitCode !== 0) {
            return `showsignature map failed (exit ${result.exitCode}):\n${out}`;
        }
        return out.trim() || "(no output)";
    },
})

export const read = tool({
  description: [
    "Windowed literal read of exactly one file, with a structural outline (real line numbers) around the window for orientation. Prefer this over plain read for supported file types (.ts/.js/.tsx/.jsx/.svelte/.go/.py/.rs/.lua/.md/.json), typically jumping to a line number that showsignature_map reported.",
    "The content window carries no line-number prefixes, so it is safe to copy into exact-match edit tools. Windows in LINES (offset/limit), unlike showmap which paginates in ENTRIES (skip/take).",
    "If the output ends with a 'note:' line, the window was capped — it names the exact follow-up flags.",
  ].join(" "),
    args: {
        file:    z.string().describe("File to read"),
        offset:  z.number().optional().describe("First line to read (1-indexed)"),
        limit:   z.number().optional().describe("Number of lines to read"),
        outline: z.string().optional().describe("Outline extractors, e.g. 'imports,signatures' (default: signatures)"),
        framing: z.string().optional().describe("'none' for plain content only (no tags, no outline)"),
        lang:    z.string().optional().describe("Language hint, e.g. 'py', 'ts'"),
        all:     z.boolean().optional().describe("Lift the 2000-line/50 KB window cap"),
    },
    async execute(args, context) {
        const argv: string[] = [];
        if (args.offset !== undefined) argv.push("--offset", String(args.offset));
        if (args.limit !== undefined) argv.push("--limit", String(args.limit));
        if (args.outline) argv.push("--outline", args.outline);
        if (args.framing) argv.push("--framing", args.framing);
        if (args.lang) argv.push("--lang", args.lang);
        if (args.all) argv.push("--all");
        argv.push(args.file);

        const result = await Bun.$`showsignature read ${argv}`.cwd(context.directory).nothrow().quiet();
        const out = result.stdout.toString() + result.stderr.toString();
        if (result.exitCode !== 0) {
            return `showsignature read failed (exit ${result.exitCode}):\n${out}`;
        }
        return out.trim() || "(no output)";
    },
})
