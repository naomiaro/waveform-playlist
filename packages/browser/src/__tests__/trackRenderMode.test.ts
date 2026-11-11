import { describe, it, expect } from 'vitest';
import { createTrack } from '@waveform-playlist/core';
import { trackRenderMode } from '../utils/trackRenderMode';

describe('trackRenderMode (#756: the render mode follows the track kind)', () => {
  it('draws a MIDI track as a piano roll, whatever else is set', () => {
    const midi = createTrack({ name: 'm', kind: 'midi' });
    expect(trackRenderMode(midi)).toBe('piano-roll');
    expect(trackRenderMode({ ...midi, renderMode: 'spectrogram' })).toBe('piano-roll');
    expect(trackRenderMode(midi, 'both')).toBe('piano-roll');
  });

  it('an empty MIDI track is a piano roll before it has any clip', () => {
    expect(trackRenderMode(createTrack({ name: 'm', kind: 'midi', clips: [] }))).toBe('piano-roll');
  });

  it('draws an audio track with its override, then its own mode, then a waveform', () => {
    const audio = createTrack({ name: 'a' });
    expect(trackRenderMode(audio)).toBe('waveform');
    expect(trackRenderMode({ ...audio, renderMode: 'spectrogram' })).toBe('spectrogram');
    expect(trackRenderMode({ ...audio, renderMode: 'spectrogram' }, 'both')).toBe('both');
  });

  it('never draws an audio track as a piano roll', () => {
    const audio = createTrack({ name: 'a' });
    expect(trackRenderMode({ ...audio, renderMode: 'piano-roll' })).toBe('waveform');
    expect(trackRenderMode(audio, 'piano-roll')).toBe('waveform');
  });
});
