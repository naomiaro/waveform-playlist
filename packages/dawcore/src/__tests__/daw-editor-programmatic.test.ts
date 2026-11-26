import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import {
  makeAudioBuffer as makeDecodedBuffer,
  makeAudioFile,
  makeFakeAdapter,
  mountEditor,
  restoreFetch,
  settle,
  stubFetch,
  stubPeakPipeline,
  tick,
} from './helpers/editor-harness';
import type { FakeAdapter } from './helpers/editor-harness';

/** A track as it is played (loaded clips, current mix), read from the arrangement (#848). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const played = (editor: any, id: string) => editor._loadedTracks().find((t: any) => t.id === id);

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
  await import('../elements/daw-editor');
});

// Minimal AudioBuffer mock — only the fields _loadAndAppendClip / _loadTrack read.
function makeAudioBuffer(durationSec = 2, sampleRate = 48000): AudioBuffer {
  const length = Math.round(durationSec * sampleRate);
  return {
    length,
    duration: durationSec,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer;
}

function makePeakData() {
  return { data: [new Int16Array(0)], length: 0, bits: 16 };
}

// Stubs the audio-decode + peak-generation paths so tests don't need a real
// AudioContext. Mirrors what _loadTrack / _loadAndAppendClip would do.
function stubAudioPipeline(editor: any) {
  editor._fetchAndDecode = vi.fn().mockResolvedValue(makeAudioBuffer());
  editor._peakPipeline = {
    generatePeaks: vi.fn().mockResolvedValue(makePeakData()),
    cacheWaveformData: vi.fn(),
    getMaxCachedScale: vi.fn().mockReturnValue(0),
    getCachedScale: vi.fn().mockReturnValue(0),
    reextractPeaks: vi.fn().mockReturnValue(new Map()),
    terminate: vi.fn(),
  };
  // Mock the engine so _ensureEngine resolves without building one.
  editor._engine = {
    recordingTrackIds: new Set<string>(),
    setTracks: vi.fn(),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    updateTrack: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackPan: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setSelection: vi.fn(),
    selectTrack: vi.fn(),
    setTempo: vi.fn(),
    on: vi.fn(),
    dispose: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    getAudibleTime: vi.fn().mockReturnValue(0),
    getState: vi.fn().mockReturnValue({ tracks: [] }),
  };
}

const AUDIO_URLS = [
  '/a.opus',
  '/b.opus',
  '/c.opus',
  '/late.opus',
  '/good1.opus',
  '/good2.opus',
  '/bad.opus',
  '/missing.opus',
];

afterEach(() => {
  restoreFetch();
});

/**
 * An editor on the shared harness (#848): a real engine on a fake adapter,
 * `fetch` stubbed for the URLs above, and a peak pipeline that resolves at
 * once. The editor's arrangement fetches and decodes; a test sets what a URL
 * decodes to with `fake.setDecoded` / `fake.holdDecode`.
 */
async function setupLoadingEditor(): Promise<{
  editor: any;
  fake: FakeAdapter;
  pipeline: Record<string, Mock>;
}> {
  const fake = makeFakeAdapter();
  stubFetch(Object.fromEntries(AUDIO_URLS.map((url) => [url, 'ok' as const])));
  let pipeline!: Record<string, Mock>;
  const editor = await mountEditor({
    adapter: fake.adapter,
    before: (e) => {
      pipeline = stubPeakPipeline(e);
    },
  });
  return { editor, fake, pipeline };
}

/** A method of the fake adapter, as the mock it is. */
function mockOf(fake: FakeAdapter, method: string): Mock {
  return fake.adapter[method] as Mock;
}

/** The `<daw-track>` element of a track id (`editor.addTrack()` resolves with the id). */
function trackElement(editor: any, trackId: string): any {
  return [...editor.querySelectorAll('daw-track')].find((t: any) => t.trackId === trackId);
}

function setupEditor(): any {
  const editor = document.createElement('daw-editor') as any;
  // A complete fake: the editor builds a real engine on it at connect (#848),
  // and a track entering calls the adapter.
  editor.adapter = makeFakeAdapter().adapter;
  document.body.appendChild(editor);
  stubAudioPipeline(editor);
  return editor;
}

describe('editor.ready()', () => {
  it('exposes ready() as a method', () => {
    const editor = setupEditor();
    expect(typeof editor.ready).toBe('function');
    editor.remove();
  });

  it('resolves with the engine when called before any track', async () => {
    const editor = setupEditor();
    // _ensureEngine returns the stubbed engine immediately
    const engine = await editor.ready();
    expect(engine).toBe(editor._engine);
    editor.remove();
  });
});

describe('editor.addTrack()', () => {
  it('appends a <daw-track> element to the editor', async () => {
    const { editor } = await setupLoadingEditor();

    const promise = editor.addTrack({ name: 'Test', volume: 0.7 });
    // Element is appended synchronously; the promise resolves with its id once it has entered
    expect(editor.querySelectorAll('daw-track').length).toBe(1);

    const trackEl = editor.querySelector('daw-track');
    const id = await promise;
    expect(id).toBe(trackEl.trackId);
    expect(trackEl.name).toBe('Test');
    expect(trackEl.volume).toBe(0.7);
    editor.remove();
  });

  it('builds <daw-clip> children from config.clips', async () => {
    const editor = setupEditor();
    editor.addTrack({
      name: 'Multi',
      clips: [
        { src: '/a.opus', start: 0, duration: 4 },
        { src: '/b.opus', start: 4, duration: 4 },
      ],
    });
    await new Promise((r) => setTimeout(r, 60));
    const clips = editor.querySelectorAll('daw-clip');
    expect(clips.length).toBe(2);
    expect((clips[0] as any).src).toBe('/a.opus');
    expect((clips[1] as any).start).toBe(4);
    editor.remove();
  });
});

