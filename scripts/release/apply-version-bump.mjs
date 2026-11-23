#!/usr/bin/env node
// Applies a version bump that another job computed, after checking that it is
// nothing but a version bump.
//
//   node scripts/release/apply-version-bump.mjs <dir>
//
// In .github/workflows/publish-next.yml the job that runs `changeset version`
// also installs, builds and tests, so it runs dependencies' code and is given
// no right to push. It hands over the files the version step changed, laid
// out under <dir> as in the repository. This script runs in the job that may
// push to dev, which installs nothing, and it accepts from <dir> only:
//
//   packages/<name>/package.json   for a package that exists here, and equal
//                                  to the one here in everything but
//                                  `version`, which must be x.y.z-next.N
//   .changeset/pre.json            still `mode: pre`, `tag: next`, and data
//                                  of the expected shape
//
// Anything else in <dir> fails the run and nothing is written. A hand-written
// range that the version step rewrote is such a difference too (the version
// job's own check reports it with more words).
//
// Prints one line per bumped package, `name@version`, for the commit message.
// Uses node's own modules only: the job that runs it has no node_modules.
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { isPrerelease, readPublicPackages, repoRoot } from './workspace.mjs';

const PRE_JSON = '.changeset/pre.json';

const inputDir = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!inputDir) {
  console.error('usage: apply-version-bump.mjs <dir>');
  process.exit(2);
}

/** Every file under `dir`, as a path relative to it with `/` separators. */
function listFiles(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      const stat = lstatSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) files.push(relative(dir, path).split(sep).join('/'));
      else throw new Error(`${relative(dir, path)} is not a plain file or folder`);
    }
  };
  walk(dir);
  return files.sort();
}

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function checkManifest(pkg, text) {
  const proposed = JSON.parse(text);
  if (!isPlainObject(proposed)) throw new Error('not a JSON object');
  if (!isPrerelease(proposed.version)) {
    throw new Error(`version "${proposed.version}" is not x.y.z-next.N`);
  }
  // Same keys in the same order with the same values, once the version is
  // set aside: JSON.stringify is the comparison.
  const withOldVersion = JSON.stringify({ ...proposed, version: pkg.manifest.version });
  const current = JSON.stringify({ ...pkg.manifest, version: pkg.manifest.version });
  if (withOldVersion !== current) {
    throw new Error('it differs from the package.json here in more than its version');
  }
  return proposed.version;
}

function checkPreJson(text) {
  const pre = JSON.parse(text);
  const keys = isPlainObject(pre) ? Object.keys(pre).sort().join(',') : '';
  if (keys !== 'changesets,initialVersions,mode,tag') {
    throw new Error(`unexpected keys (${keys})`);
  }
  if (pre.mode !== 'pre' || pre.tag !== 'next') {
    throw new Error(`mode "${pre.mode}", tag "${pre.tag}": expected pre and next`);
  }
  const versions = pre.initialVersions;
  if (!isPlainObject(versions) || !Object.values(versions).every((v) => typeof v === 'string')) {
    throw new Error('initialVersions is not a map of names to versions');
  }
  if (!Array.isArray(pre.changesets) || !pre.changesets.every((id) => /^[\w.-]+$/.test(id))) {
    throw new Error('changesets is not a list of changeset names');
  }
}

const packagesByManifestPath = new Map(
  readPublicPackages().map((pkg) => [`${pkg.dir.split(sep).join('/')}/package.json`, pkg])
);

const writes = [];
const bumped = [];
const problems = [];

for (const file of listFiles(inputDir)) {
  const text = readFileSync(join(inputDir, file), 'utf8');
  try {
    if (file === PRE_JSON) {
      checkPreJson(text);
    } else if (packagesByManifestPath.has(file)) {
      const pkg = packagesByManifestPath.get(file);
      const version = checkManifest(pkg, text);
      if (version !== pkg.manifest.version) bumped.push(`${pkg.name}@${version}`);
    } else {
      throw new Error('not a file a version bump may change');
    }
    writes.push({ file, text });
  } catch (error) {
    problems.push(`${file}: ${error.message}`);
  }
}

if (bumped.length === 0 && problems.length === 0) {
  problems.push('no package version changes in the bump');
}

if (problems.length > 0) {
  console.error('The version bump is refused, and nothing was written:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

for (const { file, text } of writes) writeFileSync(join(repoRoot, file), text);
for (const line of bumped) console.log(line);
