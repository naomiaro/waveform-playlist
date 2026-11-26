/**
 * #722: each temporal tick of `<daw-ruler>` is at the floor of its time's
 * samples / samplesPerPixel. `(ms / 1000) * pixPerSec` rounds twice and put
 * 2:27 at pixel 15999 at 48000 Hz and 441 samples per pixel.
 */
import { describe, it, expect } from 'vitest';
import { computeTemporalTicks, getScaleInfo } from '../utils/smart-scale';

/** The pixel of a time, in exact integer arithmetic. */
function exactPixel(ms: number, sampleRate: number, samplesPerPixel: number): number {
  return Number((BigInt(ms) * BigInt(sampleRate)) / (1000n * BigInt(samplesPerPixel)));
}

/** "m:ss" back to milliseconds. */
function labelMs(label: string): number {
  const [m, s] = label.split(':').map(Number);
  return (m * 60 + s) * 1000;
}

describe('computeTemporalTicks pixels (#722)', () => {
  it('puts 2:27 at pixel 16000 at 48000 Hz and 441 samples per pixel', () => {
    const { labels } = computeTemporalTicks(441, 48000, 20 * 60, 30);
    expect(labels.find((l) => l.text === '2:27')?.pix).toBe(16000);
  });

  it.each([
    [48000, 1000],
    [44100, 1000],
    [44100, 441],
    [48000, 441],
    [96000, 441],
    [48000, 3000],
  ])('places every label at its exact pixel at %i Hz, %i samples per pixel', (sr, spp) => {
    const { labels } = computeTemporalTicks(spp, sr, 20 * 60, 30);
    expect(labels.length).toBeGreaterThan(20);
    const wrong = labels
      .filter(({ text, pix }) => pix !== exactPixel(labelMs(text), sr, spp))
      .map(({ text, pix }) => `${text}: ${pix}, exact ${exactPixel(labelMs(text), sr, spp)}`);
    expect(wrong).toEqual([]);
  });

  it.each([
    [48000, 1024],
    [96000, 1024],
    [44100, 1024],
  ])('places every tick mark at its exact pixel at %i Hz, %i samples per pixel', (sr, spp) => {
    const durationSeconds = 20 * 60;
    const { canvasInfo, widthX } = computeTemporalTicks(spp, sr, durationSeconds, 30);
    const { smallStep } = getScaleInfo(spp);
    const expected: number[] = [];
    for (let ms = 0; exactPixel(ms, sr, spp) < widthX; ms += smallStep) {
      expected.push(exactPixel(ms, sr, spp));
    }
    expect([...canvasInfo.keys()]).toEqual(expected);
  });

  it('draws a tick one pixel before the end of the ruler, and none at the end', () => {
    // 10 s at 48 px per second is 480 px, so the 0:10 tick (pixel 480) is past it.
    expect(computeTemporalTicks(1000, 48000, 10, 30).labels.map((l) => l.text)).not.toContain(
      '0:10'
    );
    // 10.001 s is 481 px wide, so pixel 480 is the last one.
    const { labels } = computeTemporalTicks(1000, 48000, 10.001, 30);
    expect(labels[labels.length - 1]).toEqual({
      pix: 480,
      text: '0:10',
    });
  });

  it('returns no ticks for a duration that is not a number', () => {
    const { labels, canvasInfo } = computeTemporalTicks(1000, 48000, NaN, 30);
    expect(labels).toEqual([]);
    expect(canvasInfo.size).toBe(0);
  });
});
