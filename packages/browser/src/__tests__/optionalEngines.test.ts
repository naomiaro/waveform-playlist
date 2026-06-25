// Issue #510: both playout engines + tone must be OPTIONAL peer deps of
// @waveform-playlist/browser so consumers can use one path or bring their own
// PlayoutAdapter without installing the other engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8')
);

const OPTIONAL_ENGINES = [
  '@waveform-playlist/playout',
  '@waveform-playlist/media-element-playout',
  'tone',
];

describe('optional playout engines (#510)', () => {
  it('does not list the engines as hard dependencies', () => {
    const deps = pkg.dependencies ?? {};
    for (const name of OPTIONAL_ENGINES) {
      expect(deps).not.toHaveProperty(name);
    }
  });

  it('declares the engines as optional peerDependencies', () => {
    const peers = pkg.peerDependencies ?? {};
    const meta = pkg.peerDependenciesMeta ?? {};
    for (const name of OPTIONAL_ENGINES) {
      expect(peers).toHaveProperty(name);
      expect(meta[name]).toEqual({ optional: true });
    }
  });

  it('uses workspace:^ ranges for the sibling engine peers', () => {
    const peers = pkg.peerDependencies ?? {};
    expect(peers['@waveform-playlist/playout']).toBe('workspace:^');
    expect(peers['@waveform-playlist/media-element-playout']).toBe('workspace:^');
  });
});