describe('editor.removeTrack()', () => {
  it('removes the matching <daw-track> element from the DOM', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'Test' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    expect(editor.querySelectorAll('daw-track').length).toBe(1);
    editor.removeTrack(trackEl.trackId);
    expect(editor.querySelectorAll('daw-track').length).toBe(0);
    editor.remove();
  });

  it('falls back to direct cleanup for tracks without a DOM element', async () => {
    const { editor } = await setupLoadingEditor();
    // A file-dropped track: in the arrangement, with no <daw-track>
    const { loaded } = await editor.loadFiles([makeAudioFile('drop.wav')]);
    expect(editor.querySelectorAll('daw-track').length).toBe(0);
    expect(editor._loadedTracks().length).toBe(1);
    editor.removeTrack(loaded[0]);
    expect(editor._loadedTracks().length).toBe(0);
    expect(editor._arrangement.getTracks()).toEqual([]);
    editor.remove();
  });

  it('warns and is a no-op for unknown trackId', () => {
    const editor = setupEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => editor.removeTrack('not-a-track')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no track found'));
    warnSpy.mockRestore();
    editor.remove();
  });
});

describe('editor.updateTrack()', () => {
  it('mutates reflected attributes on the <daw-track> element', async () => {
    const { editor } = await setupLoadingEditor();
    const id = await editor.addTrack({ name: 'Original', volume: 1, pan: 0 });
    const trackEl = trackElement(editor, id);
    editor.updateTrack(id, {
      name: 'Updated',
      volume: 0.3,
      muted: true,
    });
    expect(trackEl.getAttribute('name')).toBe('Updated');
    expect(trackEl.volume).toBe(0.3);
    expect(trackEl.hasAttribute('muted')).toBe(true);
    editor.remove();
  });

  it('applies directly to the arrangement for non-DOM tracks (file drops)', async () => {
    const { editor } = await setupLoadingEditor();
    const { loaded } = await editor.loadFiles([makeAudioFile('file.wav')]);
    const id = loaded[0];
    const setVolume = vi.spyOn(editor._arrangement, 'setTrackVolume');
    const setMute = vi.spyOn(editor._arrangement, 'setTrackMute');
    const setPan = vi.spyOn(editor._arrangement, 'setTrackPan');

    editor.updateTrack(id, { volume: 0.5, muted: true });
    // One call is one undo step (#843): both setters carry one gesture id.
    const gesture = { gesture: expect.any(String) };
    expect(setVolume).toHaveBeenCalledWith(id, 0.5, gesture);
    expect(setMute).toHaveBeenCalledWith(id, true, gesture);
    expect(setVolume.mock.calls[0][2]).toEqual(setMute.mock.calls[0][2]);
    expect(setPan).not.toHaveBeenCalled();
    expect(editor._arrangement.getMixer().get(id)).toMatchObject({ volume: 0.5, muted: true });
    // The mix is the arrangement's (#843): the editor holds no copy.
    expect(editor._extras.get(id)).not.toHaveProperty('volume');
    expect(editor._extras.get(id)).not.toHaveProperty('muted');
    editor.remove();
  });
});

describe('editor.addClip() / removeClip() / updateClip()', () => {
  it('addClip rejects when the track has no DOM element', async () => {
    const editor = setupEditor();
    await expect(editor.addClip('not-a-track', { src: '/a.opus' })).rejects.toThrow(
      /no <daw-track> element/
    );
    editor.remove();
  });

  it('addClip appends a <daw-clip> to the matching track', async () => {
    const editor = setupEditor();
    const t = await (async () => {
      editor.addTrack({ name: 'T' });
      await new Promise((r) => setTimeout(r, 60));
      return editor.querySelector('daw-track') as any;
    })();

    expect(t.querySelectorAll('daw-clip').length).toBe(0);
    editor.addClip(t.trackId, { src: '/a.opus', start: 5 });
    // appendChild is synchronous
    expect(t.querySelectorAll('daw-clip').length).toBe(1);
    const clipEl = t.querySelector('daw-clip') as any;
    expect(clipEl.src).toBe('/a.opus');
    expect(clipEl.start).toBe(5);
    editor.remove();
  });

  it('removeClip removes the matching <daw-clip> element', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T', clips: [{ src: '/a.opus', start: 0 }] });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const clipEl = trackEl.querySelector('daw-clip') as any;
    expect(trackEl.querySelectorAll('daw-clip').length).toBe(1);
    editor.removeClip(trackEl.trackId, clipEl.clipId);
    expect(trackEl.querySelectorAll('daw-clip').length).toBe(0);
    editor.remove();
  });

  it('updateClip writes properties on the <daw-clip>', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T', clips: [{ src: '/a.opus', start: 0, duration: 4 }] });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const clipEl = trackEl.querySelector('daw-clip') as any;
    editor.updateClip(trackEl.trackId, clipEl.clipId, {
      start: 2,
      gain: 0.5,
      name: 'Renamed',
    });
    expect(clipEl.start).toBe(2);
    expect(clipEl.gain).toBe(0.5);
    expect(clipEl.getAttribute('name')).toBe('Renamed');
    editor.remove();
  });

  it('updateClip applies directly to engine for non-DOM clips', async () => {
    const { editor, fake } = await setupLoadingEditor();
    // A file-dropped track's clip has no <daw-clip> element
    const { loaded } = await editor.loadFiles([makeAudioFile('take.wav')]);
    const trackId = loaded[0];
    const clipId = played(editor, trackId).clips[0].id;
    mockOf(fake, 'updateTrack').mockClear();
    editor.updateClip(trackId, clipId, { start: 1.5, gain: 0.25 });
    const updated = played(editor, trackId).clips[0];
    expect(updated.startSample).toBe(72000); // 1.5s * 48000
    expect(updated.gain).toBe(0.25);
    expect(fake.adapter.updateTrack).toHaveBeenCalled();
    editor.remove();
  });
});

