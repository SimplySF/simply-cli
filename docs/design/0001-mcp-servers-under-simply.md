# 0001 — Serving the MCP servers under `simply`

**Status:** Implemented (PR #3)
**Package:** `simply-cli`, `simply-atlassian-mcp`, `simply-gitlab-mcp`
**Date:** 2026-09-10

## Problem

The CLIs now live under one `simply` command. The MCP servers do not: each is a separate global
install with its own binary, and a client configuration names them individually.

```json
{
  "mcpServers": {
    "gitlab": { "command": "simply-gitlab-mcp" },
    "atlassian": { "command": "simply-atlassian-mcp" }
  }
}
```

This is not broken — the two binaries have different names and coexist perfectly well, unlike the
`simply` collision that prompted the host. It is only inconsistent: one product, two installation
stories, and a person who installed `@simplysf/simply-cli` still has to `npm install -g` something
else to get the same capabilities as tools.

## Decision

Each MCP package gains an oclif command — `gitlab mcp` and `atlassian mcp` — and becomes a JIT
plugin of the host. A client points at `simply`:

```json
{
  "mcpServers": {
    "gitlab": { "command": "simply", "args": ["gitlab", "mcp"] },
    "atlassian": { "command": "simply", "args": ["atlassian", "mcp", "--allow-writes"] }
  }
}
```

Nothing needs installing but `simply`. The plugin is fetched on first use, like every other.

**The existing binaries stay.** `simply-gitlab-mcp` and `simply-atlassian-mcp` still work and are
still published; an existing configuration keeps running untouched. A package can own an npm `bin`
_and_ be an oclif plugin — the earlier collision was two packages claiming the _same_ name, which
is not the case here.

**One server per product, not one combined server.** This is the decision worth arguing about, and
the numbers are the argument.

## Behavior

### Why not one aggregated server

The obvious reading of "MCP under `simply`" is a single `simply mcp` exposing everything. It was
rejected on tool count:

|              | Tools  | Read-only default |
| ------------ | ------ | ----------------- |
| Atlassian    | 43     | 24                |
| GitLab       | 24     | 18                |
| **Combined** | **67** | **42**            |

Sixty-seven tools in one catalogue measurably degrades a model's tool selection, and some clients
cap or truncate large catalogues. The whole value of a tool description is that a model can pick
correctly from what it is shown; sixty-seven descriptions is a worse place to pick from than
twenty-four.

Separate servers also mean a person can enable GitLab and not Atlassian, which a combined server
would need a filtering flag to express — a flag whose only purpose would be to undo a merge nobody
asked for.

The consistency win — one thing to install, one command to name — is fully available without
merging the catalogues, and that is what this does.

### Where the command lives

In the **MCP package**, not the CLI package. Three consequences, all wanted:

- The CLI stays lean. Someone who only wants `simply gitlab mr list` does not download the MCP SDK
  and zod along with it.
- `simply gitlab mcp` JIT-installs only `@simplysf/simply-gitlab-mcp`.
- Two plugins contribute to one topic (`gitlab:mr:list` from the CLI, `gitlab:mcp` from the MCP
  package). oclif is fine with that: a topic is a naming convention over command ids, not an
  ownership boundary.

### stdout is the protocol

This is the one genuinely dangerous part, because a violation does not fail — it corrupts a client
session with an error that points nowhere near the cause.

The command therefore extends `Command` from `@oclif/core` **directly**, not the product's shared
base class. The shared base sets `enableJsonFlag = true`, which makes oclif print a command's
return value to stdout whenever `--json` is passed. On this command that would put a JSON object
into the middle of a protocol stream.

`enableJsonFlag = false` is then set explicitly, restating in code what the class comment says, so
that a later refactor onto a base class that enables it fails a test rather than shipping. Tests
assert the flag is off, that `--json` is rejected outright, and that `--list` writes nothing to
stdout.

Everything diagnostic — the `--list` output, oclif's own warnings — goes to stderr. Verified by
speaking MCP at the command and parsing every line it produced on stdout.

### Flags

Matching the standalone binary, so there is one thing to learn:

| Flag                | Meaning                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `--allow-writes`    | Register the tools that change data. Off by default.                                        |
| `--env-file <path>` | Connection settings. Use an absolute path; clients launch from their own working directory. |
| `--list`            | Print the tools that would be registered, to stderr, and exit without serving.              |

`--list` is new, and exists because `simply gitlab mcp` at a terminal otherwise appears to hang —
it is waiting for a client on stdin. Being able to ask what it _would_ do is the difference between
that being confusing and being obvious.

`GITLAB_READ_ONLY` and `ATLASSIAN_READ_ONLY` still refuse every write, `--allow-writes` or not.

### Version ranges

The host declares each MCP package alongside its CLI:

```json
"jitPlugins": {
  "@simplysf/simply-atlassian":     ">=0.11.0 <1.0.0",
  "@simplysf/simply-atlassian-mcp": ">=0.5.0 <1.0.0",
  "@simplysf/simply-gitlab":        ">=0.4.0 <1.0.0",
  "@simplysf/simply-gitlab-mcp":    ">=0.4.0 <1.0.0"
}
```

Ranges rather than carets, for the reason in the host's README: a caret on a 0.x version excludes
the next minor, which would mean a host release every time a product ships one.

## Alternatives considered

**One aggregated `simply mcp` server.** Covered above: 67 tools is the objection, and it is a real
one rather than a stylistic preference.

**`simply mcp --product gitlab`.** Aggregated but selectable. It solves the tool-count problem only
for people who find the flag, defaults to the bad case, and adds a host-side mechanism (a custom
hook each product implements) that the chosen design does not need at all.

**Put the command in the CLI package instead.** Simpler to describe — one plugin per product — but
it makes every CLI install carry the MCP SDK, and it couples a `simply gitlab mr list` user to a
dependency they will never load.

**Leave the binaries as the only entry point.** Genuinely defensible: nothing is broken, and the
binaries are one `npm install -g` each. Rejected because the CLIs already moved, and having half
the surface under `simply` and half not is the worst of both.

**Drop the standalone binaries.** Would make the story simpler to tell, and would break every
existing MCP client configuration for no benefit. The binaries cost nothing to keep.

## Implementation plan

1. `src/commands/<product>/mcp.ts` in each MCP package, extending `Command` directly.
2. oclif plugin configuration on each MCP package, plus `prepack` manifest generation — without a
   shipped manifest the host cannot discover the command and JIT never fires.
3. Both MCP packages added to the host's `jitPlugins`.
4. Tests for the stdout guarantees.
5. Client configuration updated in each repo's MCP guide and README, showing the `simply` form
   first and keeping the binary form as the alternative.

## Open questions

- **A combined server may become worth it** if tool counts fall, or if MCP clients grow good
  filtering. The decision above is about today's numbers, not a principle.
- **`--list` output is not machine-readable.** It goes to stderr as text. If something ever needs
  to enumerate tools programmatically, that wants a different, considered format rather than
  parsing this one.
