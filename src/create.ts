import * as p from '@clack/prompts'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type FetchLike } from './api.js'
import { resolveSite } from './config.js'
import { downloadTemplate, extractTemplate } from './template.js'

/** Whether an executable answers `--version` — the portable way to probe for `git` and `bun`. */
export const hasCommand = (command: string): boolean => {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0
}

/** Throws when the target directory exists and already has files in it (`.DS_Store` litter doesn't count). */
export const assertTargetDir = (dir: string): void => {
  if (!existsSync(dir)) {
    return
  }
  const entries = readdirSync(dir).filter((name) => name !== '.DS_Store')
  if (entries.length > 0) {
    throw new Error(`Directory "${dir}" already exists and is not empty`)
  }
}

/**
 * Record which template version the app was created from — `{ "<template>": { "version": "v1.2.3" } }` in
 * `package.json`. The update flow diffs `<template>@<this-version>..latest` to see what the app missed.
 *
 * @returns `false` when the unpacked template has no `package.json` to mark.
 */
export const writeVersionMarker = ({
  dir,
  template,
  version,
}: {
  dir: string
  template: string
  version: string
}): boolean => {
  const file = join(dir, 'package.json')
  if (!existsSync(file)) {
    return false
  }
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  pkg[template] = { version }
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
  return true
}

const templateHasInitScript = (dir: string): boolean => {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    return typeof pkg.scripts?.init === 'string'
  } catch {
    return false
  }
}

/**
 * The `create` engine: sign in if needed, download a template repo archive from the 1gr14 site, unpack it, `git init`,
 * record the version marker, and hand over to the template's own `init` script. `create-start0` calls this with the
 * template pinned; the CLI exposes it as `1gr14 create`.
 */
export const runCreate = async ({
  template = 'start0',
  dir,
  site: siteInput,
  ref,
  fetchFn,
}: {
  template?: string
  dir?: string
  site?: string
  ref?: string
  fetchFn?: FetchLike
} = {}): Promise<void> => {
  const site = resolveSite({ site: siteInput })
  p.intro(`1gr14 create ${template}`)

  // No TTY (CI, piped runs): never block on prompts — require the dir and skip the init handover.
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)

  let dirInput = dir
  if (!dirInput) {
    if (!interactive) {
      throw new Error('No TTY — pass the target directory explicitly')
    }
    const answer = await p.text({
      message: 'Where to create the app? (`.` — right here)',
      placeholder: '.',
      defaultValue: '.',
    })
    if (p.isCancel(answer)) {
      p.cancel('Cancelled')
      process.exit(1)
    }
    dirInput = answer
  }
  const target = resolve(dirInput)
  assertTargetDir(target)

  const spinner = p.spinner()
  spinner.start(`Downloading ${template}…`)
  const archive = await downloadTemplate({ site, template, ref, fetchFn, spinner })

  spinner.message('Extracting…')
  await extractTemplate({ data: archive.data, target })

  const version = archive.version
  if (version) {
    writeVersionMarker({ dir: target, template, version })
  }
  if (hasCommand('git') && !existsSync(join(target, '.git'))) {
    spawnSync('git', ['init', '--quiet'], { cwd: target, stdio: 'ignore' })
  }
  spinner.stop(`Created ${dirInput}${version ? ` from ${template} ${version}` : ''}`)

  const nextSteps = `${dirInput === '.' ? '' : `cd ${dirInput}\n`}bun run init`
  if (!templateHasInitScript(target)) {
    p.note(`cd ${dirInput}`, 'Next steps')
  } else if (!hasCommand('bun')) {
    p.note(nextSteps, 'Next steps (requires Bun: https://bun.sh)')
  } else if (!interactive) {
    p.note(nextSteps, 'Next steps')
  } else {
    const runNow = await p.confirm({ message: `Run the ${template} init script now?`, initialValue: true })
    if (p.isCancel(runNow) || !runNow) {
      p.note(nextSteps, 'Next steps')
    } else {
      p.log.step('bun run init')
      const result = spawnSync('bun', ['run', 'init'], { cwd: target, stdio: 'inherit' })
      if (result.status !== 0) {
        p.log.warn(`Init exited with code ${String(result.status)} — rerun it later: bun run init`)
      }
    }
  }

  p.outro('Happy hacking! ♥')
}