// #659: element-less clips that carry an engine clip id on their descriptor
// (recorded takes) are listed by editor.tracks as the arrangement holds them
// (#848: read from it, no descriptor to keep in step).
describe('element-less clips addressed by id (#659)', () => {
  function seedRecordedTake(editor: ReturnType<typeof setupEditor>) {
    const trackId = 'rec-track';
    // editor.tracks lists the tracks of the arrangement (#848).
    const arrangementClip = (id: string, startSample: number) => ({
      ...createClip({
        startSample,
        durationSamples: 96000,
        offsetSamples: 0,
        sampleRate: 48000,
        sourceDurationSamples: 96000,
        name: 'Recording',
      }),
      id,
    });
    editor._arrangement.addTrack({
      ...createTrack({ name: 'T', clips: [] }),
      id: trackId,
      clips: [arrangementClip('take-1', 0), arrangementClip('take-2', 96000)],
    });
    return trackId;
  }

  it('updateClip by engine id updates the descriptor editor.tracks returns', () => {
    const editor = setupEditor();
    const trackId = seedRecordedTake(editor);

    editor.updateClip(trackId, 'take-1', { gain: 2, name: 'Lead', start: 0.5 });

    const clips = editor.tracks.find((t: { trackId: string }) => t.trackId === trackId).clips;
    expect(clips[0]).toMatchObject({ clipId: 'take-1', gain: 2, name: 'Lead', start: 0.5 });
    expect(clips[1]).toMatchObject({ clipId: 'take-2', gain: 1, name: 'Recording', start: 2 });
    editor.remove();
  });

  it('removeClip by engine id drops the descriptor too', async () => {
    const { editor } = await setupLoadingEditor();
    // seedRecordedTake puts the take's track in the arrangement too (#848).
    const trackId = seedRecordedTake(editor);

    editor.removeClip(trackId, 'take-1');

    const clips = editor.tracks.find((t: { trackId: string }) => t.trackId === trackId).clips;
    expect(clips.map((c: { clipId?: string }) => c.clipId)).toEqual(['take-2']);
    expect(played(editor, trackId).clips.map((c: { id: string }) => c.id)).toEqual(['take-2']);
    editor.remove();
  });
  it('a take the arrangement dropped (undo, covering punch-in) is not listed', () => {
    const editor = setupEditor();
    const trackId = seedRecordedTake(editor);

    editor._arrangement.updateTrack(trackId, (t: { clips: { id: string }[] }) => ({
      ...t,
      clips: t.clips.filter((c: { id: string }) => c.id !== 'take-1'),
    }));

    const clips = editor.tracks.find((t: { trackId: string }) => t.trackId === trackId).clips;
    expect(clips.map((c: { clipId?: string }) => c.clipId)).toEqual(['take-2']);
    editor.remove();
  });

  it('a split take is listed as its left half (the same id) and a new right half', () => {
    const editor = setupEditor();
    const trackId = seedRecordedTake(editor);

    editor._arrangement.splitClip(trackId, 'take-1', 48000);

    const clips = editor.tracks.find((t: { trackId: string }) => t.trackId === trackId).clips;
    expect(clips).toHaveLength(3);
    expect(clips[0]).toMatchObject({ clipId: 'take-1', start: 0, duration: 1 });
    expect(clips[1]).toMatchObject({ start: 1, duration: 1 });
    expect(clips[2]).toMatchObject({ clipId: 'take-2' });
    editor.remove();
  });

  it('a take moved or trimmed in the arrangement is listed where it is', () => {
    const editor = setupEditor();
    const trackId = seedRecordedTake(editor);

    // take-1 ends where take-2 starts: move take-2, which has room after it.
    editor._arrangement.moveClip(trackId, 'take-2', 24000);

    const clips = editor.tracks.find((t: { trackId: string }) => t.trackId === trackId).clips;
    expect(clips[1]).toMatchObject({ clipId: 'take-2', start: 2.5, duration: 2 });
    editor.remove();
  });
});

