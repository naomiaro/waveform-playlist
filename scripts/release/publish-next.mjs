#!/usr/bin/env node
// Publishes, under the npm dist-tag `next`, every package whose version in the
// working tree is a prerelease (x.y.z-next.N) that the registry does not have.
//
//   node scripts/release/publish-next.mjs                 pack and publish (a terminal with an npm login)
//   node scripts/release/publish-next.mjs --dry-run       pack, and let npm check each upload without sending it
//   node scripts/release/publish-next.mjs --list          only say what the registry lacks (last line: missing=N)
//   node scripts/release/publish-next.mjs --pack <dir>    only pack what the registry lacks into <dir>
//   node scripts/release/publish-next.mjs --from <dir>    only publish, from tarballs packed into <dir>
//
// It never publishes a stable version and never moves `latest`. A version the
// registry already has is skipped, so a run that failed half-way is run again.
// The packages must be built before they are packed (`pnpm build`): no package
// has a prepublish hook. pnpm packs, which writes the `workspace:` ranges out
// as versions; npm uploads, which is what authenticates.
//
// .github/workflows/publish-next.yml packs in one job (`--pack`) and publishes
// in another (`--from`), which holds the right to publish and runs no
// dependency's code: no install, no build. The tarballs come from a job that
// did run such code, so `--from` trusts nothing about one but what
// `inspectTarball` finds in it. This file uses node's own modules only, for
// the same reason: the publish job has no node_modules.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  fetchPackument,
  inDependencyOrder,
  isPrerelease,
  readPublicPackages,
  repoRoot,
} from './workspace.mjs';

const DIST_TAG = 'next';
const MANIFEST_PATH = 'package/package.json';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`${name} needs a directory`);
    process.exit(2);
  }
  return resolve(value);
};

const dryRun = flag('--dry-run');
const listOnly = flag('--list');
const packInto = valueOf('--pack');
const publishFrom = valueOf('--from');

