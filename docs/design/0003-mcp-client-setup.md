# 0003 — Installing the MCP servers into MCP clients

**Status:** In progress (`simply-mcp-clients` implemented; product commands follow its publish)
**Package:** new `packages/simply-mcp-clients` here; `simply-atlassian-mcp`, `simply-gitlab-mcp`;
this host's `jitPlugins` ranges
**Date:** 2026-10-15

## Problem

Since [0001](0001-mcp-servers-under-simply.md), getting a server running is one install. Getting a
client to _launch_ it is still a manual edit of a file whose name, location, top-level key, and
syntax differ per client, and every product README carries a section per client to explain it:

| Client         | File (user scope)                                                                          | Shape                                    |
| -------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Claude Code    | `~/.claude.json`, owned and rewritten by Claude Code itself                                | `mcpServers` (via `claude mcp add-json`) |
| Claude Desktop | `%APPDATA%\Claude\` / `~/Library/Application Support/Claude/` `claude_desktop_config.json` | `mcpServers`                             |
| Cursor         | `~/.cursor/mcp.json`                                                                       | `mcpServers`                             |
| VS Code        | `<user profile>/mcp.json` (JSONC)                                                          | `servers`, with `"type": "stdio"`        |
| Windsurf       | `~/.codeium/windsurf/mcp_config.json`                                                      | `mcpServers`                             |
| Gemini CLI     | `~/.gemini/settings.json`, shared with every other Gemini setting                          | `mcpServers`                             |
| Codex CLI      | `~/.codex/config.toml` (`$CODEX_HOME`)                                                     | TOML `[mcp_servers.<name>]`              |

The edits fail in ways that point nowhere near the cause. The commonest, from the troubleshooting
tables: a GUI client on macOS doesn't inherit the shell's `PATH`, so `simply` installed under nvm is
`ENOENT`; on Windows, Node's `spawn` refuses `simply.cmd` without a shell; a relative or `~`
`--env-file` resolves against the client's working directory; a JSON comma breaks a settings file
that held everything else the person had configured.

## Decision

Each MCP package gains **`<product> mcp install`**, which writes a server entry into one or more
named clients' configuration:

```sh
simply atlassian mcp install --client claude-code --client cursor --env-file ~/atlassian.env
simply gitlab mcp install --client vscode --scope project
```

The knowledge of the clients — where each keeps its file, what shape it wants, how to edit it
without destroying what else is in it — lives **once**, in a new library package
`@simplysf/simply-mcp-clients` in this repo. The two commands are thin: each describes its own
server (name, launch arguments, which flags it forwards) and hands that to the library. This is
0012's rule from `simply-atlassian` applied across repos: the client table changes every time a
client moves a file, and two copies of it would drift in the first month.

The library follows the products' core-package rule: no terminal, no `process.argv`, no stdout. It
returns a plan; the command prints it.

## Behavior

### Command

`simply atlassian mcp install` and `simply gitlab mcp install`, identical except for the
server-specific flags. `atlassian mcp` stays a command and also becomes a topic; oclif matches the
longest command id, so `atlassian mcp install` reaches the new command and `atlassian mcp` with no
argument still serves.

| Flag                    | Meaning                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `--client <id>`         | Required, repeatable: `claude-code`, `claude-desktop`, `cursor`, `vscode`, `windsurf`, `gemini`, `codex`. |
| `--scope user\|project` | Default `user`. `project` writes the client's repo-level file in the current directory, where one exists. |
| `--env-file <path>`     | Forwarded to the server. Resolved to an absolute path and required to exist, here, at install time.       |
| `--allow-writes`        | Forwarded. Also changes the default name to `simply-<product>-write`, matching the two-entry arrangement. |
| `--xray`                | Atlassian only. Forwarded.                                                                                |
| `--name <name>`         | Entry name. Default `simply-<product>` (or `-write`, above).                                              |
| `--launcher <style>`    | `absolute` (default for `user`), `simply` (default for `project`), `npx`. See below.                      |
| `--force`               | Replace an existing entry of the same name that differs.                                                  |
| `--dry-run`             | Print what would be written, per client, and change nothing.                                              |
| `--json`                | The plan or result as JSON. This command is not a protocol server, so `--json` is safe here.              |

Without `--client`, the command fails with exit 2 and lists the client ids, marking the ones whose
configuration directory exists on this machine. It does not guess: writing into a client the
person didn't name is the one outcome worse than writing nothing.

There is no interactive mode, for the reason the products have none: the dominant caller is often
an agent, and an agent can't answer a prompt.

### What gets written

The entry launches the same server `simply <product> mcp` runs, with the forwarded flags. Never a
credential: the only way to give it connection settings is `--env-file`, which is written as a path.
If `--env-file` is absent the command still installs, and warns (stderr) that the client must
supply the settings in the entry's `env` block — which a GUI client will not fill from the shell.

| `--launcher` | `command`                      | `args` prefix                                 | For                                                                         |
| ------------ | ------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------- |
| `absolute`   | this Node (`process.execPath`) | the host's `bin/run.js`, then `<product> mcp` | Personal config. Survives GUI `PATH` and Windows `.cmd`.                    |
| `simply`     | `simply`                       | `<product> mcp`                               | Committed project files, where an absolute path is wrong for everyone else. |
| `npx`        | `npx`                          | `-y @simplysf/simply-cli <product> mcp`       | Machines with no global install.                                            |

`absolute` pins the Node binary, so a Node upgrade under nvm breaks it; the result text says so,
and re-running with `--force` repairs it. That trade is taken knowingly: a broken path after an
upgrade is reported by the client as a missing file, which is at least true, whereas `ENOENT` on
`simply` from a GUI client is the failure people can't diagnose.

### How each client is edited

| Client           | Mechanism                                                                        | `project` scope               |
| ---------------- | -------------------------------------------------------------------------------- | ----------------------------- |
| `claude-code`    | `claude mcp add-json <name> <json> --scope user` (removes first under `--force`) | `.mcp.json`, edited as a file |
| `claude-desktop` | file edit                                                                        | none — refused, exit 2        |
| `cursor`         | file edit                                                                        | `.cursor/mcp.json`            |
| `vscode`         | file edit, `servers` key, `"type": "stdio"`                                      | `.vscode/mcp.json`            |
| `windsurf`       | file edit                                                                        | none — refused                |
| `gemini`         | file edit                                                                        | `.gemini/settings.json`       |
| `codex`          | `codex mcp add <name> -- <command> <args…>` (removes first under `--force`)      | none — refused                |

Shell out to the client's own CLI where the client owns a file it rewrites (`~/.claude.json`, which
Claude Code writes on every session, so an edit races it) or where the format is one this package
would otherwise have to write faithfully (TOML with the person's comments in it). If that CLI is
not on `PATH`, the client fails with the exact command to run by hand, and the other named clients
still proceed.

Every file edit:

- **Preserves everything else.** Only the one entry's text changes. Every other byte stays as it was,
  including comments, key order, trailing commas, and line endings. The new entry follows the file's
  own indentation. VS Code's file is JSONC, and Gemini's holds every other setting the person has.
  The file is parsed with `jsonc-parser`'s `parseTree`, and the inserter that writes the entry is
  this package's own. `jsonc-parser`'s `modify` was the plan, but given formatting options it
  reformats the neighbouring entry and moves a trailing `// comment` onto the new line. Without
  them, it writes the new entry on a single line.
