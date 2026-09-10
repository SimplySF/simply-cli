---
title: Plugins
description: How the simply CLI installs product commands on demand, and how to pin, update, or remove them.
---

`simply` is a host. It owns the command name and ships knowing which commands exist, but it depends
on none of the products — each one is a plugin, fetched the first time you use it.

## What happens on first run

```sh
simply gitlab mr list --project group/project
# Installing @simplysf/simply-gitlab to run gitlab:mr:list (first run only)…
# Installed @simplysf/simply-gitlab.
```

The host recognised `gitlab:mr:list` as a command belonging to a product that is not installed,
fetched that product, reloaded, and ran the command. Every later run skips straight to the last step.

That recognition is possible because the host's command list is built at release time from each
product's published package — which is also why `simply --help` lists every topic before you have
installed anything.

## Managing what is installed

```sh
simply plugins                                     # what is installed, and at what version
simply plugins update                              # update everything
simply plugins install @simplysf/simply-gitlab     # install ahead of time
simply plugins install @simplysf/simply-gitlab@1.2.0   # pin a version
simply plugins uninstall @simplysf/simply-gitlab   # remove one
```

Plugins live in the CLI's own data directory, not in global `node_modules`, so nothing here competes
with anything else you have installed.

## Installing ahead of time

The first run of a product does an npm install. That needs network access and permission to write to
the CLI's data directory — fine on a laptop, a surprise in CI or a locked-down image, and a surprise
at exactly the wrong moment.

Pre-install instead:

```dockerfile
RUN npm install -g @simplysf/simply-cli \
 && simply plugins install @simplysf/simply-gitlab
```

## Versions

The host declares which version of each product it will install:

```json
"jitPlugins": {
  "@simplysf/simply-gitlab": ">=0.4.0 <1.0.0"
}
```

A product ships as many releases as it likes inside that range without the host moving. Crossing out
of it — a new major — needs a host release, which is the one place the two are genuinely coupled.

`simply plugins install <package>@<version>` overrides the range for your machine, which is the
escape hatch if you need a version the host does not yet declare.

## What this means for `--help`

`simply --help` is generated when the **host** is released. A product that adds a command will run
it fine once installed, but the command will not appear in the host's help until the host is
released again. The product's own `--help` always reflects what you have:

```sh
simply gitlab --help          # from the installed product, always current
simply gitlab mr --help
```

## Upgrading from a standalone install

If you previously installed a product CLI directly, it owned `simply` itself:

```sh
npm uninstall -g @simplysf/simply-atlassian @simplysf/simply-gitlab
npm install -g @simplysf/simply-cli
```

Your commands do not change. `simply gitlab mr list` is exactly what it was — only what owns the
binary is different, so scripts keep working.
