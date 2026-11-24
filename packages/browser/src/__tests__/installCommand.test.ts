import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installSpecsDefine } from '../../../../scripts/build/install-specs.mjs';
import { formatInstallCommand, installCommand } from '../utils/installCommand';

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
    expect(formatInstallCommand({}, ['@dawcore/wam'])).toBe('npm install "@dawcore/wam"');
  });
});

// spectrogram is no peer of browser: the spectrogram hook's error names it.
const expected = installSpecsDefine('browser', ['@waveform-playlist/spectrogram']);
const builtSpecs = JSON.parse(expected.__INSTALL_SPECS__) as Record<string, string>;

/** Every `installCommand(...)` call in the package's source, by file. */
function installCommandCalls(): { file: string; args: string }[] {
  const srcDir = join(__dirname, '..');
  const files = (readdirSync(srcDir, { recursive: true }) as string[]).filter(
    (file) =>
      /\.tsx?$/.test(file) && !file.includes('__tests__') && !file.endsWith('installCommand.ts')
  );
  return files.flatMap((file) =>
    [...readFileSync(join(srcDir, file), 'utf8').matchAll(/installCommand\(([^)]*)\)/g)].map(
      (match) => ({ file, args: match[1] })
    )
  );
}

describe('the build hands the published ranges to installCommand', () => {
  it('tsup defines __INSTALL_SPECS__ for the published build', async () => {
    expect((await loadConfig('tsup.config.ts')).define).toEqual(expected);
  });

  it('vitest defines the same, so these tests see what a build prints', async () => {
    expect((await loadConfig('vitest.config.ts')).define).toEqual(expected);
    expect(installCommand('tone')).toBe(`npm install "${builtSpecs.tone}"`);
  });

  it('has a range for every package an installCommand call in the source names', () => {
    const calls = installCommandCalls();
    expect(calls.length).toBeGreaterThanOrEqual(6);
    for (const { file, args } of calls) {
      const names = [...args.matchAll(/'([^']+)'/g)].map((match) => match[1]);
      expect(names, `${file}: installCommand(${args}) names no package literally`).not.toEqual([]);
      for (const name of names) {
        expect(builtSpecs[name], `${file}: no range built in for ${name}`).toBeDefined();
      }
    }
  });
});
