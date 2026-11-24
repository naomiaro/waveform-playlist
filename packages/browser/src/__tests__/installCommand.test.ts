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

describe('the build hands the published ranges to installCommand', () => {
  const expected = installSpecsDefine('browser');

  it('tsup defines __INSTALL_SPECS__ for the published build', async () => {
    expect((await loadConfig('tsup.config.ts')).define).toEqual(expected);
  });

  it('vitest defines the same, so these tests see what a build prints', async () => {
    expect((await loadConfig('vitest.config.ts')).define).toEqual(expected);
    const specs = JSON.parse(expected.__INSTALL_SPECS__) as Record<string, string>;
    expect(installCommand('tone')).toBe(`npm install "${specs.tone}"`);
  });
});
