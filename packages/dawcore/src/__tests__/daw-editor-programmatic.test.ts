import { describe, it, expect, vi, beforeAll } from 'vitest';

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

function setupEditor(): any {
  const editor = document.createElement('daw-editor') as any;
  // Mock adapter so audioContext getter works.
  editor.adapter = { audioContext: { state: 'running', sampleRate: 48000 } };
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
    const editor = setupEditor();

    const promise = editor.addTrack({ name: 'Test', volume: 0.7 });
    // Element is appended synchronously even though the promise resolves on daw-track-ready
    expect(editor.querySelectorAll('daw-track').length).toBe(1);

    // Simulate _loadTrack completion by dispatching daw-track-ready
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track');
    const t = await promise;
    expect(t).toBe(trackEl);
    expect(t.name).toBe('Test');
    expect(t.volume).toBe(0.7);
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

  it('rejects when all requested clips fail to load', async () => {
    const editor = setupEditor();
    // Per-clip failures dispatch daw-clip-error and skip; if every requested
    // clip fails, the track surfaces a track-level error so addTrack rejects.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor._fetchAndDecode = vi.fn().mockRejectedValue(new Error('decode failed'));
    const clipErrors: CustomEvent[] = [];
    editor.addEventListener('daw-clip-error', (e: CustomEvent) => clipErrors.push(e));
    const promise = editor.addTrack({
      name: 'Bad',
      clips: [{ src: '/missing.opus' }],
    });
    await expect(promise).rejects.toThrow(/all 1 clip\(s\) failed/);
    expect(clipErrors).toHaveLength(1);
    expect(String(clipErrors[0].detail.error)).toContain('decode failed');
    warnSpy.mockRestore();
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

  it('falls back to direct cleanup for tracks without a DOM element', () => {
    const editor = setupEditor();
    // Simulate file-dropped track: present in _engineTracks but no <daw-track>
    editor._engineTracks = new Map([['file-id', { id: 'file-id', clips: [], name: 'X' }]]);
    expect(editor._engineTracks.size).toBe(1);
    editor.removeTrack('file-id');
    expect(editor._engineTracks.size).toBe(0);
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
    const editor = setupEditor();
    editor.addTrack({ name: 'Original', volume: 1, pan: 0 });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    editor.updateTrack(trackEl.trackId, {
      name: 'Updated',
      volume: 0.3,
      muted: true,
    });
    expect(trackEl.getAttribute('name')).toBe('Updated');
    expect(trackEl.volume).toBe(0.3);
    expect(trackEl.hasAttribute('muted')).toBe(true);
    editor.remove();
  });

  it('applies directly to engine for non-DOM tracks (file drops)', () => {
    const editor = setupEditor();
    const desc = {
      name: 'File',
      src: '',
      volume: 1,
      pan: 0,
      muted: false,
      soloed: false,
      clips: [],
    };
    editor._tracks = new Map([['file-id', desc]]);
    editor._engineTracks = new Map([['file-id', { id: 'file-id', clips: [] }]]);

    editor.updateTrack('file-id', { volume: 0.5, muted: true });
    expect(editor._engine.setTrackVolume).toHaveBeenCalledWith('file-id', 0.5);
    expect(editor._engine.setTrackMute).toHaveBeenCalledWith('file-id', true);
    expect(editor._tracks.get('file-id').volume).toBe(0.5);
    expect(editor._tracks.get('file-id').muted).toBe(true);
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

  it('updateClip applies directly to engine for non-DOM clips', () => {
    const editor = setupEditor();
    const trackId = 'file-track';
    const clipId = 'file-clip';
    const clip = {
      id: clipId,
      startSample: 0,
      durationSamples: 96000,
      offsetSamples: 0,
      gain: 1,
      name: 'Original',
      sampleRate: 48000,
    };
    editor._engineTracks = new Map([[trackId, { id: trackId, clips: [clip], name: 'T' }]]);
    editor.updateClip(trackId, clipId, { start: 1.5, gain: 0.25 });
    const updated = editor._engineTracks.get(trackId).clips[0];
    expect(updated.startSample).toBe(72000); // 1.5s * 48000
    expect(updated.gain).toBe(0.25);
    expect(editor._engine.updateTrack).toHaveBeenCalled();
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
    const editor = setupEditor();
    editor.addTrack({ name: 'T' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor._fetchAndDecode = vi.fn().mockRejectedValue(new Error('decode failed'));
    await expect(editor.addClip(trackEl.trackId, { src: '/missing.opus' })).rejects.toThrow(
      'decode failed'
    );
    warnSpy.mockRestore();
    editor.remove();
  });

  it('_loadAndAppendClip rolls back per-clip caches when peak generation fails', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;

    // Fail peak generation specifically (audio decode succeeds)
    editor._peakPipeline.generatePeaks = vi.fn().mockRejectedValue(new Error('worker crash'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const buffersBefore = editor._clipBuffers.size;
    const offsetsBefore = editor._clipOffsets.size;
    const peaksBefore = editor._peaksData.size;

    await expect(editor.addClip(trackEl.trackId, { src: '/a.opus' })).rejects.toThrow(
      'worker crash'
    );

    expect(editor._clipBuffers.size).toBe(buffersBefore);
    expect(editor._clipOffsets.size).toBe(offsetsBefore);
    expect(editor._peaksData.size).toBe(peaksBefore);
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
    editor._engineTracks = new Map([
      [
        trackId,
        {
          id: trackId,
          clips: [
            {
              id: clipId,
              startSample: 0,
              durationSamples: 96000,
              offsetSamples: 0,
              gain: 1,
              name: 'X',
              sampleRate: 48000,
            },
          ],
        },
      ],
    ]);
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

describe('Phase 3 refactor: _resolvePeaks + peaks-first flow', () => {
  function makeWaveformData(sampleRate: number, scale = 256, durationSec = 2) {
    return {
      sample_rate: sampleRate,
      scale,
      duration: durationSec,
      length: 0,
      bits: 16,
    } as any;
  }

  it('peaks-first path uses pre-computed WaveformData when sample-rate matches', async () => {
    const editor = setupEditor();
    editor._fetchPeaks = vi.fn().mockResolvedValue(makeWaveformData(48000));
    // Stub extractPeaks via mocking — _peakPipeline.cacheWaveformData is also called
    editor._peakPipeline.cacheWaveformData = vi.fn();
    await editor.addTrack({
      name: 'T',
      clips: [{ src: '/a.opus', peaksSrc: '/a.dat' }],
    });
    expect(editor._fetchPeaks).toHaveBeenCalledWith('/a.dat');
    expect(editor._peakPipeline.cacheWaveformData).toHaveBeenCalled();
    editor.remove();
  });

  it('peaks-first path warns + falls back when peaks sample-rate mismatches AudioContext', async () => {
    const editor = setupEditor(); // adapter sampleRate is 48000
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // .dat at 44100 — mismatch
    editor._fetchPeaks = vi.fn().mockResolvedValue(makeWaveformData(44100));
    editor._peakPipeline.cacheWaveformData = vi.fn();
    await editor.addTrack({
      name: 'T',
      clips: [{ src: '/a.opus', peaksSrc: '/a.dat' }],
    });
    const mismatchWarns = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((m) => m.includes('Pre-computed peaks'));
    expect(mismatchWarns.length).toBeGreaterThanOrEqual(1);
    // Fell back to standard path — cacheWaveformData NOT called
    expect(editor._peakPipeline.cacheWaveformData).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    editor.remove();
  });

  it('peaks-first path warns + falls back when peaks fetch fails', async () => {
    const editor = setupEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor._fetchPeaks = vi.fn().mockRejectedValue(new Error('404 not found'));
    editor._peakPipeline.cacheWaveformData = vi.fn();
    await editor.addTrack({
      name: 'T',
      clips: [{ src: '/a.opus', peaksSrc: '/missing.dat' }],
    });
    const fetchWarns = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((m) => m.includes('Failed to load peaks'));
    expect(fetchWarns.length).toBeGreaterThanOrEqual(1);
    expect(editor._peakPipeline.cacheWaveformData).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    editor.remove();
  });

  it('_loadAndAppendClip raises _minSamplesPerPixel only after generatePeaks succeeds', async () => {
    const editor = setupEditor();
    editor._fetchPeaks = vi.fn().mockResolvedValue(makeWaveformData(48000, 512));
    editor._peakPipeline.cacheWaveformData = vi.fn();
    // generatePeaks succeeds first, then track loads, then we addClip with peaks
    await editor.addTrack({ name: 'T' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const beforeFloor = editor._minSamplesPerPixel;
    await editor.addClip(trackEl.trackId, { src: '/a.opus', peaksSrc: '/a.dat' });
    // After successful load, _minSamplesPerPixel was raised to peaks scale (512)
    expect(editor._minSamplesPerPixel).toBe(Math.max(beforeFloor, 512));
    editor.remove();
  });

  it('_loadAndAppendClip does NOT raise _minSamplesPerPixel when generatePeaks fails', async () => {
    const editor = setupEditor();
    editor._fetchPeaks = vi.fn().mockResolvedValue(makeWaveformData(48000, 512));
    editor._peakPipeline.cacheWaveformData = vi.fn();
    await editor.addTrack({ name: 'T' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const beforeFloor = editor._minSamplesPerPixel;

    // Fail generatePeaks specifically
    editor._peakPipeline.generatePeaks = vi.fn().mockRejectedValue(new Error('worker crash'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      editor.addClip(trackEl.trackId, { src: '/a.opus', peaksSrc: '/a.dat' })
    ).rejects.toThrow('worker crash');
    // Floor is unchanged — no peaks survived, no zoom-floor stranded
    expect(editor._minSamplesPerPixel).toBe(beforeFloor);
    warnSpy.mockRestore();
    editor.remove();
  });
});

describe('Phase 3 refactor: _loadTrack per-clip isolation', () => {
  it('one bad clip does not abort the whole track — successful clips load, bad clip dispatches daw-clip-error', async () => {
    const editor = setupEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Reject only one src so others succeed
    editor._fetchAndDecode = vi.fn().mockImplementation((src: string) => {
      if (src === '/bad.opus') return Promise.reject(new Error('decode failed'));
      return Promise.resolve({
        length: 96000,
        duration: 2,
        sampleRate: 48000,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(96000),
      } as unknown as AudioBuffer);
    });
    const clipErrors: CustomEvent[] = [];
    editor.addEventListener('daw-clip-error', (e: CustomEvent) => clipErrors.push(e));

    const t = await editor.addTrack({
      name: 'Mixed',
      clips: [{ src: '/good1.opus' }, { src: '/bad.opus' }, { src: '/good2.opus' }],
    });

    // Track loaded with 2 successful clips
    const engineTrack = editor._engineTracks.get(t.trackId);
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
    const editor = setupEditor();
    editor.addTrack({ name: 'T' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const trackId = trackEl.trackId;

    const clipsBefore = editor._engineTracks.get(trackId)?.clips.length ?? 0;
    const clipId = await editor.addClip(trackId, { src: '/a.opus', start: 4 });

    expect(typeof clipId).toBe('string');
    expect(editor._engineTracks.get(trackId).clips.length).toBe(clipsBefore + 1);
    const newClip = editor._engineTracks.get(trackId).clips.find((c: any) => c.id === clipId);
    expect(newClip).toBeDefined();
    // `start: 4` × 48000 = 192000 samples
    expect(newClip.startSample).toBe(192000);
    expect(editor._clipBuffers.has(clipId)).toBe(true);
    expect(editor._peaksData.has(clipId)).toBe(true);
    editor.remove();
  });

  it('addClip dispatches daw-clip-ready and the engine receives the updated track', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;

    const readyEvents: CustomEvent[] = [];
    editor.addEventListener('daw-clip-ready', (e: CustomEvent) => readyEvents.push(e));

    const updateTrackBefore = editor._engine.updateTrack.mock.calls.length;
    await editor.addClip(trackEl.trackId, { src: '/a.opus' });

    expect(readyEvents).toHaveLength(1);
    expect(readyEvents[0].detail.trackId).toBe(trackEl.trackId);
    expect(editor._engine.updateTrack.mock.calls.length).toBeGreaterThan(updateTrackBefore);
    editor.remove();
  });

  it('late-append <daw-clip> via direct appendChild triggers _loadAndAppendClip', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T' });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const trackId = trackEl.trackId;
    const clipsBefore = editor._engineTracks.get(trackId).clips.length;

    // Directly construct + append, no editor.addClip API
    const clipEl = document.createElement('daw-clip') as any;
    clipEl.setAttribute('src', '/late.opus');
    clipEl.setAttribute('start', '5');
    trackEl.appendChild(clipEl);

    // Wait for daw-clip-connected (deferred via setTimeout(0)) → _loadAndAppendClip
    await new Promise((r) => setTimeout(r, 60));
    expect(editor._engineTracks.get(trackId).clips.length).toBe(clipsBefore + 1);
    const added = editor._engineTracks.get(trackId).clips.find((c: any) => c.id === clipEl.clipId);
    expect(added).toBeDefined();
    editor.remove();
  });

  it('removeClip cleans up engine state, _clipBuffers, _clipOffsets, _peaksData', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const clipEl = trackEl.querySelector('daw-clip') as any;
    const clipId = clipEl.clipId;
    const trackId = trackEl.trackId;

    // Sanity — clip exists in engine and caches
    expect(editor._engineTracks.get(trackId).clips.length).toBe(1);
    expect(editor._clipBuffers.has(clipId)).toBe(true);
    expect(editor._peaksData.has(clipId)).toBe(true);

    editor.removeClip(trackId, clipId);
    // MutationObserver fires asynchronously
    await new Promise((r) => setTimeout(r, 0));

    expect(editor._engineTracks.get(trackId).clips.length).toBe(0);
    expect(editor._clipBuffers.has(clipId)).toBe(false);
    expect(editor._clipOffsets.has(clipId)).toBe(false);
    expect(editor._peaksData.has(clipId)).toBe(false);
    expect(editor._engine.updateTrack).toHaveBeenCalledWith(trackId, expect.any(Object));
    editor.remove();
  });

  it('removing a track with clips cascades cleanup to engine state', async () => {
    const editor = setupEditor();
    // Stub _stopPlayhead — happy-dom playhead controller isn't fully realized
    // and throws when the engine empties at the end of MutationObserver work.
    editor._stopPlayhead = vi.fn();
    editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }, { src: '/b.opus' }] });
    await new Promise((r) => setTimeout(r, 80));
    const trackEl = editor.querySelector('daw-track') as any;
    const clipIds = [...trackEl.querySelectorAll('daw-clip')].map((c: any) => c.clipId);
    expect(clipIds.length).toBe(2);

    editor.removeTrack(trackEl.trackId);
    await new Promise((r) => setTimeout(r, 0));

    for (const id of clipIds) {
      expect(editor._clipBuffers.has(id)).toBe(false);
      expect(editor._peaksData.has(id)).toBe(false);
    }
    expect(editor._engineTracks.has(trackEl.trackId)).toBe(false);
    editor.remove();
  });

  it('updateClip DOM-path triggers _applyClipUpdate which mutates engine startSample', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T', clips: [{ src: '/a.opus', start: 0 }] });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const clipEl = trackEl.querySelector('daw-clip') as any;

    editor.updateClip(trackEl.trackId, clipEl.clipId, { start: 3 });
    await clipEl.updateComplete; // Lit fires daw-clip-update post-render

    const engineClip = editor._engineTracks
      .get(trackEl.trackId)
      .clips.find((c: any) => c.id === clipEl.clipId);
    // start: 3 × 48000 = 144000
    expect(engineClip.startSample).toBe(144000);
    editor.remove();
  });

  it('updateClip with changed bounds invokes reextractPeaks', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T', clips: [{ src: '/a.opus', start: 0, duration: 4 }] });
    await new Promise((r) => setTimeout(r, 60));
    const trackEl = editor.querySelector('daw-track') as any;
    const clipEl = trackEl.querySelector('daw-clip') as any;

    const reextractCalls = editor._peakPipeline.reextractPeaks.mock.calls.length;
    editor.updateClip(trackEl.trackId, clipEl.clipId, { duration: 2 });
    await clipEl.updateComplete;

    expect(editor._peakPipeline.reextractPeaks.mock.calls.length).toBeGreaterThan(reextractCalls);
    editor.remove();
  });
});

describe("Phase 2: in-flight track load doesn't false-warn for pre-captured clips", () => {
  it('addTrack({clips:[..]}) does not warn when deferred daw-clip-connected fires for pre-read clips', async () => {
    const editor = setupEditor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await editor.addTrack({
      name: 'T',
      clips: [
        { src: '/a.opus', start: 0 },
        { src: '/b.opus', start: 4 },
      ],
    });
    // None of the warns should mention "still loading" — those clips were
    // captured by _readTrackDescriptor and the deferred events are redundant.
    const loadingWarns = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((msg) => msg.includes('still loading'));
    expect(loadingWarns).toEqual([]);
    warnSpy.mockRestore();
    editor.remove();
  });

  it('genuine late-append during in-flight load still warns', async () => {
    const editor = setupEditor();
    // Slow the decode so the track is in-flight when we late-append
    let resolveDecode!: (b: AudioBuffer) => void;
    editor._fetchAndDecode = vi
      .fn()
      .mockImplementation(() => new Promise<AudioBuffer>((r) => (resolveDecode = r)));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const promise = editor.addTrack({
      name: 'Slow',
      clips: [{ src: '/a.opus' }],
    });
    // Wait for daw-track-connected microtask to run; track now in _tracks but not _engineTracks.
    await new Promise((r) => setTimeout(r, 0));

    // Append a NEW clip that wasn't in the original config
    const trackEl = editor.querySelector('daw-track') as any;
    const lateClip = document.createElement('daw-clip');
    lateClip.setAttribute('src', '/late.opus');
    trackEl.appendChild(lateClip);
    // Wait for the late clip's deferred daw-clip-connected
    await new Promise((r) => setTimeout(r, 0));

    const loadingWarns = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((msg) => msg.includes('still loading'));
    expect(loadingWarns.length).toBe(1);

    // Let the addTrack promise resolve so the test can clean up
    resolveDecode({
      length: 96000,
      duration: 2,
      sampleRate: 48000,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(96000),
    } as unknown as AudioBuffer);
    await promise;
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
    editor._engineTracks = new Map([[trackId, { id: trackId, clips: [], name: 'T' }]]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.updateClip(trackId, 'missing-clip', { start: 1 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    warnSpy.mockRestore();
    editor.remove();
  });
});

describe('engine clip-id alignment', () => {
  it('engine clip ids match <daw-clip>.clipId after _loadTrack', async () => {
    const editor = setupEditor();
    editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }, { src: '/b.opus' }] });
    await new Promise((r) => setTimeout(r, 80));

    const domClipIds = [...editor.querySelectorAll('daw-clip')].map((c: any) => c.clipId);
    const engineTracks = [...editor._engineTracks.values()] as any[];
    const engineClipIds = engineTracks[0].clips.map((c: any) => c.id);

    expect(domClipIds.length).toBe(2);
    expect(engineClipIds).toEqual(domClipIds);
    editor.remove();
  });
});

describe('load races (audit wave 2)', () => {
  it('a track removed while its clips are loading is not resurrected into the engine', async () => {
    const editor = setupEditor();
    let releaseDecode!: (b: AudioBuffer) => void;
    editor._fetchAndDecode = vi.fn(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          releaseDecode = resolve;
        })
    );

    const promise = editor.addTrack({
      name: 'Doomed',
      clips: [{ src: '/a.opus', start: 0, duration: 2 }],
    });
    await vi.waitFor(() => expect(editor._fetchAndDecode).toHaveBeenCalled());
    const trackEl = editor.querySelector('daw-track') as any;
    const trackId = trackEl.trackId;

    editor.removeTrack(trackId);
    // Element removal is observed via MutationObserver (async)
    await vi.waitFor(() => expect(editor._tracks.has(trackId)).toBe(false));

    const errorEvents: CustomEvent[] = [];
    editor.addEventListener('daw-track-error', (e: Event) => errorEvents.push(e as CustomEvent));
    editor._peakPipeline.getMaxCachedScale.mockClear();
    releaseDecode(makeAudioBuffer());

    // The addTrack promise must settle (rejected — the track was removed),
    // and the rejection must be discriminable from a real load failure so
    // consumer error UIs can filter intentional removals.
    const err = await Promise.race([
      promise.then(
        () => new Error('unexpectedly resolved'),
        (e: Error) => e
      ),
      new Promise<Error>((r) => setTimeout(() => r(new Error('hung')), 500)),
    ]);
    expect(err.name).toBe('TrackLoadCancelledError');
    expect(errorEvents[0]?.detail.reason).toBe('removed');

    // ...the removed track must NOT reappear in engine/UI state, and the
    // zoom floor raised during the load must be recomputed away
    expect(editor._engineTracks.has(trackId)).toBe(false);
    expect(editor.tracks.find((t: any) => t.trackId === trackId)).toBeUndefined();
    expect(editor._peakPipeline.getMaxCachedScale).toHaveBeenCalled();
    editor.remove();
  });

  it('a load that completes after the editor was detached is cancelled, not committed to a dead engine', async () => {
    const editor = setupEditor();
    let releaseDecode!: (b: AudioBuffer) => void;
    editor._fetchAndDecode = vi.fn(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          releaseDecode = resolve;
        })
    );

    const promise = editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await vi.waitFor(() => expect(editor._fetchAndDecode).toHaveBeenCalled());

    const engineStub = editor._engine; // disconnectedCallback nulls the field
    editor.remove(); // detach — disconnectedCallback disposed the engine
    releaseDecode(makeAudioBuffer()); // decode SUCCEEDS on the dead editor

    const err = await Promise.race([
      promise.then(
        () => new Error('unexpectedly resolved'),
        (e: Error) => e
      ),
      new Promise<Error>((r) => setTimeout(() => r(new Error('hung')), 500)),
    ]);
    // Committing would rebuild an engine (and adapter graph) on a detached
    // element that nothing will ever dispose.
    expect(err.name).toBe('TrackLoadCancelledError');
    expect(engineStub.setTracks).not.toHaveBeenCalled();
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

  it('addTrack rejects instead of hanging when the load fails after the editor is detached', async () => {
    const editor = setupEditor();
    let rejectDecode!: (e: Error) => void;
    editor._fetchAndDecode = vi.fn(
      () =>
        new Promise<AudioBuffer>((_resolve, reject) => {
          rejectDecode = reject;
        })
    );

    const promise = editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await vi.waitFor(() => expect(editor._fetchAndDecode).toHaveBeenCalled());

    editor.remove(); // page transition / framework re-render mid-load
    rejectDecode(new Error('network error'));

    const outcome = await Promise.race([
      promise.then(
        () => 'resolved',
        () => 'rejected'
      ),
      new Promise((r) => setTimeout(() => r('hung'), 500)),
    ]);
    expect(outcome).toBe('rejected');
  });

  it('addClip during the parent track load rejects instead of hanging forever', async () => {
    const editor = setupEditor();
    let releaseDecode!: (b: AudioBuffer) => void;
    editor._fetchAndDecode = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AudioBuffer>((resolve) => {
            releaseDecode = resolve;
          })
      )
      .mockResolvedValue(makeAudioBuffer());

    const trackPromise = editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    await vi.waitFor(() => expect(editor._fetchAndDecode).toHaveBeenCalled());
    const trackId = (editor.querySelector('daw-track') as any).trackId;

    const clipPromise = editor.addClip(trackId, { src: '/b.opus', start: 2 });
    const outcome = await Promise.race([
      clipPromise.then(
        () => 'resolved',
        () => 'rejected'
      ),
      new Promise((r) => setTimeout(() => r('hung'), 500)),
    ]);
    expect(outcome).toBe('rejected');

    releaseDecode(makeAudioBuffer());
    await trackPromise;
    editor.remove();
  });
});

describe('removeTrack timeline sync (audit wave 2)', () => {
  it('removing the last track rewinds the engine to 0, matching the UI', async () => {
    const editor = setupEditor();
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    const trackId = editor.tracks[0].trackId;
    editor._currentTime = 30; // prior seek — engine holds 30 too

    editor.removeTrack(trackId);
    await vi.waitFor(() => expect(editor._tracks.has(trackId)).toBe(false));

    // Without engine.seek(0), the display shows 0 but the next play()
    // resumes from the engine's stale position (engine.removeTrack never
    // touches time).
    expect(editor._engine.seek).toHaveBeenCalledWith(0);
    expect(editor.currentTime).toBe(0);
    editor.remove();
  });

  it('removing the last track during playback stops the engine (isPlaying not stranded)', async () => {
    const editor = setupEditor();
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    const trackId = editor.tracks[0].trackId;
    editor._isPlaying = true;

    const events: string[] = [];
    editor.addEventListener('daw-stop', (e: Event) => events.push(e.type));

    editor.removeTrack(trackId);
    await vi.waitFor(() => expect(editor._tracks.has(trackId)).toBe(false));

    // An empty timeline has nothing to play — leaving the transport rolling
    // strands isPlaying=true with a dead playhead RAF. Transport UIs key on
    // daw-play/daw-stop, so this stop must be announced like every other
    // stop path (editor.stop() is otherwise the only daw-stop dispatcher).
    expect(editor._engine.stop).toHaveBeenCalled();
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
    const editor = setupEditor();
    editor._peakPipeline.getCachedScale = vi.fn().mockReturnValue(128);
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });

    // Worker peaks can only be extracted at >= their cached scale (128) —
    // a finer zoom draws the waveform at a fraction of its clip container.
    editor.samplesPerPixel = 32;
    expect(editor.samplesPerPixel).toBe(128);
    editor.remove();
  });

  it('a floor raised above the current samplesPerPixel re-clamps the live zoom', async () => {
    const editor = setupEditor();
    editor.samplesPerPixel = 64;
    editor._peakPipeline.getCachedScale = vi.fn().mockReturnValue(256);

    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });

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
    const editor = setupEditor();
    editor.samplesPerPixel = 64;
    editor._peakPipeline.getMaxCachedScale = vi.fn().mockReturnValue(128);
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    const trackId = editor.tracks[0].trackId;

    editor.removeTrack(trackId);
    await vi.waitFor(() => expect(editor._tracks.has(trackId)).toBe(false));

    // The recompute raised the floor above the live spp — without a
    // re-clamp, layout stays at 64 while peaks clamp to 128: the exact
    // half-width mismatch _raiseZoomFloor makes unrepresentable, reachable
    // through the one floor-mutation path that bypassed it.
    expect(editor.samplesPerPixel).toBe(128);
    editor.remove();
  });
});

