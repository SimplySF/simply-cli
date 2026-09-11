#!/usr/bin/env node
// Builds this site's product documentation from the *published* packages the host declares in
// `oclif.jitPlugins`, rather than from any checkout.
//
// Each package tarball carries three things this needs: `oclif.manifest.json` (every command with
// its flags and examples), `README.md`, and `docs/` (the hand-written guides). Downloading them is
// the same mechanism `oclif manifest --jit` already uses at release time, which means the site
// describes exactly what someone installing `simply` today would get — not what is on a branch.
//
// The output directory is gitignored and rebuilt from scratch on every run. Nothing under it is
// hand-edited.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..');
const hostPkg = JSON.parse(fs.readFileSync(path.resolve(siteRoot, '../packages/simply-cli/package.json'), 'utf8'));
const outputRoot = path.join(siteRoot, 'src/content/docs');
const publicRoot = path.join(siteRoot, 'public');

/**
 * The products this site documents, and how their packages map onto it.
 *
 * `cli` and `mcp` are looked up in the host's `jitPlugins`, so the versions rendered are always the
 * ones the host would actually install. Adding a product here and to `jitPlugins` is the whole
 * change needed to document it.
 */
const PRODUCTS = [
  {
    slug: 'atlassian',
    title: 'Atlassian',
    blurb: 'Jira and Confluence from the command line.',
    cli: '@simplysf/simply-atlassian',
    mcp: '@simplysf/simply-atlassian-mcp',
    order: 1,
  },
  {
    slug: 'gitlab',
    title: 'GitLab',
    blurb: 'Projects, merge requests, CI/CD, and configuration baselines.',
    cli: '@simplysf/simply-gitlab',
    mcp: '@simplysf/simply-gitlab-mcp',
    order: 2,
  },
];

/** How commands are grouped into reference pages, per product. First match wins. */
const GROUPS = {
  atlassian: [
    { match: 'atlassian:jira:issue:comment', file: 'jira-issue-comments', title: 'Jira — Issue comments' },
    { match: 'atlassian:jira:issue:link', file: 'jira-issue-links', title: 'Jira — Issue links' },
    { match: 'atlassian:jira:issue', file: 'jira-issues', title: 'Jira — Issues' },
    { match: 'atlassian:jira:sprint', file: 'jira-boards-sprints', title: 'Jira — Boards and sprints' },
    { match: 'atlassian:jira:board', file: 'jira-boards-sprints', title: 'Jira — Boards and sprints' },
    { match: 'atlassian:jira:user', file: 'jira-users', title: 'Jira — Users' },
    { match: 'atlassian:jira:whoami', file: 'jira-users', title: 'Jira — Users' },
    { match: 'atlassian:confluence', file: 'confluence', title: 'Confluence' },
    { match: 'atlassian:jira', file: 'jira-other', title: 'Jira — Other' },
    { match: 'atlassian:mcp', file: 'mcp', title: 'MCP server' },
  ],
  gitlab: [
    { match: 'gitlab:config', file: 'config-baselines', title: 'Configuration baselines' },
    { match: 'gitlab:mr', file: 'merge-requests', title: 'Merge requests' },
    { match: 'gitlab:file', file: 'repository-files', title: 'Repository files' },
    { match: 'gitlab:commit', file: 'commits', title: 'Commits' },
    { match: 'gitlab:branch', file: 'branches-tags', title: 'Branches, tags, and releases' },
    { match: 'gitlab:tag', file: 'branches-tags', title: 'Branches, tags, and releases' },
    { match: 'gitlab:release', file: 'branches-tags', title: 'Branches, tags, and releases' },
    { match: 'gitlab:ci', file: 'cicd', title: 'CI/CD' },
    { match: 'gitlab:project', file: 'projects', title: 'Projects' },
    { match: 'gitlab:search', file: 'search', title: 'Search' },
    { match: 'gitlab:mcp', file: 'mcp', title: 'MCP server' },
  ],
};

const BIN = 'simply';

/**
 * Running npm is fiddlier on Windows than it looks, and both halves bite.
 *
 * Node refuses to spawn a `.cmd` shim without a shell (a deliberate security fix), so Windows needs
 * `shell: true`. But a version range like `>=0.11.0 <1.0.0` contains `>` and `<`, which a shell then
 * reads as redirection — so the spec has to be quoted too. Getting one right and not the other
 * fails as "the system cannot find the file specified", which points nowhere useful.
 */
const IS_WINDOWS = process.platform === 'win32';
const NPM = IS_WINDOWS ? 'npm.cmd' : 'npm';
const quoteSpec = (spec) => (IS_WINDOWS ? `"${spec}"` : spec);

// --- Fetching -----------------------------------------------------------------------------------

/**
 * Downloads a package tarball and unpacks it, returning the directory holding `package/`.
 *
 * `npm pack <spec>` rather than a git checkout, so what is rendered is what was published. The
 * version comes from the host's declared range, so the site and the CLI can never disagree about
 * which version they mean.
 */
