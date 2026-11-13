// #771: the React packages read a context with `use(Context)` and provide one
// with `<Context value>` (React 19). This scans the text of every `.ts` and
// `.tsx` file under `src` of the packages below, tests and stories included.
// It fails on the word `useContext` anywhere (a comment or a string too) and
// on `.Provider` or `.Consumer` after an identifier anywhere, except on the
// two lines that define the public aliases `AnnotationIntegrationProvider`
// and `SpectrogramIntegrationProvider`.
//
// What it cannot see: a computed access (`React['useContext']`), and WHERE a
// `use()` call stands. `use()` may be called in a condition or a loop, so the
// lint rule that kept `useContext` at the top level does not report a
// conditional `use()`; keeping every read at the top level of its component
// or hook is a review matter.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REACT_PACKAGES = [
  'browser',
  'annotations',
  'ui-components',
  'spectrogram',
  'recording',
  'midi',
];
const THIS_FILE = fileURLToPath(import.meta.url);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && path !== THIS_FILE ? [path] : [];
  });
}

function matches(pattern: RegExp): string[] {
  return REACT_PACKAGES.flatMap((pkg) =>
    sourceFiles(join(packagesRoot, pkg, 'src')).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          pattern.test(line) ? [`${relative(packagesRoot, file)}:${index + 1}`] : []
        )
    )
  );
}

describe('React 19 context reads (#771)', () => {
  it('scans files in every React package', () => {
    for (const pkg of REACT_PACKAGES) {
      expect(sourceFiles(join(packagesRoot, pkg, 'src')).length).toBeGreaterThan(0);
    }
  });

  it('no source file mentions useContext', () => {
    expect(matches(/(^|[^A-Za-z0-9_])useContext($|[^A-Za-z0-9_])/)).toEqual([]);
  });

  it('no source file uses X.Provider or X.Consumer, the two public aliases apart', () => {
    expect(matches(/[A-Za-z0-9_]\.(Provider|Consumer)($|[^A-Za-z0-9_])/)).toEqual([
      'browser/src/AnnotationIntegrationContext.tsx:76',
      'browser/src/SpectrogramIntegrationContext.tsx:47',
    ]);
  });
});