- **Refuses an unparseable file** (exit 2, naming the file and the parse error) rather than
  replacing it.
- **Creates the file and its directory** if absent — except where the directory's absence means the
  client isn't installed, which is reported as such. At user scope that directory is the client's
  own (`~/.cursor`, `~/.gemini`, `~/.codeium/windsurf`, `Claude` and `Code` under the
  application data directory). At project scope nothing is required.
- **Keeps a backup** at `<file>.bak` before changing an existing file, and **writes atomically**
  (temp file and rename).

### Results

Per client, one of:

| Outcome     | Meaning                                                             | Exit contribution |
| ----------- | ------------------------------------------------------------------- | ----------------- |
| `added`     | No entry of that name existed.                                      | 0                 |
| `replaced`  | One existed, differed, and `--force` was given.                     | 0                 |
| `unchanged` | One existed and was identical. Running twice is safe.               | 0                 |
| `conflict`  | One existed and differed, without `--force`. Nothing written.       | 2                 |
| `failed`    | Unparseable file, missing client CLI, unsupported scope, I/O error. | 2 (1 for I/O)     |

The command exits with the highest contribution, after attempting every client. The text output
ends with what to do next — restart Claude Desktop/Windsurf, `/mcp` in Claude Code — because
nothing here can tell whether the client noticed.

