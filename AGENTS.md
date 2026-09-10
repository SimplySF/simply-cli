# AGENTS.md

## What this repo is

`@simplysf/simply-cli` owns the `simply` command and nothing else. It has no commands of its own:
`simply plugins …` comes from `@oclif/plugin-plugins`, and every product command comes from a
plugin that is installed on first use.

The whole package is one hook. Read
[`src/hooks/jit-plugin-not-installed.ts`](packages/simply-cli/src/hooks/jit-plugin-not-installed.ts)
first; it is short, and its contract with oclif is the only subtle thing here.

## The contract with oclif, stated once

When a command belongs to a declared `jitPlugins` entry that is not installed, oclif fires
`jit_plugin_not_installed` and then behaves as follows (see `Config.runCommand` in `@oclif/core`):

| The hook        | oclif then                                                         |
| --------------- | ------------------------------------------------------------------ |
| returns a value | reloads its plugins and re-dispatches the original command         |
| throws          | surfaces the error to the user                                     |
| returns nothing | treats it as "no hook exists" and reports the command as not found |

The third row is the trap. Returning `undefined` produces a "command not found" message for a
command `simply --help` had just listed, and nothing points at the hook as the cause. The hook must
return something truthy on success, and a test pins that.

The hook must also **not run the command** — oclif does that itself after reloading.

## How discovery works, and why the plugins must ship a manifest

`simply --help` lists `atlassian` and `gitlab` before either is installed because
`oclif manifest --jit` folds each declared plugin's command metadata into this package's
`oclif.manifest.json` at release time.

It does that by downloading each plugin's npm tarball and reading `package/oclif.manifest.json` out
of it. **A plugin that does not ship its own manifest cannot be JIT-installed** — the host build
fails, and without a manifest entry the command is never found, so the hook never fires. Both
product packages therefore generate a manifest in `prepack`.

This is also why the manifest step lives in `release.yml` rather than in `build`: it needs the
plugins to be published at the declared range, and it needs network.

## Adding a product CLI

1. The product package must have no `bin` field, must set `oclif.bin` to `simply`, and must generate
   `oclif.manifest.json` in `prepack`.
2. Add it to `oclif.jitPlugins` here with a version range, and add a `topics` entry so its topic has
   a description in `simply --help`.
3. Release it before releasing the host, or the host's manifest build cannot resolve it.

Command ids must not collide across plugins. Each product roots its commands under its own topic
(`atlassian`, `gitlab`), which is what keeps that true without coordination.

## Working conventions

- Node 22+, TypeScript ESM, oclif, pnpm, lerna, wireit — the same as `simply-atlassian` and
  `simply-gitlab`, so tooling knowledge carries over.
- `pnpm run build` compiles and lints. `pnpm test` is the full gate.
- `pnpm --filter @simplysf/simply-cli run manifest` builds the JIT manifest. It shells out to `tar`
  and is only run on Linux CI; it is not part of the local build.
