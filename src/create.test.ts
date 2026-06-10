import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertTargetDir, hasCommand, writeVersionMarker } from './create.js'

const makeDir = () => mkdtempSync(join(tmpdir(), '1gr14-create-'))

describe('assertTargetDir', () => {
  it('accepts a missing directory', () => {
    expect(() => assertTargetDir(join(makeDir(), 'fresh'))).not.toThrow()
  })

  it('accepts an empty directory (and .DS_Store litter)', () => {
    const dir = makeDir()
    expect(() => assertTargetDir(dir)).not.toThrow()
    writeFileSync(join(dir, '.DS_Store'), '')
    expect(() => assertTargetDir(dir)).not.toThrow()
  })

  it('rejects a directory with files', () => {
    const dir = makeDir()
    mkdirSync(join(dir, 'src'))
    expect(() => assertTargetDir(dir)).toThrow('not empty')
  })
})

describe('writeVersionMarker', () => {
  it('writes the template version into package.json', () => {
    const dir = makeDir()
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-app' }, null, 2) + '\n')
    expect(writeVersionMarker({ dir, template: 'start0', version: 'v0.1.0' })).toBe(true)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>
    expect(pkg).toEqual({ name: 'my-app', start0: { version: 'v0.1.0' } })
  })

  it('reports false when the template has no package.json', () => {
    expect(writeVersionMarker({ dir: makeDir(), template: 'start0', version: 'v0.1.0' })).toBe(false)
  })
})

describe('hasCommand', () => {
  it('finds git and rejects nonsense', () => {
    expect(hasCommand('git')).toBe(true)
    expect(hasCommand('definitely-not-a-real-command-1gr14')).toBe(false)
  })
})
