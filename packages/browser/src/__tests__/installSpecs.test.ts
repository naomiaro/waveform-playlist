/**
 * The build helper that tells a package which version of another package its
 * install hints should name (#884). Its rules copy pnpm's publish-time rewrite
 * of the `workspace:` protocol (`makePublishDependency` in pnpm 8.15, the
 * version the root `packageManager` pins), so a hint names the range the
 * published manifest has; a hand-written `>=` floor becomes a caret on the
 * version built with, so a stable build stops before the next breaking release.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hintRange,
  installSpecs,
  installSpecsDefine,
  publishedRange,
  satisfiesFloors,
  workspaceVersions,
} from '../../../../scripts/build/install-specs.mjs';

const packagesDir = join(__dirname, '../../..');
const manifest = (dir: string) =>
  JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'));

describe('satisfiesFloors', () => {
  it("admits a prerelease only through a floor with a prerelease on its own version (npm's rule)", () => {
    expect(satisfiesFloors('0.0.16-next.1', '>=0.0.16-0')).toBe(true);
    expect(satisfiesFloors('0.0.16-next.1', '>=0.0.16')).toBe(false);
    expect(satisfiesFloors('0.0.16-next.1', '>=0.0.1')).toBe(false);
    expect(satisfiesFloors('0.0.6-next.1', '>=0.0.1 || >=0.0.6-0')).toBe(true);
    // A prerelease floor on another version does not admit it either.
    expect(satisfiesFloors('0.0.16-next.1', '>=0.0.1-0')).toBe(false);
  });

  it('admits the release through a prerelease floor on its own version', () => {
    // transport 0.0.16 against dawcore's >=0.0.16-0 once 0.0.16 is released.
    expect(satisfiesFloors('0.0.16', '>=0.0.16-0')).toBe(true);
  });

  it('orders versions by semver precedence', () => {
    expect(satisfiesFloors('0.0.16', '>=0.0.16')).toBe(true);
    expect(satisfiesFloors('0.0.15', '>=0.0.16')).toBe(false);
    expect(satisfiesFloors('0.1.0', '>=0.0.16')).toBe(true);
    expect(satisfiesFloors('1.0.0-next.10', '>=1.0.0-next.9')).toBe(true);
    expect(satisfiesFloors('1.0.0-next.9', '>=1.0.0-next.10')).toBe(false);
    expect(satisfiesFloors('1.0.0-1', '>=1.0.0-a')).toBe(false);
    expect(satisfiesFloors('1.0.0-a', '>=1.0.0-a.1')).toBe(false);
    expect(satisfiesFloors('1.0.0-a.1', '>=1.0.0-a')).toBe(true);
  });

  it('says nothing about a range of another shape', () => {
    expect(satisfiesFloors('1.2.0', '^1.0.0')).toBeUndefined();
    expect(satisfiesFloors('1.2.0', '>=1.0.0 <2.0.0')).toBeUndefined();
  });
});

describe('hintRange', () => {
  afterEach(() => vi.restoreAllMocks());
  const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('names a caret on the version built with for a floor that admits it, silently', () => {
    const warn = quiet();
    expect(hintRange('>=0.0.16-0', '0.0.16-next.1', 'transport')).toBe('^0.0.16-next.1');
    expect(hintRange('>=0.0.16', '0.0.16', 'transport')).toBe('^0.0.16');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps a floor raised above the version built with, and says so in the build log', () => {
    const warn = quiet();
    expect(hintRange('>=0.0.16-0', '0.0.15', 'transport')).toBe('>=0.0.16-0');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(
      'transport names the peer range ">=0.0.16-0" as it is: the version in the manifests, 0.0.15, is below it'
    );
  });

  it('keeps a hand-written range of another shape on a workspace package, and says so', () => {
    const warn = quiet();
    expect(hintRange('^1.0.0', '1.2.0', 'x')).toBe('^1.0.0');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('not a range of >= floors');
  });

  it('keeps the range of a package not under packages/ without a warning', () => {
    const warn = quiet();
    expect(hintRange('>=15.0.0', undefined, 'tone')).toBe('>=15.0.0');
    expect(warn).not.toHaveBeenCalled();
  });

  it('gives the published range for a workspace token', () => {
    expect(hintRange('workspace:*', '2.0.0', 'x')).toBe('2.0.0');
  });
});

describe('publishedRange', () => {
  it('turns workspace:^ into a caret on the workspace version', () => {
    expect(publishedRange('workspace:^', '13.0.0-next.1')).toBe('^13.0.0-next.1');
  });

  it('turns workspace:~ into a tilde on the workspace version', () => {
    expect(publishedRange('workspace:~', '13.0.0')).toBe('~13.0.0');
  });

  it('turns workspace:* into the exact workspace version', () => {
    expect(publishedRange('workspace:*', '0.0.16-next.0')).toBe('0.0.16-next.0');
  });

  it('drops the protocol from a workspace range that names a version', () => {
    expect(publishedRange('workspace:^12.5.0', '13.0.0')).toBe('^12.5.0');
  });

  it('keeps a hand-written range as written', () => {
    expect(publishedRange('>=0.0.16-0', '0.0.16-next.0')).toBe('>=0.0.16-0');
    expect(publishedRange('>=12.7.0 || >=13.0.0-0', '13.0.0')).toBe('>=12.7.0 || >=13.0.0-0');
  });

  it('gives the exact version for a partial version ending in *, as pnpm does', () => {
    expect(publishedRange('workspace:1.*', '1.4.2')).toBe('1.4.2');
  });

  it('refuses a workspace alias or a path, which no hint can name', () => {
    expect(() => publishedRange('workspace:other@^1.0.0', '1.0.0')).toThrow(/no install hint/);
    expect(() => publishedRange('workspace:../other', '1.0.0')).toThrow(/no install hint/);
  });

  it('refuses a workspace token for a package that is not under packages/', () => {
    expect(() => publishedRange('workspace:^', undefined, 'website')).toThrow(
      /website has "workspace:\^" but is not a package under packages\//
    );
  });
});

describe('workspaceVersions', () => {
  it('skips a directory without a manifest instead of failing the build', () => {
    const root = mkdtempSync(join(tmpdir(), 'install-specs-'));
    try {
      mkdirSync(join(root, 'a'));
      writeFileSync(join(root, 'a', 'package.json'), '{"name":"a","version":"1.2.3"}');
      mkdirSync(join(root, 'leftover'));
      expect([...workspaceVersions(root)]).toEqual([['a', '1.2.3']]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('installSpecs', () => {
  it("names browser's workspace peers with a caret on the version in this commit", () => {
    const specs = installSpecs('browser');
    const playout = manifest('playout').version;
    expect(specs['@waveform-playlist/playout']).toBe(`@waveform-playlist/playout@^${playout}`);
    const mep = manifest('media-element-playout').version;
    expect(specs['@waveform-playlist/media-element-playout']).toBe(
      `@waveform-playlist/media-element-playout@^${mep}`
    );
    expect(specs['@dawcore/wam']).toBe(`@dawcore/wam@^${manifest('dawcore-wam').version}`);
  });

  it("names a peer from outside the workspace with browser's range for it", () => {
    expect(installSpecs('browser').tone).toBe(`tone@${manifest('browser').peerDependencies.tone}`);
  });

  it("names dawcore's hand-written floors with a caret on the version in the same manifests", () => {
    const specs = installSpecs('dawcore', ['@waveform-playlist/playout']);
    const peers = manifest('dawcore').peerDependencies;
    for (const [name, dir] of [
      ['@dawcore/transport', 'transport'],
      ['@dawcore/midi', 'dawcore-midi'],
      ['@dawcore/wam', 'dawcore-wam'],
      ['@dawcore/faust', 'dawcore-faust'],
      ['@waveform-playlist/worklets', 'worklets'],
    ]) {
      const version = manifest(dir).version;
      // A floor raised before the peer is versioned keeps the range (hintRange).
      const expected = satisfiesFloors(version, peers[name]) ? `^${version}` : peers[name];
      expect(specs[name]).toBe(`${name}@${expected}`);
    }
  });

  it('names an extra workspace package that is not a peer with a caret on its version', () => {
    const specs = installSpecs('dawcore', ['@waveform-playlist/playout']);
    expect(specs['@waveform-playlist/playout']).toBe(
      `@waveform-playlist/playout@^${manifest('playout').version}`
    );
  });

  it('keeps the peer range for an extra name that is also a peer', () => {
    // tone is not under packages/: as an extra alone it would fail the build.
    const specs = installSpecs('browser', ['tone']);
    expect(specs.tone).toBe(`tone@${manifest('browser').peerDependencies.tone}`);
  });

  it('refuses an extra name that is neither a peer nor a workspace package', () => {
    expect(() => installSpecs('dawcore', ['left-pad'])).toThrow(/left-pad/);
  });
});

describe('installSpecsDefine', () => {
  it('hands the specs to a bundler define as one JSON string', () => {
    const define = installSpecsDefine('browser');
    expect(JSON.parse(define.__INSTALL_SPECS__)).toEqual(installSpecs('browser'));
  });
});