function fetchPackage(spec, range, into) {
  const dir = path.join(into, spec.replace(/[@/]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const wanted = `${spec}@${range}`;

  const stdout = execFileSync(NPM, ['pack', quoteSpec(wanted), '--pack-destination', quoteSpec(dir), '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: IS_WINDOWS,
  });
  const [{ filename, version }] = JSON.parse(stdout);

  // `tar` rather than a library: it is what oclif itself uses for this, and it is present
  // everywhere this runs. On Windows the GNU tar from Git Bash reads `C:\...` as a remote host, so
  // extraction happens with the archive named relative to its own directory.
  execFileSync('tar', ['-xzf', filename], { cwd: dir, stdio: 'ignore' });
  return { dir: path.join(dir, 'package'), version };
}

// --- Rendering ----------------------------------------------------------------------------------

function frontmatter({ title, description, order }) {
  return [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    'sidebar:',
    `  order: ${order}`,
    '---',
    '',
    '',
  ].join('\n');
}

/** Escapes a value for a fenced block; manifest text is authored by us, so this is light. */
function text(value) {
  return String(value ?? '').trimEnd();
}

/** Renders one flag as a definition row. */
function renderFlag(name, flag) {
  const parts = [];
  if (flag.char) parts.push(`-${flag.char}`);
  parts.push(`--${name}`);
  const spec = flag.type === 'boolean' ? parts.join(', ') : `${parts.join(', ')} <value>`;

  const notes = [];
  if (flag.required) notes.push('required');
  if (flag.default !== undefined) notes.push(`default: \`${flag.default}\``);
  if (Array.isArray(flag.options)) notes.push(`one of: ${flag.options.map((o) => `\`${o}\``).join(', ')}`);
  if (flag.env) notes.push(`env: \`${flag.env}\``);
  if (flag.multiple && !/repeatable/i.test(flag.summary ?? '')) notes.push('repeatable');

  const suffix = notes.length > 0 ? ` _(${notes.join('; ')})_` : '';
  return `- \`${spec}\` — ${text(flag.summary ?? flag.description ?? '')}${suffix}`;
}

/**
 * Renders one command from its manifest entry.
 *
 * Generated from the manifest rather than scraped out of the README's oclif block: the manifest is
 * structured, so flags keep their types, defaults, and allowed values instead of being whatever a
 * regex managed to pull out of formatted help text.
 */