describe('Phase 1 regression fixes', () => {
  it('addClip rejects synchronously when config.src is missing', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    await expect(editor.addClip(trackEl.trackId, {})).rejects.toThrow(/src is required/);
    await expect(editor.addClip(trackEl.trackId, { src: '' })).rejects.toThrow(/src is required/);
    editor.remove();
  });

  it('addClip rejects when daw-clip-error fires (decode failure)', async () => {
    const { editor, fake } = await setupLoadingEditor();
    const trackId = await editor.addTrack({ name: 'T' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fake.setDecoded('/missing.opus', new Error('decode failed'));
    await expect(editor.addClip(trackId, { src: '/missing.opus' })).rejects.toThrow(
      'decode failed'
    );
    warnSpy.mockRestore();
    editor.remove();
  });

  it('reextractClipPeaks returns full PeakData (including bits)', () => {
    const editor = setupEditor();
    const fakeBuf = { length: 96000, sampleRate: 48000 } as unknown as AudioBuffer;
    editor._clipBuffers = new Map([['c1', fakeBuf]]);
    editor._peakPipeline.reextractPeaks = vi
      .fn()
      .mockReturnValue(new Map([['c1', { data: [new Int16Array(0)], length: 0, bits: 16 }]]));
    const result = editor.reextractClipPeaks('c1', 0, 96000);
    expect(result).toEqual({ data: [expect.any(Int16Array)], length: 0, bits: 16 });
    expect(result.bits).toBe(16);
    editor.remove();
  });

  it('_applyClipUpdate writes complete PeakData (with bits) into _peaksData', () => {
    const editor = setupEditor();
    const fakeBuf = { length: 96000, sampleRate: 48000 } as unknown as AudioBuffer;
    const clipId = 'c1';
    const trackId = 't1';
    editor._clipBuffers = new Map([[clipId, fakeBuf]]);
    editor._arrangement.addTrack({
      ...createTrack({ name: 'T', clips: [] }),
      id: trackId,
      clips: [
        {
          ...createClip({
            startSample: 0,
            durationSamples: 96000,
            offsetSamples: 0,
            sampleRate: 48000,
            sourceDurationSamples: 96000,
            name: 'X',
          }),
          id: clipId,
        },
      ],
    });
    editor._peakPipeline.reextractPeaks = vi
      .fn()
      .mockReturnValue(new Map([[clipId, { data: [new Int16Array(0)], length: 0, bits: 16 }]]));

    // Synthesize a daw-clip element with new offset/duration
    const clipEl = {
      start: 0,
      duration: 1, // changed from 2 → triggers boundsChanged path
      offset: 0,
      gain: 1,
      name: '',
      tagName: 'DAW-CLIP',
    } as any;
    editor._applyClipUpdate(trackId, clipId, clipEl);
    const stored = editor._peaksData.get(clipId);
    expect(stored.bits).toBe(16);
    expect(stored.data).toBeDefined();
    editor.remove();
  });
});

describe('Phase 3 refactor: _resolvePeaks + .dat preview', () => {
  function makeWaveformData(sampleRate: number, scale = 256, durationSec = 2) {
    return {
      sample_rate: sampleRate,
      scale,
      duration: durationSec,
      length: 0,
      bits: 16,
    } as any;
  }

  it('a .dat preview warns + falls back when peaks sample-rate mismatches AudioContext', async () => {
    const { editor, pipeline } = await setupLoadingEditor(); // adapter sampleRate is 48000
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // .dat at 44100 — mismatch
    editor._fetchPeaks = vi.fn().mockResolvedValue(makeWaveformData(44100));
    await editor.addTrack({
      name: 'T',
      clips: [{ src: '/a.opus', peaksSrc: '/a.dat' }],
    });
    await settle(editor);
    expect(editor._fetchPeaks).toHaveBeenCalledWith('/a.dat');
    const mismatchWarns = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((m) => m.includes('Pre-computed peaks'));
    expect(mismatchWarns.length).toBeGreaterThanOrEqual(1);
    // Fell back to peaks from the audio — no preview drawn, cacheWaveformData NOT called
    expect(editor._previewPeaks.size).toBe(0);
    expect(pipeline.cacheWaveformData).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    editor.remove();
  });

  it('a .dat preview warns + falls back when peaks fetch fails', async () => {
    const { editor, pipeline } = await setupLoadingEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor._fetchPeaks = vi.fn().mockRejectedValue(new Error('404 not found'));
    await editor.addTrack({
      name: 'T',
      clips: [{ src: '/a.opus', peaksSrc: '/missing.dat' }],
    });
    await settle(editor);
    const fetchWarns = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((m) => m.includes('Failed to load peaks'));
    expect(fetchWarns.length).toBeGreaterThanOrEqual(1);
    expect(editor._previewPeaks.size).toBe(0);
    expect(pipeline.cacheWaveformData).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    editor.remove();
  });

  it('a loaded clip raises _minSamplesPerPixel only after generatePeaks succeeds', async () => {
    // No .dat here: a .dat preview raises the floor to its own scale as soon as
    // it is drawn (#848), before any peaks are generated from the audio.
    const { editor, pipeline } = await setupLoadingEditor();
    pipeline.getCachedScale.mockReturnValue(512);
    let releasePeaks!: (peaks: unknown) => void;
    pipeline.generatePeaks.mockImplementation(
      () =>
        new Promise((resolve) => {
          releasePeaks = resolve;
        })
    );
    const trackId = await editor.addTrack({ name: 'T' });
    const beforeFloor = editor._minSamplesPerPixel;
    await editor.addClip(trackId, { src: '/a.opus' });
    // The audio has loaded; its peaks are still being generated
    expect(editor._minSamplesPerPixel).toBe(beforeFloor);
    releasePeaks(makePeakData());
    // After the peaks were generated, _minSamplesPerPixel was raised to their scale (512)
    await vi.waitFor(() => expect(editor._minSamplesPerPixel).toBe(Math.max(beforeFloor, 512)));
    editor.remove();
  });

  it('a loaded clip does NOT raise _minSamplesPerPixel when generatePeaks fails', async () => {
    const { editor, pipeline } = await setupLoadingEditor();
    pipeline.getCachedScale.mockReturnValue(512);
    const trackId = await editor.addTrack({ name: 'T' });
    const beforeFloor = editor._minSamplesPerPixel;

    // Fail generatePeaks specifically
    pipeline.generatePeaks.mockRejectedValue(new Error('worker crash'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await editor.addClip(trackId, { src: '/a.opus' });
    await vi.waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('worker crash'))
    );
    // Floor is unchanged — no peaks survived, no zoom-floor stranded
    expect(editor._minSamplesPerPixel).toBe(beforeFloor);
    warnSpy.mockRestore();
    editor.remove();
  });
});

describe('Phase 3 refactor: per-clip load isolation', () => {
  it('one bad clip does not abort the whole track — successful clips load, bad clip dispatches daw-clip-error', async () => {
    const { editor, fake } = await setupLoadingEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Fail only one src so others succeed
    fake.setDecoded('/bad.opus', new Error('decode failed'));
    const clipErrors: CustomEvent[] = [];
    editor.addEventListener('daw-clip-error', (e: CustomEvent) => clipErrors.push(e));

    const trackId = await editor.addTrack({
      name: 'Mixed',
      clips: [{ src: '/good1.opus' }, { src: '/bad.opus' }, { src: '/good2.opus' }],
    });
    await settle(editor);

    // Track loaded with 2 successful clips
    const engineTrack = played(editor, trackId);
    expect(engineTrack.clips.length).toBe(2);
    // Per-clip error dispatched for the failed one
    expect(clipErrors).toHaveLength(1);
    expect(String(clipErrors[0].detail.error)).toContain('decode failed');
    warnSpy.mockRestore();
    editor.remove();
  });
});

describe('Phase 2: end-to-end engine state assertions', () => {
  it('addClip resolves with clipId and engine track gains the clip', async () => {
    const { editor } = await setupLoadingEditor();
    const trackId = await editor.addTrack({ name: 'T' });

    const clipsBefore = played(editor, trackId)?.clips.length ?? 0;
    const clipId = await editor.addClip(trackId, { src: '/a.opus', start: 4 });

    expect(typeof clipId).toBe('string');
    expect(played(editor, trackId).clips.length).toBe(clipsBefore + 1);
    const newClip = played(editor, trackId).clips.find((c: any) => c.id === clipId);
    expect(newClip).toBeDefined();
    // `start: 4` × 48000 = 192000 samples
    expect(newClip.startSample).toBe(192000);
    expect(editor._clipBuffers.has(clipId)).toBe(true);
    await vi.waitFor(() => expect(editor._peaksData.has(clipId)).toBe(true));
    editor.remove();
  });

  it('addClip dispatches daw-clip-ready and the engine receives the updated track', async () => {
    const { editor, fake } = await setupLoadingEditor();
    const trackId = await editor.addTrack({ name: 'T' });

    const readyEvents: CustomEvent[] = [];
    editor.addEventListener('daw-clip-ready', (e: CustomEvent) => readyEvents.push(e));

    // The engine hands the updated track on to the adapter.
    const updateTrackBefore = mockOf(fake, 'updateTrack').mock.calls.length;
    await editor.addClip(trackId, { src: '/a.opus' });

    expect(readyEvents).toHaveLength(1);
    expect(readyEvents[0].detail.trackId).toBe(trackId);
    expect(mockOf(fake, 'updateTrack').mock.calls.length).toBeGreaterThan(updateTrackBefore);
    editor.remove();
  });

  it('late-append <daw-clip> via direct appendChild loads the clip into the engine', async () => {
    const { editor } = await setupLoadingEditor();
    const trackId = await editor.addTrack({ name: 'T' });
    const trackEl = trackElement(editor, trackId);
    const clipsBefore = played(editor, trackId).clips.length;

    // Directly construct + append, no editor.addClip API
    const clipEl = document.createElement('daw-clip') as any;
    clipEl.setAttribute('src', '/late.opus');
    clipEl.setAttribute('start', '5');
    trackEl.appendChild(clipEl);

    // Wait for daw-clip-connected (deferred via setTimeout(0)) and the clip's audio
    await vi.waitFor(() => expect(played(editor, trackId).clips.length).toBe(clipsBefore + 1));
    const added = played(editor, trackId).clips.find((c: any) => c.id === clipEl.clipId);
    expect(added).toBeDefined();
    editor.remove();
  });

  it('removeClip cleans up engine state, _clipBuffers, _clipOffsets, _peaksData', async () => {
    const { editor, fake } = await setupLoadingEditor();
    const trackId = await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await settle(editor);
    const clipId = trackElement(editor, trackId).querySelector('daw-clip').clipId;

    // Sanity — clip exists in engine and caches
    expect(played(editor, trackId).clips.length).toBe(1);
    expect(editor._clipBuffers.has(clipId)).toBe(true);
    await vi.waitFor(() => expect(editor._peaksData.has(clipId)).toBe(true));

    mockOf(fake, 'updateTrack').mockClear();
    editor.removeClip(trackId, clipId);
    // MutationObserver cleanup is async — retry instead of one macrotask.
    await vi.waitFor(() => {
      expect(played(editor, trackId).clips.length).toBe(0);
      expect(editor._clipBuffers.has(clipId)).toBe(false);
      expect(editor._clipOffsets.has(clipId)).toBe(false);
      expect(editor._peaksData.has(clipId)).toBe(false);
    });
    // The engine hands the updated track on to the adapter.
    expect(fake.adapter.updateTrack).toHaveBeenCalledWith(trackId, expect.any(Object));
    editor.remove();
  });

  it('removing a track with clips cascades cleanup to engine state', async () => {
    const { editor } = await setupLoadingEditor();
    // Stub _stopPlayhead — happy-dom playhead controller isn't fully realized
    // and throws when the engine empties at the end of MutationObserver work.
    editor._stopPlayhead = vi.fn();
    const trackId = await editor.addTrack({
      name: 'T',
      clips: [{ src: '/a.opus' }, { src: '/b.opus' }],
    });
    await settle(editor);
    const clipIds = [...trackElement(editor, trackId).querySelectorAll('daw-clip')].map(
      (c: any) => c.clipId
    );
    expect(clipIds.length).toBe(2);
    expect(played(editor, trackId).clips.length).toBe(2);

    editor.removeTrack(trackId);
    // MutationObserver cleanup is async — retry instead of one macrotask.
    await vi.waitFor(() => {
      for (const id of clipIds) {
        expect(editor._clipBuffers.has(id)).toBe(false);
        expect(editor._peaksData.has(id)).toBe(false);
      }
      expect(played(editor, trackId) !== undefined).toBe(false);
    });
    editor.remove();
  });

  it('updateClip DOM-path triggers _applyClipUpdate which mutates engine startSample', async () => {
    const { editor } = await setupLoadingEditor();
    const trackId = await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus', start: 0 }] });
    await settle(editor);
    const clipEl = trackElement(editor, trackId).querySelector('daw-clip') as any;

    editor.updateClip(trackId, clipEl.clipId, { start: 3 });
    await clipEl.updateComplete; // Lit fires daw-clip-update post-render

    const engineClip = played(editor, trackId).clips.find((c: any) => c.id === clipEl.clipId);
    // start: 3 × 48000 = 144000
    expect(engineClip.startSample).toBe(144000);
    editor.remove();
  });

  it('updateClip with changed bounds invokes reextractPeaks', async () => {
    const { editor, fake, pipeline } = await setupLoadingEditor();
    fake.setDecoded('/a.opus', makeDecodedBuffer(8)); // longer than the clip
    const trackId = await editor.addTrack({
      name: 'T',
      clips: [{ src: '/a.opus', start: 0, duration: 4 }],
    });
    await settle(editor);
    const clipEl = trackElement(editor, trackId).querySelector('daw-clip') as any;

    const reextractCalls = pipeline.reextractPeaks.mock.calls.length;
    editor.updateClip(trackId, clipEl.clipId, { duration: 2 });
    await clipEl.updateComplete;

    expect(pipeline.reextractPeaks.mock.calls.length).toBeGreaterThan(reextractCalls);
    editor.remove();
  });
});

describe("Phase 2: in-flight track load doesn't false-warn for pre-captured clips", () => {
  it('addTrack({clips:[..]}) does not warn when deferred daw-clip-connected fires for pre-read clips', async () => {
    const { editor } = await setupLoadingEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await editor.addTrack({
      name: 'T',
      clips: [
        { src: '/a.opus', start: 0 },
        { src: '/b.opus', start: 4 },
      ],
    });
    await settle(editor);
    // None of the warns should mention "still loading" — those clips were
    // captured by _readTrackDescriptor and the deferred events are redundant.
    const loadingWarns = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((msg) => msg.includes('still loading'));
    expect(loadingWarns).toEqual([]);
    warnSpy.mockRestore();
    editor.remove();
  });
});

describe('Phase 2: silent no-op warns', () => {
  it('removeTrack warns when trackId is unknown', () => {
    const editor = setupEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.removeTrack('not-a-track');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no track found'));
    warnSpy.mockRestore();
    editor.remove();
  });

  it('removeClip warns when track is unknown', () => {
    const editor = setupEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.removeClip('not-a-track', 'not-a-clip');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no track found'));
    warnSpy.mockRestore();
    editor.remove();
  });

  it('updateClip warns when DOM-track present but clip not found in engine state', () => {
    // Skip the DOM short-circuit by setting up a track without the clip,
    // then calling updateClip with a non-existent clipId.
    const editor = setupEditor();
    const trackId = 'engine-only';
    editor._arrangement.addTrack({ ...createTrack({ name: 'T', clips: [] }), id: trackId });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.updateClip(trackId, 'missing-clip', { start: 1 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    warnSpy.mockRestore();
    editor.remove();
  });
});

describe('engine clip-id alignment', () => {
  it('engine clip ids match <daw-clip>.clipId after loading', async () => {
    const { editor } = await setupLoadingEditor();
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }, { src: '/b.opus' }] });
    await settle(editor);

    const domClipIds = [...editor.querySelectorAll('daw-clip')].map((c: any) => c.clipId);
    const engineTracks = editor._loadedTracks() as any[];
    const engineClipIds = engineTracks[0].clips.map((c: any) => c.id);

    expect(domClipIds.length).toBe(2);
    expect(engineClipIds).toEqual(domClipIds);
    editor.remove();
  });
});

