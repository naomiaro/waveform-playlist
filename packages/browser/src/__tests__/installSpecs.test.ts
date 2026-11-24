/**
 * The build helper that tells a package which version of another package its
 * install hints should name (#884). Its rules copy pnpm's publish-time rewrite
 * of the `workspace:` protocol (`replaceWorkspaceProtocolPeerDependency` in
 * pnpm 8.15), so a hint names the range the published manifest has.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  installSpecs,
  installSpecsDefine,
  publishedRange,
} from '../../../../scripts/build/install-specs.mjs';

const packagesDir = join(__dirname, '../../..');
const manifest = (dir: string) =>
  JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'));

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

  it('refuses a workspace alias, which no hint can name', () => {
    expect(() => publishedRange('workspace:other@^1.0.0', '1.0.0')).toThrow(/workspace alias/);
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

  it("names dawcore's hand-written peer ranges as written", () => {
    const specs = installSpecs('dawcore', ['@waveform-playlist/playout']);
    const peers = manifest('dawcore').peerDependencies;
    for (const name of [
      '@dawcore/transport',
      '@dawcore/midi',
      '@dawcore/wam',
      '@dawcore/faust',
      '@waveform-playlist/worklets',
    ]) {
      expect(specs[name]).toBe(`${name}@${peers[name]}`);
    }
  });

  it('names an extra workspace package that is not a peer with a caret on its version', () => {
    const specs = installSpecs('dawcore', ['@waveform-playlist/playout']);
    expect(specs['@waveform-playlist/playout']).toBe(
      `@waveform-playlist/playout@^${manifest('playout').version}`
    );
  });

  it('keeps the peer range for an extra name that is also a peer', () => {
    const specs = installSpecs('dawcore', ['@dawcore/transport']);
    const range = manifest('dawcore').peerDependencies['@dawcore/transport'];
    expect(specs['@dawcore/transport']).toBe(`@dawcore/transport@${range}`);
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
