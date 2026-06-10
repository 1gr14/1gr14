#!/usr/bin/env node
import { Command } from 'commander'
import { createRequire } from 'node:module'
import { ApiError, getSession, signOutRemote } from './api.js'
import { deleteToken, getToken, resolveSite, tokenEnvVar } from './config.js'
import { runCreate } from './create.js'
import { runDownload } from './download.js'
import { links, openLink, type LinkName } from './links.js'
import { runLogin } from './login.js'
import { runUpdate } from './update.js'

// Read name/version/description from the installed package.json at runtime, so
// the published version is always correct (no value baked in at build time).
const pkg = createRequire(import.meta.url)('../package.json') as {
  version: string
  description: string
}

const linkNames = Object.keys(links) as LinkName[]

const fail = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nError: ${message}`)
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === 'UNAUTHORIZED') {
      console.error('Hint: sign in with `1gr14 login`.')
    }
    if (error.status === 403 || error.code === 'UNSUBSCRIBED') {
      console.error(`Hint: this needs an active subscription — ${links.site}/support`)
    }
  }
  process.exit(1)
}

const program = new Command()

program.name('1gr14').description(pkg.description).version(pkg.version, '-v, --version', 'print the version')

program
  .command('open')
  .description(`open a 1gr14 link in the browser: ${linkNames.join(', ')}`)
  .argument('[target]', 'which link to open', 'site')
  .action(async (target: string) => {
    if (!linkNames.includes(target as LinkName)) {
      console.error(`Unknown target "${target}". Use one of: ${linkNames.join(', ')}.`)
      process.exit(1)
    }
    const url = await openLink(target as LinkName)
    console.log(`Opening ${url}`)
  })

program
  .command('login')
  .description('sign in to the 1gr14 site from this machine')
  .option('--site <url>', 'site URL (defaults to https://1gr14.dev)')
  .action(async (options: { site?: string }) => {
    try {
      await runLogin({ site: resolveSite({ site: options.site }) })
    } catch (error) {
      fail(error)
    }
  })

program
  .command('logout')
  .description('sign out and forget the stored token')
  .option('--site <url>', 'site URL (defaults to https://1gr14.dev)')
  .action(async (options: { site?: string }) => {
    try {
      const site = resolveSite({ site: options.site })
      const token = getToken({ site })
      if (!token) {
        console.log('Not signed in.')
        return
      }
      await signOutRemote({ site, token }).catch(() => {
        // Revoking is best-effort — the local token is forgotten either way.
      })
      deleteToken({ site })
      if (process.env[tokenEnvVar]) {
        console.log(`Signed out. Note: ${tokenEnvVar} is set and still takes precedence.`)
      } else {
        console.log('Signed out.')
      }
    } catch (error) {
      fail(error)
    }
  })

program
  .command('whoami')
  .description('show who is signed in')
  .option('--site <url>', 'site URL (defaults to https://1gr14.dev)')
  .action(async (options: { site?: string }) => {
    try {
      const site = resolveSite({ site: options.site })
      const token = getToken({ site })
      if (!token) {
        console.log('Not signed in. Run `1gr14 login`.')
        process.exitCode = 1
        return
      }
      const user = await getSession({ site, token })
      if (!user) {
        console.log('The stored token is no longer valid. Run `1gr14 login`.')
        process.exitCode = 1
        return
      }
      console.log(`Signed in to ${site} as ${user.email}`)
    } catch (error) {
      fail(error)
    }
  })

program
  .command('create')
  .description('create a new app from a 1gr14 template (start0 by default)')
  .argument('[template]', 'template name', 'start0')
  .argument('[dir]', 'directory to create the app in')
  .option('--site <url>', 'site URL (defaults to https://1gr14.dev)')
  .option('--ref <ref>', 'template git ref (defaults to the latest release)')
  .action(async (template: string, dir: string | undefined, options: { site?: string; ref?: string }) => {
    try {
      await runCreate({ template, dir, site: options.site, ref: options.ref })
    } catch (error) {
      fail(error)
    }
  })

program
  .command('download')
  .description('download a template snapshot, nothing else (for updates and comparisons — see create)')
  .argument('[template]', 'template name', 'start0')
  .argument('[dir]', 'directory to unpack into (defaults to <template>-<version>)')
  .option('--site <url>', 'site URL (defaults to https://1gr14.dev)')
  .option('--ref <ref>', 'template git ref (defaults to the latest release)')
  .action(async (template: string, dir: string | undefined, options: { site?: string; ref?: string }) => {
    try {
      await runDownload({ template, dir, site: options.site, ref: options.ref })
    } catch (error) {
      fail(error)
    }
  })

program
  .command('update')
  .description('diff your app\'s template version against the latest, ready for an agent to apply')
  .argument('[template]', 'template name', 'start0')
  .option('--site <url>', 'site URL (defaults to https://1gr14.dev)')
  .option('--from <ref>', 'diff from this ref (defaults to the package.json marker)')
  .option('--to <ref>', 'diff to this ref (defaults to the latest release)')
  .action(async (template: string, options: { site?: string; from?: string; to?: string }) => {
    try {
      await runUpdate({ template, from: options.from, to: options.to, site: options.site })
    } catch (error) {
      fail(error)
    }
  })

program.addHelpText('after', `\nSite: ${links.site}`)

// Bare `1gr14` with no command prints help.
if (process.argv.length <= 2) {
  program.outputHelp()
  process.exit(0)
}

await program.parseAsync(process.argv)
