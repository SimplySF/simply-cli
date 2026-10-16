# @simplysf/simply-mcp-clients

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-mcp-clients?label=@simplysf/simply-mcp-clients)](https://npmjs.com/@simplysf/simply-mcp-clients) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-cli/main/LICENSE.txt)

Writes an MCP server entry into an MCP client's configuration, and leaves the rest of that configuration as it was. It powers `simply atlassian mcp install` and `simply gitlab mcp install`. See [design 0003](https://github.com/SimplySF/simply-cli/blob/main/docs/design/0003-mcp-client-setup.md) for the reasoning.

It is a library, not a CLI. It never writes to stdout or stderr and never reads `process.argv`. It plans an install, applies it, and returns results and report text for the caller to print.

## Clients

| Id               | User scope                                                                                                    | Project scope           |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `claude-code`    | `claude mcp add-json … --scope user`                                                                          | `.mcp.json`             |
| `claude-desktop` | `claude_desktop_config.json` in `%APPDATA%\Claude` / `Application Support/Claude` / `$XDG_CONFIG_HOME/Claude` | none                    |
| `cursor`         | `~/.cursor/mcp.json`                                                                                          | `.cursor/mcp.json`      |
| `vscode`         | `Code/User/mcp.json` in the same application data directory, key `servers`                                    | `.vscode/mcp.json`      |
| `windsurf`       | `~/.codeium/windsurf/mcp_config.json`                                                                         | none                    |
| `gemini`         | `~/.gemini/settings.json`                                                                                     | `.gemini/settings.json` |
| `codex`          | `codex mcp add <name> -- …` (`$CODEX_HOME/config.toml`)                                                       | none                    |

## Usage

```ts
import {
  buildLaunch,
  currentEnvironment,
  exitCodeFor,
  formatInstallReport,
  installServer,
  resolveEnvFile,
} from '@simplysf/simply-mcp-clients';

const environment = currentEnvironment();
const envFile = await resolveEnvFile('~/gitlab.env', environment); // absolute, and checked to exist
const launch = buildLaunch('absolute', ['gitlab', 'mcp', '--env-file', envFile], {
  nodePath: process.execPath,
  runScript: '/path/to/simply-cli/bin/run.js',
});

const results = await installServer(
  { name: 'simply-gitlab', ...launch },
  ['cursor', 'claude-code'],
  'user',
  environment,
  {
    force: false,
    dryRun: false,
  },
);
console.log(formatInstallReport(results, 'absolute'));
process.exitCode = exitCodeFor(results);
```

Each client produces one result: `added`, `replaced`, `unchanged`, `conflict` or `failed`. A conflict, a refused file and a missing client CLI each contribute exit code 2, and an I/O error contributes 1. `exitCodeFor` returns the highest code across all results.

### How files are edited

- **Only the one entry changes.** The new or replaced entry follows the file's own indentation and line endings. Every other byte stays as it was, comments and trailing commas included.
- **An unparseable file is refused** and left untouched.
- **A backup comes first.** When an existing file changes, it is first copied to `<file>.bak`. The new content goes to a temporary file that is then renamed over the original.
- **A missing client is not created.** If a client's user directory (such as `~/.cursor`) is missing, the client is reported as not installed, and its file is not created.
- **Claude Code and Codex are changed through their own CLIs.** Their files are only read, to check for an existing entry. If the CLI is not on `PATH`, the result includes the exact command to run by hand.

Lower-level pieces are exported as well: `planInstall` (pure) and `applyPlan`, `detectInstalledClients`, `formatClientChoices`, and the `CLIENTS` table.

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-cli/main/LICENSE.txt) license.