## Alternatives considered

**Duplicate the client module in each MCP package.** No new package and no release ordering. Rejected
because the client table is the most volatile thing in the feature, and the products' own design
history (0012 in `simply-atlassian`) records what two copies of one rule do.

**A host-level `simply mcp install --product atlassian`.** One command for both. Rejected for
0001's reason: the host has no commands of its own and would need the products' server-specific
flags (`--xray`) without owning them. The library gives the same single implementation.

**Edit `~/.claude.json` and `config.toml` directly.** Uniform, no dependency on the client's CLI.
Rejected: Claude Code rewrites its file during sessions, and a TOML round-trip that preserves
comments needs a library this package would carry for one client. The fallback when the CLI is
missing is the exact command, which is no worse than today.

**`code --add-mcp` for VS Code.** Supported, but it can't replace an entry or target a workspace,
and the file is ours to edit safely anyway.

**Write the env values into the entry.** What most third-party installers do. Rejected: tokens end
up in files that get synced, screenshotted, and committed, and the products already have a
credentials story built on env files and read-scoped tokens.

**Interactive picker.** Nicer for a person at a terminal, unusable for an agent, and the error on a
missing `--client` lists the choices anyway.

## Implementation plan

1. `packages/simply-mcp-clients` here: `ServerSpec`, a `CLIENTS` table (paths per platform, honoring
   `APPDATA`, `XDG_CONFIG_HOME`, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`), `planInstall(spec, client, scope, env) → Plan` (pure),
   `applyPlan(plan, { force, dryRun })`, and `installServer` across several clients. It also
   provides `buildLaunch` (the three launchers), `resolveEnvFile`, `exitCodeFor`,
   `detectInstalledClients`, and the report text (`formatInstallReport`, `formatClientChoices`).
   This keeps each product command to flag parsing. It depends on `jsonc-parser` and `cross-spawn`
   (`claude` and `codex` are `.cmd` shims on Windows). Publish it before either product.
2. `src/commands/<product>/mcp/install.ts` in each MCP package, building the `ServerSpec` and
   rendering results. Design-doc rows in each product repo pointing here, per their process.
3. Product READMEs and `docs/guides/mcp-server.md`: lead with `mcp install`, keep the per-client
   sections as the reference for what it writes.
4. This host: raise both MCP `jitPlugins` lower bounds to the releases that ship the command.

## Testing

Library, all against a temp `HOME`/`APPDATA` and a stubbed process runner: each client's path per
platform; add/unchanged/conflict/replace; comments and unrelated keys survive a VS Code and a Gemini
edit byte-for-byte outside the entry; an unparseable file is refused untouched; `.bak` and atomic
write; the exact argv given to `claude` and `codex`, and the fallback message when they're absent;
unsupported scopes refused; launcher styles; `--env-file` made absolute and checked.

Commands: flag forwarding into `args` (`--allow-writes`, `--xray`, `--env-file`); the default name
switch; exit code is the highest across clients; missing `--client` lists ids.

## Open questions

- **More clients.** Zed, Cline, JetBrains AI, Copilot CLI. Each is a table row; add on a concrete ask.
- **`mcp uninstall`.** Small given the plan/apply split; deferred until someone asks.
- **`simply` launcher on Windows project files.** `simply` is a `.cmd` there, which some clients can
  only start through `cmd /c` — which in turn isn't portable to a teammate's Mac. Today's answer is
  to document it; a per-client override may be worth it.
- **Writing the env file.** `--env-file` must already exist. Generating one from prompts would
  overlap the products' credentials guide and is left out.
