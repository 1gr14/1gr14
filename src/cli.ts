#!/usr/bin/env node
import { createRequire } from 'node:module'
import { Command } from 'commander'
import { links, openLink, type LinkName } from './index.js'

// Read name/version/description from the installed package.json at runtime, so
// the published version is always correct (no value baked in at build time).
const pkg = createRequire(import.meta.url)('../package.json') as {
  version: string
  description: string
}

const commands: ReadonlyArray<{ name: string; link: LinkName; summary: string }> = [
  { name: 'open', link: 'site', summary: 'open the 1gr14 site' },
  { name: 'video', link: 'video', summary: 'open the YouTube channel' },
  { name: 'discord', link: 'discord', summary: 'open the Discord server' },
  { name: 'tg', link: 'tg', summary: 'open the Telegram channel' },
  { name: 'x', link: 'x', summary: 'open X (Twitter)' },
]

const program = new Command()

program.name('1gr14').description(pkg.description).version(pkg.version, '-v, --version', 'print the version')

for (const { name, link, summary } of commands) {
  program
    .command(name)
    .description(summary)
    .action(async () => {
      const url = await openLink(link)
      console.log(`Opening ${url}`)
    })
}

program.addHelpText('after', `\nSite: ${links.site}`)

// Bare `1gr14` with no command prints help.
if (process.argv.length <= 2) {
  program.outputHelp()
  process.exit(0)
}

program.parse(process.argv)