function renderCommand(id, command) {
  const invocation = `${BIN} ${id.split(':').join(' ')}`;
  const lines = [`## \`${invocation}\``, '', text(command.summary), ''];

  const flags = Object.entries(command.flags ?? {}).filter(([, flag]) => !flag.hidden);
  const connection = flags.filter(([, f]) => f.helpGroup === 'CONNECTION');
  const ordinary = flags.filter(([, f]) => f.helpGroup !== 'CONNECTION' && f.name !== 'json');

  if (ordinary.length > 0) {
    lines.push('**Flags**', '', ...ordinary.map(([name, flag]) => renderFlag(name, flag)), '');
  }
  if (connection.length > 0) {
    lines.push('**Connection**', '', ...connection.map(([name, flag]) => renderFlag(name, flag)), '');
  }
  if (command.enableJsonFlag) {
    lines.push('**Global**', '', '- `--json` — the raw API payload, for scripts and agents.', '');
  }

  if (command.description) lines.push(text(command.description), '');

  const examples = (command.examples ?? []).map((e) => (typeof e === 'string' ? { command: e } : e));
  if (examples.length > 0) {
    lines.push('**Examples**', '');
    for (const example of examples) {
      if (example.description) lines.push(example.description, '');
      lines.push(
        '```sh',
        text(example.command)
          .replaceAll('<%= config.bin %>', BIN)
          .replaceAll('<%= command.id %>', id.split(':').join(' ')),
        '```',
        '',
      );
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Rewrites links in a guide that was written for a per-product site.
 *
 * Those guides use root-relative links like `/guides/credentials/`, which under the combined site
 * live one level deeper. Left alone they would 404, and the link checker in CI would be the thing
 * that told us — after the fact.
 */
function rewriteLinks(markdown, slug) {
  return markdown
    .replaceAll('](/guides/', `](/${slug}/guides/`)
    .replaceAll('](/reference/', `](/${slug}/reference/`)
    .replaceAll('](/getting-started/', `](/${slug}/getting-started/`);
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

// --- Build --------------------------------------------------------------------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-docs-'));
const summary = [];

for (const product of PRODUCTS) {
  const specs = [product.cli, product.mcp].filter((s) => hostPkg.oclif.jitPlugins[s] !== undefined);
  if (specs.length === 0) {
    console.warn(`sync-products: ${product.slug} declares no packages in jitPlugins; skipping`);
    continue;
  }

  const productDir = path.join(outputRoot, product.slug);
  fs.rmSync(productDir, { recursive: true, force: true });

  const commands = {};
  const versions = {};
  let guides = 0;

  for (const spec of specs) {
    const { dir, version } = fetchPackage(spec, hostPkg.oclif.jitPlugins[spec], tmp);
    versions[spec] = version;

    const manifestPath = path.join(dir, 'oclif.manifest.json');
    if (fs.existsSync(manifestPath)) {
      Object.assign(commands, JSON.parse(fs.readFileSync(manifestPath, 'utf8')).commands);
    } else {
      console.warn(`sync-products: ${spec}@${version} ships no oclif.manifest.json; its commands are missing`);
    }

    // Guides ship inside the package, so they are versioned with it.
    const docsDir = path.join(dir, 'docs');
    if (!fs.existsSync(docsDir)) {
      console.warn(`sync-products: ${spec}@${version} ships no docs/; its guides are missing`);
      continue;
    }

    for (const entry of fs
      .readdirSync(path.join(docsDir, 'guides'), { withFileTypes: true })
      .filter((e) => e.isFile())) {
      const body = rewriteLinks(fs.readFileSync(path.join(docsDir, 'guides', entry.name), 'utf8'), product.slug);
      write(path.join(productDir, 'guides', entry.name), body);
      guides += 1;
    }

    const gettingStarted = path.join(docsDir, 'getting-started.md');
    if (fs.existsSync(gettingStarted)) {
      write(
        path.join(productDir, 'getting-started.md'),
        rewriteLinks(fs.readFileSync(gettingStarted, 'utf8'), product.slug),
      );
    }

    // Anything under docs/schema is a published artefact (JSON Schema and friends) and is served
    // verbatim, so the `$schema` URL in someone's config keeps resolving.
    const schemaDir = path.join(docsDir, 'schema');
    if (fs.existsSync(schemaDir)) {
      for (const entry of fs.readdirSync(schemaDir)) {
        write(path.join(publicRoot, 'schema', entry), fs.readFileSync(path.join(schemaDir, entry), 'utf8'));
      }
    }
  }

  // Reference pages, grouped.
  const groups = GROUPS[product.slug] ?? [];
  const pages = new Map();
  const unmatched = [];

  for (const id of Object.keys(commands).sort()) {
    const group = groups.find((g) => id.startsWith(g.match));
    if (!group) {
      unmatched.push(id);
      continue;
    }
    if (!pages.has(group.file)) pages.set(group.file, { group, bodies: [] });
    pages.get(group.file).bodies.push(renderCommand(id, commands[id]));
  }
  for (const id of unmatched) console.warn(`sync-products: no reference group matched ${id}`);

  const rows = [];
  const ordered = [...pages.entries()].sort(([, a], [, b]) => groups.indexOf(a.group) - groups.indexOf(b.group));
  let order = 1;
  for (const [file, { group, bodies }] of ordered) {
    write(
      path.join(productDir, 'reference', `${file}.md`),
      frontmatter({
        title: group.title,
        description: `${group.title} commands for ${product.title}.`,
        order: order++,
      }) +
        bodies.join('\n\n') +
        '\n',
    );
    rows.push(`| [${group.title}](/${product.slug}/reference/${file}/) | ${bodies.length} |`);
  }

  write(
    path.join(productDir, 'reference', 'index.md'),
    frontmatter({
      title: 'Command Reference',
      description: `Every ${product.title} command, generated from the published package.`,
      order: 0,
    }) +
      [
        `Every \`${BIN} ${product.slug}\` command, generated from`,
        `\`${product.cli}@${versions[product.cli] ?? '?'}\` as published — so this always matches the`,
        '`--help` of what you have installed.',
        '',
        '| Page | Commands |',
        '| ---- | -------- |',
        ...rows,
        '',
      ].join('\n'),
  );

  // A landing page per product, listing only what this build actually produced — so a guide that
  // has not shipped yet is simply absent rather than a link to nowhere.
  const guidesDir = path.join(productDir, 'guides');
  const guidePages = fs.existsSync(guidesDir) ? fs.readdirSync(guidesDir).filter((f) => f.endsWith('.md')) : [];
  const guideLinks = guidePages.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const title = slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    return `- [${title}](/${product.slug}/guides/${slug}/)`;
  });
  const hasGettingStarted = fs.existsSync(path.join(productDir, 'getting-started.md'));

  write(
    path.join(productDir, 'index.md'),
    frontmatter({ title: product.title, description: product.blurb, order: 0 }) +
      [
        product.blurb,
        '',
        'Install the `simply` CLI and this product installs itself the first time you use it.',
        '',
        '```sh',
        'npm install -g @simplysf/simply-cli',
        `simply ${product.slug} --help`,
        '```',
        '',
        ...(hasGettingStarted ? [`- [Get started](/${product.slug}/getting-started/)`] : []),
        `- [Command reference](/${product.slug}/reference/)`,
        ...guideLinks,
        '',
        ...(guideLinks.length === 0
          ? ['The guides for this product ship inside its package and appear here from its next release onwards.', '']
          : []),
      ].join('\n'),
  );

  summary.push(
    `${product.slug}: ${Object.keys(commands).length} commands, ${guides} guide(s), from ${specs
      .map((s) => `${s.split('/')[1]}@${versions[s]}`)
      .join(' + ')}`,
  );
}

fs.rmSync(tmp, { recursive: true, force: true });
for (const line of summary) console.log(line);
