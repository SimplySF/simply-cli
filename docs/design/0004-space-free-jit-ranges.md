# 0004 — Space-free JIT ranges, and installing an exact version

**Status:** Implemented
**Package:** `simply-cli`
**Date:** 2026-10-20

## Problem

On Windows, the first run of a product command installed the product **and** an unrelated, deprecated
npm package called [`undefined`](https://www.npmjs.com/package/undefined). `simply plugins update`
installed it again every time.

The host declared ranges like `>=0.4.0 <1.0.0`, and the hook passed `<name>@<range>` to
`plugins:install`. `@oclif/plugin-plugins` (5.5.2, and still in 7.0.10) runs npm as
`node npm-cli.js …` with `windowsVerbatimArguments: true` and does not quote its arguments, so the
space splits the spec in two:

```
npm install @simplysf/simply-gitlab@>=0.4.0 <1.0.0
            └──────── one argument ───────┘ └ two ┘
```

`npm-package-arg` reads `<1.0.0` as a range with no name, and npm resolves that to the package
literally named `undefined`. The real product still installed correctly, which is why nobody noticed.
macOS and Linux spawn with an argument array and were never affected.

There are two places a range reaches npm, and the hook controls only one of them:

| Path                    | What plugin-plugins passes to npm                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| First run (the hook)    | whatever the hook asks `plugins:install` for                                                          |
| `simply plugins update` | the saved tag if it is not an exact version; otherwise the host's `jitPlugins` range (`normaliseTag`) |

And plugin-plugins saves `semver.validRange(tag)`, which turns even a space-free range like `0.x`
back into `>=0.0.0 <1.0.0-0`. So fixing either half alone is not enough.

## Decision

Both halves:

1. **The hook installs an exact version.** It looks up the newest published version inside the
   declared range in the registry's abbreviated metadata and installs `<name>@<version>`.
   plugin-plugins saves an exact version as-is, so `plugins update` then falls through to the
   host's range.
2. **The host's `jitPlugins` ranges are space-free:** `0.x` for every product. A test fails if a
   declared range contains whitespace.

If the lookup fails (offline, a blocked registry, a range nothing satisfies), the hook installs the
range exactly as before. That keeps every platform no worse than it was, and on a machine that
cannot reach the registry the install that follows fails anyway, with plugin-plugins' own message.

The lookup reads `npm_config_registry` when set and otherwise uses `registry.npmjs.org`. It does not
read `.npmrc`. That only affects which version is _chosen_; npm still does the install with its own
configuration.

## What changes for people

- **Ranges lose their minimums.** `>=0.11.0 <1.0.0` becomes `0.x`. npm always picks the newest
  version that matches, so this changes nothing in practice. No space-free range means
  "at least X, below 1.0.0".
- **Existing Windows installs keep the `undefined` package** until it is removed. It is never loaded
  or run. `simply plugins reset --hard` removes it along with every product, and each product
  reinstalls itself on next use. The README says so.

## Upstream

The real fix is quoting in `@oclif/plugin-plugins`' `spawn`. The same root cause broke installs
when Node lived under `C:\Program Files`; oclif/plugin-plugins#1388 fixed that by quoting the Node
path, but left the arguments unquoted. Once a release with that fix is the minimum for `@oclif/plugin-plugins` here, both
halves of this workaround can be removed.

## Alternatives considered

- **Quote the range in the hook** (`<name>@"<range>"`). One line, but the quotes are saved into
  plugin-plugins' state and shown by `simply plugins`. It also relies on Windows argument parsing
  removing them, which nothing guarantees beyond today's spawn code.
- **Rewrite plugin-plugins' saved state after install.** Fixes `update` without a registry lookup, but
  this package would then own the format of a file it does not own.
- **Wait for upstream.** Leaves Windows users installing a stranger's package until then.
