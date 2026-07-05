// End-of-timeline auto-stop semantics on <daw-editor> (parity with the React
// provider — issues #589/#590/#593):
//
// 1. Default: playback auto-stops when the playhead reaches the end of the
//    timeline (player style); the engine's stop rewinds to the play-start
//    position and `daw-stop` fires.
// 2. `indefinite-playback` opts out — the transport rolls until an explicit
//    stop/pause (DAW style; previously this attribute was layout-only
//    because no auto-stop existed at all).
// 3. An active recording session suppresses the auto-stop so overdub
//    playback runs past the end of existing material.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawEditorElement } from '../elements/daw-editor';

function makeMockAdapter() {
  let position = 0;
  const adapter = {
    audioContext: {
      sampleRate: 48000,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
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
  return { adapter, setPosition: (t: number) => (position = t) };
}

describe('daw-editor end-of-timeline auto-stop', () => {
  let editor: DawEditorElement;
  let setPosition: (t: number) => void;
  let rafCallbacks: FrameRequestCallback[];

  /** Run all currently queued animation frames (one "frame"). */
  const stepFrame = () => {
    const cbs = rafCallbacks;
    rafCallbacks = [];
    cbs.forEach((cb) => cb(performance.now()));
  };

  beforeEach(async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    const mock = makeMockAdapter();
    setPosition = mock.setPosition;
    editor.adapter = mock.adapter as never;
    document.body.appendChild(editor);
    // One 2-second MIDI note → timeline duration 2s, no fetch/decode needed.
    await editor.addTrack({
      name: 'midi',
      midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 2, velocity: 0.8 }] },
    });
    await editor.updateComplete;
    // Mock RAF only AFTER setup — connectedCallback paths defer via real RAF.
    rafCallbacks = [];
    let nextRafId = 1;
    const rafIds = new Map<number, FrameRequestCallback>();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const id = nextRafId++;
      rafIds.set(id, cb);
      rafCallbacks.push(cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      const cb = rafIds.get(id);
      if (cb) {
        rafIds.delete(id);
        const idx = rafCallbacks.indexOf(cb);
        if (idx !== -1) rafCallbacks.splice(idx, 1);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    editor.remove();
  });

  it('auto-stops at the end of the timeline by default and fires daw-stop', async () => {
    const stops: string[] = [];
    editor.addEventListener('daw-stop', () => stops.push('daw-stop'));

    await editor.play();
    expect(editor.isPlaying).toBe(true);

    // Inside the timeline: keeps playing.
    setPosition(1.0);
    stepFrame();
    expect(editor.isPlaying).toBe(true);
    expect(stops).toHaveLength(0);

    // Past the 2s end: auto-stops, daw-stop fires, cursor back at play start.
    setPosition(2.1);
    stepFrame();
    expect(editor.isPlaying).toBe(false);
    expect(stops).toHaveLength(1);
    expect(editor.currentTime).toBe(0);
  });

  it('does not reschedule zombie frames after the in-frame auto-stop', async () => {
    await editor.play();
    setPosition(2.1);
    stepFrame();
    expect(editor.isPlaying).toBe(false);
    // The stopped loop must not have re-queued itself.
    expect(rafCallbacks).toHaveLength(0);
  });

  it('indefinite-playback rolls past the end until explicit stop (DAW style)', async () => {
    editor.setAttribute('indefinite-playback', '');
    await editor.updateComplete;

    await editor.play();
    setPosition(30);
    stepFrame();
    stepFrame();
    expect(editor.isPlaying).toBe(true);

    editor.stop();
    expect(editor.isPlaying).toBe(false);
  });

  it('an active recording session suppresses the auto-stop', async () => {
    // Simulate an in-progress recording session (RecordingController owns the
    // real getter; the frame check must consult it).
    Object.defineProperty(editor, 'isRecording', { value: true, configurable: true });

    await editor.play();
    setPosition(5);
    stepFrame();
    stepFrame();
    expect(editor.isPlaying).toBe(true);
  });
});
