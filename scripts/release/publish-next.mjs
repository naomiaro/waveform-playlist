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
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
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

// npm's own tarball reader, from the npm that will do the upload: the code
// `npm publish <tarball>` runs to decide the name, the version and the tag.
// Reading the archive with anything else leaves two readers to disagree
// (after a lone zero block, on some pax headers, on old GNU long names: each
// made `tar` show one package.json and npm publish another).
let pacote;
function npmsTarballReader() {
  if (!pacote) {
    const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    pacote = createRequire(join(npmRoot, 'npm', 'package.json'))('pacote');
  }
  return pacote;
}

/**
 * What npm would publish from a tarball, or an error when that is not a plain
 * prerelease of one package:
 *
 *   - the manifest is the one npm reads (see above), asked for as
 *     `npm publish` asks: `fullMetadata` and `fullReadJson`
 *   - it has no `tag`, which npm puts above `--tag` (it would move `latest`),
 *     and no `publishConfig` (registry, provenance)
 *   - as a second look with the system's tar: every member is under
 *     `package/` and is a plain file or folder
 */
async function inspectTarball(tarball) {
  const manifest = await npmsTarballReader().manifest(tarball, {
    fullMetadata: true,
    fullReadJson: true,
  });
  for (const key of ['tag', 'publishConfig']) {
    if (Object.hasOwn(manifest, key)) {
      throw new Error(`its package.json has "${key}", which changes how npm publishes it`);
    }
  }
  if (typeof manifest.name !== 'string' || !isPrerelease(manifest.version)) {
    throw new Error(`it holds ${manifest.name}@${manifest.version}, not a -next.N prerelease`);
  }

  const paths = tar(['-tzf', tarball]).split('\n').filter(Boolean);
  const outside = paths.filter(
    (path) => !path.startsWith('package/') || path.split('/').includes('..')
  );
  if (outside.length > 0) {
    throw new Error(`members outside package/: ${outside.slice(0, 3).join(', ')}`);
  }
  const special = tar(['-tvzf', tarball])
    .split('\n')
    .filter((line) => line !== '' && !/^[-d]/.test(line));
  if (special.length > 0) {
    throw new Error(`members that are not plain files or folders: ${special[0]}`);
  }
  return { name: manifest.name, version: manifest.version };
}

/** The tarballs of `dir` by `name@version`, as read inside each of them. */
async function indexTarballs(dir) {
  const index = new Map();
  for (const file of readdirSync(dir).filter((entry) => entry.endsWith('.tgz'))) {
    const tarball = join(dir, file);
    try {
      const { name, version } = await inspectTarball(tarball);
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

async function upload(pkg, tarball) {
  // The tarball decides what is published, so it is read here, right before
  // it is sent: it must be this package at this checkout's version.
  const inside = await inspectTarball(tarball);
  if (inside.name !== pkg.name || inside.version !== pkg.manifest.version) {
    throw new Error(
      `${tarball} holds ${inside.name}@${inside.version}, expected ${pkg.name}@${pkg.manifest.version}`
    );
  }
  const npmArgs = ['publish', tarball, '--tag', DIST_TAG, '--access', 'public'];
  if (dryRun) npmArgs.push('--dry-run');
  execFileSync('npm', npmArgs, { cwd: repoRoot, stdio: 'inherit' });
}

/** What the registry has for a package: its dist-tags and its versions. */
const snapshotOf = (packument) => ({
  tags: { ...(packument?.['dist-tags'] ?? {}) },
  versions: Object.keys(packument?.versions ?? {}),
});

const publicPackages = inDependencyOrder(readPublicPackages());
const candidates = publicPackages.filter((pkg) => isPrerelease(pkg.manifest.version));

const before = new Map();
const missing = [];
for (const pkg of publicPackages) {
  const snapshot = snapshotOf(await fetchPackument(pkg.name));
  before.set(pkg.name, snapshot);
  if (!candidates.includes(pkg)) continue;
  if (snapshot.versions.includes(pkg.manifest.version)) {
    console.log(`on the registry       ${pkg.name}@${pkg.manifest.version}`);
  } else {
    missing.push(pkg);
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

// Prereleases are published while dev is in pre mode, and at no other time:
// with pre.json gone or being left, a stable release is being prepared.
const preState = (() => {
  try {
    const pre = JSON.parse(readFileSync(join(repoRoot, '.changeset/pre.json'), 'utf8'));
    return `${pre.mode}:${pre.tag}`;
  } catch {
    return 'absent';
  }
})();
if (preState !== `pre:${DIST_TAG}`) {
  console.error(
    `.changeset/pre.json is "${preState}", not "pre:${DIST_TAG}": nothing is published.`
  );
  process.exit(1);
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
  const packed = publishFrom ? await indexTarballs(publishFrom) : undefined;
  for (const pkg of missing) {
    const label = `${pkg.name}@${pkg.manifest.version}`;
    console.log(`== ${label}`);
    try {
      const tarball = packed ? packed.get(label) : pack(pkg, ownDir);
      if (!tarball) throw new Error(`no usable tarball for ${label} in ${publishFrom}`);
      await upload(pkg, tarball);
    } catch (error) {
      console.error(`FAILED ${label}: ${error.message}`);
      failed.push(label);
    }
  }
} finally {
  if (ownDir) rmSync(ownDir, { recursive: true, force: true });
}

// The promise of this script, checked against the registry and not against
// its own reasoning. For every public package of this repository, published
// in this run or not: no dist-tag but `next` changed, and no version appeared
// but the one that was meant to. (A read right after an upload can still show
// the old state; what this catches is a state that must never be.)
const surprises = [];
if (!dryRun) {
  for (const pkg of publicPackages) {
    const was = before.get(pkg.name);
    const now = snapshotOf(await fetchPackument(pkg.name));
    const expected = missing.includes(pkg) ? pkg.manifest.version : undefined;
    for (const tag of new Set([...Object.keys(was.tags), ...Object.keys(now.tags)])) {
      if (was.tags[tag] === now.tags[tag]) continue;
      if (tag === DIST_TAG && now.tags[tag] === expected) continue;
      surprises.push(`${pkg.name}: dist-tag ${tag} was ${was.tags[tag]}, is ${now.tags[tag]}`);
    }
    for (const version of now.versions) {
      if (was.versions.includes(version) || version === expected) continue;
      surprises.push(`${pkg.name}: version ${version} appeared`);
    }
  }
}

const done = missing.length - failed.length;
console.log(`\n${dryRun ? 'Dry run of' : 'Published'} ${done} of ${missing.length} package(s).`);
if (surprises.length > 0) {
  console.error('\nTHE REGISTRY CHANGED IN A WAY THIS SCRIPT NEVER DOES. Look at it now:');
  for (const line of surprises) console.error(`  ${line}`);
  console.error('  a dist-tag is put back with: npm dist-tag add <name>@<version> <tag>');
}
if (failed.length > 0) {
  console.error(`Not published: ${failed.join(', ')}`);
  console.error('Run it again once the cause is fixed: what is on the registry is skipped.');
}
if (surprises.length > 0 || failed.length > 0) process.exit(1);
