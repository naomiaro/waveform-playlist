import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installSpecsDefine } from '../../../../scripts/build/install-specs.mjs';
import { formatInstallCommand, installCommand } from '../utils/install-command';

// The two configs are outside `rootDir`; a computed path keeps tsc from
// compiling them into this package.
const loadConfig = async (file: string): Promise<{ define?: unknown }> => {
  const mod = (await import(/* @vite-ignore */ `../../${file}`)) as { default: unknown };
  return (Array.isArray(mod.default) ? mod.default[0] : mod.default) as { define?: unknown };
};

describe('formatInstallCommand', () => {
  it('quotes each spec, since a range holds > and ||', () => {
    expect(formatInstallCommand({ a: 'a@>=1.0.0 || >=2.0.0-0', b: 'b@^3.0.0' }, ['a', 'b'])).toBe(
      'npm install "a@>=1.0.0 || >=2.0.0-0" "b@^3.0.0"'
    );
  });

  it('falls back to the bare name where no range was built in', () => {
    expect(formatInstallCommand({}, ['@dawcore/midi'])).toBe('npm install "@dawcore/midi"');
  });
});

// playout is no peer of dawcore: the no-adapter error names it as one of two adapters.
const expected = installSpecsDefine('dawcore', ['@waveform-playlist/playout']);
const builtSpecs = JSON.parse(expected.__INSTALL_SPECS__) as Record<string, string>;

const srcDir = join(__dirname, '..');
const sourceFiles = (readdirSync(srcDir, { recursive: true }) as string[]).filter(
  (file) =>
    /\.ts$/.test(file) && !file.includes('__tests__') && !file.endsWith('install-command.ts')
);
const source = (file: string) => readFileSync(join(srcDir, file), 'utf8');

describe('the build hands the hint ranges to installCommand', () => {
  it('tsup defines __INSTALL_SPECS__ for the published build', async () => {
    expect((await loadConfig('tsup.config.ts')).define).toEqual(expected);
  });

  it('vitest defines the same, so these tests see what a build prints', async () => {
    expect((await loadConfig('vitest.config.ts')).define).toEqual(expected);
    expect(installCommand('@dawcore/transport')).toBe(
      `npm install "${builtSpecs['@dawcore/transport']}"`
    );
  });

  it('has a range for every package an installCommand call in the source names', () => {
    const names: string[] = [];
    for (const file of sourceFiles) {
      for (const [, args] of source(file).matchAll(/installCommand\(([^)]*)\)/g)) {
        if (args === 'packageName') {
          // optional-modules.ts: the names come from its loadOptionalModule calls.
          for (const [, name] of source(file).matchAll(/loadOptionalModule\([^,]+,\s*'([^']+)'/g)) {
            names.push(name);
          }
          continue;
        }
        const literal = [...args.matchAll(/'([^']+)'/g)].map((match) => match[1]);
        expect(literal, `${file}: installCommand(${args}) names no package literally`).not.toEqual(
          []
        );
        names.push(...literal);
      }
    }
    expect(names.length).toBeGreaterThanOrEqual(6);
    for (const name of names) {
      expect(builtSpecs[name], `no range built in for ${name}`).toBeDefined();
    }
  });
});
