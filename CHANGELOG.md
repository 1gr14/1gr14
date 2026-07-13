## Unreleased

- Drop the trailing ellipsis from spinner messages (`Downloading start0`, not
  `Downloading start0…`) — `@clack/prompts` already animates its own dots, so the
  ellipsis doubled them. Also replaced the stray single `…` glyph with plain
  `...` in the remaining strings and comments.

## 0.3.7 — 2026-07-13

- `1gr14 create`: when the template's init script runs, don't print a second
  closing `outro` over the init script's own — that stacked a duplicate "Happy
  hacking! ♥" under the init script's sign-off. The CLI still signs off on the
  paths where init isn't run (declined, no Bun, non-interactive, no init script).

## 0.3.6 — 2026-07-10

- `create` / `download` / `update`: sign in before the download spinner starts.
  A first run used to flicker between "Downloading..." and "Waiting for approval
  in the browser...", because the login raised a second spinner over the first.
- A failed run now stops its spinner, so the error prints on its own instead of
  being followed by a stray "Canceled" — which read as if you had cancelled
  rather than been refused.

## 0.3.4 — 2026-07-01

- `1gr14 create`: hand the created directory to the template's init via the
  `S_1GR14_CREATE_DIR` env var, so start0's "Next steps" can tell you to `cd`
  into the new app. Previously init couldn't see the shell's directory and
  printed a wrong `cd ..`.

## 0.3.3 — 2026-06-11

- Internal: migrated to the in-house tag-driven release (no semantic-release),
  dual TS6/TS7 typecheck, README refresh, dropped dead deps. No user-facing
  change.

## [0.3.2](https://github.com/1gr14/1gr14/compare/v0.3.1...v0.3.2) (2026-06-11)


### Bug Fixes

* refresh Discord invite — old link expired, new permanent one ([f4adffd](https://github.com/1gr14/1gr14/commit/f4adffdd648d7bfce285b9c75ada99ba89cc97ca))

## [0.3.1](https://github.com/1gr14/1gr14/compare/v0.3.0...v0.3.1) (2026-06-11)


### Bug Fixes

* call the renamed /api/api-key/* endpoints ([ae831a2](https://github.com/1gr14/1gr14/commit/ae831a28b5432debf21ea8054a74c49b5fbf6bce))

# [0.3.0](https://github.com/1gr14/1gr14/compare/v0.2.0...v0.3.0) (2026-06-10)


### Features

* exchange the device session for a restricted API key ([b4aef2c](https://github.com/1gr14/1gr14/commit/b4aef2c2d771a3dc135342bcf44ef485f6598480))

# [0.2.0](https://github.com/1gr14/1gr14/compare/v0.1.0...v0.2.0) (2026-06-10)


### Features

* the ecosystem engine — login, create, download, update ([8125b62](https://github.com/1gr14/1gr14/commit/8125b6225c958ca8af2df196255b042ff4f2a555))

# [0.1.0](https://github.com/1gr14/1gr14/compare/v0.0.0...v0.1.0) (2026-06-09)


### Features

* 1gr14 CLI — open the site and channels ([3cfe3f8](https://github.com/1gr14/1gr14/commit/3cfe3f8a6c9435fa3f7872d62584e5758cd92ca0))