describe('load races (audit wave 2)', () => {
  it('a load that completes after the editor was detached is not committed to the disposed adapter', async () => {
    const { editor, fake } = await setupLoadingEditor();
    const held = fake.holdDecode('/a.opus');
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });

    editor.remove(); // detach — disconnectedCallback disposed the engine
    expect(fake.adapter.dispose).toHaveBeenCalled();
    for (const method of ['setTracks', 'addTrack', 'updateTrack']) mockOf(fake, method).mockClear();
    held.resolve(); // decode SUCCEEDS on the detached editor
    await tick(3);

    // Committing would rebuild tracks in an adapter graph that nothing will
    // ever play or dispose again.
    expect(fake.adapter.setTracks).not.toHaveBeenCalled();
    expect(fake.adapter.addTrack).not.toHaveBeenCalled();
    expect(fake.adapter.updateTrack).not.toHaveBeenCalled();
  });

  it('a clip connect event arriving before its parent registers a descriptor is silently skipped', () => {
    const editor = setupEditor();
    // The clip's deferred connect can fire before the parent track's own
    // deferred connect registers the descriptor — this must NOT dispatch a
    // daw-clip-error (the descriptor read will capture the clip right after).
    const trackEl = document.createElement('daw-track') as any;
    const clipEl = document.createElement('daw-clip') as any;
    trackEl.appendChild(clipEl);
    trackEl.trackId = 'not-yet-registered';

    const errorEvents: CustomEvent[] = [];
    editor.addEventListener('daw-clip-error', (e: Event) => errorEvents.push(e as CustomEvent));

    editor._onClipConnected({ detail: { clipId: clipEl.clipId, element: clipEl } } as CustomEvent);

    expect(errorEvents.length).toBe(0);
    editor.remove();
  });
});

