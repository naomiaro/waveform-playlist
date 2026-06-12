import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawEditorElement } from '../elements/daw-editor';

function makeMockAdapter() {
  let position = 0;
  return {
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
}

describe('daw-editor daw-timeupdate', () => {
  let editor: DawEditorElement;
  let rafCallbacks: FrameRequestCallback[];

  /** Run all currently queued animation frames (one "frame"). */
  const stepFrame = () => {
    const cbs = rafCallbacks;
    rafCallbacks = [];
    cbs.forEach((cb) => cb(performance.now()));
  };

  beforeEach(async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    editor.adapter = makeMockAdapter() as never;
    document.body.appendChild(editor);
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

  it('dispatches daw-timeupdate on every animation frame while playing', async () => {
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    await editor.play();
    stepFrame();
    stepFrame();
    expect(handler).toHaveBeenCalledTimes(2);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(typeof detail.time).toBe('number');
  });

  it('the event bubbles and is composed', async () => {
    const handler = vi.fn();
    document.addEventListener('daw-timeupdate', handler);
    await editor.play();
    stepFrame();
    document.removeEventListener('daw-timeupdate', handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).composed).toBe(true);
  });

  it('positions the playhead each frame from the same clock', async () => {
    const playhead = editor.shadowRoot!.querySelector('daw-playhead') as HTMLElement & {
      setPosition: (px: number) => void;
    };
    const posSpy = vi.fn();
    playhead.setPosition = posSpy;
    await editor.play();
    stepFrame();
    expect(posSpy).toHaveBeenCalledTimes(1);
    // time 0 -> pixel 0 regardless of spp
    expect(posSpy.mock.calls[0][0]).toBe(0);
  });

  it('dispatches one final daw-timeupdate on pause', async () => {
    await editor.play();
    stepFrame();
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    editor.pause();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches one daw-timeupdate on seek while stopped (HTMLMediaElement-adjacent)', () => {
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    editor.seekTo(1.5);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail.time).toBe(1.5);
  });

  it('dispatches exactly one daw-timeupdate on stop (engine stop handler + editor.stop both call _stopPlayhead)', async () => {
    await editor.play();
    stepFrame();
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    editor.stop();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('seek while playing does not dispatch a transient timeupdate at the play-start position', async () => {
    await editor.play(2);
    stepFrame();
    const times: number[] = [];
    const handler = (e: Event) => times.push((e as CustomEvent).detail.time);
    editor.addEventListener('daw-timeupdate', handler);
    editor.seekTo(5);
    await editor.updateComplete;
    editor.removeEventListener('daw-timeupdate', handler);
    // No event at the old play-start position (2) — the transient internal
    // stop must not leak a backward-jumping time to consumers.
    expect(times).not.toContain(2);
  });

  it('stops dispatching after stop (no further frames fire events)', async () => {
    await editor.play();
    stepFrame();
    editor.stop();
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    stepFrame(); // any stale queued frames must not dispatch
    expect(handler).not.toHaveBeenCalled();
  });
});
