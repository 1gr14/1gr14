import { expect, expectTypeOf, it, mock } from 'bun:test'

// Mock the browser opener so tests never launch anything. Record the URLs.
const opened: string[] = []
mock.module('open', () => ({
  default: async (url: string) => {
    opened.push(url)
  },
}))

const { links, openLink } = await import('./index.js')

it('every link is an https url', () => {
  for (const url of Object.values(links)) {
    expect(url).toMatch(/^https:\/\//)
  }
})

it('opens a link by name and returns its url', async () => {
  opened.length = 0
  const url = await openLink('site')
  expect(url).toBe(links.site)
  expect(opened).toEqual([links.site])
})

it('opens every channel', async () => {
  opened.length = 0
  for (const name of Object.keys(links) as Array<keyof typeof links>) {
    await openLink(name)
  }
  expect(opened).toEqual(Object.values(links))
})

// Type-level tests. Never called — `tsc` (and `tsgo`) check the body, nothing runs.
function assertTypes() {
  expectTypeOf(openLink).toEqualTypeOf<(name: keyof typeof links) => Promise<string>>()
  expectTypeOf(links.site).toBeString()
}

it('compile-time type assertions hold', () => {
  expect(typeof assertTypes).toBe('function') // referenced so tsc checks it; never invoked
})
