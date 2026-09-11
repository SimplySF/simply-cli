---
title: 'Quick Start'
description: 'Get going with a quick start example.'
sidebar:
  order: 0
---

## Install

```sh
npm install @simplysf/simply-cli --global
```

## Authorize

Each product reads its own settings, and each has its own credentials guide:

| Product                  | Minimum                                              |
| ------------------------ | ---------------------------------------------------- |
| [GitLab](/gitlab/)       | `GITLAB_TOKEN` (`GITLAB_URL` defaults to gitlab.com) |
| [Atlassian](/atlassian/) | `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`        |

## View Help

```sh
simply --help
```

## Run a Command

```sh
simply gitlab project list --membership
```

Projects, merge requests, CI/CD, and configuration baselines.

Install the `simply` CLI and this product installs itself the first time you use it.

```sh
npm install -g @simplysf/simply-cli
simply gitlab --help
```

## Next Steps

- **GitLab** — [get started](/gitlab/) · [commands](/gitlab/reference/)
- **Atlassian** — [get started](/atlassian/) · [commands](/atlassian/reference/)
- [MCP servers](/quick-start/mcp/) — give an AI agent the same capabilities
