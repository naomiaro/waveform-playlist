/**
 * #722: in the temporal scale, a tick's pixel is computed from its time, not
 * by adding a fractional pixel step in a loop. At 48000 Hz and 1000 samples
 * per pixel the accumulated step put the `0:02` label at pixel 95 for a time
 * that is at pixel 96.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { SmartScale } from '../components/SmartScale';
import { defaultTheme } from '../wfpl-theme';
import { PlaylistInfoContext, type PlaylistInfo } from '../contexts/PlaylistInfo';

afterEach(cleanup);

const baseInfo: PlaylistInfo = {
  sampleRate: 48000,
  samplesPerPixel: 1000,
  waveHeight: 80,
  timeScaleHeight: 15,
  barWidth: 1,
  barGap: 0,
  roundedBars: false,
  progressBarWidth: 1,
};

/** Every label's pixel, keyed by its text, as SmartScale hands them to `renderTick`. */
function labelPixels(info: Partial<PlaylistInfo>, durationMs: number): Map<string, number> {
  const pixels = new Map<string, number>();
  render(
    <ThemeProvider theme={defaultTheme}>
      <PlaylistInfoContext value={{ ...baseInfo, ...info }}>
        <SmartScale
          durationMs={durationMs}
          renderTick={(label, pix) => {
            pixels.set(label, pix);
            return null;
          }}
        />
      </PlaylistInfoContext>
    </ThemeProvider>
  );
  return pixels;
}

/** The pixel of a time, in exact integer arithmetic (the floor of samples / samplesPerPixel). */
function exactPixel(ms: number, sampleRate: number, samplesPerPixel: number): number {
  return Number((BigInt(ms) * BigInt(sampleRate)) / (1000n * BigInt(samplesPerPixel)));
}

/** "m:ss" back to milliseconds. */
function labelMs(label: string): number {
  const [m, s] = label.split(':').map(Number);
  return (m * 60 + s) * 1000;
}

describe('SmartScale temporal tick pixels (#722)', () => {
  it('puts 0:02 at pixel 96 at 48000 Hz and 1000 samples per pixel', () => {
    const pixels = labelPixels({ sampleRate: 48000, samplesPerPixel: 1000 }, 10000);
    expect(pixels.get('0:02')).toBe(96);
  });

  it.each([
    [48000, 1000],
    [44100, 1000],
    [44100, 441],
    // `(ms / 1000) * pixPerSec` rounds twice and puts 2:27 at 15999 here.
    [48000, 441],
    [48000, 3000],
    [96000, 10000],
  ])('places every label at its exact pixel at %i Hz, %i samples per pixel', (sr, spp) => {
    const durationMs = 20 * 60 * 1000;
    const pixels = labelPixels({ sampleRate: sr, samplesPerPixel: spp }, durationMs);
    expect(pixels.size).toBeGreaterThan(20);
    const wrong = [...pixels]
      .filter(([label, pix]) => pix !== exactPixel(labelMs(label), sr, spp))
      .map(([label, pix]) => `${label}: ${pix}, exact ${exactPixel(labelMs(label), sr, spp)}`);
    expect(wrong).toEqual([]);
  });

  it('draws a label one pixel before the end of the scale, and none at the end', () => {
    // 10 s at 48 px per second is 480 px, so the 0:10 label (pixel 480) is past it.
    expect(labelPixels({}, 10000).has('0:10')).toBe(false);
    cleanup();
    // 10.001 s is 481 px wide, so pixel 480 is the last one.
    expect(labelPixels({}, 10001).get('0:10')).toBe(480);
  });

  it('draws no labels, and returns, for a duration that is not a number', () => {
    expect(labelPixels({}, NaN).size).toBe(0);
  });
});
