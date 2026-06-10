import * as p from '@clack/prompts'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extract } from 'tar'
import { ApiError, downloadRepoArchive, type FetchLike, type RepoArchive } from './api.js'
import { deleteToken, getToken } from './config.js'
import { runLogin } from './login.js'

/** The stored token for the site, or a fresh one via the interactive device-flow sign-in. */
export const ensureToken = async ({ site, fetchFn }: { site: string; fetchFn?: FetchLike }): Promise<string> => {
  const token = getToken({ site })
  if (token) {
    return token
  }
  p.log.info('Sign in first — the browser will ask you to approve this device.')
  return (await runLogin({ site, fetchFn })).token
}

export type TemplateArchive = RepoArchive & {
  /** What the archive actually is — the tag when released, the ref otherwise. */
  version: string | null
}

/**
 * Download a template archive from the site, signing in when needed: missing token → device-flow login; stale token
 * (the session can expire server-side) → forget it and sign in again, once. The shared first step of `create`,
 * `download`, and `update`.
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
  let token = await ensureToken({ site, fetchFn })
  let archive: RepoArchive
  try {
    archive = await downloadRepoArchive({ site, token, repo: template, ref, fetchFn })
  } catch (error) {
    const unauthorized = error instanceof ApiError && (error.status === 401 || error.code === 'UNAUTHORIZED')
    if (!unauthorized) {
      throw error
    }
    spinner?.error('Session expired — sign in again')
    deleteToken({ site })
    token = (await runLogin({ site, fetchFn })).token
    spinner?.start(`Downloading ${template}…`)
    archive = await downloadRepoArchive({ site, token, repo: template, ref, fetchFn })
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