const tar = (tarArgs) =>
  execFileSync('tar', tarArgs, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

/** Packs one package into `dir` and returns the tarball's path. */
function pack(pkg, dir) {
  const before = new Set(readdirSync(dir));
  execFileSync('pnpm', ['pack', '--pack-destination', dir], {
    cwd: join(repoRoot, pkg.dir),
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const added = readdirSync(dir).filter((file) => file.endsWith('.tgz') && !before.has(file));
  if (added.length !== 1) {
    throw new Error(`expected one new tarball for ${pkg.name}, found ${added.length}`);
  }
  return join(dir, added[0]);
}

/**
 * What a tarball would be published as, or an error when npm could read it
 * differently from this function. npm takes the manifest from the archive
 * after dropping each member's first path segment, so:
 *
 *   - every member must be under `package/`: a `package.json` under another
 *     top-level folder would replace the one that is checked here
 *   - there is exactly one `package/package.json`
 *   - members are plain files and folders: no link can point elsewhere
 *   - the manifest has no `tag`, which npm puts above `--tag` (it would move
 *     `latest`), and no `publishConfig` (registry, provenance)
 */
function inspectTarball(tarball) {
  const paths = tar(['-tzf', tarball]).split('\n').filter(Boolean);
  const outside = paths.filter(
    (path) => !path.startsWith('package/') || path.split('/').includes('..')
  );
  if (outside.length > 0) {
    throw new Error(`members outside package/: ${outside.slice(0, 3).join(', ')}`);
  }
  const manifests = paths.filter((path) => path === MANIFEST_PATH);
  if (manifests.length !== 1) {
    throw new Error(`${manifests.length} members named ${MANIFEST_PATH}, expected 1`);
  }
  const special = tar(['-tvzf', tarball])
    .split('\n')
    .filter((line) => line !== '' && !/^[-d]/.test(line));
  if (special.length > 0) {
    throw new Error(`members that are not plain files or folders: ${special[0]}`);
  }

  const manifest = JSON.parse(tar(['-xOzf', tarball, MANIFEST_PATH]));
  for (const key of ['tag', 'publishConfig']) {
    if (Object.hasOwn(manifest, key)) {
      throw new Error(`its package.json has "${key}", which changes how npm publishes it`);
    }
  }
  if (typeof manifest.name !== 'string' || !isPrerelease(manifest.version)) {
    throw new Error(`it holds ${manifest.name}@${manifest.version}, not a -next.N prerelease`);
  }
  return { name: manifest.name, version: manifest.version };
}

/** The tarballs of `dir` by `name@version`, as read inside each of them. */
function indexTarballs(dir) {
  const index = new Map();
  for (const file of readdirSync(dir).filter((entry) => entry.endsWith('.tgz'))) {
    const tarball = join(dir, file);
    try {
      const { name, version } = inspectTarball(tarball);
      const key = `${name}@${version}`;
      if (index.has(key)) throw new Error(`a second tarball for ${key}`);
      index.set(key, tarball);
    } catch (error) {
      // Left out of the index: the package it was meant for has no tarball.
      console.error(`REFUSED ${file}: ${error.message}`);
    }
  }
  return index;
}

function upload(pkg, tarball) {
  // The tarball decides what is published, so it is read here, right before
  // it is sent: it must be this package at this checkout's version.
  const inside = inspectTarball(tarball);
  if (inside.name !== pkg.name || inside.version !== pkg.manifest.version) {
    throw new Error(
      `${tarball} holds ${inside.name}@${inside.version}, expected ${pkg.name}@${pkg.manifest.version}`
    );
  }
  const npmArgs = ['publish', tarball, '--tag', DIST_TAG, '--access', 'public'];
  if (dryRun) npmArgs.push('--dry-run');
  execFileSync('npm', npmArgs, { cwd: repoRoot, stdio: 'inherit' });
}

const latestOf = (packument) => packument?.['dist-tags']?.latest;

const candidates = inDependencyOrder(readPublicPackages()).filter((pkg) =>
  isPrerelease(pkg.manifest.version)
);

const missing = [];
const latestBefore = new Map();
for (const pkg of candidates) {
  const packument = await fetchPackument(pkg.name);
  if (packument && Object.hasOwn(packument.versions ?? {}, pkg.manifest.version)) {
    console.log(`on the registry       ${pkg.name}@${pkg.manifest.version}`);
  } else {
    missing.push(pkg);
    latestBefore.set(pkg.name, latestOf(packument));
  }
}

if (listOnly) {
  for (const pkg of missing) {
    console.log(`not on the registry   ${pkg.name}@${pkg.manifest.version}`);
  }
  console.log(`missing=${missing.length}`);
  process.exit(0);
}

if (missing.length === 0) {
  console.log('\nNothing to publish.');
  process.exit(0);
}

if (packInto) {
  for (const pkg of missing) {
    const tarball = pack(pkg, packInto);
    console.log(`packed   ${pkg.name}@${pkg.manifest.version}   ${tarball}`);
  }
  console.log(`\nPacked ${missing.length} package(s) into ${packInto}.`);
  process.exit(0);
}

console.log(
  `\n${dryRun ? 'Would publish' : 'Publishing'} ${missing.length} package(s) with the tag "${DIST_TAG}":`
);
for (const pkg of missing) console.log(`  ${pkg.name}@${pkg.manifest.version}`);
console.log('');

// One package that fails does not hold back the ones after it, and the next
// run publishes what is left. Until then a dependent can be on `next` while a
// package it pins is not: installing that dependent fails for that long.
const ownDir = publishFrom ? undefined : mkdtempSync(join(tmpdir(), 'publish-next-'));
const failed = [];
try {
  const packed = publishFrom ? indexTarballs(publishFrom) : undefined;
  for (const pkg of missing) {
    const label = `${pkg.name}@${pkg.manifest.version}`;
    console.log(`== ${label}`);
    try {
      const tarball = packed ? packed.get(label) : pack(pkg, ownDir);
      if (!tarball) throw new Error(`no usable tarball for ${label} in ${publishFrom}`);
      upload(pkg, tarball);
    } catch (error) {
      console.error(`FAILED ${label}: ${error.message}`);
      failed.push(label);
    }
  }
} finally {
  if (ownDir) rmSync(ownDir, { recursive: true, force: true });
}

// The promise of this script, checked against the registry and not against
// its own reasoning: `latest` is where it was for every package it touched.
const moved = [];
if (!dryRun) {
  for (const pkg of missing) {
    const latestNow = latestOf(await fetchPackument(pkg.name));
    if (latestNow !== latestBefore.get(pkg.name)) {
      moved.push(`${pkg.name}: latest was ${latestBefore.get(pkg.name)}, is ${latestNow}`);
    }
  }
}

const done = missing.length - failed.length;
console.log(`\n${dryRun ? 'Dry run of' : 'Published'} ${done} of ${missing.length} package(s).`);
if (moved.length > 0) {
  console.error('\nTHE DIST-TAG latest MOVED. This must not happen; put it back by hand:');
  for (const line of moved) console.error(`  ${line}`);
  console.error('  npm dist-tag add <name>@<the version it was> latest');
}
if (failed.length > 0) {
  console.error(`Not published: ${failed.join(', ')}`);
  console.error('Run it again once the cause is fixed: what is on the registry is skipped.');
}
if (moved.length > 0 || failed.length > 0) process.exit(1);
