import * as p from '@clack/prompts'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type FetchLike } from './api.js'
import { resolveSite } from './config.js'
import { downloadTemplate, ensureApiKey, extractTemplate } from './template.js'

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
 * and hand over to the template's own `init` script. `create-start0` calls this with the template pinned; the CLI
 * exposes it as `1gr14 create`. The version marker (`"<template>": { "version" }`) ships inside the template's own
 * `package.json`, stamped at release — nothing to write here.
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

  // Signing in prints its own notes and runs its own spinner — get it done before ours starts.
  await ensureApiKey({ site, fetchFn })

  const spinner = p.spinner()
  spinner.start(`Downloading ${template}…`)
  try {
    const archive = await downloadTemplate({ site, template, ref, fetchFn, spinner })

    spinner.message('Extracting…')
    await extractTemplate({ data: archive.data, target })

    if (hasCommand('git') && !existsSync(join(target, '.git'))) {
      spawnSync('git', ['init', '--quiet'], { cwd: target, stdio: 'ignore' })
    }
    spinner.stop(`Created ${dirInput}${archive.version ? ` from ${template} ${archive.version}` : ''}`)
  } catch (error) {
    spinner.error('Failed')
    throw error
  }

  let initRan = false
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
      // The template's init runs from inside `target`, so it can't see our shell's cwd (the app's parent). Hand it the
      // directory the user typed so its closing "Next steps" can tell them to `cd` in — see start0's init/steps.ts.
      const result = spawnSync('bun', ['run', 'init'], {
        cwd: target,
        stdio: 'inherit',
        env: { ...process.env, S_1GR14_CREATE_DIR: dirInput },
      })
      if (result.status !== 0) {
        p.log.warn(`Init exited with code ${String(result.status)} — rerun it later: bun run init`)
      } else {
        initRan = true
      }
    }
  }

  // When the init script ran, it printed its own closing message — don't stack a second outro on top of it.
  if (!initRan) {
    p.outro('Happy hacking! ♥')
  }
}
