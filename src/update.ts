import * as p from '@clack/prompts'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type FetchLike } from './api.js'
import { resolveSite } from './config.js'
import { hasCommand } from './create.js'
import { downloadTemplate, ensureApiKey, extractTemplate } from './template.js'

/**
 * The template version an app was created from — `package.json` → `"<template>": { "version": "..." }`, or `null`. The
 * marker ships inside the template's own `package.json` (stamped at release), so every copy carries it from day one.
 */
export const readVersionMarker = ({ dir, template }: { dir: string; template: string }): string | null => {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<
      string,
      { version?: unknown } | undefined
    >
    const version = pkg[template]?.version
    return typeof version === 'string' && version.trim() ? version : null
  } catch {
    return null
  }
}

const safeRef = (ref: string): string => ref.replace(/[^\w.-]/g, '-')

/** The diff file `update` writes into the app folder, e.g. `start0-v0.3.0..v0.5.0.diff`. */
export const updateDiffFileName = ({ template, from, to }: { template: string; from: string; to: string }): string =>
  `${template}-${safeRef(from)}..${safeRef(to)}.diff`

/**
 * The `update` engine: figure out which template version the app was created from (the `package.json` marker), download
 * that version and the latest one, and write their diff — the diff of the boilerplate against itself, the app's own
 * changes don't matter — into the app folder for an agent to apply. See the template's `docs/updating.md`.
 *
 * @returns The written diff file, or `null` when already up to date.
 */
export const runUpdate = async ({
  template = 'start0',
  from,
  to,
  site: siteInput,
  cwd = process.cwd(),
  fetchFn,
}: {
  template?: string
  /** Override the version to diff from — defaults to the `package.json` marker. */
  from?: string
  /** Override the version to diff to — defaults to the latest release. */
  to?: string
  site?: string
  cwd?: string
  fetchFn?: FetchLike
} = {}): Promise<{ diffFile: string; from: string; to: string } | null> => {
  const site = resolveSite({ site: siteInput })
  p.intro(`1gr14 update ${template}`)

  if (!existsSync(join(cwd, 'package.json'))) {
    throw new Error('No package.json here — run `1gr14 update` inside your app folder')
  }
  const fromRef = from ?? readVersionMarker({ dir: cwd, template })
  if (!fromRef) {
    throw new Error(
      `Can't tell which ${template} version this app was created from: package.json has no ` +
        `"${template}": { "version": ... } marker. Add it, or pass --from <ref>.`,
    )
  }
  if (!hasCommand('git')) {
    throw new Error('git is required to build the diff — install it and rerun')
  }

  // Signing in prints its own notes and runs its own spinner — get it done before ours starts.
  await ensureApiKey({ site, fetchFn })

  const spinner = p.spinner()
  spinner.start(`Downloading the latest ${template}`)
  try {
    const fresh = await downloadTemplate({ site, template, ref: to, fetchFn, spinner })
    const toRef = fresh.version ?? to ?? 'latest'
    if (toRef === fromRef) {
      spinner.stop(`Already up to date — ${template} ${toRef}`)
      p.outro('Nothing to apply')
      return null
    }

    spinner.message(`Downloading your ${template} (${fromRef})`)
    const base = await downloadTemplate({ site, template, ref: fromRef, fetchFn, spinner })

    spinner.message('Diffing')
    const tmp = mkdtempSync(join(tmpdir(), '1gr14-update-'))
    let diff: string
    try {
      // Extracted as `a` and `b` and diffed from their parent with empty prefixes, so the dir names become the
      // standard `a/... b/...` patch prefixes and `git apply -p1` semantics just work.
      await extractTemplate({ data: base.data, target: join(tmp, 'a') })
      await extractTemplate({ data: fresh.data, target: join(tmp, 'b') })
      const result = spawnSync(
        'git',
        ['-c', 'core.quotepath=false', 'diff', '--no-index', '--src-prefix=', '--dst-prefix=', 'a', 'b'],
        {
          cwd: tmp,
          encoding: 'utf8',
          maxBuffer: 256 * 1024 * 1024,
        },
      )
      // --no-index exits 1 when the trees differ — that's the expected case, not an error.
      if (result.status !== 0 && result.status !== 1) {
        throw new Error(`git diff failed${result.stderr ? `\n${result.stderr}` : ''}`)
      }
      diff = result.stdout
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }

    if (!diff.trim()) {
      spinner.stop(`No content changes between ${fromRef} and ${toRef}`)
      p.outro('Nothing to apply')
      return null
    }

    const diffFile = updateDiffFileName({ template, from: fromRef, to: toRef })
    writeFileSync(join(cwd, diffFile), diff)
    spinner.stop(`Diff ready: ${diffFile} (${template} ${fromRef} → ${toRef})`)

    const prompt = [
      `My app was created from ${template} ${fromRef}.`,
      `The file ${diffFile} is the diff of the boilerplate itself`,
      `up to ${toRef} (CHANGELOG.md entries included). Go change by change:`,
      `apply what's relevant to this app, adapt renamed pieces to our names,`,
      `skip what we removed on purpose and list every skip with a reason.`,
      `The diff itself bumps package.json "${template}" to "${toRef}" — make`,
      `sure that lands. Finish by deleting ${diffFile}.`,
    ].join('\n')
    p.note(prompt, 'Hand this to your agent')
    p.outro('Happy updating! ♥')
    return { diffFile, from: fromRef, to: toRef }
  } catch (error) {
    spinner.error('Failed')
    throw error
  }
}
