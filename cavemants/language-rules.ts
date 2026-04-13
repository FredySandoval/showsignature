import type { Rule, ProtectEntry } from './caveman.js'

export const protectEntries: ProtectEntry[] = [
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

export const baseRules: Rule[] = [
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
    from: /\b(?:you need to|you have to|it is necessary to)\b/gi,
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
    from: /\bdue to(?:\s+the)?\s+fact that\b/gi,
    to: 'because',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\bin(?:\s+the)?\s+event that\b/gi,
    to: 'if',
    note: 'shorter phrase',
  },
  {
    kind: 'replace',
    from: /\b(?:is able to|has(?:\s+the)?\s+ability to)\b/gi,
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
    from: /\bthis (issue|problem|change)\b/gi,
    to: '$1',
    note: 'drop determiner',
  },
  {
    kind: 'replace',
    from: /\bbecause\b/gi,
    to: '. ',
    note: 'fragment split',
  },
]

export const ultraRules: Rule[] = [
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
  ['Pleasantries', 'remove', "sure, certainly, of course, happy to, I'd be happy to, I'd recommend, thanks, thank you, hope that helps"],
  ['Hedging', 'remove', 'likely, most likely, maybe, perhaps, I think, it seems, seems like, kind of, sort of, probably'],
  ['Hedging phrases', 'remove', 'it might be worth, you could consider, it would be good to'],
  ['Connective fluff', 'remove', 'however, furthermore, additionally, in addition, therefore, thus, moreover'],
  ['Soft wrappers', 'remove/replace', 'you should, remember to, make sure to → ensure, you need to → must'],
  ['Phrase rewrites', 'replace', 'in order to → to, due to the fact that → because, in the event that → if, the reason is because → because'],
  ['Word rewrites', 'replace', 'utilize → use, implement a solution for → fix, extensive → big, is able to → can, has the ability to → can, does not have → lacks, is not able to → cannot, this issue → issue'],
  ['Structure', 'rewrite', 'because → sentence split; ultra: cause/causes, leads to, results in → → and drop some conjunctions'],
  ['Protection', 'preserve', 'code blocks, inline code, markdown links/images, table rows, quoted errors, URLs, env vars, versions, file paths'],
] as const
