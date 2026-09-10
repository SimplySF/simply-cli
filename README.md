# Simply CLI

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

`simply` is the command that hosts [SimplySF](https://github.com/SimplySF)'s product command-line
tools. Install it once; the product CLIs install themselves the first time you use one.

**Documentation: https://simplysf.github.io/simply-cli/**

```sh
npm install -g @simplysf/simply-cli

simply gitlab mr list --project group/project
# Installing @simplysf/simply-gitlab to run gitlab:mr:list (first run only)…
# IID  STATE   SOURCE         TARGET  AUTHOR   UPDATED     TITLE
# 42   opened  feature/thing  main    someone  2026-09-01  feat: the thing

simply atlassian jira whoami
# Installing @simplysf/simply-atlassian to run atlassian:jira:whoami (first run only)…
```

Every later run is instant.

## Why this exists

Each product CLI used to own the `simply` command itself, which meant only one of them could be
installed at a time — npm links one binary name to one package. Now a single host owns `simply` and
the products are plugins, so they coexist, and adding a third changes nothing about the first two.

## What it hosts

| Plugin                                                                           | Commands                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`@simplysf/simply-atlassian`](https://github.com/SimplySF/simply-atlassian)     | `simply atlassian jira …`, `simply atlassian confluence …` |
| [`@simplysf/simply-atlassian-mcp`](https://github.com/SimplySF/simply-atlassian) | `simply atlassian mcp`                                     |
| [`@simplysf/simply-gitlab`](https://github.com/SimplySF/simply-gitlab)           | `simply gitlab …`                                          |
| [`@simplysf/simply-gitlab-mcp`](https://github.com/SimplySF/simply-gitlab)       | `simply gitlab mcp`                                        |

`simply --help` lists both topics whether or not they are installed — the command list ships with
the host, so you can discover a command before anything is fetched.

## Installing ahead of time

The first run of any command from a not-yet-installed product does an npm install, which needs
network access and permission to write to the CLI's data directory. In CI, a container image, or an
air-gapped machine, do it up front instead:

```sh
npm install -g @simplysf/simply-cli
simply plugins install @simplysf/simply-atlassian
simply plugins install @simplysf/simply-gitlab
```

In a Dockerfile that is two lines and it makes every later invocation offline-safe.

## Managing what is installed

```sh
simply plugins                                    # what is installed, and at what version
simply plugins update                             # update all of them
simply plugins uninstall @simplysf/simply-gitlab  # remove one
simply plugins install @simplysf/simply-gitlab@1.2.0   # pin a version
```

Plugins live in the CLI's own data directory, not in global `node_modules`, so nothing here
competes with anything else you have installed.

## Upgrading from a standalone install

If you previously installed a product CLI directly, it owned `simply` itself. Replace it:

```sh
npm uninstall -g @simplysf/simply-atlassian @simplysf/simply-gitlab
npm install -g @simplysf/simply-cli
```

**Your commands do not change.** `simply atlassian jira issue view PROJ-42` and
`simply gitlab mr list --project group/project` are exactly what they were — only what owns the
`simply` binary is different. Scripts keep working.

## Version ranges

The host declares which version of each product it will install:

```json
"jitPlugins": {
  "@simplysf/simply-atlassian": ">=0.11.0 <1.0.0",
  "@simplysf/simply-gitlab": ">=0.4.0 <1.0.0"
}
```

A product can ship as many releases inside its range as it likes without the host moving. Leaving
the range needs a host release, which is the one place the two are genuinely coupled.

## Issues

Report anything about the `simply` command itself at
https://github.com/SimplySF/simply-cli/issues. For a problem with a specific command, the product
repo is the better place — [simply-atlassian](https://github.com/SimplySF/simply-atlassian/issues)
or [simply-gitlab](https://github.com/SimplySF/simply-gitlab/issues).

## Documentation

https://simplysf.github.io/simply-cli/ covers `simply` and every product it hosts: the command
reference for each, the guides that ship with each package, and how to configure the MCP servers.

It is built from the **published** packages, so it describes the versions people actually have
installed rather than whatever is on `main`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0. See [LICENSE.txt](LICENSE.txt).
