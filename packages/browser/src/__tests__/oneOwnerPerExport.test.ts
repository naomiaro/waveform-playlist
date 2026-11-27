// #770, #807: a name has one owner. No source file of any package under
// `packages/` re-exports from another workspace package, and no two entry points
// (every `exports` entry of every package, browser's `./tone` included) export
// the same name; the pairs that do are listed, each with its reason.
//
// What the scans cannot see (none present when this was written, except the
// radio group name `render-mode` of the spectrogram menu, #808): a name
// imported and then exported in a second statement, or exported as an alias
// (`export const X = Imported`), is caught only by the name check, so only when
// its owner is one of the entries scanned; `export default`, `export * as`,
// `export let`, a destructured `export const { a }`; an id held in a constant,
// a template string without `${}`, `.attrs({ id })`, a radio `name`. The id
// check covers the React packages only.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REACT_PACKAGES = ['browser', 'annotations', 'ui-components', 'spectrogram', 'recording'];
const ALL_PACKAGES = readdirSync(packagesRoot)
  .filter((dir) => isFile(join(packagesRoot, dir, 'package.json')))
  .sort();

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

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
  // Comments removed first: an `export` written in a comment exports nothing.
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  // A `./x.js` specifier names `./x.ts`. A star export that resolves to no file
  // fails the test: skipping it would drop its names from the comparison.
  const resolve = (spec: string): string => {
    const base = join(dirname(file), spec.replace(/\.js$/, ''));
    const found = [
      `${base}.ts`,
      `${base}.tsx`,
      join(base, 'index.ts'),
      join(base, 'index.tsx'),
    ].find(isFile);
    if (!found)
      throw new Error(`${relative(packagesRoot, file)}: cannot resolve export * from '${spec}'`);
    return found;
  };
  for (const match of text.matchAll(/export\s+\*\s+from\s+["'](\.[^"']+)["']/g)) {
    exportedNames(resolve(match[1]), seen).forEach((name) => names.add(name));
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

/**
 * The source file of each `exports` entry of a package, by name: `browser` for
 * `.`, `browser/tone` for `./tone`. `./dist/x.mjs` is built from `src/x.ts(x)`
 * or `src/x/index.ts(x)`.
 */
function entriesOf(dir: string): Array<[string, string]> {
  const manifest = JSON.parse(readFileSync(join(packagesRoot, dir, 'package.json'), 'utf8'));
  return Object.entries(manifest.exports as Record<string, string | { import: string }>).map(
    ([subpath, target]) => {
      const built = typeof target === 'string' ? target : target.import;
      const stem = join(
        packagesRoot,
        dir,
        'src',
        built.replace(/^\.\/dist\//, '').replace(/\.m?js$/, '')
      );
      const source = [
        `${stem}.ts`,
        `${stem}.tsx`,
        join(stem, 'index.ts'),
        join(stem, 'index.tsx'),
      ].find(isFile);
      if (!source) throw new Error(`no source for ${dir} ${subpath} (${built})`);
      // The mapping is a naming convention: check that tsup really builds this file.
      const tsup = readFileSync(join(packagesRoot, dir, 'tsup.config.ts'), 'utf8');
      const fromRoot = relative(join(packagesRoot, dir), source);
      if (!tsup.includes(`'${fromRoot}'`)) {
        throw new Error(`${dir}/tsup.config.ts does not build ${fromRoot} (entry ${subpath})`);
      }
      return [subpath === '.' ? dir : `${dir}/${subpath.slice(2)}`, source];
    }
  );
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

// Entries that export nothing a consumer imports by name: a worker script.
const NO_NAMED_EXPORTS = ['dawcore-spectrogram/worker/spectrogram.worker'];

// A subpath entry that offers part of its own package's main entry on a narrower
// import: the same names, one package, so one owner. Not compared with that entry.
const PART_OF_MAIN_ENTRY = ['dawcore-spectrogram/orchestrator'];

// Two different things under one name, each in its own package (#807: renaming
// them was not worth a break; the web-component and transport names are their
// packages' own API):
const DIFFERENT_THINGS = [
  // a type in core, a component in ui-components
  'Track (core, ui-components)',
  // the options of React's WAV export and of `<daw-editor>`'s `exportAudio()`
  'ExportOptions (browser/tone, dawcore)',
  // core's meter-change record (detectMeterChanges) and transport's MeterMap entry,
  // with a `Tick` brand and a cached `barAtTick`
  'MeterEntry (core, transport)',
  // the options of the React recording hook and of dawcore's recording controller
  'RecordingOptions (dawcore, recording)',
];

describe('one owner per exported name (#770)', () => {
  it.each(ALL_PACKAGES)('%s re-exports nothing from another workspace package', (pkg) => {
    const found = sourceFiles(join(packagesRoot, pkg, 'src')).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(RE_EXPORT)].map(
        (match) => `${relative(packagesRoot, file)}: ${match[1]}`
      )
    );
    expect(found).toEqual([]);
  });

  it('no two entry points export the same name, apart from the controlled and bound pairs', () => {
    const entries = ALL_PACKAGES.flatMap(entriesOf);
    const names = new Map(entries.map(([entry, file]) => [entry, exportedNames(file)]));
    const NAME_OWNERS = [...names.keys()];
    // The scan must have found the entries, or an empty result means nothing.
    expect(ALL_PACKAGES.length).toBeGreaterThan(15);
    for (const entry of NAME_OWNERS) {
      if (!NO_NAMED_EXPORTS.includes(entry))
        expect(names.get(entry)!.size, entry).toBeGreaterThan(0);
    }
    expect(NAME_OWNERS).toContain('browser/tone');
    expect(NAME_OWNERS).toContain('dawcore-spectrogram/orchestrator');
    expect(names.get('dawcore')!.has('DawEditorElement')).toBe(true);
    expect(names.get('transport')!.has('MeterEntry')).toBe(true);
    expect(names.get('dawcore-midi')!.has('loadMidiTracks')).toBe(true);
    expect(names.get('engine')!.has('calculateDuration')).toBe(true);
    expect(names.get('core')!.has('samplesToPixels')).toBe(true);
    expect(names.get('core')!.has('SnapTo')).toBe(true);
    expect(names.get('browser/tone')!.has('useExportWav')).toBe(true);
    expect(names.get('browser')!.has('WaveformPlaylistProvider')).toBe(true);
    expect(names.get('ui-components')!.has('BaseCheckbox')).toBe(true);
    const shared: string[] = [];
    const isPartOf = (part: string, main: string) =>
      PART_OF_MAIN_ENTRY.includes(part) && part.split('/')[0] === main;
    NAME_OWNERS.forEach((a, i) =>
      NAME_OWNERS.slice(i + 1).forEach((b) => {
        if (isPartOf(a, b) || isPartOf(b, a)) return;
        for (const name of names.get(a)!) {
          if (names.get(b)!.has(name)) shared.push(`${name} (${[a, b].sort().join(', ')})`);
        }
      })
    );
    expect(shared.sort()).toEqual(
      [
        ...CONTROLLED_AND_BOUND.map((name) => `${name} (browser, ui-components)`),
        ...DIFFERENT_THINGS,
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
