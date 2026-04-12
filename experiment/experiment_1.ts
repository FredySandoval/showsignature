type Rule = {
  kind: 'remove' | 'replace'
  from: string | RegExp
  to?: string
  note: string
}

type Options = {
  ultra?: boolean
}

type ProtectEntry = {
  name: string
  pattern: RegExp
}

const protectEntries: ProtectEntry[] = [
  { name: 'fenced code', pattern: /```[\s\S]*?```/g },
  { name: 'inline code', pattern: /`[^`\n]+`/g },
  { name: 'markdown image', pattern: /!\[[^\]]*\]\([^\)\n]+\)/g },
  { name: 'markdown link', pattern: /\[[^\]]+\]\([^\)\n]+\)/g },
  { name: 'markdown autolink', pattern: /<https?:\/\/[^>]+>/g },
  { name: 'markdown table row', pattern: /^\|.*\|$/gm },
  { name: 'quoted error', pattern: /(["'])(?:(?=(\\?))\2.)*?\1/g },
  { name: 'url', pattern: /https?:\/\/\S+/g },
  { name: 'env var', pattern: /\b[A-Z][A-Z0-9_]{1,}\b/g },
  { name: 'version', pattern: /\bv?\d+\.\d+(?:\.\d+)?\b/g },
  { name: 'file path', pattern: /(?:\.?\.?\/|\/)[\w./-]+/g },
]

const baseRules: Rule[] = [
  {
    kind: 'replace',
    from: /\bdue to the fact that\b/gi,
    to: 'because',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bin the event that\b/gi,
    to: 'if',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bhas the ability to\b/gi,
    to: 'can',
    note: 'shorter phrase',
  },
  { kind: 'remove', from: /\b(?:a|an|the)\b/gi, note: 'articles' },
  {
    kind: 'remove',
    from: /\b(?:just|really|basically|actually|simply|essentially|generally)\b/gi,
    note: 'filler words',
  },
  {
    kind: 'remove',
    from: /\b(?:very|quite|extremely|highly|fairly|rather)\b/gi,
    note: 'intensifiers',
  },
  {
    kind: 'remove',
    from: /\b(?:kind of|sort of|pretty much|more or less|arguably|probably|possibly|potentially)\b/gi,
    note: 'more hedging',
  },
  {
    kind: 'remove',
    from: /\b(?:note that|keep in mind|it is worth noting that|for the most part)\b/gi,
    note: 'weak intro phrases',
  },
  {
    kind: 'remove',
    from: /(^|[\n.!?]\s*)(?:sure|certainly|of course)\b[,.! ]*/gim,
    note: 'pleasantries',
  },
  {
    kind: 'remove',
    from: /\b(?:happy to|i(?:’|')?d be happy to|i(?:’|')?d recommend|thanks|thank you|no problem|absolutely|definitely|glad to help|hope that helps)\b[,.! ]*/gi,
    note: 'polite wrappers',
  },
  {
    kind: 'remove',
    from: /\b(?:likely|most likely|maybe|perhaps|i think|it seems|seems like)\b/gi,
    note: 'hedging',
  },
  {
    kind: 'remove',
    from: /\b(?:it might be worth|you could consider|it would be good to)\b/gi,
    note: 'hedging phrases',
  },
  {
    kind: 'remove',
    from: /\b(?:however|furthermore|additionally|in addition|therefore|thus|moreover|indeed|specifically|in particular)\b[,.! ]*/gi,
    note: 'connective fluff',
  },
  {
    kind: 'remove',
    from: /\b(?:you should|remember to)\b/gi,
    note: 'soft instruction wrappers',
  },
  {
    kind: 'replace',
    from: /\byou need to\b/gi,
    to: 'must',
    note: 'stronger instruction',
  },
  {
    kind: 'replace',
    from: /\byou have to\b/gi,
    to: 'must',
    note: 'stronger instruction',
  },
  {
    kind: 'replace',
    from: /\bit is necessary to\b/gi,
    to: 'must',
    note: 'stronger instruction',
  },
  {
    kind: 'replace',
    from: /\bmake sure to\b/gi,
    to: 'ensure',
    note: 'shorter instruction',
  },
  {
    kind: 'replace',
    from: /\bin order to\b/gi,
    to: 'to',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bdue to (?:the )?fact that\b/gi,
    to: 'because',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bin (?:the )?event that\b/gi,
    to: 'if',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bis able to\b/gi,
    to: 'can',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bhas (?:the )?ability to\b/gi,
    to: 'can',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bhas ability to\b/gi,
    to: 'can',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bthe reason is because\b/gi,
    to: 'because',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\butili[sz]e\b/gi,
    to: 'use',
    note: 'simpler synonym',
  },
  {
    kind: 'replace',
    from: /\bimplement a solution for\b/gi,
    to: 'fix',
    note: 'simpler synonym',
  },
  {
    kind: 'replace',
    from: /\bextensive\b/gi,
    to: 'big',
    note: 'simpler synonym',
  },
  {
    kind: 'replace',
    from: /\bdoes not have\b/gi,
    to: 'lacks',
    note: 'shorter negation',
  },
  {
    kind: 'replace',
    from: /\bis not able to\b/gi,
    to: 'cannot',
    note: 'shorter negation',
  },
  {
    kind: 'replace',
    from: /\bis not necessary\b/gi,
    to: 'optional',
    note: 'shorter negation',
  },
  {
    kind: 'replace',
    from: /\bthis issue\b/gi,
    to: 'issue',
    note: 'drop determiner',
  },
  {
    kind: 'replace',
    from: /\bthis problem\b/gi,
    to: 'problem',
    note: 'drop determiner',
  },
  {
    kind: 'replace',
    from: /\bthis change\b/gi,
    to: 'change',
    note: 'drop determiner',
  },
  {
    kind: 'replace',
    from: /\bbecause\b/gi,
    to: '. ',
    note: 'fragment split',
  },
]

const ultraRules: Rule[] = [
  { kind: 'replace', from: /\band\b/gi, to: ' ', note: 'drop conjunction' },
  { kind: 'replace', from: /\bbut\b/gi, to: '. ', note: 'split contrast' },
  { kind: 'replace', from: /\bso\b/gi, to: '. ', note: 'split result' },
  { kind: 'replace', from: /\bthen\b/gi, to: '. ', note: 'split sequence' },
  { kind: 'replace', from: /\bcauses?\b/gi, to: '→', note: 'causal arrow' },
  { kind: 'replace', from: /\bleads to\b/gi, to: '→', note: 'causal arrow' },
  { kind: 'replace', from: /\bresults in\b/gi, to: '→', note: 'causal arrow' },
]

export const ruleTable = [
  ['Articles', 'remove', 'a, an, the'],
  ['Filler', 'remove', 'just, really, basically, actually, simply, essentially, generally'],
  ['Intensifiers', 'remove', 'very, quite, extremely, highly, fairly, rather'],
  ['Pleasantries', 'remove', 'sure, certainly, of course, happy to, I\'d be happy to, I\'d recommend, thanks, thank you, hope that helps'],
  ['Hedging', 'remove', 'likely, most likely, maybe, perhaps, I think, it seems, seems like, kind of, sort of, probably'],
  ['Hedging phrases', 'remove', 'it might be worth, you could consider, it would be good to'],
  ['Connective fluff', 'remove', 'however, furthermore, additionally, in addition, therefore, thus, moreover'],
  ['Soft wrappers', 'remove/replace', 'you should, remember to, make sure to → ensure, you need to → must'],
  ['Phrase rewrites', 'replace', 'in order to → to, due to the fact that → because, in the event that → if, the reason is because → because'],
  ['Word rewrites', 'replace', 'utilize → use, implement a solution for → fix, extensive → big, is able to → can, has the ability to → can, does not have → lacks, is not able to → cannot, this issue → issue'],
  ['Structure', 'rewrite', 'because → sentence split; ultra: cause/causes, leads to, results in → → and drop some conjunctions'],
  ['Protection', 'preserve', 'code blocks, inline code, markdown links/images, table rows, quoted errors, URLs, env vars, versions, file paths'],
] as const

function isQuotedError(text: string) {
  const inner = text.slice(1, -1)
  return /\b(?:error|exception|failed|failure|cannot|can't|invalid|unexpected|undefined|timeout|timed out|denied|not found|syntaxerror|typeerror|referenceerror)\b/i.test(inner)
}

function protect(text: string) {
  const values: string[] = []
  let output = text

  for (const entry of protectEntries) {
    output = output.replace(entry.pattern, (match) => {
      if (entry.name === 'quoted error' && !isQuotedError(match)) {
        return match
      }

      const token = `\uE000${values.length}\uE001`
      values.push(match)
      return token
    })
  }

  return {
    text: output,
    restore(input: string) {
      return input.replace(/\uE000(\d+)\uE001/g, (_, index) => values[Number(index)] ?? '')
    },
  }
}

function applyRules(text: string, options: Options = {}) {
  const rules = options.ultra ? [...baseRules, ...ultraRules] : baseRules
  let output = text

  for (const rule of rules) {
    if (rule.kind === 'remove') {
      output = output.replace(rule.from, ' ')
      continue
    }

    output = output.replace(rule.from, rule.to ?? '')
  }

  return output
}

function getMarkdownPrefix(line: string) {
  const match = line.match(/^(\s*(?:(?:#{1,6}[ \t]+)|(?:>[ \t]?)+|(?:[-*+][ \t]+)|(?:\d+\.[ \t]+))*)(.*)$/)

  return {
    prefix: match?.[1] ?? '',
    content: match?.[2] ?? line,
  }
}

function cleanupLine(text: string) {
  return text
    .replace(/\b(?:you|we)\b\s+(?=(?:need|must|can|should|run|use|fix|remove|keep|ensure)\b)/gi, '')
    .replace(/\bthe system\b/gi, 'system')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([.?!]){2,}/g, '$1')
    .replace(/"[^"]*"|'[^']*'/g, (match) => `${match[0]}${match.slice(1, -1).trim()}${match.at(-1) ?? ''}`)
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*\.\s*/g, '. ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[,.;:!? ]+|[,.;:!? ]+$/g, '')
    .trim()
}

function cleanupDocument(text: string) {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

export function toCaveman(input: string, options: Options = {}) {
  const { text, restore } = protect(input)

  const shortened = text
    .split('\n')
    .map((line) => {
      if (!line.trim()) {
        return ''
      }

      const { prefix, content } = getMarkdownPrefix(line)
      const rewritten = cleanupLine(applyRules(content, options))
      return rewritten ? `${prefix}${rewritten}` : prefix.trimEnd()
    })
    .join('\n')

  return restore(cleanupDocument(shortened))
}

function printRuleTable() {
  const rows = [
    ['Category', 'Action', 'Rule'],
    ...ruleTable.map((row) => [...row]),
  ]

  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => row[index].length)))

  for (const row of rows) {
    console.log(row.map((cell, index) => cell.padEnd(widths[index])).join(' | '))
  }
}

function printUsage() {
  console.log('Usage: bun ./experiment_1.ts [--ultra] "text"')
  console.log('       bun ./experiment_1.ts [--ultra] --input input.txt [--output output.txt]')
  console.log('       bun ./experiment_1.ts --rules')
}

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag)
  if (index === -1) {
    return null
  }

  return args[index + 1] ?? null
}

function removeFlags(args: string[], flags: string[]) {
  const skip = new Set(flags)
  const output: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]

    if (skip.has(value)) {
      index += 1
      continue
    }

    if (value === '--ultra') {
      continue
    }

    output.push(value)
  }

  return output
}

async function readInput(args: string[]) {
  const inputPath = getFlagValue(args, '--input')
  if (inputPath) {
    return await Bun.file(inputPath).text()
  }

  const cleanArgs = removeFlags(args, ['--input', '--output'])
  if (cleanArgs.length > 0) {
    return cleanArgs.join(' ')
  }

  if (!process.stdin.isTTY) {
    return await Bun.stdin.text()
  }

  return ''
}

async function writeOutput(args: string[], content: string) {
  const outputPath = getFlagValue(args, '--output')
  if (!outputPath) {
    console.log(content)
    return
  }

  await Bun.write(outputPath, content)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--rules')) {
    printRuleTable()
    return
  }

  const ultra = args.includes('--ultra')
  const input = await readInput(args)

  if (!input) {
    printUsage()
    return
  }

  const output = toCaveman(input, { ultra })
  await writeOutput(args, output)
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
