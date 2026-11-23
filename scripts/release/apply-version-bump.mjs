#!/usr/bin/env node
// Writes a prerelease version bump into the working tree, from nothing but a
// list of `name: version`, and only when every version is the one a version
// step in pre mode could have computed.
//
//   BUMP='{"@waveform-playlist/core":"13.0.0-next.1"}' node scripts/release/apply-version-bump.mjs
//
// In .github/workflows/publish-next.yml the job that runs `changeset version`
// also installs, builds and tests, so it runs dependencies' code and is given
// no right to push. All it hands over is that list. This script runs in the
// job that may push to dev, which installs nothing, and it decides the rest
// from its own checkout:
//
//   - dev must be in pre mode with the tag `next` (.changeset/pre.json here)
//   - a name must be a public package here
//   - a version must be the NEXT prerelease of that package: counted one up
//     from the version here, on a patch, minor or major step from the stable
//     version pre mode started at (`@dawcore/*`: the patch step only)
//   - each package.json keeps this checkout's text; one `"version"` value is
//     replaced, and the result is read back and compared
//   - pre.json's list of consumed changesets is the list here plus the
//     changeset files here
//
// It then asks git what changed, and fails unless that is exactly what it
// wrote. Prints one line per package, `name@version`, for the commit message.
// Uses node's own modules only: the job that runs it has no node_modules.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPublicPackages, repoRoot } from './workspace.mjs';

const PRE_JSON = '.changeset/pre.json';
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PRERELEASE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-next\.(0|[1-9]\d*)$/;

function fail(problems) {
  console.error('The version bump is refused, and nothing was written:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

/** `{ base: [major, minor, patch], count }`; count is -1 for a stable version. */
function parseVersion(version) {
  const stable = STABLE.exec(version);
  if (stable) return { base: stable.slice(1, 4).map(Number), count: -1 };
  const pre = PRERELEASE.exec(version);
  if (pre) return { base: pre.slice(1, 4).map(Number), count: Number(pre[4]) };
  return null;
}

const compareBase = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The bases a pre-mode bump can reach from the version pre mode started at. */
function reachableBases([major, minor, patch], zerover) {
  const patchStep = [major, minor, patch + 1];
  if (zerover) return [patchStep];
  return [patchStep, [major, minor + 1, 0], [major + 1, 0, 0]];
}

function checkVersion(pkg, proposedText, initialText) {
  const proposed = typeof proposedText === 'string' ? PRERELEASE.exec(proposedText) : null;
  if (!proposed) return `version ${JSON.stringify(proposedText)} is not x.y.z-next.N`;
  const next = parseVersion(proposedText);
  const current = parseVersion(pkg.manifest.version);
  const initial = typeof initialText === 'string' ? STABLE.exec(initialText) : null;
  if (!current) return `the version here, "${pkg.manifest.version}", is not one this script knows`;
  if (!initial) return `pre.json has no stable initial version for it (${initialText})`;

  const bases = reachableBases(initial.slice(1, 4).map(Number), pkg.name.startsWith('@dawcore/'));
  if (!bases.some((base) => compareBase(base, next.base) === 0)) {
    const list = bases.map((base) => base.join('.')).join(', ');
    return `${proposedText} is not a step from ${initialText} (${list})`;
  }
  if (compareBase(next.base, current.base) < 0) {
    return `${proposedText} is behind ${pkg.manifest.version}`;
  }
  if (next.count !== current.count + 1) {
    return `${proposedText} does not follow ${pkg.manifest.version} (expected -next.${current.count + 1})`;
  }
  return null;
}

/** This checkout's package.json text with its version value replaced. */
function withVersion(pkg, version) {
  const path = join(repoRoot, pkg.dir, 'package.json');
  const text = readFileSync(path, 'utf8');
  const before = `"version": ${JSON.stringify(pkg.manifest.version)}`;
  if (text.split(before).length !== 2) {
    throw new Error(`${pkg.dir}/package.json does not have ${before} exactly once`);
  }
  const updated = text.replace(before, () => `"version": ${JSON.stringify(version)}`);
  const expected = JSON.stringify({ ...pkg.manifest, version });
  if (JSON.stringify(JSON.parse(updated)) !== expected) {
    throw new Error(`${pkg.dir}/package.json: replacing the version changed something else`);
  }
  return { file: `${pkg.dir}/package.json`, text: updated };
}

// --- what is on dev ---------------------------------------------------------

const pre = JSON.parse(readFileSync(join(repoRoot, PRE_JSON), 'utf8'));
if (pre.mode !== 'pre' || pre.tag !== 'next') {
  fail([
    `${PRE_JSON}: mode "${pre.mode}", tag "${pre.tag}". dev is not in pre mode with the tag next`,
  ]);
}
const packages = new Map(readPublicPackages().map((pkg) => [pkg.name, pkg]));

// --- what was handed over ---------------------------------------------------

let bump;
try {
  bump = JSON.parse(process.env.BUMP ?? '');
} catch {
  fail(['BUMP is not JSON']);
}
if (typeof bump !== 'object' || bump === null || Array.isArray(bump)) fail(['BUMP is not a map']);
const entries = Object.entries(bump);
if (entries.length === 0) fail(['BUMP names no package']);

const problems = [];
const writes = [];
const bumped = [];
for (const [name, version] of entries) {
  const pkg = packages.get(name);
  if (!pkg) {
    problems.push(`${JSON.stringify(name)} is not a public package of this repository`);
    continue;
  }
  const problem = checkVersion(pkg, version, pre.initialVersions?.[name]);
  if (problem) {
    problems.push(`${name}: ${problem}`);
    continue;
  }
  try {
    writes.push(withVersion(pkg, version));
    bumped.push(`${name}@${version}`);
  } catch (error) {
    problems.push(error.message);
  }
}
if (problems.length > 0) fail(problems);

// The changesets a version run consumes: all of them, so all that are here.
const changesetIds = readdirSync(join(repoRoot, '.changeset'))
  .filter((file) => file.endsWith('.md') && file !== 'README.md')
  .map((file) => file.slice(0, -'.md'.length));
const consumed = [...pre.changesets];
for (const id of changesetIds.sort()) {
  if (!consumed.includes(id)) consumed.push(id);
}
writes.push({
  file: PRE_JSON,
  text: `${JSON.stringify({ ...pre, changesets: consumed }, null, 2)}\n`,
});

for (const { file, text } of writes) writeFileSync(join(repoRoot, file), text);

// What git sees must be what was written here: nothing else may have put a
// file into this checkout.
const changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .sort();
const expected = writes.map(({ file }) => ` M ${file}`).sort();
if (changed.join('\n') !== expected.join('\n')) {
  console.error('The working tree does not hold exactly the version bump:\n');
  for (const line of changed.filter((entry) => !expected.includes(entry))) {
    console.error(`  unexpected: ${line}`);
  }
  for (const line of expected.filter((entry) => !changed.includes(entry))) {
    console.error(`  missing:    ${line}`);
  }
  process.exit(1);
}

for (const line of bumped) console.log(line);
