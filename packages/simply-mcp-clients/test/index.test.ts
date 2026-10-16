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

import { expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Pins the runtime exports. Both products' `mcp install` commands import these from npm, so removing
 * or renaming one is a breaking change for them.
 */
it('exports the expected set of runtime values', () => {
  expect(Object.keys(api).sort()).toStrictEqual([
    'CLIENTS',
    'CLIENT_IDS',
    'SIMPLY_CLI_PACKAGE',
    'applyPlan',
    'buildLaunch',
    'currentEnvironment',
    'defaultLauncher',
    'detectInstalledClients',
    'exitCodeFor',
    'formatClientChoices',
    'formatCommandLine',
    'formatInstallReport',
    'installServer',
    'isClientId',
    'isValidServerName',
    'planInstall',
    'resolveEnvFile',
    'runProcess',
  ]);
});
