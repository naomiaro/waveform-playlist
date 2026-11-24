// The publishable packages of this repository, for the release scripts.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

/** Every package under packages/ that is not private: { name, dir, manifest }. */
export function readPublicPackages() {
  return readdirSync(join(repoRoot, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join('packages', entry.name);
      const manifest = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
      return { name: manifest.name, dir, manifest };
    })
    .filter((pkg) => !pkg.manifest.private);
}

/** A package's manifest as committed at a git ref, or null when it is not there. */
export function readManifestAt(ref, dir) {
  try {
    const text = execFileSync('git', ['show', `${ref}:${dir}/package.json`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * The packages ordered so that each comes after the packages of this
 * repository it depends on. A cycle (browser and annotations are each other's
 * peers) is broken where it is met.
 */
export function inDependencyOrder(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const ordered = [];
  const done = new Set();
  const visit = (pkg, path) => {
    if (done.has(pkg.name) || path.includes(pkg.name)) return;
    const needs = DEPENDENCY_FIELDS.flatMap((field) => Object.keys(pkg.manifest[field] ?? {}))
      .filter((name) => byName.has(name))
      .sort();
    for (const name of needs) visit(byName.get(name), [...path, pkg.name]);
    done.add(pkg.name);
    ordered.push(pkg);
  };
  for (const pkg of [...packages].sort((a, b) => a.name.localeCompare(b.name))) visit(pkg, []);
  return ordered;
}

const NUMBER = '(?:0|[1-9]\\d*)';
const PRERELEASE = new RegExp(`^${NUMBER}\\.${NUMBER}\\.${NUMBER}-next\\.${NUMBER}$`);

/** x.y.z-next.N and nothing else: the only versions the prerelease scripts publish. */
export const isPrerelease = (version) => typeof version === 'string' && PRERELEASE.test(version);

const REGISTRY = 'https://registry.npmjs.org';

/**
 * A package's document on the npm registry, or null when npm has no package
 * of that name. The query string is there for the CDN, which keeps a packument
 * for five minutes: without it a version published a minute ago reads as missing.
 */
export async function fetchPackument(name) {
  const url = `${REGISTRY}/${name.replaceAll('/', '%2f')}?t=${Date.now()}`;
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`the registry answered ${response.status} for ${name}`);
  }
  return response.json();
}

export const isOnRegistry = async (name) => (await fetchPackument(name)) !== null;
