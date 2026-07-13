import * as p from '@clack/prompts'
import { resolve } from 'node:path'
import { type FetchLike } from './api.js'
import { resolveSite } from './config.js'
import { assertTargetDir } from './create.js'
import { downloadTemplate, ensureApiKey, extractTemplate } from './template.js'

/**
 * The `download` engine: fetch a template snapshot from the site and unpack it — nothing else. No git init, no version
 * marker, no init handover; that's `create`. This is the building block for side-by-side comparisons (`update` uses the
 * same internals) and for grabbing the source without starting an app.
 *
 * @returns The unpacked directory and the snapshot version.
 */
export const runDownload = async ({
  template = 'start0',
  dir,
  ref,
  site: siteInput,
  fetchFn,
}: {
  template?: string
  dir?: string
  ref?: string
  site?: string
  fetchFn?: FetchLike
} = {}): Promise<{ dir: string; version: string | null }> => {
  const site = resolveSite({ site: siteInput })
  p.intro(`1gr14 download ${template}`)

  // Signing in prints its own notes and runs its own spinner — get it done before ours starts.
  await ensureApiKey({ site, fetchFn })

  const spinner = p.spinner()
  spinner.start(`Downloading ${template}`)
  try {
    const archive = await downloadTemplate({ site, template, ref, fetchFn, spinner })
    // Defaulting the folder to the version keeps repeated snapshots side by side: start0-v0.3.0/, start0-v0.5.0/, ...
    const dirInput = dir ?? `${template}-${(archive.version ?? 'snapshot').replace(/[^\w.-]/g, '-')}`
    const target = resolve(dirInput)
    assertTargetDir(target)
    spinner.message('Extracting')
    await extractTemplate({ data: archive.data, target })
    spinner.stop(`Downloaded ${template}${archive.version ? ` ${archive.version}` : ''} into ${dirInput}`)

    p.note(`A raw snapshot — no git, no setup. Starting an app? That's \`1gr14 create ${template}\`.`, 'Note')
    p.outro('Done')
    return { dir: target, version: archive.version }
  } catch (error) {
    spinner.error('Failed')
    throw error
  }
}
