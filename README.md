# 1gr14

> The 1gr14 command-line tool. Open the site and channels from your terminal.

[![CI](https://github.com/1gr14/1gr14/actions/workflows/ci.yml/badge.svg)](https://github.com/1gr14/1gr14/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/1gr14.svg)](https://www.npmjs.com/package/1gr14)
[![coverage](https://codecov.io/gh/1gr14/1gr14/branch/main/graph/badge.svg)](https://codecov.io/gh/1gr14/1gr14)
[![license](https://img.shields.io/npm/l/1gr14.svg)](./LICENSE)

<!-- docs:start -->
<!-- Everything between docs:start and docs:end is synced to 1gr14.dev as this
project's Overview page. Keep the markers; put badges/header above docs:start and
the Community/Contributing/License footer below docs:end. -->

`1gr14` is a tiny CLI. It opens the 1gr14 site and community channels in your
browser — no hunting for links.

```sh
npx 1gr14 open      # open https://1gr14.dev
```

## Install

```sh
bun add -g 1gr14
# or run without installing: npx 1gr14 <command>
```

Bun 1+ or Node.js 20+. ESM only.

## Commands

| Command         | Opens                |
| --------------- | -------------------- |
| `1gr14 open`    | the site — 1gr14.dev |
| `1gr14 video`   | YouTube              |
| `1gr14 discord` | Discord              |
| `1gr14 tg`      | Telegram             |
| `1gr14 x`       | X (Twitter)          |

`1gr14` with no command prints help. `1gr14 --version` prints the version.

## Use it from code

The links and the opener are exported too.

```ts
import { links, openLink } from '1gr14'

links.site // 'https://1gr14.dev'
await openLink('discord') // opens the Discord server
```

## Requirements

- **Bun 1+** or **Node.js 20+** (ESM only)

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
