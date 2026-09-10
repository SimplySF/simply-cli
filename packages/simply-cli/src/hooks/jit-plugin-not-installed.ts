/*
 * Copyright (c) 2026, SimplySF.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { type Hook } from '@oclif/core';

/**
 * Installs a product CLI the moment one of its commands is first run.
 *
 * `simply` ships knowing which commands exist — `oclif manifest --jit` folds every declared
 * plugin's command metadata into this package at build time — but it depends on none of them. So
 * `simply gitlab mr list` on a fresh install finds the command, discovers its plugin is not
 * present, and lands here.
 *
 * What oclif does with the result is the whole contract, and it is worth stating because it is not
 * obvious from the signature: **returning anything means "installed"**. oclif then reloads its
 * plugins and re-dispatches the original command itself, so this hook must not try to run the
 * command. Throwing means the install failed and the error reaches the user. Returning nothing at
 * all is read as "no hook exists", and oclif falls back to reporting the command as not found —
 * which would be a baffling message for a command it just listed in `--help`.
 */
const hook: Hook<'jit_plugin_not_installed'> = async function (options) {
  const { command, config, pluginName, pluginVersion } = options;
  const spec = `${pluginName}@${pluginVersion}`;

  // stderr, not stdout: a command's output is frequently piped into jq or a file, and a line about
  // installing a plugin has no business in it.
  process.stderr.write(`Installing ${pluginName} to run ${command.id} (first run only)…\n`);

  try {
    // Delegated to plugin-plugins rather than shelling out to npm, so the plugin lands in the same
    // place `simply plugins` manages and can be listed, updated, and removed like any other.
    await config.runCommand('plugins:install', [spec]);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not install ${spec}, which ${command.id} needs.\n${reason}\n\n` +
        `This first run needs network access and permission to write to ${config.dataDir}. ` +
        `On a locked-down or offline machine, install it ahead of time with: simply plugins install ${spec}`,
      { cause: error },
    );
  }

  process.stderr.write(`Installed ${pluginName}.\n`);

  // Truthy so oclif treats the plugin as present, reloads, and runs the command. The value itself
  // is never read.
  return { installed: pluginName };
};

export default hook;
