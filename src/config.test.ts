import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { configDir, deleteToken, getToken, resolveSite, setToken, siteEnvVar, tokenEnvVar } from './config.js'

const makeEnv = (): NodeJS.ProcessEnv => ({ XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), '1gr14-config-')) })

const site = 'https://example.test'

describe('configDir', () => {
  it('respects XDG_CONFIG_HOME', () => {
    const env = makeEnv()
    expect(configDir(env)).toBe(join(env.XDG_CONFIG_HOME!, '1gr14'))
  })

  it('defaults to ~/.config', () => {
    expect(configDir({})).toBe(join(homedir(), '.config', '1gr14'))
  })
})

describe('token store', () => {
  it('roundtrips a token per site', () => {
    const env = makeEnv()
    expect(getToken({ site, env })).toBe(null)
    setToken({ site, token: 'aaa', env })
    setToken({ site: 'https://other.test', token: 'bbb', env })
    expect(getToken({ site, env })).toBe('aaa')
    expect(getToken({ site: 'https://other.test', env })).toBe('bbb')
    expect(existsSync(join(configDir(env), 'auth.json'))).toBe(true)
  })

  it('deletes only the requested site and reports whether something was there', () => {
    const env = makeEnv()
    setToken({ site, token: 'aaa', env })
    setToken({ site: 'https://other.test', token: 'bbb', env })
    expect(deleteToken({ site, env })).toBe(true)
    expect(deleteToken({ site, env })).toBe(false)
    expect(getToken({ site, env })).toBe(null)
    expect(getToken({ site: 'https://other.test', env })).toBe('bbb')
  })

  it('prefers the env var over the stored token', () => {
    const env = makeEnv()
    setToken({ site, token: 'stored', env })
    env[tokenEnvVar] = 'from-env'
    expect(getToken({ site, env })).toBe('from-env')
  })

  it('survives a corrupt auth file', () => {
    const env = makeEnv()
    setToken({ site, token: 'aaa', env })
    expect(getToken({ site: 'https://missing.test', env })).toBe(null)
  })
})

describe('resolveSite', () => {
  it('defaults to the production site', () => {
    expect(resolveSite({ env: {} })).toBe('https://1gr14.dev')
  })

  it('prefers the explicit value, then the env var', () => {
    const env: NodeJS.ProcessEnv = { [siteEnvVar]: 'http://localhost:3000' }
    expect(resolveSite({ env })).toBe('http://localhost:3000')
    expect(resolveSite({ site: 'https://explicit.test', env })).toBe('https://explicit.test')
  })

  it('strips trailing slashes', () => {
    expect(resolveSite({ site: 'https://example.test//', env: {} })).toBe('https://example.test')
  })
})
