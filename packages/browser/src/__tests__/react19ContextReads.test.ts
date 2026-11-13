// #771: the React packages read a context with `use(Context)` and provide one
// with `<Context value>` (React 19). This scans source text, tests and stories
// included, so a new `useContext(` or `<X.Provider>` fails here.
//
// What it cannot see: `React.useContext` reached through another name
// (`const read = React.useContext`), and a provider held in a variable
// (`const P = X.Provider; <P>`). The two exported aliases
// `AnnotationIntegrationProvider` and `SpectrogramIntegrationProvider` are of
// that second kind and are public names.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REACT_PACKAGES = ['browser', 'annotations', 'ui-components', 'spectrogram', 'recording'];
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

  it('no source file calls useContext', () => {
    expect(matches(/[^A-Za-z0-9_]useContext[^A-Za-z0-9_]/)).toEqual([]);
  });

  it('no source file renders <X.Provider>', () => {
    expect(matches(/<\/?[A-Za-z0-9_.]+\.Provider[\s>]/)).toEqual([]);
  });
});
