import { describe, expect, it } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readVersionMarker, updateDiffFileName } from './update.js'

const makeDir = () => mkdtempSync(join(tmpdir(), '1gr14-update-test-'))

describe('readVersionMarker', () => {
  it('reads the template marker', () => {
    const dir = makeDir()
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-app', start0: { version: 'v0.3.0' } }))
    expect(readVersionMarker({ dir, template: 'start0' })).toBe('v0.3.0')
  })

  it('returns null when the marker (or package.json) is missing or empty', () => {
    const dir = makeDir()
    expect(readVersionMarker({ dir, template: 'start0' })).toBe(null)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-app' }))
    expect(readVersionMarker({ dir, template: 'start0' })).toBe(null)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ start0: { version: '  ' } }))
    expect(readVersionMarker({ dir, template: 'start0' })).toBe(null)
  })
})

describe('updateDiffFileName', () => {
  it('builds a filesystem-safe name', () => {
    expect(updateDiffFileName({ template: 'start0', from: 'v0.3.0', to: 'v0.5.0' })).toBe('start0-v0.3.0..v0.5.0.diff')
    expect(updateDiffFileName({ template: 'start0', from: 'feature/x', to: 'v1.0.0' })).toBe(
      'start0-feature-x..v1.0.0.diff',
    )
  })
})
