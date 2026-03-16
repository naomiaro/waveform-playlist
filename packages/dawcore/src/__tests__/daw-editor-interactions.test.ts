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
