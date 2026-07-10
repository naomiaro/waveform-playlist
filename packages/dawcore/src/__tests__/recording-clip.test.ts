import { describe, it, expect, vi } from 'vitest';
import { addRecordedClip, type RecordingClipHost } from '../interactions/recording-clip';
import type { PeakData } from '@waveform-playlist/core';

function makeHost(overrides: Partial<RecordingClipHost> = {}): RecordingClipHost {
  return {
    samplesPerPixel: 1024,
    renderSamplesPerPixel: 1024,
    mono: false,
    isConnected: true,
    effectiveSampleRate: 48000,
    _tracks: new Map(),
    _engineTracks: new Map(),
    _peaksData: new Map(),
    _clipBuffers: new Map(),
    _clipOffsets: new Map(),
    _peakPipeline: {
      generatePeaks: vi.fn(async () => ({ data: [], length: 0, bits: 16 }) as unknown as PeakData),
    } as unknown as RecordingClipHost['_peakPipeline'],
    _engine: null,
    _recomputeDuration: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    ...overrides,
  } as RecordingClipHost;
}

function makeBuffer(length: number): AudioBuffer {
  return {
    length,
    numberOfChannels: 1,
    sampleRate: 48000,
    duration: length / 48000,
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer;
}

describe('addRecordedClip', () => {
  it('punch-in: carves overlapped content out of the track before inserting the clip (#579)', async () => {
    const existing = {
      id: 'existing',
      startSample: 0,
      durationSamples: 2048,
      offsetSamples: 0,
      sampleRate: 48000,
      sourceDurationSamples: 2048,
      gain: 1,
    };
    const host = makeHost({
      _engineTracks: new Map([
        ['t1', { id: 't1', name: 't1', clips: [existing] } as unknown as never],
      ]) as RecordingClipHost['_engineTracks'],
    });

    addRecordedClip(host, 't1', makeBuffer(1024), 0, 1024, 0);
    await vi.waitFor(() => {
      expect(host._peakPipeline.generatePeaks).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 0));

    const track = host._engineTracks.get('t1')!;
    expect(track.clips).toHaveLength(2);

    const carved = track.clips.find((c) => c.id === 'existing')!;
    const recorded = track.clips.find((c) => c.id !== 'existing')!;

    // The recorded clip owns [0, 1024) — matching the React provider's
    // punch-in replace semantics.
    expect(recorded.startSample).toBe(0);
    expect(carved.startSample).toBe(1024);
    expect(carved.offsetSamples).toBe(1024);
    expect(carved.durationSamples).toBe(1024);
  });

  it('does not orphan a _peaksData entry when the track was removed during peak generation', async () => {
    const host = makeHost(); // _engineTracks has no track — simulates removal mid-generation

    addRecordedClip(host, 'gone-track', makeBuffer(1000), 0, 1000, 0);
    await vi.waitFor(() => {
      expect(host._peakPipeline.generatePeaks).toHaveBeenCalled();
    });
    // Let the .then() continuation settle
    await new Promise((r) => setTimeout(r, 0));

    // Cleanup must cover every per-clip cache, not just _clipBuffers — the
    // clip never enters the engine, so nothing else ever deletes this entry.
    expect(host._clipBuffers.size).toBe(0);
    expect(host._peaksData.size).toBe(0);
  });
});

describe('addRecordedClip peak scale (audit wave 5)', () => {
  it('generates finalized peaks at renderSamplesPerPixel and records clip offsets', async () => {
    // In beats mode renderSamplesPerPixel is tick-derived and differs from
    // samplesPerPixel — the container is laid out in render space, so peaks
    // at the temporal scale draw at the wrong width. And without a
    // _clipOffsets entry, the statechange sync treats the clip as uncached
    // and re-runs the worker after EVERY recording.
    const host = makeHost({
      renderSamplesPerPixel: 237,
      _engineTracks: new Map([
        ['t1', { id: 't1', name: 't1', clips: [] } as unknown as never],
      ]) as RecordingClipHost['_engineTracks'],
    });
    const buf = makeBuffer(96000);

    addRecordedClip(host, 't1', buf, 48000, 96000, 0);
    await vi.waitFor(() => {
      expect(host._peakPipeline.generatePeaks).toHaveBeenCalled();
    });

    expect(host._peakPipeline.generatePeaks).toHaveBeenCalledWith(buf, 237, false);
    const [clipId] = [...host._clipBuffers.keys()];
    expect(host._clipOffsets.get(clipId)).toEqual({ offsetSamples: 0, durationSamples: 96000 });
    await new Promise((r) => setTimeout(r, 0));
  });
});