describe('removeTrack timeline sync (audit wave 2)', () => {
  it('removing the last track rewinds the engine to 0, matching the UI', async () => {
    const { editor } = await setupLoadingEditor();
    const trackId = await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await settle(editor);
    editor._currentTime = 30; // prior seek — engine holds 30 too
    const seek = vi.spyOn(editor.engine, 'seek');

    editor.removeTrack(trackId);
    await vi.waitFor(() => expect(editor._extras.has(trackId)).toBe(false));

    // Without engine.seek(0), the display shows 0 but the next play()
    // resumes from the engine's stale position (engine.removeTrack never
    // touches time).
    expect(seek).toHaveBeenCalledWith(0);
    expect(editor.currentTime).toBe(0);
    editor.remove();
  });

  it('removing the last track during playback stops the engine (isPlaying not stranded)', async () => {
    const { editor } = await setupLoadingEditor();
    const trackId = await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await settle(editor);
    // Rolling for real: the engine's statechange is what sets _isPlaying.
    editor.engine.play(0);
    expect(editor._isPlaying).toBe(true);
    const stop = vi.spyOn(editor.engine, 'stop');

    const events: string[] = [];
    editor.addEventListener('daw-stop', (e: Event) => events.push(e.type));

    editor.removeTrack(trackId);
    await vi.waitFor(() => expect(editor._extras.has(trackId)).toBe(false));

    // An empty timeline has nothing to play — leaving the transport rolling
    // strands isPlaying=true with a dead playhead RAF. Transport UIs key on
    // daw-play/daw-stop, so this stop must be announced like every other
    // stop path (editor.stop() is otherwise the only daw-stop dispatcher).
    expect(stop).toHaveBeenCalled();
    expect(events).toContain('daw-stop');
    editor.remove();
  });

  it('removal of a never-registered track does not rewind the cursor', async () => {
    const editor = setupEditor();
    editor._currentTime = 30; // user's cursor position on an empty timeline

    // MutationObserver fires _onTrackRemoved even for a <daw-track> removed
    // before its deferred daw-track-connected ran (framework churn) — the
    // `existed` gate must cover the rewind/stop block too.
    editor._onTrackRemoved('never-registered');

    expect(editor._engine.seek).not.toHaveBeenCalled();
    expect(editor._currentTime).toBe(30);
    editor.remove();
  });
});

