import { describe, it, expect } from 'vitest';
import { createTrack } from '@waveform-playlist/core';
import type { RenderMode } from '@waveform-playlist/core';
import { trackRenderMode } from '../utils/trackRenderMode';

describe('trackRenderMode (render modes are for audio tracks)', () => {
  it('an audio track takes its override, then its own mode, then a waveform', () => {
    const audio = createTrack({ name: 'a' });
    expect(trackRenderMode(audio)).toBe('waveform');
    expect(trackRenderMode({ ...audio, renderMode: 'spectrogram' })).toBe('spectrogram');
    expect(trackRenderMode({ ...audio, renderMode: 'spectrogram' }, 'both')).toBe('both');
  });

  it('a MIDI track always gets waveform, so nothing starts a spectrogram for it', () => {
    const midi = createTrack({ name: 'm', kind: 'midi' });
    expect(trackRenderMode(midi)).toBe('waveform');
    expect(trackRenderMode({ ...midi, renderMode: 'spectrogram' })).toBe('waveform');
    expect(trackRenderMode(midi, 'both')).toBe('waveform');
  });

  it("'piano-roll' is not a render mode (type-level)", () => {
    // @ts-expect-error a piano roll is how a MIDI track is drawn, not a mode
    const mode: RenderMode = 'piano-roll';
    expect(mode).toBeDefined();
  });
});
