import { describe, it, expect } from 'vitest';

/**
 * Mono-to-stereo mirroring logic extracted from useMicrophoneLevel.
 *
 * When a mono microphone is used with channelCount=2, the worklet sends
 * a single-channel peak/rms array. The hook mirrors channel 0 values
 * to fill the requested channelCount so the VU meter shows both bars.
 *
 * Logic (from useMicrophoneLevel lines 174-177):
 *   const mirroredPeaks = peak.length < channelCount
 *     ? new Array(channelCount).fill(peakValues[0])
 *     : peakValues;
 */

interface MirrorInput {
  /** Raw peak values from worklet (one per actual mic channel) */
  rawValues: number[];
  /** Requested channel count for display */
  channelCount: number;
}

/**
 * Pure function mirroring the mono-to-stereo logic from useMicrophoneLevel
 */
function mirrorToChannelCount(input: MirrorInput): number[] {
  const { rawValues, channelCount } = input;
  if (rawValues.length < channelCount) {
    return new Array(channelCount).fill(rawValues[0]);
  }
  return rawValues;
}

describe('mono-to-stereo mirroring', () => {
  it('mirrors mono to stereo', () => {
    const result = mirrorToChannelCount({ rawValues: [0.75], channelCount: 2 });
    expect(result).toEqual([0.75, 0.75]);
  });

  it('mirrors mono to 4 channels', () => {
    const result = mirrorToChannelCount({ rawValues: [0.5], channelCount: 4 });
    expect(result).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('passes through when channel count matches', () => {
    const result = mirrorToChannelCount({ rawValues: [0.3, 0.7], channelCount: 2 });
    expect(result).toEqual([0.3, 0.7]);
  });

  it('passes through when more channels than requested', () => {
    const result = mirrorToChannelCount({ rawValues: [0.3, 0.7, 0.5], channelCount: 2 });
    expect(result).toEqual([0.3, 0.7, 0.5]);
  });

  it('mirrors zero value', () => {
    const result = mirrorToChannelCount({ rawValues: [0], channelCount: 2 });
    expect(result).toEqual([0, 0]);
  });

  it('mirrors max value', () => {
    const result = mirrorToChannelCount({ rawValues: [1.0], channelCount: 2 });
    expect(result).toEqual([1.0, 1.0]);
  });

  it('mirrors above-unity value', () => {
    const result = mirrorToChannelCount({ rawValues: [1.5], channelCount: 2 });
    expect(result).toEqual([1.5, 1.5]);
  });

  it('single channel with channelCount=1 passes through', () => {
    const result = mirrorToChannelCount({ rawValues: [0.42], channelCount: 1 });
    expect(result).toEqual([0.42]);
  });

  describe('applied to both peak and RMS arrays', () => {
    it('mirrors peak and rms independently', () => {
      // Simulates what useMicrophoneLevel does for both arrays
      const peakValues = [0.8];
      const rmsValues = [0.3];
      const channelCount = 2;

      const mirroredPeaks = mirrorToChannelCount({ rawValues: peakValues, channelCount });
      const mirroredRms = mirrorToChannelCount({ rawValues: rmsValues, channelCount });

      expect(mirroredPeaks).toEqual([0.8, 0.8]);
      expect(mirroredRms).toEqual([0.3, 0.3]);
    });

    it('does not mirror when stereo mic provides 2 channels', () => {
      const peakValues = [0.8, 0.6];
      const rmsValues = [0.3, 0.2];
      const channelCount = 2;

      const mirroredPeaks = mirrorToChannelCount({ rawValues: peakValues, channelCount });
      const mirroredRms = mirrorToChannelCount({ rawValues: rmsValues, channelCount });

      expect(mirroredPeaks).toEqual([0.8, 0.6]);
      expect(mirroredRms).toEqual([0.3, 0.2]);
    });
  });
});
