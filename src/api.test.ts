import { describe, expect, it } from 'bun:test'
import {
  ApiError,
  CLIENT_ID,
  downloadRepoArchive,
  exchangeApiKey,
  getSession,
  pollDeviceToken,
  requestDeviceCode,
  revokeApiKey,
  type FetchLike,
} from './api.js'

const site = 'https://example.test'

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

/** A fetch stub that pops queued responses and records every request. */
const makeFetch = (responses: Response[]) => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const fetchFn: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init })
    const response = responses.shift()
    if (!response) {
      throw new Error('fetch stub ran out of responses')
    }
    return response
  }
  return { fetchFn, calls }
}

const noSleep = async () => {}

describe('requestDeviceCode', () => {
  it('posts the client id and returns the code pair', async () => {
    const { fetchFn, calls } = makeFetch([
      jsonResponse(200, { device_code: 'dc', user_code: 'UC', verification_uri: 'u', interval: 5, expires_in: 1800 }),
    ])
    const result = await requestDeviceCode({ site, fetchFn })
    expect(result.device_code).toBe('dc')
    expect(calls[0].url).toBe(`${site}/api/auth/device/code`)
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ client_id: CLIENT_ID })
  })

  it('throws an ApiError with the server description', async () => {
    const { fetchFn } = makeFetch([
      jsonResponse(400, { error: 'invalid_client', error_description: 'Invalid client ID' }),
    ])
    expect(requestDeviceCode({ site, fetchFn })).rejects.toThrow('Invalid client ID')
  })
})

describe('pollDeviceToken', () => {
  it('keeps polling through pending and slow_down, then resolves with the token', async () => {
    const { fetchFn, calls } = makeFetch([
      jsonResponse(400, { error: 'authorization_pending', error_description: 'pending' }),
      jsonResponse(400, { error: 'slow_down', error_description: 'slow down' }),
      jsonResponse(200, { access_token: 'token-123', token_type: 'Bearer' }),
    ])
    const slowedTo: number[] = []
    const token = await pollDeviceToken({
      site,
      deviceCode: 'dc',
      intervalSeconds: 0,
      fetchFn,
      sleepFn: noSleep,
      onSlowDown: (seconds) => slowedTo.push(seconds),
    })
    expect(token).toBe('token-123')
    expect(calls.length).toBe(3)
    expect(slowedTo).toEqual([5])
  })

  it('rejects when the user denies', async () => {
    const { fetchFn } = makeFetch([jsonResponse(400, { error: 'access_denied', error_description: 'denied' })])
    expect(pollDeviceToken({ site, deviceCode: 'dc', intervalSeconds: 0, fetchFn, sleepFn: noSleep })).rejects.toThrow(
      'denied',
    )
  })

  it('rejects with a timeout after the deadline', async () => {
    const { fetchFn } = makeFetch([])
    expect(pollDeviceToken({ site, deviceCode: 'dc', expiresInSeconds: 0, fetchFn, sleepFn: noSleep })).rejects.toThrow(
      'Timed out',
    )
  })
})

describe('getSession', () => {
  it('returns the user', async () => {
    const { fetchFn, calls } = makeFetch([jsonResponse(200, { user: { email: 'a@b.c', name: 'A' } })])
    const user = await getSession({ site, apiKey: 'k', fetchFn })
    expect(user?.email).toBe('a@b.c')
    expect(new Headers(calls[0].init?.headers).get('x-api-key')).toBe('k')
  })

  it('returns null when there is no session', async () => {
    const { fetchFn } = makeFetch([jsonResponse(200, null)])
    expect(await getSession({ site, apiKey: 'k', fetchFn })).toBe(null)
  })
})

describe('exchangeApiKey', () => {
  it('trades the device session for an api key', async () => {
    const { fetchFn, calls } = makeFetch([jsonResponse(200, { api_key: 's_1gr14_abc' })])
    const apiKey = await exchangeApiKey({ site, token: 't', client: CLIENT_ID, name: 'My Mac', fetchFn })
    expect(apiKey).toBe('s_1gr14_abc')
    const url = new URL(calls[0].url)
    expect(url.pathname).toBe('/api/api-key/exchange')
    expect(url.searchParams.get('client')).toBe(CLIENT_ID)
    expect(url.searchParams.get('name')).toBe('My Mac')
    expect(calls[0].init?.method).toBe('POST')
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe('Bearer t')
  })
})

describe('revokeApiKey', () => {
  it('posts the key and tolerates an already-dead one', async () => {
    const { fetchFn, calls } = makeFetch([jsonResponse(200, { revoked: true }), jsonResponse(401, {})])
    await revokeApiKey({ site, apiKey: 'k', fetchFn })
    expect(new URL(calls[0].url).pathname).toBe('/api/api-key/revoke')
    expect(new Headers(calls[0].init?.headers).get('x-api-key')).toBe('k')
    await revokeApiKey({ site, apiKey: 'k', fetchFn })
  })
})

describe('downloadRepoArchive', () => {
  it('parses an AppError-shaped error body', async () => {
    const { fetchFn } = makeFetch([
      jsonResponse(403, { error: { message: 'Only for users with active subscription', code: 'UNSUBSCRIBED' } }),
    ])
    try {
      await downloadRepoArchive({ site, apiKey: 'k', repo: 'start0', fetchFn })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe('UNSUBSCRIBED')
      expect((error as ApiError).status).toBe(403)
      expect((error as ApiError).message).toBe('Only for users with active subscription')
    }
  })

  it('requests the tgz with auth and reads the version headers', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const { fetchFn, calls } = makeFetch([
      new Response(bytes, { status: 200, headers: { 'x-repo-ref': 'v0.1.0', 'x-repo-tag': 'v0.1.0' } }),
    ])
    const archive = await downloadRepoArchive({ site, apiKey: 'k', repo: 'start0', ref: 'v0.1.0', fetchFn })
    expect(new Uint8Array(archive.data)).toEqual(bytes)
    expect(archive.ref).toBe('v0.1.0')
    expect(archive.tag).toBe('v0.1.0')
    const url = new URL(calls[0].url)
    expect(url.pathname).toBe('/api/github/archive')
    expect(url.searchParams.get('repo')).toBe('start0')
    expect(url.searchParams.get('format')).toBe('tgz')
    expect(url.searchParams.get('ref')).toBe('v0.1.0')
    expect(new Headers(calls[0].init?.headers).get('x-api-key')).toBe('k')
  })
})
