## Unreleased

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
