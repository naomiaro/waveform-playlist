#!/usr/bin/env node
// Run after `changeset version` in pre mode, before the result is committed.
// Compares the manifests in the working tree with the ones at HEAD and fails
// when the version run did something a prerelease must not do
// (.claude/skills/release/SKILL.md, "Prereleases: `@next` from dev"):
//
//   - rewrote a hand-written peer range on a package of this repository
//     (the range did not admit the peer's new prerelease)
//   - gave a package a version that is not x.y.z-next.N
//   - took a `@dawcore/*` package out of 0.0.x (zerover: patch only)
//
// Prints one line per bumped package, `name@version`, for the commit message.
import { isPrerelease, readManifestAt, readPublicPackages } from './workspace.mjs';

const packages = readPublicPackages();
const names = new Set(packages.map((pkg) => pkg.name));
const problems = [];
const bumped = [];

for (const { name, dir, manifest } of packages) {
  const before = readManifestAt('HEAD', dir);
  if (!before) {
    problems.push(`${name}: no package.json at HEAD (a new package is published by hand the first time)`);
    continue;
  }

  if (manifest.version !== before.version) {
    bumped.push(`${name}@${manifest.version}`);
    if (!isPrerelease(manifest.version)) {
      problems.push(`${name}: ${before.version} -> ${manifest.version} is not a -next.N prerelease`);
    }
    if (name.startsWith('@dawcore/') && !manifest.version.startsWith('0.0.')) {
      problems.push(`${name}: ${before.version} -> ${manifest.version} leaves 0.0.x (a peer range did not admit a prerelease)`);
    }
  }

  const peersBefore = before.peerDependencies ?? {};
  const peersNow = manifest.peerDependencies ?? {};
  for (const peer of new Set([...Object.keys(peersBefore), ...Object.keys(peersNow)])) {
    if (!names.has(peer)) continue;
    const was = peersBefore[peer];
    const is = peersNow[peer];
    if (was === is || (was ?? '').startsWith('workspace:')) continue;
    problems.push(`${name}: peer range on ${peer} was rewritten: "${was}" -> "${is}"`);
  }
}

if (problems.length > 0) {
  console.error('The version run is not publishable as a prerelease:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nRestore the tree, give the range an alternative for the peer\'s next version\n' +
      '(.claude/skills/release/SKILL.md, "Prereleases"), and run the version step again.'
  );
  process.exit(1);
}

for (const line of bumped) console.log(line);
