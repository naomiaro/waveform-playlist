// #771: the React packages read a context with `use(Context)` and provide one
// with `<Context value>` (React 19). This scans the text of every `.ts` and
// `.tsx` file under `src` of the packages below, tests and stories included.
// It fails on the word `useContext` anywhere (a comment or a string too) and
// on `.Provider` or `.Consumer` after an identifier anywhere, except on the
// two lines that define the public aliases `AnnotationIntegrationProvider`
// and `SpectrogramIntegrationProvider`.
//
// What it cannot see: a computed access (`React['useContext']`), a provider
// reached as `X?.Provider`, `(X as T).Provider`, `const { Provider } = X` or
// with a line break before `.Provider`, and WHERE a
// `use()` call stands. `use()` may be called in a condition or a loop, so the
// lint rule that kept `useContext` at the top level does not report a
// conditional `use()`. A `no-restricted-syntax` rule in the root
// `eslint.config.mjs` reports those; `conditionalUseLint.test.ts` covers it.
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

function matchingLines(pattern: RegExp): { where: string; text: string }[] {
  return REACT_PACKAGES.flatMap((pkg) =>
    sourceFiles(join(packagesRoot, pkg, 'src')).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((text, index) =>
          pattern.test(text)
            ? [{ where: `${relative(packagesRoot, file)}:${index + 1}`, text }]
            : []
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
    expect(
      matchingLines(/(^|[^A-Za-z0-9_])useContext($|[^A-Za-z0-9_])/).map((hit) => hit.where)
    ).toEqual([]);
  });

  it('no source file uses X.Provider or X.Consumer, the two public aliases apart', () => {
    const ALIAS = /^export const (Annotation|Spectrogram)IntegrationProvider = \w+\.Provider;$/;
    const hits = matchingLines(/[A-Za-z0-9_]\.(Provider|Consumer)($|[^A-Za-z0-9_])/);
    expect(hits.filter((hit) => !ALIAS.test(hit.text)).map((hit) => hit.where)).toEqual([]);
    expect(
      hits.filter((hit) => ALIAS.test(hit.text)).map((hit) => hit.where.split(':')[0])
    ).toEqual([
      'browser/src/AnnotationIntegrationContext.tsx',
      'browser/src/SpectrogramIntegrationContext.tsx',
    ]);
  });
});
