import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawEditorElement } from '../elements/daw-editor';

// Mock adapter modeled on daw-editor-seek-playhead.test.ts:makeMockAdapter.
function makeMockAdapter() {
  let position = 0;
  return {
    audioContext: {
      sampleRate: 48000,
      state: 'running',
      outputLatency: 0.01,
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

describe('daw-editor timeFormat + public playback getters', () => {
  let editor: DawEditorElement;

  beforeEach(() => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    editor.adapter = makeMockAdapter() as never;
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
    vi.restoreAllMocks();
  });

  it('defaults timeFormat to hh:mm:ss.sss', () => {
    expect(editor.timeFormat).toBe('hh:mm:ss.sss');
  });

  it('setTimeFormat updates the property and reflects the attribute', async () => {
    editor.setTimeFormat('seconds');
    await editor.updateComplete;
    expect(editor.timeFormat).toBe('seconds');
    expect(editor.getAttribute('time-format')).toBe('seconds');
  });

  it('accepts the time-format attribute', async () => {
    editor.setAttribute('time-format', 'hh:mm:ss');
    await editor.updateComplete;
    expect(editor.timeFormat).toBe('hh:mm:ss');
  });

  it('dispatches daw-time-format-change with the new format', () => {
    const handler = vi.fn();
    editor.addEventListener('daw-time-format-change', handler);
    editor.setTimeFormat('seconds');
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ format: 'seconds' });
  });

  it('does not dispatch when set to the current value', () => {
    const handler = vi.fn();
    editor.addEventListener('daw-time-format-change', handler);
    editor.setTimeFormat('hh:mm:ss.sss');
    expect(handler).not.toHaveBeenCalled();
  });

  it('warns and ignores invalid formats', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.setTimeFormat('mm:ss' as never);
    expect(editor.timeFormat).toBe('hh:mm:ss.sss');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('self-heals an invalid time-format attribute back to the accepted value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.setTimeFormat('seconds');
    await editor.updateComplete;
    editor.setAttribute('time-format', 'bogus');
    await editor.updateComplete;
    expect(editor.timeFormat).toBe('seconds');
    expect(editor.getAttribute('time-format')).toBe('seconds');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('self-heals an invalid parse-time time-format attribute back to the default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    container.innerHTML = '<daw-editor time-format="bogus"></daw-editor>';
    document.body.appendChild(container);
    const parsed = container.querySelector('daw-editor') as DawEditorElement;
    await parsed.updateComplete;
    expect(parsed.timeFormat).toBe('hh:mm:ss.sss');
    expect(parsed.getAttribute('time-format')).toBe('hh:mm:ss.sss');
    expect(warn).toHaveBeenCalled();
    container.remove();
  });

  it('exposes read-only isPlaying, false initially', () => {
    expect(editor.isPlaying).toBe(false);
  });

  it('exposes duration derived from loaded tracks', async () => {
    await editor.addTrack({
      name: 'midi',
      midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 2, velocity: 0.8 }] },
    });
    await editor.updateComplete;
    expect(editor.duration).toBeCloseTo(2);
  });
});
