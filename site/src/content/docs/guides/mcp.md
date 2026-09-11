---
title: MCP servers
description: Point an MCP client at simply and give an AI agent the same GitLab and Atlassian capabilities as the CLI.
---

Every product serves its commands as [Model Context Protocol](https://modelcontextprotocol.io/)
tools, through the same `simply` command:

```json
{
  "mcpServers": {
    "gitlab": { "command": "simply", "args": ["gitlab", "mcp"] },
    "atlassian": { "command": "simply", "args": ["atlassian", "mcp"] }
  }
}
```

Nothing to install but `@simplysf/simply-cli` — each server installs itself the first time the
client launches it.

## One server per product, deliberately

There is no single `simply mcp` exposing everything. Together the catalogues are 67 tools, and that
many descriptions measurably degrades a model's ability to pick the right one; some clients also cap
or truncate large catalogues.

|           | Tools | Read-only default |
| --------- | ----- | ----------------- |
| Atlassian | 43    | 24                |
| GitLab    | 24    | 18                |

Separate servers also let you enable one product and not the other, which a combined server would
need a filtering flag to express.

## Checking what a server offers

```sh
simply gitlab mcp --list
simply atlassian mcp --list --allow-writes
```

Prints the tools that would be registered, then exits. Useful because running the server directly
at a terminal looks like a hang — it is waiting for a client on stdin, which is the correct
behaviour and an alarming first impression.

## Letting an agent write

Read tools only, unless you say otherwise:

```json
{
  "mcpServers": {
    "gitlab": { "command": "simply", "args": ["gitlab", "mcp"] },
    "gitlab-write": {
      "command": "simply",
      "args": ["gitlab", "mcp", "--allow-writes", "--env-file", "/home/me/gitlab-write.env"]
    }
  }
}
```

Pairing a read-only server with a write-capable one that uses a different credential file keeps the
agent's normal loop structurally incapable of changing anything. `GITLAB_READ_ONLY` and
`ATLASSIAN_READ_ONLY` refuse every write even with `--allow-writes` on.

The layer that actually binds is a read-scoped token, which makes the instance refuse the write
regardless of what any caller is persuaded to attempt.

## Settings

Each server reads its product's own environment variables, or an `--env-file`:

```json
"args": ["gitlab", "mcp", "--env-file", "/home/me/gitlab.env"]
```

Use an absolute path. MCP clients launch a server from a working directory of their own, so `~` and
relative paths may not resolve. On Windows, write it with forward slashes inside JSON.

## Per-product detail

The full tool catalogues, per-client configuration for Claude Desktop, Claude Code, Cursor,
Gemini CLI and VS Code, error codes, and troubleshooting live with each product:

- [GitLab MCP server](/gitlab/)
- [Atlassian MCP server](/atlassian/)

## The standalone binaries still work

`simply-gitlab-mcp` and `simply-atlassian-mcp` are still published and unchanged. If you have an
existing client configuration pointing at them, it keeps working — nothing needs migrating.
