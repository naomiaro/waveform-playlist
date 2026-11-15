// #770: a name has one owner. No source file of the five packages below
// re-exports from another workspace package, and no two of the entry points
// scanned (their main entries, browser's `./tone` entry and core's) export the
// same name; the pairs that do are listed, each with its reason.
//
// What the scans cannot see (none present when this was written, except the
// radio group name `render-mode` of the spectrogram menu, #808): a name
// imported and then exported in a second statement, or exported as an alias
// (`export const X = Imported`), is caught only by the name check, so only when
// its owner is one of the entries scanned; `export default`, `export * as`,
// `export let`, a destructured `export const { a }`; an id held in a constant,
// a template string without `${}`, `.attrs({ id })`, a radio `name`. The other
// packages (midi, engine, playout, media-element-playout, the web components)
// are not scanned: #807.
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
const RE_EXPORT =
  /export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+'(@(?:waveform-playlist|dawcore)\/[^']+)'/g;

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
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
  )) {
    names.add(match[1]);
  }
  return names;
}

/** `pkg` is a package directory, or `browser/tone` for browser's second entry. */
function entryOf(pkg: string): string {
  const [dir, entry = 'index'] = pkg.split('/');
  const src = join(packagesRoot, dir, 'src');
  return [join(src, `${entry}.tsx`), join(src, `${entry}.ts`)].find((candidate) => {
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

// What the name check covers: the React packages, browser's `./tone` entry, and
// core, which they all build on.
const NAME_OWNERS = [...REACT_PACKAGES, 'browser/tone', 'core'];
// Not one thing with two owners: a type in core, a component in ui-components.
const DIFFERENT_KINDS = ['Track (core, ui-components)'];
// Two different functions under one name, older than #770 and not yet renamed
// (#807). Listed so that the next one is noticed; remove the entry with the rename.
const KNOWN_AND_TRACKED = ['createEffectInstance (browser/tone, core)'];

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
    const names = new Map(NAME_OWNERS.map((pkg) => [pkg, exportedNames(entryOf(pkg))]));
    // The scan must have found the entries, or an empty result means nothing.
    for (const pkg of NAME_OWNERS) expect(names.get(pkg)!.size).toBeGreaterThan(5);
    expect(names.get('core')!.has('samplesToPixels')).toBe(true);
    expect(names.get('core')!.has('SnapTo')).toBe(true);
    expect(names.get('browser/tone')!.has('useExportWav')).toBe(true);
    expect(names.get('browser')!.has('WaveformPlaylistProvider')).toBe(true);
    expect(names.get('ui-components')!.has('BaseCheckbox')).toBe(true);
    const shared: string[] = [];
    NAME_OWNERS.forEach((a, i) =>
      NAME_OWNERS.slice(i + 1).forEach((b) => {
        for (const name of names.get(a)!) {
          if (names.get(b)!.has(name)) shared.push(`${name} (${[a, b].sort().join(', ')})`);
        }
      })
    );
    expect(shared.sort()).toEqual(
      [
        ...CONTROLLED_AND_BOUND.map((name) => `${name} (browser, ui-components)`),
        ...DIFFERENT_KINDS,
        ...KNOWN_AND_TRACKED,
      ].sort()
    );
  });
});

// Kept in this file because it is the same scan of the same sources.
describe('no fixed element ids (maintainer, 2026-11-13: "we should never have fixed ids")', () => {
  // An id written as a literal is shared by every instance of the component, so
  // two players on a page collide and a label reaches the other one's input.
  // Ids come from `useId()` (alone or as the stem of a template string).
  const FIXED_ID =
    /[^A-Za-z-](?:id|htmlFor|aria-labelledby|aria-describedby|aria-controls)=(?:"[^"]+"|'[^']+'|\{(?:"[^"]+"|'[^']+')\})/g;

  it.each(REACT_PACKAGES)('%s writes no literal id, htmlFor or id reference', (pkg) => {
    const found = sourceFiles(join(packagesRoot, pkg, 'src')).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(FIXED_ID)].map(
        (match) => `${relative(packagesRoot, file)}: ${match[0].trim()}`
      )
    );
    expect(found).toEqual([]);
  });

  it('the scan sees a literal id when there is one', () => {
    const sample =
      '<input id="master-gain" />\n<label htmlFor={\'x\'}>\n<div aria-labelledby="title" />';
    expect([...sample.matchAll(FIXED_ID)]).toHaveLength(3);
    expect([...'<input id={id} /> <a trackId="t1" />'.matchAll(FIXED_ID)]).toHaveLength(0);
  });
});
