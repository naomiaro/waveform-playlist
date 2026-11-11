import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Contract test against the INSTALLED Tone.js build (#671).
 *
 * Playout reaches into a few Tone.js private fields. Every other test in this
 * package mocks `tone`, so a rename upstream would pass them all and break
 * only in a browser. This reads the real build's source instead, and runs in
 * CI against both the stable line and `tone@next`.
 *
 * When one of these fails after a Tone.js update, read the linked call site
 * before touching the pattern — the workaround may need to change, not just
 * the test.
 */
const require = createRequire(import.meta.url);
const esmDir = path.dirname(require.resolve('tone'));
const source = (relativePath: string): string =>
  readFileSync(path.join(esmDir, relativePath), 'utf8');
const { version } = JSON.parse(
  readFileSync(path.join(esmDir, '..', '..', 'package.json'), 'utf8')
) as { version: string };

describe('Tone.js ' + version + ' private internals playout relies on', () => {
  it('is a 15.x build (the peer range)', () => {
    expect(version).toMatch(/^15\./);
  });

  // TonePlayout.play(): `transport._clock._lastUpdate = startTime` skips the
  // stale tick range after a stop/start cycle (Tone.js #1419).
  it('Transport keeps its Clock on _clock, and Clock tracks _lastUpdate', () => {
    expect(source('core/clock/Transport.js')).toMatch(/this\._clock = new Clock\(/);
    const clock = source('core/clock/Clock.js');
    expect(clock).toMatch(/this\._lastUpdate = 0;/);
    // The loop must still START from _lastUpdate, or advancing it skips nothing.
    expect(clock).toMatch(/const startTime = this\._lastUpdate;/);
  });

  // Public API, but load-bearing: clip sources connect to `inputGain.input`,
  // an external effects chain returns into `volumeNode.input.input`, and mute
  // and export fades automate `gain.input.gain` (the native AudioParam — this
  // replaced the private `signal._param`, Tone.js #1418).
  it('Gain.input is the native GainNode and Volume.input is a Gain', () => {
    expect(source('core/context/Gain.js')).toMatch(/this\.input = this\._gainNode;/);
    expect(source('component/channel/Volume.js')).toMatch(
      /this\.input = this\.output = new Gain\(/
    );
  });

  // audioContext.ts supportsNativeContextMode(): Tone's Listener wraps the
  // AudioListener AudioParams eagerly, which throws on a native Firefox
  // context (Tone.js #681). If this stops matching, the feature detection
  // (and the Firefox fallback) may no longer be needed.
  it('Listener still wraps the raw AudioListener params at construction', () => {
    expect(source('core/context/Listener.js')).toMatch(/rawContext\.listener\.positionX/);
  });
});
