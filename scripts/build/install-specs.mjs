// What a package's install hints name: for each package a hint may ask the
// reader to install, `name@range` (#884). A plain `npm install <name>`
// installs `latest`, which can fail the peer range of a `next` package, or be
// a newer major than a stable package accepts. The range is the one the
// PUBLISHED manifest has, except where that range is open-ended (a hand-written
// `>=` floor): there it is a caret on the peer's version in the same
// manifests, the version the package was built with, so a stable build does
// not send the reader to a later breaking release.
//
// The ranges are read at build time and handed to the bundler as a define
// (`__INSTALL_SPECS__`), so each build names the versions of its own
// manifests: the publish workflow and the release by hand both build after
// the version step. Node's own modules only, like scripts/release/.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packagesDir = join(repoRoot, 'packages');

const readManifest = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

/**
 * Version of every package under `root` (default packages/), by name. A
 * directory without a manifest (left behind by a branch switch) is skipped.
 */
export function workspaceVersions(root = packagesDir) {
  return new Map(
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'package.json')))
      .map((entry) => readManifest(join(root, entry.name)))
      .map((pkg) => [pkg.name, pkg.version])
  );
}

// pnpm's own pattern: `workspace:^`, `workspace:~`, `workspace:*`, also after
// a partial version (`workspace:1.*`) or an alias (`workspace:other@^`).
const VERSION_TOKEN = /^workspace:(.*?)@?([\^~*])$/;

/**
 * The range pnpm 8.15 publishes for a range of the source manifest
 * (`makePublishDependency`, which `createExportableManifest` applies to
 * `peerDependencies` too): a range ending in `^` or `~` becomes that token on
 * the workspace version, one ending in `*` the exact version, `workspace:<range>`
 * the range; a range without the protocol is kept. pnpm's other forms (an
 * alias, a path) are refused: no install hint can name them.
 */
export function publishedRange(range, workspaceVersion, name = 'a peer') {
  if (!range.startsWith('workspace:')) return range;
  const token = VERSION_TOKEN.exec(range);
  if (token) {
    if (workspaceVersion === undefined) {
      throw new Error(`install-specs: ${name} has "${range}" but is not a package under packages/`);
    }
    return (token[2] === '*' ? '' : token[2]) + workspaceVersion;
  }
  const rest = range.slice('workspace:'.length);
  if (rest.startsWith('./') || rest.startsWith('../') || rest.includes('@')) {
    throw new Error(`install-specs: ${name} has "${range}", which no install hint can name`);
  }
  return rest;
}

const FLOOR = /^>=\s*(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  return match && { core: match.slice(1, 4).map(Number), pre: match[4] ? match[4].split('.') : [] };
}

function compareIdentifiers(a, b) {
  const numeric = (id) => /^\d+$/.test(id);
  if (numeric(a) && numeric(b)) return Number(a) - Number(b);
  if (numeric(a) !== numeric(b)) return numeric(a) ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** semver precedence of two parsed versions. */
function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const order = compareIdentifiers(a.pre[i], b.pre[i]);
    if (order !== 0) return order;
  }
  return a.pre.length - b.pre.length;
}

/**
 * Whether `version` satisfies `range` when the range is one or more `>=`
 * floors joined by `||`, with npm's rule that a prerelease matches only a floor
 * with a prerelease on the same major.minor.patch. `undefined` for a range of
 * another shape, or a version that does not parse.
 */
export function satisfiesFloors(version, range) {
  const parsed = parseVersion(version);
  const floors = range.split('||').map((part) => FLOOR.exec(part.trim()));
  if (!parsed || floors.some((floor) => floor === null)) return undefined;
  return floors.some((match) => {
    const floor = { core: match.slice(1, 4).map(Number), pre: match[4] ? match[4].split('.') : [] };
    const sameCore = floor.core.every((n, i) => n === parsed.core[i]);
    if (parsed.pre.length && !(floor.pre.length && sameCore)) return false;
    return compareVersions(parsed, floor) >= 0;
  });
}

/**
 * The range a hint names for a peer: the published range, except a range of
 * `>=` floors on a package under packages/, which becomes a caret on that
 * package's version when the version satisfies it (the caret then lies inside
 * the range: every version it admits is at or above the version, below the
 * next breaking release). Otherwise the range is kept, with a warning in the
 * build log: a version the floors do not admit yet (a floor raised before the
 * peer's version step), or a range of another shape. The hint is then still
 * inside the peer range, only as open as the range.
 */
export function hintRange(range, workspaceVersion, name) {
  const published = publishedRange(range, workspaceVersion, name);
  if (range.startsWith('workspace:') || workspaceVersion === undefined) return published;
  const admitted = satisfiesFloors(workspaceVersion, range);
  if (admitted) return `^${workspaceVersion}`;
  const reason =
    admitted === undefined
      ? 'that is not a range of >= floors this script reads'
      : `the version in the manifests, ${workspaceVersion}, is below it`;
  console.warn(
    `install-specs: the install hint for ${name} names the peer range "${range}" as it is: ${reason}`
  );
  return published;
}

/**
 * `{ name: "name@range" }` for every peer of `packages/<dir>` (see hintRange), plus each name
 * of `extra` that is not a peer: a package under packages/, named with a caret
 * on its version in the same manifests (dawcore names playout's adapter
 * without peering on it). An extra name not under packages/ fails the build.
 */
export function installSpecs(dir, extra = []) {
  const manifest = readManifest(join(packagesDir, dir));
  const versions = workspaceVersions();
  const peers = manifest.peerDependencies ?? {};
  const specs = {};
  for (const [name, range] of Object.entries(peers)) {
    specs[name] = `${name}@${hintRange(range, versions.get(name), name)}`;
  }
  for (const name of extra) {
    if (name in specs) continue;
    if (!versions.has(name)) {
      throw new Error(
        `install-specs: ${name} is neither a peer of ${manifest.name} nor a package under packages/`
      );
    }
    specs[name] = `${name}@^${versions.get(name)}`;
  }
  return specs;
}

/** The bundler define for tsup and vitest: `{ __INSTALL_SPECS__: '<json>' }`. */
export function installSpecsDefine(dir, extra = []) {
  return { __INSTALL_SPECS__: JSON.stringify(installSpecs(dir, extra)) };
}
