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

| Product                  | Minimum                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| [GitLab](/gitlab/)       | `SIMPLY_GITLAB_TOKEN` (`SIMPLY_GITLAB_URL` defaults to gitlab.com) |
| [Atlassian](/atlassian/) | `SIMPLY_JIRA_URL`, `SIMPLY_JIRA_USERNAME`, `SIMPLY_JIRA_API_TOKEN` |
| [Gemini](/gemini/)       | No credentials; the `gemini` CLI on your PATH                      |

The GitLab and Atlassian variables were renamed with a `SIMPLY_` prefix, so they no longer collide
with other tools that read `GITLAB_TOKEN` or `JIRA_URL`. The unprefixed names still work for now,
with a warning; each product's credentials guide lists the renames.

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
- **Gemini** — [get started](/gemini/) · [commands](/gemini/reference/)
- [MCP servers](/quick-start/mcp/) — give an AI agent the same capabilities