describe('seekTo semantics (audit wave 4)', () => {
  it('seekTo while playing dispatches daw-seek — not daw-stop/daw-play — and updates currentTime synchronously', () => {
    const editor = setupEditor();
    editor._isPlaying = true;
    const events: string[] = [];
    for (const t of ['daw-seek', 'daw-stop', 'daw-play']) {
      editor.addEventListener(t, ((e: Event) => {
        events.push(e.type);
      }) as EventListener);
    }

    editor.seekTo(45);

    // Consumers keyed on daw-stop (state persistence, transport UI) must not
    // misfire on every programmatic seek; the pointer-handler seek path
    // already has these semantics.
    expect(events).toEqual(['daw-seek']);
    expect(editor._engine.stop).toHaveBeenCalled();
    expect(editor._engine.play).toHaveBeenCalledWith(45);
    expect(editor._currentTime).toBe(45);
    editor.remove();
  });

  it('seekTo while stopped dispatches daw-seek', () => {
    const editor = setupEditor();
    const events: string[] = [];
    editor.addEventListener('daw-seek', ((e: Event) => {
      events.push(e.type);
    }) as EventListener);

    editor.seekTo(10);

    expect(editor._engine.seek).toHaveBeenCalledWith(10);
    expect(events).toEqual(['daw-seek']);
    editor.remove();
  });

  it('seekTo ignores non-finite and clamps negative times', () => {
    const editor = setupEditor();
    editor.seekTo(NaN);
    expect(editor._engine.seek).not.toHaveBeenCalled();

    editor.seekTo(-5);
    expect(editor._engine.seek).toHaveBeenCalledWith(0);
    expect(editor._currentTime).toBe(0);
    editor.remove();
  });
});

describe('seekTo error surfacing (audit wave 4)', () => {
  it('an engine reschedule failure dispatches daw-error instead of throwing', () => {
    const editor = setupEditor();
    editor._isPlaying = true;
    editor._engine.play = vi.fn(() => {
      throw new Error('adapter wedged');
    });
    const events: CustomEvent[] = [];
    for (const t of ['daw-error', 'daw-seek']) {
      editor.addEventListener(t, ((e: Event) => {
        events.push(e as CustomEvent);
      }) as EventListener);
    }

    expect(() => editor.seekTo(45)).not.toThrow();

    expect(events.map((e) => e.type)).toEqual(['daw-error']);
    expect(events[0].detail.operation).toBe('seek');
    editor.remove();
  });
});

describe('zoom floor (audit wave 5)', () => {
  it('worker-generated peaks raise the zoom floor to the cached base scale', async () => {
    const { editor, pipeline } = await setupLoadingEditor();
    pipeline.getCachedScale.mockReturnValue(128);
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await settle(editor);

    // Worker peaks can only be extracted at >= their cached scale (128) —
    // a finer zoom draws the waveform at a fraction of its clip container.
    editor.samplesPerPixel = 32;
    expect(editor.samplesPerPixel).toBe(128);
    editor.remove();
  });

  it('a floor raised above the current samplesPerPixel re-clamps the live zoom', async () => {
    const { editor, pipeline } = await setupLoadingEditor();
    editor.samplesPerPixel = 64;
    pipeline.getCachedScale.mockReturnValue(256);

    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await settle(editor);

    // The setter only clamps FUTURE sets — without re-clamping, layout keeps
    // spp 64 while peaks clamp to 256: waveform at a quarter width,
    // misaligned against ruler and playhead.
    expect(editor.samplesPerPixel).toBe(256);
    editor.remove();
  });
});

describe('recording preview position parity (audit wave 5)', () => {
  it('beats mode positions the preview with the same tick math as finalized clips', async () => {
    const editor = setupEditor();
    editor.scaleMode = 'beats';
    editor.ticksPerPixel = 10;
    editor.bpm = 127;
    editor.ppqn = 960;
    await editor.updateComplete;

    // bpm 127 / tpp 10 / ppqn 960 / sr 48000: exact spp = 236.22, ceil'd
    // renderSpp = 237. sample-path left = floor(2646000/237) = 11164 px;
    // tick-path left = round(secondsToTicks(55.125)/10) = 11201 px — the
    // preview take would jump ~37px sideways the moment recording stops.
    const { left } = editor._previewPosition(2646000, 480000);
    const startTick = editor._secondsToTicks(2646000 / 48000);
    expect(left).toBe(Math.round(startTick / 10));
    expect(left).not.toBe(Math.floor(2646000 / editor._renderSpp));
    editor.remove();
  });

  it('temporal mode keeps the sample-based preview position', async () => {
    const editor = setupEditor();
    const { left, width } = editor._previewPosition(48000, 96000);
    expect(left).toBe(Math.floor(48000 / editor._renderSpp));
    expect(width).toBe(Math.floor(96000 / editor._renderSpp));
    editor.remove();
  });
});

