import { describe, it, expect, vi } from 'vitest';
import { addRecordedClip, type RecordingClipHost } from '../interactions/recording-clip';
import { createClip, createTrack, isLoadingClip } from '@waveform-playlist/core';
import type { AudioClip, LoadingClip, PeakData } from '@waveform-playlist/core';
import { createArrangement } from '@waveform-playlist/engine';

/** An arrangement holding track 't1' with these clips (#848: the take goes into it). */
function arrangementWith(clips: (AudioClip | LoadingClip)[] = []) {
  return createArrangement({
    tracks: [{ ...createTrack({ name: 't1', clips: [] }), id: 't1', clips }],
  });
}

function trackOf(host: RecordingClipHost, id = 't1') {
  return host._arrangement.getTracks().find((t) => t.id === id)!;
}

function makeHost(overrides: Partial<RecordingClipHost> = {}): RecordingClipHost {
  return {
    samplesPerPixel: 1024,
    renderSamplesPerPixel: 1024,
    mono: false,
    isConnected: true,
    effectiveSampleRate: 48000,
    _arrangement: createArrangement(),
    _peaksData: new Map(),
    _clipBuffers: new Map(),
    _clipOffsets: new Map(),
    _peakPipeline: {
      generatePeaks: vi.fn(async () => ({ data: [], length: 0, bits: 16 }) as unknown as PeakData),
      getCachedScale: vi.fn(() => 0),
    } as unknown as RecordingClipHost['_peakPipeline'],
    _raiseZoomFloor: vi.fn(),
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
      ...createClip({
        startSample: 0,
        durationSamples: 2048,
        offsetSamples: 0,
        sampleRate: 48000,
        sourceDurationSamples: 2048,
        gain: 1,
      }),
      id: 'existing',
    };
    const host = makeHost({ _arrangement: arrangementWith([existing]) });

    addRecordedClip(host, 't1', makeBuffer(1024), 0, 1024, 0);
    await vi.waitFor(() => {
      expect(host._peakPipeline.generatePeaks).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 0));

    const track = trackOf(host);
    expect(track.clips).toHaveLength(2);

    const carved = track.clips.find((c) => c.id === 'existing') as AudioClip;
    const recorded = track.clips.find((c) => c.id !== 'existing') as AudioClip;

    // The recorded clip owns [0, 1024) — matching the React provider's
    // punch-in replace semantics.
    expect(recorded.startSample).toBe(0);
    expect(carved.startSample).toBe(1024);
    expect(carved.offsetSamples).toBe(1024);
    expect(carved.durationSamples).toBe(1024);
  });

  // #848: the track is in the arrangement while its audio loads.
  it('a take on a track with a loading clip keeps the loading clip, as one undo step', async () => {
    const loading: LoadingClip = { id: 'later', src: '/later.wav', start: 0, duration: 1 };
    const host = makeHost({ _arrangement: arrangementWith([loading]) });

    addRecordedClip(host, 't1', makeBuffer(1024), 0, 1024, 0);
    await vi.waitFor(() => expect(trackOf(host).clips).toHaveLength(2));

    const [kept, take] = trackOf(host).clips;
    expect(kept.id).toBe('later');
    expect(isLoadingClip(kept)).toBe(true);
    expect(isLoadingClip(take)).toBe(false);
    host._arrangement.undo();
    expect(trackOf(host).clips.map((c) => c.id)).toEqual(['later']);
    expect(host._arrangement.canUndo).toBe(false);
  });

  it('does not orphan a _peaksData entry when the track was removed during peak generation', async () => {
    const host = makeHost(); // the arrangement has no such track — simulates removal mid-generation

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
    const host = makeHost({ renderSamplesPerPixel: 237, _arrangement: arrangementWith() });
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

describe('addRecordedClip zoom floor (audit wave 5 review)', () => {
  it('raises the zoom floor from the worker-cached scale', async () => {
    // The recording path worker-caches peaks at the base scale like any
    // other load — skipping the floor raise lets the finalized recorded
    // waveform render squeezed when the editor is zoomed finer than 128.
    const host = makeHost({ _arrangement: arrangementWith() });
    (host._peakPipeline.getCachedScale as ReturnType<typeof vi.fn>).mockReturnValue(128);

    addRecordedClip(host, 't1', makeBuffer(96000), 0, 96000, 0);
    await vi.waitFor(() => {
      expect(host._peakPipeline.generatePeaks).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(host._raiseZoomFloor).toHaveBeenCalledWith(128);
  });
});

// #659: a recorded take has no <daw-clip> element, so its id used to be
// unreachable — absent from editor.tracks and from daw-recording-complete
// (which fires BEFORE the clip exists).
describe('addRecordedClip clip addressability (#659)', () => {
  function makeLoadedHost(overrides: Partial<RecordingClipHost> = {}) {
    return makeHost({
      _arrangement: arrangementWith(),
      ...overrides,
    });
  }

  async function settle(host: RecordingClipHost) {
    await vi.waitFor(() => {
      expect(host._peakPipeline.generatePeaks).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 0));
  }

  it('the take is in the arrangement under its name, where editor.tracks reads it (#848)', async () => {
    const host = makeLoadedHost();

    addRecordedClip(host, 't1', makeBuffer(1024), 0, 1024, 0, 'Take 1');
    await settle(host);

    expect(trackOf(host).clips[0]).toMatchObject({ name: 'Take 1' });
  });

  it('dispatches daw-recording-clip-add with trackId + clipId AFTER the clip reaches the arrangement', async () => {
    const order: string[] = [];
    const dispatchEvent = vi.fn((e: Event) => {
      order.push(e.type);
      return true;
    });
    const host = makeLoadedHost({ dispatchEvent });
    host._arrangement.subscribe(() => order.push('arrangement'));

    addRecordedClip(host, 't1', makeBuffer(1024), 0, 1024, 0);
    await settle(host);

    expect(order).toEqual(['arrangement', 'daw-recording-clip-add']);
    const event = dispatchEvent.mock.calls[0][0] as CustomEvent;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.detail).toEqual({
      trackId: 't1',
      clipId: trackOf(host).clips[0].id,
    });
  });

  it('does not dispatch when the track was removed during peak generation', async () => {
    const host = makeHost();

    addRecordedClip(host, 'gone-track', makeBuffer(1000), 0, 1000, 0);
    await settle(host);

    expect(host.dispatchEvent).not.toHaveBeenCalled();
  });

  it('does not dispatch on a disconnected editor', async () => {
    const host = makeLoadedHost({ isConnected: false });

    addRecordedClip(host, 't1', makeBuffer(1024), 0, 1024, 0);
    await settle(host);

    expect(host.dispatchEvent).not.toHaveBeenCalled();
  });
});
