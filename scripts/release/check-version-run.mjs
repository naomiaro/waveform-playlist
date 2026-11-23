#!/usr/bin/env node
// Run after `changeset version` in pre mode, before the result is committed.
// Compares the manifests in the working tree with the ones at HEAD and fails
// when the version run did something a prerelease must not do
// (.claude/skills/release/SKILL.md, "Prereleases: `@next` from dev"):
//
//   - rewrote a hand-written range on a package of this repository
//     (the range did not admit that package's new prerelease)
//   - gave a package a version that is not x.y.z-next.N
//   - took a `@dawcore/*` package out of 0.0.x (zerover: patch only)
//   - bumped a package npm has never seen: the workflow cannot publish a
//     package's first version (it has no trusted publisher yet), and the
//     packages after it would wait behind the failure
//
// Prints one line per bumped package, `name@version`, for the commit message.
import { isOnRegistry, isPrerelease, readManifestAt, readPublicPackages } from './workspace.mjs';

const RANGE_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

const packages = readPublicPackages();
const names = new Set(packages.map((pkg) => pkg.name));
const problems = [];
const bumped = [];

for (const { name, dir, manifest } of packages) {
  const before = readManifestAt('HEAD', dir) ?? {};

  if (manifest.version !== before.version) {
    bumped.push(`${name}@${manifest.version}`);
    if (!isPrerelease(manifest.version)) {
      problems.push(
        `${name}: ${before.version} -> ${manifest.version} is not a -next.N prerelease`
      );
    }
    if (name.startsWith('@dawcore/') && !manifest.version.startsWith('0.0.')) {
      problems.push(
        `${name}: ${before.version} -> ${manifest.version} leaves 0.0.x (a peer range did not admit a prerelease)`
      );
    }
  }

  // Asked for every package the publish step would take, bumped by this run
  // or not: a package the merged pull request added is at HEAD already, and
  // may arrive with a prerelease version and no changeset.
  if (isPrerelease(manifest.version) && !(await isOnRegistry(name))) {
    problems.push(
      `${name}: npm has no package of this name. Publish its first version by hand, give it a trusted publisher entry, then merge it`
    );
  }

  for (const field of RANGE_FIELDS) {
    const rangesBefore = before[field] ?? {};
    const rangesNow = manifest[field] ?? {};
    for (const dep of new Set([...Object.keys(rangesBefore), ...Object.keys(rangesNow)])) {
      if (!names.has(dep)) continue;
      const was = rangesBefore[dep];
      const is = rangesNow[dep];
      if (was === is || (was ?? '').startsWith('workspace:')) continue;
      problems.push(`${name}: ${field} range on ${dep} was rewritten: "${was}" -> "${is}"`);
    }
  }
}

if (problems.length > 0) {
  console.error('The version run is not publishable as a prerelease:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nFor a rewritten range: restore the tree, give the range an alternative for the\n' +
      'package\'s next version (.claude/skills/release/SKILL.md, "Prereleases"), and run\n' +
      'the version step again.'
  );
  process.exit(1);
}

for (const line of bumped) console.log(line);
