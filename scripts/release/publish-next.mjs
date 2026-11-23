#!/usr/bin/env node
// Publishes, under the npm dist-tag `next`, every package whose version in the
// working tree is a prerelease (x.y.z-next.N) that the registry does not have.
//
//   node scripts/release/publish-next.mjs            publish
//   node scripts/release/publish-next.mjs --dry-run  pack, and let npm check each upload without sending it
//   node scripts/release/publish-next.mjs --list     only say what the registry lacks (last line: missing=N)
//
// It never publishes a stable version and never moves `latest`. A version the
// registry already has is skipped, so a run that failed half-way is run again.
// The packages must be built first (`pnpm build`): no package has a prepublish
// hook. Each one is packed with pnpm, which writes the `workspace:` ranges out
// as versions, and uploaded with npm, which is what authenticates: by OIDC
// (trusted publishing) in .github/workflows/publish-next.yml, or by whatever
// login the terminal has.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inDependencyOrder, isPrerelease, readPublicPackages, repoRoot } from './workspace.mjs';

const DIST_TAG = 'next';
const REGISTRY = 'https://registry.npmjs.org';
const dryRun = process.argv.includes('--dry-run');
const listOnly = process.argv.includes('--list');

async function registryHas(name, version) {
  const response = await fetch(`${REGISTRY}/${name.replace('/', '%2f')}`, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`registry answered ${response.status} for ${name}`);
  }
  const packument = await response.json();
  return Object.hasOwn(packument.versions ?? {}, version);
}

function packAndPublish(pkg, packDir) {
  execFileSync('pnpm', ['pack', '--pack-destination', packDir], {
    cwd: join(repoRoot, pkg.dir),
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const tarballs = readdirSync(packDir).filter((file) => file.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(`expected one tarball for ${pkg.name}, found ${tarballs.length}`);
  }
  const tarball = join(packDir, tarballs[0]);
  const args = ['publish', tarball, '--tag', DIST_TAG, '--access', 'public'];
  if (dryRun) args.push('--dry-run');
  execFileSync('npm', args, { cwd: repoRoot, stdio: 'inherit' });
  rmSync(tarball);
}

const candidates = inDependencyOrder(readPublicPackages()).filter((pkg) =>
  isPrerelease(pkg.manifest.version)
);

const missing = [];
for (const pkg of candidates) {
  if (await registryHas(pkg.name, pkg.manifest.version)) {
    console.log(`on the registry   ${pkg.name}@${pkg.manifest.version}`);
  } else {
    missing.push(pkg);
  }
}

if (listOnly) {
  for (const pkg of missing)
    console.log(`not on the registry   ${pkg.name}@${pkg.manifest.version}`);
  console.log(`missing=${missing.length}`);
  process.exit(0);
}

if (missing.length === 0) {
  console.log('\nNothing to publish.');
  process.exit(0);
}

console.log(
  `\n${dryRun ? 'Would publish' : 'Publishing'} ${missing.length} package(s) with the tag "${DIST_TAG}":`
);
for (const pkg of missing) console.log(`  ${pkg.name}@${pkg.manifest.version}`);
console.log('');

const packDir = mkdtempSync(join(tmpdir(), 'publish-next-'));
const published = [];
try {
  for (const pkg of missing) {
    console.log(`== ${pkg.name}@${pkg.manifest.version}`);
    packAndPublish(pkg, packDir);
    published.push(pkg);
  }
} catch (error) {
  console.error(`\nStopped after ${published.length} of ${missing.length}: ${error.message}`);
  console.error('Run it again once the cause is fixed: what is on the registry is skipped.');
  process.exit(1);
} finally {
  rmSync(packDir, { recursive: true, force: true });
}

console.log(`\n${dryRun ? 'Dry run of' : 'Published'} ${published.length} package(s).`);
