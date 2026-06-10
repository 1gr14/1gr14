import * as p from '@clack/prompts'
import launch from 'open'
import { getSession, pollDeviceToken, requestDeviceCode, type FetchLike, type SessionUser } from './api.js'
import { setToken } from './config.js'

/**
 * Interactive device-flow sign-in: shows the user code, opens the verification page in the browser, polls until the
 * user approves, and stores the received token for the site. The caller owns `p.intro` / `p.outro` framing.
 *
 * @returns The token (also persisted) and the signed-in user.
 */
export const runLogin = async ({
  site,
  openBrowser = true,
  fetchFn,
}: {
  site: string
  openBrowser?: boolean
  fetchFn?: FetchLike
}): Promise<{ token: string; user: SessionUser | null }> => {
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
  spinner.start('Waiting for approval in the browser…')
  try {
    const token = await pollDeviceToken({
      site,
      deviceCode: device.device_code,
      intervalSeconds: device.interval,
      expiresInSeconds: device.expires_in,
      onSlowDown: (seconds) => spinner.message(`Waiting for approval (checking every ${seconds}s)…`),
      fetchFn,
    })
    const user = await getSession({ site, token, fetchFn })
    setToken({ site, token })
    spinner.stop(user ? `Signed in as ${user.email}` : 'Signed in')
    return { token, user }
  } catch (error) {
    spinner.error('Sign-in failed')
    throw error
  }
}
