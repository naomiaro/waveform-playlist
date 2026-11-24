// What a package's install hints name: for each package a hint may ask the
// reader to install, `name@range`, with the range the PUBLISHED manifest has
// (#884). A plain `npm install <name>` installs `latest`, which can fail the
// peer range of a `next` package, or of a stable package on an older major.
//
// The ranges are read at build time and handed to the bundler as a define
// (`__INSTALL_SPECS__`), so each build names the versions of its own commit:
// the publish workflow and the release by hand both build after the version
// step. Node's own modules only, like scripts/release/.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packagesDir = join(repoRoot, 'packages');

const readManifest = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

/** Version of every package under packages/, by name. */
function workspaceVersions() {
  return new Map(
    readdirSync(packagesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readManifest(join(packagesDir, entry.name)))
      .map((pkg) => [pkg.name, pkg.version])
  );
}

const WORKSPACE_TOKEN = /^workspace:([\^~*])$/;

/**
 * The range pnpm publishes for a peer range of the source manifest
 * (`replaceWorkspaceProtocolPeerDependency`, pnpm 8.15): `workspace:^` and
 * `workspace:~` become that token on the workspace version, `workspace:*`
 * the exact version, `workspace:<range>` the range; any other range is kept.
 */
export function publishedRange(range, workspaceVersion) {
  if (!range.startsWith('workspace:')) return range;
  const token = WORKSPACE_TOKEN.exec(range);
  if (token) return (token[1] === '*' ? '' : token[1]) + workspaceVersion;
  const rest = range.slice('workspace:'.length);
  if (rest.includes('@')) {
    throw new Error(`install-specs: "${range}" is a workspace alias; no install hint can name it`);
  }
  return rest;
}

/**
 * `{ name: "name@range" }` for every peer of `packages/<dir>`, plus each name
 * of `extra` that is not a peer: a workspace package, named with a caret on
 * its version in this commit (dawcore names playout's adapter without
 * peering on it). An extra name outside the workspace fails the build.
 */
export function installSpecs(dir, extra = []) {
  const manifest = readManifest(join(packagesDir, dir));
  const versions = workspaceVersions();
  const peers = manifest.peerDependencies ?? {};
  const specs = {};
  for (const [name, range] of Object.entries(peers)) {
    specs[name] = `${name}@${publishedRange(range, versions.get(name))}`;
  }
  for (const name of extra) {
    if (name in specs) continue;
    if (!versions.has(name)) {
      throw new Error(
        `install-specs: ${name} is neither a peer of ${manifest.name} nor a package of this repository`
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
