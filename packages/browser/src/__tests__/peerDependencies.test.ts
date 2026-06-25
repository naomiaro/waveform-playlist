// Guard against the `workspace:*` peer-dependency footgun.
//
// pnpm rewrites `workspace:*` to the EXACT current version of the sibling package
// at publish time. For PEER dependencies between sibling packages that produces
// mutually-unsatisfiable exact pins (e.g. annotations@x pinning browser==13.1.0
// while browser@y pins annotations==12.0.1), which breaks `npm install` for
// downstream consumers with ERESOLVE.
//
// Cross-package peerDependencies must therefore use a RANGE (`workspace:^` or
// `workspace:~`), never `workspace:*`.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// packages/browser/src/__tests__ -> packages/
const packagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function findExactWorkspacePeerPins(): string[] {
  const offenders: string[] = [];
  for (const pkg of readdirSync(packagesDir)) {
    const pkgJsonPath = join(packagesDir, pkg, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    const json = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    const peers: Record<string, string> = json.peerDependencies ?? {};
    for (const [dep, range] of Object.entries(peers)) {
      if (range === 'workspace:*') {
        offenders.push(`${json.name} → peerDependencies["${dep}"]: ${range}`);
      }
    }
  }
  return offenders;
}

describe('cross-package peerDependencies', () => {
  it('never use `workspace:*` (use `workspace:^` so they publish as ranges)', () => {
    expect(findExactWorkspacePeerPins()).toEqual([]);
  });
});
