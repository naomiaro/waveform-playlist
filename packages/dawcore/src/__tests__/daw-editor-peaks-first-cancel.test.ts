import { describe, it, expect, vi, beforeAll } from 'vitest';

// Stub the sync peak extraction so the peaks-first path runs without real
// WaveformData (the editor calls extractPeaks directly on this path).
vi.mock('../workers/waveformDataUtils', () => ({
  extractPeaks: vi.fn(() => ({ data: [new Int16Array(0)], length: 0, bits: 16 })),
}));

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
  await import('../elements/daw-editor');
});

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

// Minimal WaveformData stand-in — only the fields the peaks-first path reads.
function makeWaveformData(scale = 512): any {
  return { sample_rate: 48000, duration: 2, scale };
}

function setupEditor(): any {
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = { audioContext: { state: 'running', sampleRate: 48000 } };
  document.body.appendChild(editor);
  editor._peakPipeline = {
    generatePeaks: vi.fn().mockResolvedValue({ data: [new Int16Array(0)], length: 0, bits: 16 }),
    cacheWaveformData: vi.fn(),
    getMaxCachedScale: vi.fn().mockReturnValue(0),
    getCachedScale: vi.fn().mockReturnValue(0),
    reextractPeaks: vi.fn().mockReturnValue(new Map()),
    terminate: vi.fn(),
  };
  editor._engine = {
    setTracks: vi.fn(),
    removeTrack: vi.fn(),
    updateTrack: vi.fn(),
    on: vi.fn(),
    dispose: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn(),
    stop: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    getState: vi.fn().mockReturnValue({ tracks: [] }),
  };
  return editor;
}

describe('peaks-first load cancellation (audit wave 2)', () => {
  it('does not resurrect a removed track as a peaks-first preview', async () => {
    const editor = setupEditor();
    let releasePeaks!: (wd: unknown) => void;
    editor._resolvePeaks = vi.fn(
      () =>
        new Promise((resolve) => {
          releasePeaks = resolve;
        })
    );
    editor._fetchAndDecode = vi.fn(() => new Promise(() => {})); // decode never settles

    const promise = editor.addTrack({
      name: 'P',
      clips: [{ src: '/a.opus', peaksSrc: '/a.dat', start: 0, duration: 2 }],
    });
    promise.catch(() => {}); // settled below; silence unhandled-rejection noise
    await vi.waitFor(() => expect(editor._resolvePeaks).toHaveBeenCalled());
    const trackId = (editor.querySelector('daw-track') as any).trackId;

    editor.removeTrack(trackId);
    await vi.waitFor(() => expect(editor._tracks.has(trackId)).toBe(false));

    releasePeaks(makeWaveformData());
    await new Promise((r) => setTimeout(r, 20));

    // Pre-fix the preview insert ran unconditionally, so the removed track's
    // waveform reappeared on screen for the whole audio decode.
    expect(editor._engineTracks.has(trackId)).toBe(false);
    editor.remove();
  });

  it('addClip during a peaks-first load rejects instead of appending to the doomed preview', async () => {
    const editor = setupEditor();
    let releasePeaks!: (wd: unknown) => void;
    editor._resolvePeaks = vi.fn(
      () =>
        new Promise((resolve) => {
          releasePeaks = resolve;
        })
    );
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

    const trackPromise = editor.addTrack({
      name: 'P',
      clips: [{ src: '/a.opus', peaksSrc: '/a.dat', start: 0, duration: 2 }],
    });
    await vi.waitFor(() => expect(editor._resolvePeaks).toHaveBeenCalled());
    const trackId = (editor.querySelector('daw-track') as any).trackId;

    // Preview inserted — _engineTracks.has(trackId) is true while the track
    // is STILL loading, which defeated the has()-based loading guard.
    releasePeaks(makeWaveformData());
    await vi.waitFor(() => expect(editor._engineTracks.has(trackId)).toBe(true));

    const clipPromise = editor.addClip(trackId, { src: '/b.opus', start: 2 });
    const outcome = await Promise.race([
      clipPromise.then(
        () => 'resolved',
        () => 'rejected'
      ),
      new Promise((r) => setTimeout(() => r('hung'), 500)),
    ]);
    // Pre-fix this RESOLVED and the clip was silently discarded when the
    // final track commit overwrote the preview — worse than the old hang.
    expect(outcome).toBe('rejected');

    releaseDecode(makeAudioBuffer());
    await trackPromise;
    editor.remove();
  });
});
