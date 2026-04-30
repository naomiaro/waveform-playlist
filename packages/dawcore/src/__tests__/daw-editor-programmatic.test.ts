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

  it('rejects when daw-track-error fires for that track', async () => {
    const editor = setupEditor();
    // Make the fetch reject so _loadTrack dispatches daw-track-error naturally.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor._fetchAndDecode = vi.fn().mockRejectedValue(new Error('decode failed'));
    const promise = editor.addTrack({
      name: 'Bad',
      clips: [{ src: '/missing.opus' }],
    });
    await expect(promise).rejects.toThrow('decode failed');
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

  it('is a no-op for unknown trackId', () => {
    const editor = setupEditor();
    expect(() => editor.removeTrack('not-a-track')).not.toThrow();
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
