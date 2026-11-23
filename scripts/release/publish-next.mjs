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
// dependency's code: no install, no build. `--from` therefore trusts nothing
// about a tarball but what it reads inside it: the name and version in its
// package.json must be the ones of a package in this checkout.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  inDependencyOrder,
  isPrerelease,
  readPublicPackages,
  registryHasVersion,
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

/** The name and version a tarball would be published as. */
function readTarballManifest(tarball) {
  const text = execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const { name, version } = JSON.parse(text);
  return { name, version };
}

/** The tarballs of `dir` by `name@version`, as read inside each of them. */
function indexTarballs(dir) {
  const index = new Map();
  for (const file of readdirSync(dir).filter((entry) => entry.endsWith('.tgz'))) {
    const tarball = join(dir, file);
    const { name, version } = readTarballManifest(tarball);
    const key = `${name}@${version}`;
    if (index.has(key)) throw new Error(`two tarballs for ${key}`);
    index.set(key, tarball);
  }
  return index;
}

function upload(pkg, tarball) {
  // The tarball decides what is published, so it is read again here: it must
  // be this package at this checkout's version, and that version a prerelease.
  const inside = readTarballManifest(tarball);
  if (inside.name !== pkg.name || inside.version !== pkg.manifest.version) {
    throw new Error(
      `${tarball} holds ${inside.name}@${inside.version}, expected ${pkg.name}@${pkg.manifest.version}`
    );
  }
  if (!isPrerelease(inside.version)) {
    throw new Error(`${inside.name}@${inside.version} is not a -next.N prerelease`);
  }
  const npmArgs = ['publish', tarball, '--tag', DIST_TAG, '--access', 'public'];
  if (dryRun) npmArgs.push('--dry-run');
  execFileSync('npm', npmArgs, { cwd: repoRoot, stdio: 'inherit' });
}

const candidates = inDependencyOrder(readPublicPackages()).filter((pkg) =>
  isPrerelease(pkg.manifest.version)
);

const missing = [];
for (const pkg of candidates) {
  if (await registryHasVersion(pkg.name, pkg.manifest.version)) {
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

console.log(
  `\n${dryRun ? 'Would publish' : 'Publishing'} ${missing.length} package(s) with the tag "${DIST_TAG}":`
);
for (const pkg of missing) console.log(`  ${pkg.name}@${pkg.manifest.version}`);
console.log('');

// One package that fails does not hold back the ones after it: a dependent
// published before its dependency is on the registry is no harm to npm, and
// the next run publishes what is left.
const ownDir = publishFrom ? undefined : mkdtempSync(join(tmpdir(), 'publish-next-'));
const failed = [];
try {
  const packed = publishFrom ? indexTarballs(publishFrom) : undefined;
  for (const pkg of missing) {
    const label = `${pkg.name}@${pkg.manifest.version}`;
    console.log(`== ${label}`);
    try {
      const tarball = packed ? packed.get(label) : pack(pkg, ownDir);
      if (!tarball) throw new Error(`no tarball for ${label} in ${publishFrom}`);
      upload(pkg, tarball);
    } catch (error) {
      console.error(`FAILED ${label}: ${error.message}`);
      failed.push(label);
    }
  }
} finally {
  if (ownDir) rmSync(ownDir, { recursive: true, force: true });
}

const done = missing.length - failed.length;
console.log(`\n${dryRun ? 'Dry run of' : 'Published'} ${done} of ${missing.length} package(s).`);
if (failed.length > 0) {
  console.error(`Not published: ${failed.join(', ')}`);
  console.error('Run it again once the cause is fixed: what is on the registry is skipped.');
  process.exit(1);
}
