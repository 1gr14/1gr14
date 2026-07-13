import * as p from '@clack/prompts'
import { hostname } from 'node:os'
import launch from 'open'
import {
  CLIENT_ID,
  exchangeApiKey,
  getSession,
  pollDeviceToken,
  requestDeviceCode,
  signOutRemote,
  type FetchLike,
  type SessionUser,
} from './api.js'
import { setApiKey } from './config.js'

/**
 * Interactive device-flow sign-in: shows the user code, opens the verification page in the browser, polls until the
 * user approves, then exchanges the short-lived session for a long-lived API key (named after this machine) and stores
 * it for the site. The session dies in the exchange — the key is the only credential that remains, and it can do
 * nothing but the 1gr14 tools' job. The caller owns `p.intro` / `p.outro` framing.
 *
 * @returns The API key (also persisted) and the signed-in user.
 */
export const runLogin = async ({
  site,
  openBrowser = true,
  fetchFn,
}: {
  site: string
  openBrowser?: boolean
  fetchFn?: FetchLike
}): Promise<{ apiKey: string; user: SessionUser | null }> => {
  const device = await requestDeviceCode({ site, fetchFn })
  p.note(`Code: ${device.user_code}\n${device.verification_uri_complete}`, 'Confirm this device in the browser')
  if (openBrowser) {
    try {
      await launch(device.verification_uri_complete)
    } catch {
      // No browser (SSH, CI) — the URL is printed above, the user can open it elsewhere.
    }
  }
  const spinner = p.spinner()
  spinner.start('Waiting for approval in the browser')
  try {
    const token = await pollDeviceToken({
      site,
      deviceCode: device.device_code,
      intervalSeconds: device.interval,
      expiresInSeconds: device.expires_in,
      onSlowDown: (seconds) => spinner.message(`Waiting for approval (checking every ${seconds}s)`),
      fetchFn,
    })
    spinner.message('Creating the API key')
    let apiKey: string
    try {
      apiKey = await exchangeApiKey({ site, token, client: CLIENT_ID, name: hostname().slice(0, 32), fetchFn })
    } catch (error) {
      await signOutRemote({ site, token, fetchFn }).catch(() => {
        // Best-effort: don't leave the device session alive when the exchange failed.
      })
      throw error
    }
    const user = await getSession({ site, apiKey, fetchFn })
    setApiKey({ site, apiKey })
    spinner.stop(user ? `Signed in as ${user.email}` : 'Signed in')
    return { apiKey, user }
  } catch (error) {
    spinner.error('Sign-in failed')
    throw error
  }
}
