# 1gr14

> The 1gr14 command-line tool. Create apps from 1gr14 templates, sign in, and
> open the site and channels from your terminal.

[![CI](https://github.com/1gr14/1gr14/actions/workflows/ci.yml/badge.svg)](https://github.com/1gr14/1gr14/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/1gr14.svg)](https://www.npmjs.com/package/1gr14)
[![coverage](https://codecov.io/gh/1gr14/1gr14/branch/main/graph/badge.svg)](https://codecov.io/gh/1gr14/1gr14)
[![license](https://img.shields.io/npm/l/1gr14.svg)](./LICENSE)

<!-- docs:start -->
<!-- Everything between docs:start and docs:end is synced to 1gr14.dev as this
project's Overview page. Keep the markers; put badges/header above docs:start and
the Community/Contributing/License footer below docs:end. -->

`1gr14` is the entry point to the 1gr14 ecosystem from your terminal. It creates
apps from 1gr14 templates (like the [start0](https://1gr14.dev) SaaS
boilerplate), signs you in to 1gr14.dev, and opens the community channels — no
hunting for links.

```sh
npx 1gr14 create start0 my-app   # sign in, download start0, set it up
npx 1gr14 open                   # open https://1gr14.dev
```

## Install

```sh
bun add -g 1gr14
# or run without installing: npx 1gr14 <command>
```

Bun 1+ or Node.js 20+. ESM only.

## Create an app

```sh
1gr14 create start0 my-app
```

Downloads the latest release of a template from 1gr14.dev, unpacks it,
`git init`s, and runs the template's own `init` script (it asks for your app
name and finishes the setup). With no directory argument it asks where to create
the app.

Getting start0 requires an active [subscription](https://1gr14.dev/support). If
you are not signed in yet, `create` starts the sign-in for you.

Flags: `--ref <ref>` downloads a specific git ref instead of the latest release;
`--site <url>` targets another site instance.

## Keep the app updated

```sh
1gr14 update    # run inside the app
```

Reads which template version the app was created from (the `package.json` marker
every template copy ships with), downloads that version and the latest release,
and writes their diff — e.g. `start0-v0.3.0..v0.5.0.diff` — next to your code,
with a ready-to-paste prompt for your agent to apply it. Already up to date? It
says so. `--from` / `--to` override the range.

There's also `1gr14 download start0 --ref v0.3.0` — a bare snapshot of any
version (no git, no setup), for reading versions side by side.

## Sign in

```sh
1gr14 login    # device flow: approve this machine in the browser
1gr14 whoami   # show who is signed in
1gr14 logout   # revoke this machine's API key and forget it
```

`login` shows a short code, opens 1gr14.dev in the browser, and waits for you to
approve the device. It then stores an **API key** for this machine in
`~/.config/1gr14/auth.json`. The key can only do the 1gr14 tools' job (download
templates) — it can't touch your account — so it never expires; `logout` revokes
it. In CI and other headless places set the `S_1GR14_API_KEY` env var instead —
sign in on your machine once and copy the key from `auth.json` (`s_1gr14` is the
brand's second spelling — and a valid shell name, unlike one starting with a
digit).

## Open the links

```sh
1gr14 open            # the site — 1gr14.dev
1gr14 open youtube    # also: support, discord, tg, x, site
```

`1gr14` with no command prints help. `1gr14 --version` prints the version.

## Use it from code

The CLI is a thin wrapper over exported functions — `create-start0` reuses them,
and you can too.

```ts
import { links, openLink, runCreate, runLogin } from '1gr14'

links.site // 'https://1gr14.dev'
await openLink('discord') // opens the Discord server
await runCreate({ template: 'start0', dir: 'my-app' }) // the whole create flow
```

## Requirements

- **Bun 1+** or **Node.js 20+** (ESM only)
- `git` on the PATH is nice to have for `create` (it `git init`s the new app;
  skipped when absent)

<!-- docs:end -->

## Community

Questions, bugs, or want to hang with other builders? Join the 1gr14 community —
one hub for all our open-source projects, this one included. Get help, share
what you built, or just say hi:
[1gr14.dev/community](https://1gr14.dev/community)

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md). Commits follow
[Conventional Commits](https://www.conventionalcommits.org/). Security reports:
[SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)

---

```text
Building open-source software for the glory of the Lord Jesus Christ ☦️
With love for developers of all backgrounds around the world ❤️
Sergei Dmitriev, 2026 😎
```
