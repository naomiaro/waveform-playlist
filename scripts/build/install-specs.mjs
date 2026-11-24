// What a package's install hints name: for each package a hint may ask the
// reader to install, `name@range`, with the range the PUBLISHED manifest has
// (#884). A plain `npm install <name>` installs `latest`, which can fail the
// peer range of a `next` package, or of a stable package on an older major.
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

/**
 * `{ name: "name@range" }` for every peer of `packages/<dir>`, plus each name
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
    specs[name] = `${name}@${publishedRange(range, versions.get(name), name)}`;
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
