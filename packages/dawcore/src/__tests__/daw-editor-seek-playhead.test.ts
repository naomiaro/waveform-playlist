import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawEditorElement } from '../elements/daw-editor';

// Mock adapter modeled on daw-editor-midi.test.ts:makeMockAdapter, with
// Tone-adapter-like latency characteristics (lookAhead 0.1, outputLatency 0.01).
function makeMockAdapter() {
  let position = 0;
  return {
    audioContext: {
      sampleRate: 48000,
      state: 'running',
      outputLatency: 0.01,
    } as unknown as AudioContext,
    ppqn: 960,
    lookAhead: 0.1,
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn((t: number) => {
      position = t;
    }),
    getCurrentTime: vi.fn(() => position),
    isPlaying: vi.fn().mockReturnValue(false),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('daw-editor seek playhead position', () => {
  let editor: DawEditorElement;

  beforeEach(async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    editor.adapter = makeMockAdapter() as never;
    document.body.appendChild(editor);
    // Lightweight fully-loaded track without fetch/decode (dawcore CLAUDE.md).
    await editor.addTrack({
      name: 'midi',
      midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 1, velocity: 0.8 }] },
    });
    await editor.updateComplete;
  });

  afterEach(() => {
    editor.remove();
  });

  it('seekTo while stopped positions the resting playhead at the exact time', () => {
    const playhead = editor.shadowRoot!.querySelector('daw-playhead') as HTMLElement & {
      stopAnimation: (time: number, sampleRate: number, spp: number) => void;
    };
    expect(playhead).toBeTruthy();
    const stopSpy = vi.fn();
    playhead.stopAnimation = stopSpy;

    editor.seekTo(5);

    expect(stopSpy).toHaveBeenCalled();
    const visualTime = stopSpy.mock.calls[stopSpy.mock.calls.length - 1][0];
    // Exact click time — NOT 5 − outputLatency − lookAhead = 4.89.
    expect(visualTime).toBe(5);
  });
});
