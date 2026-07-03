import { describe, it, expect } from 'vitest';
import { computePaddedFftRange } from '../src/computation/fftSampleRange';

// MAX_CANVAS_WIDTH === 1000. Expected values are hand-derived from the formula:
//   startPx = min(chunkIndex * 1000)
//   endPx   = max(chunkIndex * 1000 + widthPx)
//   startSample = offset + floor(startPx * spp)
//   endSample   = min(offset + duration, offset + ceil(endPx * spp))
//   paddedStart = max(offset, startSample - fftSize)
//   paddedEnd   = min(offset + duration, endSample + fftSize)

describe('computePaddedFftRange', () => {
  it('single full chunk from clip start, padded both sides', () => {
    expect(
      computePaddedFftRange({
        chunks: [{ chunkIndex: 0, widthPx: 1000 }],
        fftSize: 1024,
        offsetSamples: 0,
        durationSamples: 10_000_000,
        samplesPerPixel: 256,
      })
    ).toEqual({ paddedStart: 0, paddedEnd: 257024 });
  });

  it('middle chunk with a clip offset shifts the whole range', () => {
    expect(
      computePaddedFftRange({
        chunks: [{ chunkIndex: 2, widthPx: 1000 }],
        fftSize: 1000,
        offsetSamples: 100_000,
        durationSamples: 10_000_000,
        samplesPerPixel: 100,
      })
    ).toEqual({ paddedStart: 299_000, paddedEnd: 401_000 });
  });

  it('multi contiguous chunks with a narrower last chunk use the widest right edge', () => {
    expect(
      computePaddedFftRange({
        chunks: [
          { chunkIndex: 0, widthPx: 1000 },
          { chunkIndex: 1, widthPx: 1000 },
          { chunkIndex: 2, widthPx: 500 },
        ],
        fftSize: 512,
        offsetSamples: 0,
        durationSamples: 10_000_000,
        samplesPerPixel: 200,
      })
    ).toEqual({ paddedStart: 0, paddedEnd: 500_512 });
  });

  it('clamps the end to the clip (offset + duration), including the trailing pad', () => {
    expect(
      computePaddedFftRange({
        chunks: [{ chunkIndex: 0, widthPx: 1000 }],
        fftSize: 1000,
        offsetSamples: 0,
        durationSamples: 100_000,
        samplesPerPixel: 256,
      })
    ).toEqual({ paddedStart: 0, paddedEnd: 100_000 });
  });

  it('clamps the padded start to the clip offset', () => {
    expect(
      computePaddedFftRange({
        chunks: [{ chunkIndex: 0, widthPx: 1000 }],
        fftSize: 5000,
        offsetSamples: 1000,
        durationSamples: 10_000_000,
        samplesPerPixel: 100,
      })
    ).toEqual({ paddedStart: 1000, paddedEnd: 106_000 });
  });

  it('rounds the end up (ceil) for a fractional samples-per-pixel', () => {
    // endPx = 1999, 1999 * 0.5 = 999.5 → ceil 1000; startPx = 1000, *0.5 = 500 (exact)
    expect(
      computePaddedFftRange({
        chunks: [{ chunkIndex: 1, widthPx: 999 }],
        fftSize: 0,
        offsetSamples: 0,
        durationSamples: 10_000_000,
        samplesPerPixel: 0.5,
      })
    ).toEqual({ paddedStart: 500, paddedEnd: 1000 });
  });
});
