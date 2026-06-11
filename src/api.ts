import { setTimeout as sleep } from 'node:timers/promises'

/** The OAuth client id this CLI identifies as — the site's device-authorization plugin allow-lists it. */
export const CLIENT_ID = '1gr14-cli'

const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'

/** Minimal fetch shape the API helpers need — swap it in tests. */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

/** An error response from the 1gr14 site (or GitHub via the site), with the HTTP status and the server's error code. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(message: string, { status, code }: { status: number; code?: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// The site answers with serialized AppError ({ error: { message, code } } or flat), better-auth with OAuth-style
// { error, error_description }. Pick the human message and the machine code out of whichever arrived.
const parseError = async (response: Response): Promise<ApiError> => {
  const text = await response.text().catch(() => '')
  let message = text || `HTTP ${response.status}`
  let code: string | undefined
  try {
    const json = JSON.parse(text) as Record<string, unknown>
    const nested =
      typeof json.error === 'object' && json.error !== null ? (json.error as Record<string, unknown>) : json
    if (typeof nested.message === 'string') {
      message = nested.message
    } else if (typeof json.error_description === 'string') {
      message = json.error_description
    }
    if (typeof nested.code === 'string') {
      code = nested.code
    } else if (typeof json.error === 'string') {
      code = json.error
    }
  } catch {
    // Plain-text error body — keep it as the message.
  }
  return new ApiError(message, { status: response.status, code })
}

const jsonInit = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

// The short-lived device-flow session goes in `Authorization`; the long-lived API key in `x-api-key`. The site gates
// each to its own few endpoints.
const bearerHeaders = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` })
const apiKeyHeaders = (apiKey: string): Record<string, string> => ({ 'x-api-key': apiKey })

export type DeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

/**
 * Step 1 of the device flow ([RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628)): get a code pair to show the
 * user.
 */
export const requestDeviceCode = async ({
  site,
  fetchFn = fetch,
}: {
  site: string
  fetchFn?: FetchLike
}): Promise<DeviceCodeResponse> => {
  const response = await fetchFn(`${site}/api/auth/device/code`, jsonInit({ client_id: CLIENT_ID }))
  if (!response.ok) {
    throw await parseError(response)
  }
  return (await response.json()) as DeviceCodeResponse
}

/**
 * Step 2 of the device flow: poll until the user approves in the browser, then resolve with the access token. Respects
 * the server's `slow_down` backpressure; rejects on denial, expiry, or the deadline.
 */
export const pollDeviceToken = async ({
  site,
  deviceCode,
  intervalSeconds = 5,
  expiresInSeconds = 1800,
  onSlowDown,
  fetchFn = fetch,
  sleepFn = sleep,
}: {
  site: string
  deviceCode: string
  intervalSeconds?: number
  expiresInSeconds?: number
  onSlowDown?: (nextIntervalSeconds: number) => void
  fetchFn?: FetchLike
  sleepFn?: (ms: number) => Promise<unknown>
}): Promise<string> => {
  const deadline = Date.now() + expiresInSeconds * 1000
  let interval = intervalSeconds
  while (Date.now() < deadline) {
    await sleepFn(interval * 1000)
    const response = await fetchFn(
      `${site}/api/auth/device/token`,
      jsonInit({ grant_type: DEVICE_GRANT_TYPE, device_code: deviceCode, client_id: CLIENT_ID }),
    )
    if (response.ok) {
      const data = (await response.json()) as { access_token: string }
      return data.access_token
    }
    const error = await parseError(response)
    if (error.code === 'authorization_pending') {
      continue
    }
    if (error.code === 'slow_down') {
      interval += 5
      onSlowDown?.(interval)
      continue
    }
    throw error
  }
  throw new ApiError('Timed out waiting for the device to be approved', { status: 408 })
}

export type SessionUser = { email: string; name: string }

/** The user behind an API key, or `null` when the key no longer maps to a user. */
export const getSession = async ({
  site,
  apiKey,
  fetchFn = fetch,
}: {
  site: string
  apiKey: string
  fetchFn?: FetchLike
}): Promise<SessionUser | null> => {
  const response = await fetchFn(`${site}/api/auth/get-session`, { headers: apiKeyHeaders(apiKey) })
  if (!response.ok) {
    throw await parseError(response)
  }
  const data = (await response.json()) as { user?: SessionUser } | null
  return data?.user ?? null
}

/**
 * Exchange the short-lived device-flow session for the long-lived API key the CLI stores — the last step of `1gr14
 * login`. The site revokes the session on the way out, so the key is the only credential that remains.
 */
export const exchangeApiKey = async ({
  site,
  token,
  client,
  name,
  fetchFn = fetch,
}: {
  site: string
  /** The device-flow session token — consumed by the exchange. */
  token: string
  /** The registered client id this key is for (the device-flow `client_id`). */
  client: string
  /** Key name shown on the site, e.g. this machine's hostname. */
  name?: string
  fetchFn?: FetchLike
}): Promise<string> => {
  const url = new URL(`${site}/api/api-key/exchange`)
  url.searchParams.set('client', client)
  if (name) {
    url.searchParams.set('name', name)
  }
  const response = await fetchFn(url, { method: 'POST', headers: bearerHeaders(token) })
  if (!response.ok) {
    throw await parseError(response)
  }
  const data = (await response.json()) as { api_key: string }
  return data.api_key
}

/** Revoke an API key on the server — `1gr14 logout`. A 401 means it is already dead — not an error for sign-out. */
export const revokeApiKey = async ({
  site,
  apiKey,
  fetchFn = fetch,
}: {
  site: string
  apiKey: string
  fetchFn?: FetchLike
}): Promise<void> => {
  const response = await fetchFn(`${site}/api/api-key/revoke`, { method: 'POST', headers: apiKeyHeaders(apiKey) })
  if (!response.ok && response.status !== 401) {
    throw await parseError(response)
  }
}

/** Revoke the device-flow session behind a token — cleanup for a failed exchange. A 401 means it is already gone. */
export const signOutRemote = async ({
  site,
  token,
  fetchFn = fetch,
}: {
  site: string
  token: string
  fetchFn?: FetchLike
}): Promise<void> => {
  const response = await fetchFn(`${site}/api/auth/sign-out`, {
    ...jsonInit({}),
    headers: { 'content-type': 'application/json', ...bearerHeaders(token) },
  })
  if (!response.ok && response.status !== 401) {
    throw await parseError(response)
  }
}

export type RepoArchive = {
  data: ArrayBuffer
  /** Resolved from the `x-repo-ref` / `x-repo-tag` response headers. */
  ref: string | null
  tag: string | null
}

/** Download a template repo archive (gzipped tar) from the site. Requires an active subscription. */
export const downloadRepoArchive = async ({
  site,
  apiKey,
  repo,
  ref,
  fetchFn = fetch,
}: {
  site: string
  apiKey: string
  repo: string
  ref?: string
  fetchFn?: FetchLike
}): Promise<RepoArchive> => {
  const url = new URL(`${site}/api/github/archive`)
  url.searchParams.set('repo', repo)
  url.searchParams.set('format', 'tgz')
  if (ref) {
    url.searchParams.set('ref', ref)
  }
  const response = await fetchFn(url, { headers: apiKeyHeaders(apiKey) })
  if (!response.ok) {
    throw await parseError(response)
  }
  return {
    data: await response.arrayBuffer(),
    ref: response.headers.get('x-repo-ref'),
    tag: response.headers.get('x-repo-tag'),
  }
}
