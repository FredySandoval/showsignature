# Caveman

Turn normal English into short, blunt "caveman" text without breaking technical content.

This project is a small Bun + TypeScript text rewriter. It removes filler words, shortens verbose phrases, and preserves things that should stay exact, like code, links, URLs, file paths, versions, and error messages.

## What it does

- Removes articles like `a`, `an`, and `the`
- Removes filler, hedging, and support-chat fluff
- Rewrites long phrases into shorter ones
- Preserves technical text and markdown syntax
- Supports a more aggressive `ultra` mode
- Works as both a function and a CLI

## Examples

### Standard mode

Input:

```text
The API is basically slow because it renders everything.
```

Output:

```text
API is slow. it renders everything
```

### Ultra mode

Input:

```text
State update leads to re-render and cache miss results in retry.
```

Output:

```text
State update → re-render cache miss → retry
```

### Technical text stays intact

Input:

```text
You should run `npm run test` in /src/app.ts with NODE_ENV=v1.2.3.
```

Output:

```text
run `npm run test` in /src/app.ts with NODE_ENV=v1.2.3
```

### Markdown stays usable

Input:

```md
# The API Guide

- The guide is basically here: [The API Guide](https://example.com/docs).
  > The API is basically slow because it renders everything.
```

Output:

```md
# API Guide

- guide is here: [The API Guide](https://example.com/docs)
  > API is slow. it renders everything
```

## Protected content

The rewriter protects these parts before applying language rules:

- fenced code blocks
- inline code
- markdown links and images
- markdown autolinks
- markdown table rows
- quoted error messages
- URLs
- environment variable names
- versions like `v1.2.3`
- file paths

Markdown prefixes for headings, bullets, blockquotes, and numbered lists are preserved while the text after the prefix is rewritten.

## Install

```bash
bun install
```

## CLI usage

### Rewrite a string

```bash
bun ./caveman.ts "The API is basically slow because it renders everything."
```

### Use ultra mode

```bash
bun ./caveman.ts --ultra "State update leads to re-render and cache miss results in retry."
```

### Read from stdin

```bash
printf '%s\n' 'You should run `npm run test` in /src/app.ts with NODE_ENV=v1.2.3.' | bun ./caveman.ts
```

### Read from a file and write to a file

```bash
bun ./caveman.ts --input input.txt --output output.txt
```

### Print the rule summary

```bash
bun ./caveman.ts --rules
```

## Library usage

```ts
import { toCaveman } from "./caveman";

const output = toCaveman(
  "The API is basically slow because it renders everything.",
);
console.log(output);
// API is slow. it renders everything
```

Ultra mode:

```ts
import { toCaveman } from "./caveman";

const output = toCaveman(
  "State update leads to re-render and cache miss results in retry.",
  {
    ultra: true,
  },
);

console.log(output);
// State update → re-render cache miss → retry
```

## Rule overview

Base rules do things like:

- remove articles
- remove filler words
- remove hedging
- remove pleasantries
- replace verbose phrases like `in the event that` with `if`
- replace `you need to` with `must`
- replace `is able to` with `can`
- split `because` into a harder sentence break

Ultra mode adds more aggressive rewrites, including:

- dropping some conjunctions
- turning `causes`, `leads to`, and `results in` into `→`

Rules live in `language-rules.ts`.

## Project structure

- `caveman.ts` — core rewrite function and CLI
- `language-rules.ts` — protection patterns and rewrite rules
- `experiment_1.ts` — re-export file
- `experiment_1.test.ts` — behavior tests
- `caveman.perf.test.ts` — benchmark-style performance test
- `performance-baseline.json` — recorded benchmark baseline to beat

## Development

Run tests:

```bash
bun run test
```

Run a TypeScript check with `tsgo`:

```bash
bun run typecheck
```

Build the npm package output into `dist`:

```bash
bun run build
npm pack --dry-run
```

Run only the benchmark test:

```bash
bun test caveman.perf.test.ts
```

Increase benchmark iterations:

```bash
CAVEMAN_BENCH_ITERATIONS=200 bun test caveman.perf.test.ts
```

## Performance baseline

The repo keeps a benchmark record in `performance-baseline.json`.

Current recorded baseline:

- command: `CAVEMAN_BENCH_ITERATIONS=80 bun test caveman.perf.test.ts`
- default: `9.913ms` average
- ultra: `9.898ms` average

`caveman.perf.test.ts` reads this file and prints the delta from the baseline on each benchmark run.

Use it as a local reference to beat, not as a strict pass/fail threshold. Timing depends on machine, load, and Bun version.

## Notes

- The rewrite is intentionally lossy and stylistic.
- It is best for shortening explanations, support replies, notes, and markdown-heavy text.
- It is not meant for grammar-correct rewriting.
