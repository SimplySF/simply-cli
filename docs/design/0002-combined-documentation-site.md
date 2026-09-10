# 0002 — One documentation site, built from the published packages

**Status:** Implemented
**Package:** `simply-cli` (`site/`), `simply-atlassian`, `simply-gitlab`
**Date:** 2026-09-10

## Problem

`simply-atlassian` and `simply-gitlab` each published their own Starlight site. That mirrored the
old world, where each was a separate global install. It no longer describes what people have: one
`simply` command that reaches both products, and a reader who does not know or care which npm
package a command came from.

Three sites also meant three copies of the same material — installation, credentials, `--json`,
MCP client configuration — drifting apart at three different rates.

## Decision

One site, at `https://simplysf.github.io/simply-cli/`, built in this repo. The two product sites
are deleted and replaced by a redirect.

The content comes from three places, and which place a page comes from is decided by who owns the
truth in it:

| Content                                     | Lives in                             | Reaches the site when |
| ------------------------------------------- | ------------------------------------ | --------------------- |
| Host pages (install, plugins, MCP overview) | `site/src/content/docs/` here        | this repo merges      |
| Product command reference                   | each package's `oclif.manifest.json` | that product releases |
| Product guides                              | each package's `docs/guides/`        | that product releases |

`site/scripts/sync-products.mjs` runs before every build. For each product it runs `npm pack` on
the published CLI and MCP packages, extracts `oclif.manifest.json` and `docs/` from the tarballs,
and generates the pages under `/gitlab/` and `/atlassian/`. Nothing under those paths is committed
here.

## Why generate from the tarball rather than the repo

The obvious alternative is a submodule, or a build that checks out the product repos. Both would
document `main`. The tarball documents the release.

That difference is the whole point. A reader running `simply gitlab mr list` has an installed
version, not a `main`. A guide generated from `main` describes flags they do not have, and a
reference page generated from `main` lists commands that error out as not found. Documenting the
published artifact makes the site wrong only in the direction of being slightly behind, which is
recoverable, instead of wrong in the direction of promising things that do not exist.

It has a real cost, stated plainly: **a documentation fix does not reach the site when it merges.
It reaches the site when the package is released.** The product repos say so in their `AGENTS.md`.

## Consequences of the content living elsewhere

- **The site must rebuild without a push here.** A product release changes the site's content but
  touches nothing in this repo, so `docs.yml` runs on a daily schedule as well as on push.
- **The build needs network.** `npm pack` hits the registry. A registry outage fails the docs
  build; it does not affect `test.yml` or `release.yml`.
- **Host pages may only link to pages the host can guarantee.** A guide arrives with someone else's
  release, so a hand-written link to `/gitlab/guides/credentials/` is a link this repo cannot keep
  working. Host pages link to the product landing page (`/gitlab/`) and the reference
  (`/gitlab/reference/`) instead — both generated on every build from the manifest, which is
  mandatory for a JIT plugin and therefore always present.
- **The product landing page lists only what this build produced.** A guide that has not shipped
  yet is absent from it rather than present and broken.
- **No edit links on generated pages.** Starlight's `editLink` points into this repo, and no file
  under `/gitlab` or `/atlassian` exists here. A wrong edit link is worse than none, so generated
  pages omit it.

## The redirect

Each product repo keeps a Pages deployment serving a two-file redirect (`index.html`, `404.html`)
that preserves the path: `…/simply-gitlab/guides/credentials/` becomes
`…/simply-cli/gitlab/guides/credentials/`. It redirects with JavaScript and a `<meta refresh>`
fallback, since GitHub Pages cannot issue a 301.

The old sites' URLs are in READMEs, npm pages, and search results that this project does not
control, so the redirect is permanent, not transitional.

## Alternatives considered

**Keep three sites and cross-link them.** Rejected: it preserves the duplication and asks the
reader to know which package a command lives in, which is exactly what the host removed.

**One site, product docs committed here.** Rejected: the copy in this repo would be the fourth
place a guide lives, and the one nobody updates. Generation makes the published package the single
source.

**Build the site from the product repos on release, pushing to this repo.** Rejected: it needs
cross-repo write tokens, and produces the same output as a scheduled pull with more moving parts
and more ways to fail silently.
