import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertTargetDir, hasCommand } from './create.js'

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

describe('hasCommand', () => {
  it('finds git and rejects nonsense', () => {
    expect(hasCommand('git')).toBe(true)
    expect(hasCommand('definitely-not-a-real-command-1gr14')).toBe(false)
  })
})
