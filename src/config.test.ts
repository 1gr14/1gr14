import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { apiKeyEnvVar, configDir, forgetApiKey, getApiKey, resolveSite, setApiKey, siteEnvVar } from './config.js'

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

describe('api key store', () => {
  it('roundtrips a key per site', () => {
    const env = makeEnv()
    expect(getApiKey({ site, env })).toBe(null)
    setApiKey({ site, apiKey: 'aaa', env })
    setApiKey({ site: 'https://other.test', apiKey: 'bbb', env })
    expect(getApiKey({ site, env })).toBe('aaa')
    expect(getApiKey({ site: 'https://other.test', env })).toBe('bbb')
    expect(existsSync(join(configDir(env), 'auth.json'))).toBe(true)
  })

  it('forgets only the requested site and reports whether something was there', () => {
    const env = makeEnv()
    setApiKey({ site, apiKey: 'aaa', env })
    setApiKey({ site: 'https://other.test', apiKey: 'bbb', env })
    expect(forgetApiKey({ site, env })).toBe(true)
    expect(forgetApiKey({ site, env })).toBe(false)
    expect(getApiKey({ site, env })).toBe(null)
    expect(getApiKey({ site: 'https://other.test', env })).toBe('bbb')
  })

  it('prefers the env var over the stored key', () => {
    const env = makeEnv()
    setApiKey({ site, apiKey: 'stored', env })
    env[apiKeyEnvVar] = 'from-env'
    expect(getApiKey({ site, env })).toBe('from-env')
  })

  it('survives a corrupt auth file', () => {
    const env = makeEnv()
    setApiKey({ site, apiKey: 'aaa', env })
    expect(getApiKey({ site: 'https://missing.test', env })).toBe(null)
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
