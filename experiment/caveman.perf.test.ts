import { expect, test } from 'bun:test'

import { toCaveman } from './caveman'

const benchmarkCases = [
  { name: 'default', options: {} },
  { name: 'ultra', options: { ultra: true } },
] as const

function createBenchmarkInput() {
  const sample = [
    '# The API Guide',
    '- The guide is basically here: [The API Guide](https://example.com/docs).',
    '> The API is basically slow because it renders everything.',
    'You should run `npm run test` in /src/app.ts with NODE_ENV=v1.2.3.',
    'The build failed with "TypeError: Cannot read properties of undefined" because config is missing.',
    'In the event that the build fails, restart service.',
    'Service is able to retry and has the ability to recover.',
    'Thanks, I am happy to help. Hope that helps.',
    'Client does not have token and service is not able to retry.',
    'This step is not necessary.',
    'State update leads to re-render and cache miss results in retry.',
    '```ts\nconst value = process.env.NODE_ENV\n```',
  ].join('\n')

  return Array.from({ length: 400 }, () => sample).join('\n\n')
}

function getIterations() {
  const value = Number(process.env.CAVEMAN_BENCH_ITERATIONS ?? '80')
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 80
}

function formatNumber(value: number) {
  return Number(value.toFixed(3))
}

function runBenchmark(input: string, options: Parameters<typeof toCaveman>[1], iterations: number) {
  let checksum = 0

  for (let index = 0; index < 20; index += 1) {
    checksum += toCaveman(input, options).length
  }

  const started = performance.now()

  for (let index = 0; index < iterations; index += 1) {
    checksum += toCaveman(input, options).length
  }

  const totalMs = performance.now() - started

  return {
    totalMs,
    averageMs: totalMs / iterations,
    checksum,
  }
}

test('toCaveman benchmark', () => {
  const input = createBenchmarkInput()
  const iterations = getIterations()
  const results = benchmarkCases.map((entry) => ({
    name: entry.name,
    ...runBenchmark(input, entry.options, iterations),
  }))

  console.log(
    JSON.stringify(
      {
        benchmark: 'toCaveman',
        iterations,
        inputLength: input.length,
        results: results.map((entry) => ({
          name: entry.name,
          totalMs: formatNumber(entry.totalMs),
          averageMs: formatNumber(entry.averageMs),
          checksum: entry.checksum,
        })),
      },
      null,
      2,
    ),
  )

  for (const entry of results) {
    expect(entry.checksum).toBeGreaterThan(0)
  }
})
