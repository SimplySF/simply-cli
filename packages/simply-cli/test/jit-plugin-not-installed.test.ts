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

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import hook from '../src/hooks/jit-plugin-not-installed.js';

/**
 * The hook's contract with oclif is the thing worth testing, and it is easy to get wrong because
 * it is expressed only in oclif's dispatch code: returning a value means "installed, carry on",
 * throwing means "failed", and returning nothing means "no hook here" — which makes oclif report
 * the command as not found, for a command it just listed in `--help`.
 */

let stderr: string[];
let restore: () => void;
let fetched: string[];

/** Stands in for the registry: answers every lookup with these published versions. */
function registry(versions: string[] | Error): void {
  vi.stubGlobal('fetch', async (url: string) => {
    fetched.push(url);
    if (versions instanceof Error) throw versions;
    return new Response(JSON.stringify({ versions: Object.fromEntries(versions.map((v) => [v, {}])) }));
  });
}

beforeEach(() => {
  fetched = [];
  // Unreachable unless a test says otherwise, so no test depends on the network.
  registry(new Error('ENOTFOUND registry.npmjs.org'));
  stderr = [];
  const original = process.stderr.write.bind(process.stderr);
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderr.push(String(chunk));
    return true;
  });
  restore = () => {
    process.stderr.write = original;
  };
});

afterEach(() => {
  restore();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The slice of oclif's hook context this hook actually touches. */
function context(runCommand: (id: string, argv: string[]) => Promise<unknown>) {
  return {
    command: { id: 'gitlab:mr:list' },
    config: { runCommand, dataDir: '/home/me/.local/share/simply' },
    pluginName: '@simplysf/simply-gitlab',
    pluginVersion: '^1.0.0',
    argv: [],
    id: 'gitlab:mr:list',
  };
}

/** Calls the hook the way oclif does, with the context bound as `this`. */
async function invoke(ctx: ReturnType<typeof context>): Promise<unknown> {
  return (hook as unknown as (this: unknown, options: unknown) => Promise<unknown>).call({}, ctx);
}

describe('the jit_plugin_not_installed hook', () => {
  it('installs the plugin at the version the host declared', async () => {
    const calls: Array<{ id: string; argv: string[] }> = [];
    await invoke(
      context(async (id, argv) => {
        calls.push({ id, argv });
        return undefined;
      }),
    );

    expect(calls).toStrictEqual([{ id: 'plugins:install', argv: ['@simplysf/simply-gitlab@^1.0.0'] }]);
  });

  it('returns a value, which is how oclif is told to reload and run the command', async () => {
    // Returning nothing would read as "no hook exists" and oclif would report the command as
    // not found — for a command it had just listed in --help.
    const result = await invoke(context(async () => undefined));
    expect(result).toBeTruthy();
  });

  it('reports progress on stderr, never stdout', async () => {
    // A command's output is routinely piped into jq or a file; an install notice has no business
    // in it.
    await invoke(context(async () => undefined));

    expect(stderr.join('')).toMatch(/Installing @simplysf\/simply-gitlab/);
    expect(stderr.join('')).toMatch(/Installed @simplysf\/simply-gitlab/);
  });

  it('throws when the install fails, naming what to do offline', async () => {
    await expect(
      invoke(
        context(() => {
          throw new Error('ENOTFOUND registry.npmjs.org');
        }),
      ),
    ).rejects.toThrow(/simply plugins install @simplysf\/simply-gitlab@\^1\.0\.0/);
  });

  it('keeps the underlying failure in the message', async () => {
    await expect(
      invoke(
        context(() => {
          throw new Error('EACCES permission denied');
        }),
      ),
    ).rejects.toThrow(/EACCES permission denied/);
  });

  it('says which command triggered the install', async () => {
    await invoke(context(async () => undefined));
    expect(stderr.join('')).toMatch(/to run gitlab:mr:list/);
  });
});

describe('the version it installs', () => {
  // A spec with a space in it reaches npm as two arguments on Windows, and the second one installs
  // the unrelated npm package `undefined`. These pin the hook to installing an exact version.

  async function installed(): Promise<string[]> {
    const argv: string[] = [];
    await invoke(
      context(async (_id, args) => {
        argv.push(...args);
        return undefined;
      }),
    );
    return argv;
  }

  it('is the newest published version inside the declared range', async () => {
    registry(['0.9.0', '1.0.0', '1.4.2', '1.5.0-beta.1', '2.0.0']);
    expect(await installed()).toStrictEqual(['@simplysf/simply-gitlab@1.4.2']);
  });

  it('is looked up with the scope separator escaped, as the registry requires', async () => {
    registry(['1.0.0']);
    await installed();
    expect(fetched).toStrictEqual(['https://registry.npmjs.org/@simplysf%2fsimply-gitlab']);
  });

  it('falls back to the declared range when the registry cannot be reached', async () => {
    expect(await installed()).toStrictEqual(['@simplysf/simply-gitlab@^1.0.0']);
  });

  it('falls back to the declared range when nothing published satisfies it', async () => {
    registry(['0.9.0']);
    expect(await installed()).toStrictEqual(['@simplysf/simply-gitlab@^1.0.0']);
  });
});

describe('the declared jitPlugins ranges', () => {
  it('contain no whitespace', () => {
    // `simply plugins update` hands these to npm verbatim, where the hook cannot intervene, so a
    // space here brings the `undefined` package back on Windows. Use a space-free range such as `0.x`.
    const pjson = JSON.parse(
      fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
    ) as { oclif: { jitPlugins: Record<string, string> } };

    for (const [name, range] of Object.entries(pjson.oclif.jitPlugins)) {
      expect(range, name).not.toMatch(/\s/);
    }
  });
});