describe('audit wave 6 — lifecycle & rendering state', () => {
  it('a reparented editor does not retain ghost render state', async () => {
    const editor = setupEditor();
    await editor.addTrack({ name: 'T', clips: [{ src: '/a.opus' }] });
    expect(editor._engineTracks.size).toBe(1);

    const other = document.createElement('div');
    document.body.appendChild(other);
    other.appendChild(editor); // synchronous disconnect → reconnect

    // The engine (and the consumer's adapter through it) was disposed and
    // the clip caches cleared — retained render state would show waveforms
    // that can never play. Element-backed tracks re-register via their own
    // deferred connect events; element-less content does not survive.
    expect(editor._engineTracks.size).toBe(0);
    expect(editor._peaksData.size).toBe(0);
    expect(editor.tracks).toHaveLength(0);
    other.remove();
  });

  it('synthesizes descriptors for engine tracks restored by undo', () => {
    const editor = setupEditor();

    editor._ensureDescriptorsForEngineTracks([
      {
        id: 'ghost',
        name: 'Guitar',
        volume: 0.7,
        pan: -0.2,
        muted: false,
        soloed: false,
        clips: [],
      },
    ]);

    // Undo restores the track in ENGINE state, but _tracks was purged at
    // removal — without a synthesized descriptor the track plays and renders
    // yet shows "Untitled" controls and is missing from editor.tracks.
    const t = editor.tracks.find((x: any) => x.trackId === 'ghost');
    expect(t?.name).toBe('Guitar');
    expect(t?.volume).toBe(0.7);
    editor.remove();
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
});
