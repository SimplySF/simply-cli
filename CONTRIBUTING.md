# Contributing

Thanks for your interest in contributing to Simply CLI! This document covers the repo structure, how to get set up, and how to submit changes.

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md).
2. Create a new issue before starting significant work so we can keep track of what you're trying to add or fix, offer suggestions, and avoid duplicate effort.
3. Fork this repository.
4. [Set up your environment](#setup) and make sure you can build and test the affected package(s) locally.
5. Create a topic branch in your fork.
6. For a new command, a user-visible flag/output/error change, or a new shared module, write a design document in [`docs/design/`](docs/design/README.md) and get it agreed on before you start implementing.
7. Make your change, following the [commit message format](#commit-messages) below.
8. Write tests for your change. No pull request will be accepted without tests covering the change.
9. Open a pull request against `main`. We'll review your code, suggest any needed changes, and merge it in.

## Repository Structure

This repository is a Lerna monorepo with a single package: the host that owns the `simply` command.
Every package has its own `CONTRIBUTING.md` covering what is specific to it — read this file first,
then that one.

| Package                                       | Description                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@simplysf/simply-cli`](packages/simply-cli) | The `simply` command: the JIT plugin hook, the plugin declarations, and nothing else |

The product commands live in their own repos ([simply-atlassian](https://github.com/SimplySF/simply-atlassian),
[simply-gitlab](https://github.com/SimplySF/simply-gitlab)) and are installed on demand. See
[AGENTS.md](AGENTS.md) for the contract between the host and a plugin.

Tooling:

- **Package manager:** pnpm workspaces
- **Task orchestration:** Lerna v10 (independent versioning) + Wireit (per-package build caching)
- **Language:** TypeScript (ESM)
- **CLI framework:** [oclif](https://oclif.io/)
- **Node:** ^22.13.0 || ^24.0.0 || ^26.0.0 (required by Lerna 10; the published CLI itself only requires >=22.0.0)
- **Docs site:** [Astro Starlight](https://starlight.astro.build/), deployed to GitHub Pages

There's also a top-level [`site/`](site) directory — the combined documentation site for `simply` and every product it hosts. It's part of the pnpm workspace (so `pnpm install` at the root sets it up too), but it's not a `packages/*` entry, so Lerna never versions, publishes, or runs `build`/`test`/`lint` scripts against it. See [Documentation Site](#documentation-site) below for how to work on it.

## Setup

This repo pins its pnpm version via the `packageManager` field in `package.json`. Use [Corepack](https://nodejs.org/api/corepack.html) (bundled with Node.js) to install that exact version rather than installing pnpm globally:

```sh
corepack enable
git clone git@github.com:SimplySF/simply-cli.git
cd simply-cli
corepack install   # installs the pnpm version pinned in package.json
pnpm install
pnpm run build
pnpm test
```

`corepack enable` only needs to be run once per machine. After that, Corepack transparently uses whatever version of pnpm is pinned in `package.json`, so every contributor and CI job runs the same version.

`pnpm install` at the root installs and links every workspace package and sets up git hooks automatically via husky.

To try your changes without installing the package globally, run its local dev binary from inside the package directory:

```sh
cd packages/simply-cli
./bin/dev.js --help
```

or link it so you can run `simply` from anywhere:

```sh
cd packages/simply-cli
npm link
```

## Common Commands

Run from the repo root to target all packages:

```sh
pnpm run build       # lerna run build (compile + lint)
pnpm run compile     # lerna run compile
pnpm run lint        # lerna run lint
pnpm run test        # lerna run test
pnpm run test:only   # lerna run test:only
pnpm run format      # lerna run format
pnpm run reset       # clear node_modules, the lockfile, and all wireit/TS/ESLint caches
pnpm run reset:install  # same as reset, then reinstall dependencies
```

Run inside a single package directory to target just that package:

```sh
cd packages/simply-cli
pnpm run build
pnpm test
```

## Adding a Dependency

To add a dependency to a specific package:

```sh
pnpm add <package> --filter @simplysf/simply-cli
```

To add a root-level devDependency (e.g., a shared build tool):

```sh
pnpm add -w -D <package>
```

## Commit Messages

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint on commit). Once release automation is wired up, Lerna will use your commit types to decide which packages get versioned and how their `CHANGELOG.md` is generated — so it's worth getting right now even though nothing consumes it yet.

```text
feat: add support for X
fix: correct handling of Y
docs: update README
chore: bump a dependency
```

If your change only affects one package, scope the commit to it, e.g. `feat(simply-cli): add gitlab mr view command`.

## Pull Requests

- Keep pull requests focused on a single change where possible.
- If the change has a design document in [`docs/design/`](docs/design/README.md), update it to match what actually shipped, including its `Status` line and its row in the index. A design doc that quietly disagrees with the code is worse than none.
- Make sure `pnpm run build` and `pnpm test` pass before opening the PR. CI runs both across every package; the pre-push hook runs the same checks but scoped to packages changed since the last release tag (see [Git Hooks](#git-hooks)), so a passing push doesn't guarantee a passing PR if your branch touches a root-level config file (e.g. `tsconfig.json`, `eslint.config.mjs`) that no single package's directory reflects.
- Aim for high test coverage on new code.
- If the change affects installation, the JIT plugin flow, or how the MCP servers are configured, update the matching guide under `site/src/content/docs/` (see [Documentation Site](#documentation-site)).
- `command-snapshot.json` (used to flag accidental breaking changes to commands/flags) regenerates automatically as part of each package's `pnpm run build` — just commit whatever changes. CI re-verifies with `git diff --exit-code` after `pnpm run build`, so a stale, uncommitted snapshot fails the build.

## Versioning and Publishing

Versioning uses Lerna's independent mode — each package has its own version and can release separately. `release.yml` versions from conventional commits on a push to `main` and publishes whatever is committed to git but still missing from npm.

## CI

| Workflow      | Trigger                                                          | What it does                                                                                  |
| ------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `test.yml`    | Push to non-main branches                                        | Runs `pnpm run build` + `pnpm test` on Linux (lts/_, lts/-1) and Windows (lts/_)              |
| `release.yml` | Push to `main` or `prerelease/**`, or manual dispatch            | Builds, tests, versions from conventional commits with Lerna, and publishes to npm            |
| `docs.yml`    | Push/PR touching `site/**`, a daily schedule, or manual dispatch | Builds the docs site, checks for broken internal links, and deploys to GitHub Pages on `main` |

## Git Hooks

| Hook         | Command                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged` — runs `prettier --write` on staged files                                       |
| `commit-msg` | `commitlint` — enforces conventional commit format                                            |
| `pre-push`   | `lerna run build --since --include-dependents && lerna run test --since --include-dependents` |

`pre-push` only builds/tests packages changed since the last release tag (plus their transitive
dependents) to keep the hook fast locally — CI (`test.yml`) always runs `pnpm run build` + `pnpm test`
across every package, so nothing changed here reduces what actually gates a merge.

Hooks are installed automatically on `pnpm install` via the `prepare: husky` script.

## Documentation Site

[`site/`](site) builds https://simplysf.github.io/simply-cli/ — one site covering `simply` and every
product it hosts.

**Most of its content is not in this repo.** `site/scripts/sync-products.mjs` runs before every
build (`prebuild`), downloads each product's **published** npm tarball, and generates the pages
under `/gitlab/` and `/atlassian/` from the `oclif.manifest.json` and `docs/guides/` it finds
inside. Nothing under those paths is committed here, and editing it locally is pointless — the next
build overwrites it. To change a product's docs, change them in that product's repo; they reach the
site when that package is **released**. [`docs/design/0002`](docs/design/0002-combined-documentation-site.md)
explains why it works this way.

What _is_ editable here is everything else in `site/src/content/docs/`: the landing page, Get
Started, and the `guides/` covering the host itself.

```sh
pnpm --filter site run dev      # sync from npm, then serve with hot reload
pnpm --filter site run build    # sync, then build to site/dist
pnpm --filter site run sync     # regenerate the product pages only
```

`sync` needs network access to the npm registry.

Two rules the link check will otherwise catch for you in CI:

- **Hand-written pages may only link to `/{product}/` and `/{product}/reference/`.** Those are
  generated on every build. A guide page is only there once that product has released it, so a link
  straight to one is a link this repo cannot keep working.
- **Never hand-write a page under `/gitlab/` or `/atlassian/`.** It will be deleted on the next
  sync.

Root-relative links in markdown are rewritten with the `/simply-cli` base path by
`site/plugins/remark-base-links.mjs`, so write `/quick-start/mcp/`, not `/simply-cli/quick-start/mcp/`.
That plugin only sees markdown body content — the hero actions in `index.mdx` are frontmatter and
carry the prefix by hand.

## Reporting Issues

Please report bugs or request features by [opening an issue](https://github.com/SimplySF/simply-cli/issues) rather than submitting a PR without prior discussion for anything non-trivial.
