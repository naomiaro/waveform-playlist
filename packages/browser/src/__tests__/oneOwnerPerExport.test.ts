// #770: a name has one owner. No source file of the React packages re-exports
// from another workspace package, and no two of their entry points export the
// same name (the allowed pairs are listed, each with its reason).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REACT_PACKAGES = ['browser', 'annotations', 'ui-components', 'spectrogram', 'recording'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'stories' ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(name) && !/\.(test|stories)\./.test(name) ? [path] : [];
  });
}

// `export { a } from '@scope/pkg'`, `export type { A } from …`, `export * from …`,
// on one line or several.
const RE_EXPORT = /export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+'(@(?:waveform-playlist|dawcore)\/[^']+)'/g;

/** Names an entry point exports, following `export *` and `export { } from` inside the package. */
function exportedNames(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(file)) return names;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  const resolve = (spec: string): string | undefined => {
    const base = join(dirname(file), spec);
    return [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(
      (candidate) => {
        try {
          return statSync(candidate).isFile();
        } catch {
          return false;
        }
      }
    );
  };
  for (const match of text.matchAll(/export\s+\*\s+from\s+'(\.[^']+)'/g)) {
    const target = resolve(match[1]);
    if (target) exportedNames(target, seen).forEach((name) => names.add(name));
  }
  for (const match of text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part
        .replace(/\/\/.*$/gm, '')
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop();
      if (name) names.add(name);
    }
  }
  for (const match of text.matchAll(
    /export\s+(?:declare\s+)?(?:const|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
  )) {
    names.add(match[1]);
  }
  return names;
}

function entryOf(pkg: string): string {
  const src = join(packagesRoot, pkg, 'src');
  return [join(src, 'index.tsx'), join(src, 'index.ts')].find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) as string;
}

// The bound control in browser wraps the controlled one of ui-components: no
// code is duplicated, and ui-components is a kit that is used on its own.
const CONTROLLED_AND_BOUND = [
  'AutomaticScrollCheckbox',
  'MasterVolumeControl',
  'PlaybackRateSelect',
  'SelectionTimeInputs',
  'TimeFormatSelect',
];

describe('one owner per exported name (#770)', () => {
  it.each(REACT_PACKAGES)('%s re-exports nothing from another workspace package', (pkg) => {
    const found = sourceFiles(join(packagesRoot, pkg, 'src')).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(RE_EXPORT)].map(
        (match) => `${relative(packagesRoot, file)}: ${match[1]}`
      )
    );
    expect(found).toEqual([]);
  });

  it('no two entry points export the same name, apart from the controlled and bound pairs', () => {
    const names = new Map(REACT_PACKAGES.map((pkg) => [pkg, exportedNames(entryOf(pkg))]));
    // The scan must have found the entries, or an empty result means nothing.
    for (const pkg of REACT_PACKAGES) expect(names.get(pkg)!.size).toBeGreaterThan(5);
    expect(names.get('browser')!.has('WaveformPlaylistProvider')).toBe(true);
    expect(names.get('ui-components')!.has('BaseCheckbox')).toBe(true);
    const shared: string[] = [];
    REACT_PACKAGES.forEach((a, i) =>
      REACT_PACKAGES.slice(i + 1).forEach((b) => {
        for (const name of names.get(a)!) {
          if (names.get(b)!.has(name)) shared.push(`${name} (${a}, ${b})`);
        }
      })
    );
    expect(shared.sort()).toEqual(
      CONTROLLED_AND_BOUND.map((name) => `${name} (browser, ui-components)`).sort()
    );
  });
});
