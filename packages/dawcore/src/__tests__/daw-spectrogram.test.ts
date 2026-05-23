import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../elements/daw-spectrogram';

describe('<daw-spectrogram>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('is a custom element', () => {
    const el = document.createElement('daw-spectrogram');
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('exposes default JS properties', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = document.createElement('daw-spectrogram') as any;
    expect(el.clipId).toBe('');
    expect(el.trackId).toBe('');
    expect(el.channelIndex).toBe(0);
    expect(el.length).toBe(0);
    expect(el.waveHeight).toBe(128);
    expect(el.samplesPerPixel).toBe(1024);
    expect(el.sampleRate).toBe(44100);
  });

  it('rejects invalid samplesPerPixel values', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = document.createElement('daw-spectrogram') as any;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.samplesPerPixel = 0;
    expect(el.samplesPerPixel).toBe(1024);
    el.samplesPerPixel = -5;
    expect(el.samplesPerPixel).toBe(1024);
    el.samplesPerPixel = NaN;
    expect(el.samplesPerPixel).toBe(1024);
    el.samplesPerPixel = 2048;
    expect(el.samplesPerPixel).toBe(2048);
    warn.mockRestore();
  });

  it('rejects invalid sampleRate values', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = document.createElement('daw-spectrogram') as any;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.sampleRate = 0;
    expect(el.sampleRate).toBe(44100);
    el.sampleRate = 48000;
    expect(el.sampleRate).toBe(48000);
    warn.mockRestore();
  });
});
