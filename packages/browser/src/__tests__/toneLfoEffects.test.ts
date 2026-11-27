import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Contract test against the INSTALLED Tone.js build (#820), after playout's
 * `toneInternals.test.ts` (#671).
 *
 * `createToneEffectInstance` calls `start()` on chorus, tremolo, auto panner
 * and auto filter, because Tone builds their LFO stopped, and on nothing
 * else, because Phaser and Vibrato start their own. Both halves are facts
 * about Tone's constructors, and getting either wrong ends in a throw
 * ("Start time must be strictly greater than previous start time") or in an
 * effect that does not move. Every other test of the factory mocks `tone`, so
 * this one reads the real build's source. It runs in CI against the stable
 * line and against `tone@next`.
 *
 * When one of these fails after a Tone.js update, read the constructor before
 * touching the pattern: `EFFECTS_WITH_A_STOPPED_LFO` in
 * `effects/effectFactory.ts` may need to change, not the test.
 */
const require = createRequire(import.meta.url);
const esmDir = path.dirname(require.resolve('tone'));
/** A file of the build with its comment lines removed (the JSDoc examples call start()). */
const code = (relativePath: string): string =>
  readFileSync(path.join(esmDir, relativePath), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join('\n');
const { version } = JSON.parse(
  readFileSync(path.join(esmDir, '..', '..', 'package.json'), 'utf8')
) as { version: string };

/** A start() call with no time: what a constructor that starts its own LFO makes. */
const STARTS_ITSELF = /\.start\(\)/;
/** The option Tone 15.5.x added for an effect that starts its own LFO. */
const AUTOSTART = /autostart/;
const HAS_START_METHOD = /^ {4}start\(time\) \{/m;

describe('Tone.js ' + version + ': which LFO effects start themselves', () => {
  it('is a 15.x build (the peer range)', () => {
    expect(version).toMatch(/^15\./);
  });

  it('Chorus has start() and does not start itself', () => {
    const chorus = code('effect/Chorus.js');
    expect(chorus).toMatch(HAS_START_METHOD);
    expect(chorus).not.toMatch(STARTS_ITSELF);
    expect(chorus).not.toMatch(AUTOSTART);
  });

  it('AutoPanner and AutoFilter get start() from LFOEffect, and none of the three starts itself', () => {
    const base = code('effect/LFOEffect.js');
    expect(base).toMatch(HAS_START_METHOD);
    expect(base).not.toMatch(STARTS_ITSELF);
    expect(base).not.toMatch(AUTOSTART);
    for (const file of ['effect/AutoPanner.js', 'effect/AutoFilter.js']) {
      const effect = code(file);
      expect(effect, file).toMatch(/extends LFOEffect /);
      expect(effect, file).not.toMatch(/\.start\(/);
      expect(effect, file).not.toMatch(AUTOSTART);
    }
  });

  it('Tremolo has start() and does not start itself', () => {
    const tremolo = code('effect/Tremolo.js');
    expect(tremolo).not.toMatch(STARTS_ITSELF);
    expect(tremolo).not.toMatch(AUTOSTART);
    if (/extends LFOStereoEffect /.test(tremolo)) {
      // 15.5.x: start() and an `autostart` option come from the base class
      // Phaser also extends. Tremolo must keep the default, which is off.
      const base = code('effect/LFOStereoEffect.js');
      expect(base).toMatch(HAS_START_METHOD);
      expect(base).toMatch(/autostart: false/);
    } else {
      expect(tremolo).toMatch(HAS_START_METHOD);
    }
  });

  it('Phaser starts itself', () => {
    const phaser = code('effect/Phaser.js');
    // 15.1.x starts both LFOs in the constructor; 15.5.x asks its base class to.
    expect(STARTS_ITSELF.test(phaser) || /autostart: true/.test(phaser)).toBe(true);
  });

  it('Vibrato starts itself', () => {
    expect(code('effect/Vibrato.js')).toMatch(STARTS_ITSELF);
  });
});
