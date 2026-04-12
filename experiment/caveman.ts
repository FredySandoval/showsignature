import { baseRules, protectEntries, ruleTable, ultraRules } from './language-rules.js'

export type Rule = {
  kind: 'remove' | 'replace'
  from: string | RegExp
  to?: string
  note: string
}

export type Options = {
  ultra?: boolean
}

export type ProtectEntry = {
  name: string
  pattern: RegExp
}

const quotedErrorPattern = /\b(?:error|exception|failed|failure|cannot|can't|invalid|unexpected|undefined|timeout|timed out|denied|not found|syntaxerror|typeerror|referenceerror)\b/i
const placeholderPattern = /\uE000(\d+)\uE001/g
const markdownPrefixPattern = /^(\s*(?:(?:#{1,6}[ \t]+)|(?:>[ \t]?)+|(?:[-*+][ \t]+)|(?:\d+\.[ \t]+))*)(.*)$/
const instructionPronounPattern = /\b(?:you|we)\b\s+(?=(?:need|must|can|should|run|use|fix|remove|keep|ensure)\b)/gi
const systemPattern = /\bthe system\b/gi
const punctuationSpacingPattern = /\s+([,.;:!?])/g
const repeatedSentenceEndPattern = /([.?!]){2,}/g
const quotedTextPattern = /"[^"]*"|'[^']*'/g
const extraSpacesPattern = /\s{2,}/g
const dotSpacingPattern = /\s*\.\s*/g
const commaSpacingPattern = /\s*,\s*/g
const edgePunctuationPattern = /^[,.;:!? ]+|[,.;:!? ]+$/g
const extraBlankLinesPattern = /\n{3,}/g
const lineTrailingSpacePattern = /[ \t]+\n/g
const lineLeadingSpacePattern = /\n[ \t]+/g

const standardRules = baseRules
const ultraModeRules = baseRules.concat(ultraRules)

function isQuotedError(text: string) {
  const inner = text.slice(1, -1)
  return quotedErrorPattern.test(inner)
}

function isProtectionRelevant(entry: ProtectEntry, text: string) {
  switch (entry.name) {
    case 'fenced code':
      return text.includes('```')
    case 'inline code':
      return text.includes('`')
    case 'markdown image':
      return text.includes('![') && text.includes('](')
    case 'markdown link':
      return text.includes('[') && text.includes('](')
    case 'markdown autolink':
      return text.includes('<http://') || text.includes('<https://')
    case 'markdown table row':
      return text.includes('|')
    case 'quoted error':
      return text.includes('"') || text.includes("'")
    case 'url':
      return text.includes('http://') || text.includes('https://')
    case 'file path':
      return text.includes('/')
    default:
      return true
  }
}

function protect(text: string) {
  const values: string[] = []
  let output = text

  for (const entry of protectEntries) {
    if (!isProtectionRelevant(entry, output)) {
      continue
    }

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
      return input.replace(placeholderPattern, (_, index) => values[Number(index)] ?? '')
    },
  }
}

function applyRules(text: string, rules: Rule[]) {
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
  const match = markdownPrefixPattern.exec(line)

  return {
    prefix: match?.[1] ?? '',
    content: match?.[2] ?? line,
  }
}

function cleanupLine(text: string) {
  let output = text.replace(instructionPronounPattern, '')

  output = output
    .replace(systemPattern, 'system')
    .replace(punctuationSpacingPattern, '$1')
    .replace(repeatedSentenceEndPattern, '$1')

  if (output.includes('"') || output.includes("'")) {
    output = output.replace(quotedTextPattern, (match) => `${match[0]}${match.slice(1, -1).trim()}${match.at(-1) ?? ''}`)
  }

  return output
    .replace(extraSpacesPattern, ' ')
    .replace(dotSpacingPattern, '. ')
    .replace(commaSpacingPattern, ', ')
    .replace(edgePunctuationPattern, '')
    .trim()
}

function cleanupDocument(text: string) {
  return text
    .replace(extraBlankLinesPattern, '\n\n')
    .replace(lineTrailingSpacePattern, '\n')
    .replace(lineLeadingSpacePattern, '\n')
    .trim()
}

export function toCaveman(input: string, options: Options = {}) {
  const rules = options.ultra ? ultraModeRules : standardRules
  const { text, restore } = protect(input)

  const shortened = text
    .split('\n')
    .map((line) => {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        return ''
      }

      const { prefix, content } = getMarkdownPrefix(line)
      const rewritten = cleanupLine(applyRules(content, rules))
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
  console.log('Usage: bun ./caveman.ts [--ultra] "text"')
  console.log('       bun ./caveman.ts [--ultra] --input input.txt [--output output.txt]')
  console.log('       bun ./caveman.ts --rules')
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
