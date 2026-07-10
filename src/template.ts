import * as p from '@clack/prompts'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extract } from 'tar'
import { ApiError, downloadRepoArchive, type FetchLike, type RepoArchive } from './api.js'
import { forgetApiKey, getApiKey } from './config.js'
import { runLogin } from './login.js'

/** The stored API key for the site, or a fresh one via the interactive device-flow sign-in. */
export const ensureApiKey = async ({ site, fetchFn }: { site: string; fetchFn?: FetchLike }): Promise<string> => {
  const apiKey = getApiKey({ site })
  if (apiKey) {
    return apiKey
  }
  p.log.info('Sign in first — the browser will ask you to approve this device.')
  return (await runLogin({ site, fetchFn })).apiKey
}

export type TemplateArchive = RepoArchive & {
  /** What the archive actually is — the tag when released, the ref otherwise. */
  version: string | null
}

/**
 * Download a template archive from the site, signing in when needed: missing API key → device-flow login; dead key
 * (revoked server-side) → forget it and sign in again, once. The shared first step of `create`, `download`, and
 * `update`.
 *
 * A sign-in prints notes and runs a spinner of its own, so a caller that owns a spinner calls {@link ensureApiKey}
 * before starting it — by the time we get here the key is on disk, and only the dead-key path can log in again (it
 * stops `spinner` first).
 */
export const downloadTemplate = async ({
  site,
  template,
  ref,
  fetchFn,
  spinner,
}: {
  site: string
  template: string
  ref?: string
  fetchFn?: FetchLike
  spinner?: ReturnType<typeof p.spinner>
}): Promise<TemplateArchive> => {
  let apiKey = await ensureApiKey({ site, fetchFn })
  let archive: RepoArchive
  try {
    archive = await downloadRepoArchive({ site, apiKey, repo: template, ref, fetchFn })
  } catch (error) {
    const unauthorized = error instanceof ApiError && (error.status === 401 || error.code === 'UNAUTHORIZED')
    if (!unauthorized) {
      throw error
    }
    spinner?.error('The API key is no longer valid — sign in again')
    forgetApiKey({ site })
    apiKey = (await runLogin({ site, fetchFn })).apiKey
    spinner?.start(`Downloading ${template}…`)
    archive = await downloadRepoArchive({ site, apiKey, repo: template, ref, fetchFn })
  }
  return { ...archive, version: archive.tag ?? archive.ref }
}

/**
 * Unpack a downloaded template archive into a directory (created when missing). GitHub archives wrap everything in a
 * `<owner>-<repo>-<sha>/` folder — stripped here. node-tar, not the system binary, so extraction behaves the same on
 * macOS, Linux, and Windows.
 */
export const extractTemplate = async ({ data, target }: { data: ArrayBuffer; target: string }): Promise<void> => {
  const tmp = mkdtempSync(join(tmpdir(), '1gr14-'))
  try {
    const archiveFile = join(tmp, 'template.tar.gz')
    writeFileSync(archiveFile, Buffer.from(data))
    mkdirSync(target, { recursive: true })
    await extract({ file: archiveFile, cwd: target, strip: 1 })
  } catch (error) {
    throw new Error('Failed to extract the archive', { cause: error })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
