---
title: Get Started
description: Install the simply CLI once and let each product install itself on first use.
---

## Requirements

Node.js 22 or later. Nothing else.

## Install

```sh
npm install -g @simplysf/simply-cli
```

That is the only thing you install. The product CLIs — GitLab, Atlassian — are fetched the first
time you run one of their commands.

## See what is available

```sh
simply --help
```

```
TOPICS
  atlassian  Work with Atlassian products. Installed on first use.
  gitlab     Work with GitLab. Installed on first use.
  plugins    List installed plugins.
```

Both product topics appear immediately, before anything is downloaded — the command list ships with
the host, so you can discover a command without installing it first.

## Run something

```sh
simply gitlab project list --membership
```

```
Installing @simplysf/simply-gitlab to run gitlab:project:list (first run only)…
Installed @simplysf/simply-gitlab.
```

The install happens once. Every later run is immediate.

## Connect to your instance

Each product reads its own settings, and each has its own credentials guide:

| Product                  | Minimum                                              |
| ------------------------ | ---------------------------------------------------- |
| [GitLab](/gitlab/)       | `GITLAB_TOKEN` (`GITLAB_URL` defaults to gitlab.com) |
| [Atlassian](/atlassian/) | `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`        |

```sh
export GITLAB_TOKEN=glpat-...
simply gitlab mr list --project group/project
```

## Installing ahead of time

The first run of a not-yet-installed product does an npm install, which needs network access and
somewhere to write. In CI, a container image, or on an air-gapped machine, do it up front:

```sh
npm install -g @simplysf/simply-cli
simply plugins install @simplysf/simply-gitlab
simply plugins install @simplysf/simply-atlassian
```

In a Dockerfile that is three lines and every later invocation is offline-safe.

## Where to go next

- **GitLab** — [get started](/gitlab/) · [commands](/gitlab/reference/)
- **Atlassian** — [get started](/atlassian/) · [commands](/atlassian/reference/)
- [Plugins](/guides/plugins/) — how installation on demand works, and how to pin or update a product
- [MCP servers](/guides/mcp/) — give an AI agent the same capabilities
