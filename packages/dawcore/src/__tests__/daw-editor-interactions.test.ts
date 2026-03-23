import { describe, it, expect, vi, beforeAll } from 'vitest';
import { pixelsToSeconds } from '@waveform-playlist/core';

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
  await import('../elements/daw-editor');
});

describe('DawEditorElement interactions', () => {
  it('pixelsToSeconds from core converts correctly', () => {
    // pixel 100, spp=1024, sr=48000 → (100 * 1024) / 48000 = 2.1333...
    expect(pixelsToSeconds(100, 1024, 48000)).toBeCloseTo(2.1333, 3);
  });

  it('pixelsToSeconds at origin is 0', () => {
    expect(pixelsToSeconds(0, 1024, 48000)).toBe(0);
  });
});

describe('Track selection', () => {
  it('has selectedTrackId property defaulting to null', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.selectedTrackId).toBeNull();
  });
});

describe('File drop', () => {
  it('has file-drop attribute defaulting to false', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.fileDrop).toBe(false);
  });

  it('exposes loadFiles method', () => {
    const el = document.createElement('daw-editor') as any;
    expect(typeof el.loadFiles).toBe('function');
  });

  it('returns empty result for null input', async () => {
    const el = document.createElement('daw-editor') as any;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await el.loadFiles(null);
    expect(result).toEqual({ loaded: [], failed: [] });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('loadFiles called with null'));
    warnSpy.mockRestore();
  });
});

describe('Selection', () => {
  it('has selection property defaulting to null', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.selection).toBeNull();
  });

  it('setSelection normalizes reversed arguments', () => {
    const el = document.createElement('daw-editor') as any;
    el.setSelection(5, 2);
    expect(el.selection).toEqual({ start: 2, end: 5 });
  });

  it('setSelection(0, 0) clears to null', () => {
    const el = document.createElement('daw-editor') as any;
    el.setSelection(1, 3);
    expect(el.selection).not.toBeNull();
    el.setSelection(0, 0);
    expect(el.selection).toBeNull();
  });

  it('setSelection dispatches daw-selection event', () => {
    const el = document.createElement('daw-editor') as any;
    const events: CustomEvent[] = [];
    el.addEventListener('daw-selection', (e: CustomEvent) => events.push(e));
    el.setSelection(1, 3);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ start: 1, end: 3 });
  });
});

describe('seekTo', () => {
  it('updates currentTime when not playing', () => {
    const el = document.createElement('daw-editor') as any;
    el._engine = { seek: vi.fn() };
    el._isPlaying = false;
    el.seekTo(5.0);
    expect(el._currentTime).toBe(5.0);
  });

  it('calls _stopPlayhead when not playing', () => {
    const el = document.createElement('daw-editor') as any;
    el._engine = { seek: vi.fn() };
    el._isPlaying = false;
    const spy = vi.spyOn(el, '_stopPlayhead').mockImplementation(() => {});
    el.seekTo(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('stops and restarts playback when playing (Tone.js reschedule)', () => {
    const el = document.createElement('daw-editor') as any;
    el._engine = {
      seek: vi.fn(),
      stop: vi.fn(),
      play: vi.fn(),
      init: vi.fn().mockResolvedValue(undefined),
    };
    el._isPlaying = true;
    const stopSpy = vi.spyOn(el, 'stop');
    const playSpy = vi.spyOn(el, 'play');
    el.seekTo(3.0);
    expect(stopSpy).toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalledWith(3.0);
    stopSpy.mockRestore();
    playSpy.mockRestore();
  });
});

describe('Track control selects track', () => {
  it('selects track when daw-track-control event is dispatched', () => {
    const el = document.createElement('daw-editor') as any;
    document.body.appendChild(el);
    // Set up minimal state for the handler
    el._tracks = new Map([['track-1', { volume: 1, pan: 0, muted: false, soloed: false }]]);
    el._engine = {
      selectTrack: vi.fn(),
      setTrackVolume: vi.fn(),
    };

    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-select', (e: CustomEvent) => events.push(e));

    el.dispatchEvent(
      new CustomEvent('daw-track-control', {
        bubbles: true,
        detail: { trackId: 'track-1', prop: 'volume', value: 0.5 },
      })
    );

    expect(el._selectedTrackId).toBe('track-1');
    expect(el._engine.selectTrack).toHaveBeenCalledWith('track-1');
    expect(events).toHaveLength(1);
    expect(events[0].detail.trackId).toBe('track-1');

    document.body.removeChild(el);
  });

  it('does not re-select already selected track', () => {
    const el = document.createElement('daw-editor') as any;
    document.body.appendChild(el);
    el._tracks = new Map([['track-1', { volume: 1, pan: 0, muted: false, soloed: false }]]);
    el._engine = {
      selectTrack: vi.fn(),
      setTrackVolume: vi.fn(),
    };
    el._selectedTrackId = 'track-1';

    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-select', (e: CustomEvent) => events.push(e));

    el.dispatchEvent(
      new CustomEvent('daw-track-control', {
        bubbles: true,
        detail: { trackId: 'track-1', prop: 'volume', value: 0.5 },
      })
    );

    expect(el._engine.selectTrack).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);

    document.body.removeChild(el);
  });
});

describe('effectiveSampleRate', () => {
  it('returns initial sampleRate hint when no audio decoded', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.effectiveSampleRate).toBe(48000);
  });

  it('returns configured sample-rate attribute', () => {
    const el = document.createElement('daw-editor') as any;
    el.sampleRate = 44100;
    expect(el.effectiveSampleRate).toBe(44100);
  });
});