describe('zoom floor recompute (audit wave 5 review)', () => {
  it('a floor recompute on track removal re-clamps the live zoom', async () => {
    const { editor, pipeline } = await setupLoadingEditor();
    editor.samplesPerPixel = 64;
    pipeline.getMaxCachedScale.mockReturnValue(128);
    const trackId = await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await settle(editor);

    editor.removeTrack(trackId);
    await vi.waitFor(() => expect(editor._extras.has(trackId)).toBe(false));

    // The recompute raised the floor above the live spp — without a
    // re-clamp, layout stays at 64 while peaks clamp to 128: the exact
    // half-width mismatch _raiseZoomFloor makes unrepresentable, reachable
    // through the one floor-mutation path that bypassed it.
    expect(editor.samplesPerPixel).toBe(128);
    editor.remove();
  });
});

describe('audit wave 6 — lifecycle & rendering state', () => {
  it('lists a track restored by undo with its name and mix', async () => {
    const { editor } = await setupLoadingEditor();
    const id = await editor.addTrack({ name: 'Guitar', volume: 0.7, pan: -0.2 });
    trackElement(editor, id).remove();
    await vi.waitFor(() => expect(editor._extras.has(id)).toBe(false));

    editor.engine.undo(); // the removal: the track comes back without an element

    // editor.tracks reads the arrangement (#848): the restored track is
    // listed with its name and mix, with nothing written for it.
    const t = editor.tracks.find((x: any) => x.trackId === id);
    expect(t?.name).toBe('Guitar');
    expect(t?.volume).toBe(0.7);
    editor.remove();
  });

  it('a track removed again by redo is no longer listed, and removeTrack does not find it', async () => {
    const { editor } = await setupLoadingEditor();
    const id = await editor.addTrack({ name: 'Guitar' });
    trackElement(editor, id).remove();
    await vi.waitFor(() => expect(editor._extras.has(id)).toBe(false));
    editor.engine.undo();
    expect(editor.tracks.map((t: { trackId: string }) => t.trackId)).toEqual([id]);
    editor.engine.redo();
    expect(editor.tracks).toHaveLength(0);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.removeTrack(id);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no track found'));
    warnSpy.mockRestore();
    editor.remove();
  });

  it('lets go of an adapter its own teardown disposed', async () => {
    const { editor } = await setupLoadingEditor();
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await settle(editor);

    const other = document.createElement('div');
    document.body.appendChild(other);
    other.appendChild(editor); // teardown disposed the consumer's adapter

    // NativePlayoutAdapter.dispose() leaves the AudioContext open, so building
    // on it again would wire tracks into a dead transport graph: waveforms,
    // no audio. The editor lets go of it (#848) and asks for a fresh one:
    // a track added meanwhile waits for it.
    expect(editor.adapter).toBeNull();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let entered: string | null = null;
    const pending = editor
      .addTrack({ name: 'U', clips: [{ src: '/b.opus' }] })
      .then((id: string) => (entered = id));
    await tick(2);
    expect(entered).toBeNull();

    // Setting a fresh adapter restores service
    stubPeakPipeline(editor);
    editor.adapter = makeFakeAdapter().adapter;
    await pending;
    expect(editor._arrangement.getTracks().map((t: { id: string }) => t.id)).toContain(entered);
    warnSpy.mockRestore();
    other.remove();
  });

  it('toggling mono re-extracts peaks immediately', async () => {
    const editor = setupEditor();
    await editor.updateComplete; // consume the initial render cycle
    editor._clipBuffers.set('c1', {} as AudioBuffer);
    editor._peakPipeline.reextractPeaks = vi.fn().mockReturnValue(new Map());

    editor.mono = true;
    await editor.updateComplete;

    // mono changes the derived peak data (per-channel vs merged) — waiting
    // for the next zoom change leaves stale channel layout, then snaps
    // mid-session with no related user action.
    expect(editor._peakPipeline.reextractPeaks).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true,
      expect.anything()
    );
    editor.remove();
  });

  it('clears the spectrogram viewport cache when the controller is disposed', () => {
    const editor = setupEditor();
    editor._spectrogramController = { dispose: vi.fn() };
    editor._lastSpectrogramViewport = { vs: 0, ve: 500, spp: 1024 };

    editor._disposeSpectrogramControllerIfEmpty(); // no spectrogram tracks → disposes

    // A recreated controller diffs against this cache — if it survives, the
    // fresh orchestrator never receives an initial setViewport and renders
    // black until a ≥100px scroll or a zoom change.
    expect(editor._lastSpectrogramViewport).toBeNull();
    editor.remove();
  });

  it('MIME-rejected files dispatch daw-files-load-error', async () => {
    const editor = setupEditor();
    const events: CustomEvent[] = [];
    editor.addEventListener('daw-files-load-error', ((e: Event) => {
      events.push(e as CustomEvent);
    }) as EventListener);

    const result = await editor.loadFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);

    expect(result.failed).toHaveLength(1);
    // Apps whose only error surface is the documented event otherwise see a
    // silently swallowed drop.
    expect(events).toHaveLength(1);
    expect(events[0].detail.file.name).toBe('notes.txt');
    editor.remove();
  });

  it('loadFiles rejects non-audio files without creating elements', async () => {
    const editor = setupEditor();
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const result = await editor.loadFiles([file]);
    expect(result.loaded).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(editor.querySelectorAll('daw-track').length).toBe(0);
    editor.remove();
  });
});
