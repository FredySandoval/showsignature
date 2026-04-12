import { describe, expect, test } from 'bun:test'

import { toCaveman } from './experiment_1.js'

describe('toCaveman', () => {
  test('removes articles and filler', () => {
    expect(toCaveman('The API returns a token.')).toBe('API returns token')
  })

  test('splits because into fragments', () => {
    expect(toCaveman('The frontend is slow because it renders all tasks at once.')).toBe(
      'frontend is slow. it renders all tasks at once',
    )
  })

  test('keeps technical tokens', () => {
    expect(toCaveman('You should run `npm run test` in /src/app.ts with NODE_ENV=v1.2.3.')).toBe(
      'run `npm run test` in /src/app.ts with NODE_ENV=v1.2.3',
    )
  })

  test('make sure survives sure removal', () => {
    expect(toCaveman('You should make sure to run tests before pushing.')).toBe(
      'ensure run tests before pushing',
    )
  })

  test('keeps markdown syntax but compresses bullet text', () => {
    const input = '- The guide is basically here: [The API Guide](https://example.com/docs).'
    expect(toCaveman(input)).toBe('- guide is here: [The API Guide](https://example.com/docs)')
  })

  test('keeps markdown heading marker but compresses heading text', () => {
    expect(toCaveman('# The API Guide')).toBe('# API Guide')
  })

  test('protects quoted errors', () => {
    expect(toCaveman('The build failed with "TypeError: Cannot read properties of undefined" because config is missing.')).toBe(
      'build failed with "TypeError: Cannot read properties of undefined". config is missing',
    )
  })

  test('does not protect normal quoted text', () => {
    expect(toCaveman('The label is "the simple guide" and it is basically fine.')).toBe(
      'label is "simple guide" and it is fine',
    )
  })

  test('ultra mode uses arrow', () => {
    expect(toCaveman('New object reference causes re-render.', { ultra: true })).toBe(
      'New object reference → re-render',
    )
  })

  test('preserves inline code without placeholder leaks', () => {
    expect(toCaveman('Use `NODE_ENV` and /src/app.ts.', { ultra: true })).toBe(
      'Use `NODE_ENV` /src/app.ts.',
    )
  })

  test('compresses blockquotes without breaking markdown marker', () => {
    expect(toCaveman('> The API is basically slow because it renders everything.')).toBe(
      '> API is slow. it renders everything',
    )
  })

  test('removes intensifiers and extra hedging', () => {
    expect(toCaveman('The API is very slow and probably unstable.')).toBe('API is slow and unstable')
  })

  test('rewrites stronger instruction wrappers', () => {
    expect(toCaveman('You need to run tests.')).toBe('must run tests')
  })

  test('rewrites verbose phrases', () => {
    expect(toCaveman('In the event that the build fails, restart service.')).toBe(
      'if build fails, restart service',
    )
  })

  test('rewrites ability phrases', () => {
    expect(toCaveman('Service is able to retry and has the ability to recover.')).toBe(
      'Service can retry and can recover',
    )
  })

  test('drops weak determiners in common phrases', () => {
    expect(toCaveman('This issue happens after deploy.')).toBe('issue happens after deploy')
  })

  test('removes support-chat politeness fluff', () => {
    expect(toCaveman('Thanks, I am happy to help. Hope that helps.')).toBe('I am help')
  })

  test('rewrites negation phrases', () => {
    expect(toCaveman('Client does not have token and service is not able to retry.')).toBe(
      'Client lacks token and service cannot retry',
    )
  })

  test('rewrites optional phrase', () => {
    expect(toCaveman('This step is not necessary.')).toBe('This step optional')
  })

  test('ultra mode rewrites more causal phrases', () => {
    expect(toCaveman('State update leads to re-render and cache miss results in retry.', { ultra: true })).toBe(
      'State update → re-render cache miss → retry',
    )
  })
})
