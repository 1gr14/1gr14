import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { links } from './links.js'

/**
 * Env var that overrides the stored API key — for CI and other headless runs. The `S_` prefix is the brand's second
 * spelling (`s_1gr14`, as in the social handles) — and conveniently a valid shell name, since a variable can't start
 * with a digit.
 */
export const apiKeyEnvVar = 'S_1GR14_API_KEY'

/** Env var that overrides the site URL — mainly for testing the CLI against a locally running site. */
export const siteEnvVar = 'S_1GR14_SITE_URL'

/** Where the CLI keeps its state: `$XDG_CONFIG_HOME/1gr14`, defaulting to `~/.config/1gr14`. */
export const configDir = (env: NodeJS.ProcessEnv = process.env): string => {
  const base = env.XDG_CONFIG_HOME?.trim() ? env.XDG_CONFIG_HOME : join(homedir(), '.config')
  return join(base, '1gr14')
}

const authFilePath = (env: NodeJS.ProcessEnv) => join(configDir(env), 'auth.json')

type AuthFile = { sites: Record<string, { apiKey: string }> }

const readAuthFile = (env: NodeJS.ProcessEnv): AuthFile => {
  try {
    const parsed = JSON.parse(readFileSync(authFilePath(env), 'utf8')) as { sites?: unknown }
    const sites = typeof parsed.sites === 'object' && parsed.sites !== null ? parsed.sites : {}
    return { sites: sites as AuthFile['sites'] }
  } catch {
    return { sites: {} }
  }
}

const writeAuthFile = (env: NodeJS.ProcessEnv, file: AuthFile): void => {
  mkdirSync(configDir(env), { recursive: true })
  const path = authFilePath(env)
  writeFileSync(path, JSON.stringify(file, null, 2) + '\n')
  try {
    chmodSync(path, 0o600)
  } catch {
    // Windows has no POSIX modes — the file still lands in the user profile.
  }
}

/**
 * The normalized site URL the CLI talks to: the explicit value, the {@link siteEnvVar} override, or `https://1gr14.dev`.
 * Trailing slashes are stripped so URLs can be safely concatenated.
 */
export const resolveSite = ({ site, env = process.env }: { site?: string; env?: NodeJS.ProcessEnv } = {}): string => {
  return (site ?? env[siteEnvVar] ?? links.site).replace(/\/+$/, '')
}

/** The stored API key for a site, with the {@link apiKeyEnvVar} env var taking precedence. `null` when signed out. */
export const getApiKey = ({ site, env = process.env }: { site: string; env?: NodeJS.ProcessEnv }): string | null => {
  const fromEnv = env[apiKeyEnvVar]?.trim()
  if (fromEnv) {
    return fromEnv
  }
  const sites = readAuthFile(env).sites
  return site in sites ? sites[site].apiKey : null
}

/** Persist an API key for a site (keys are kept per site, so a local dev site doesn't clobber production). */
export const setApiKey = ({
  site,
  apiKey,
  env = process.env,
}: {
  site: string
  apiKey: string
  env?: NodeJS.ProcessEnv
}): void => {
  const file = readAuthFile(env)
  file.sites[site] = { apiKey }
  writeAuthFile(env, file)
}

/**
 * Forget the stored API key for a site — local only, the key stays valid server-side (that's `revokeApiKey`). Returns
 * whether there was one.
 */
export const forgetApiKey = ({ site, env = process.env }: { site: string; env?: NodeJS.ProcessEnv }): boolean => {
  if (!existsSync(authFilePath(env))) {
    return false
  }
  const file = readAuthFile(env)
  if (!(site in file.sites)) {
    return false
  }
  delete file.sites[site]
  writeAuthFile(env, file)
  return true
}
