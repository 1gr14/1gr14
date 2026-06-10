// Post-build smoke test: run the built CLI under plain Node and check it works.
// Needs the runtime deps installed (commander, open).
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))

const assert = (cond, msg) => {
  if (!cond) {
    console.error('smoke test failed:', msg)
    process.exit(1)
  }
}

const run = (...args) => execFileSync('node', [cli, ...args], { encoding: 'utf8' })

const version = run('--version').trim()
assert(/^\d+\.\d+\.\d+/.test(version), `--version should print a semver, got: ${version}`)

const help = run('--help')
assert(help.includes('1gr14.dev'), 'help should show the site link')
assert(help.includes('open'), 'help should list the open command')
assert(help.includes('create'), 'help should list the create command')

console.log('smoke ok')
