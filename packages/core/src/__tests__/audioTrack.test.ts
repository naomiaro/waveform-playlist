import { describe, it, expect } from 'vitest';
import { audioTrack } from '../audioTrack';
import { isLoadingClip } from '../types/clip';
import type { AudioClip, LoadingClip, WaveformDataObject } from '../types/clip';

const buffer = {
  sampleRate: 48000,
  length: 96000,
  duration: 2,
  numberOfChannels: 1,
} as unknown as AudioBuffer;

const peaks = { sample_rate: 44100, duration: 3, scale: 256, length: 10 } as WaveformDataObject;

describe('audioTrack with src', () => {
  it('builds one loading clip carrying the options', () => {
    const fadeIn = { duration: 0.1 };
    const fadeOut = { duration: 0.2 };
    const track = audioTrack({
      src: 'a.mp3',
      start: 1,
      duration: 2,
      offset: 0.5,
      fadeIn,
      fadeOut,
      waveformData: peaks,
      gain: 0.5,
      color: 'red',
    });
    expect(track.clips).toHaveLength(1);
    const clip = track.clips[0] as LoadingClip;
    expect(isLoadingClip(clip)).toBe(true);
    expect(clip).toMatchObject({
      src: 'a.mp3',
      start: 1,
      duration: 2,
      offset: 0.5,
      fadeIn,
      fadeOut,
      waveformData: peaks,
      gain: 0.5,
      color: 'red',
    });
    expect(clip.id).toBeTruthy();
  });

  it('uses the given id and clipId', () => {
    const track = audioTrack({ src: 'a.mp3', id: 't1', clipId: 'c1' });
    expect(track.id).toBe('t1');
    expect(track.clips[0].id).toBe('c1');
  });

  it('treats an empty-string id as none', () => {
    const track = audioTrack({ src: 'a.mp3', id: '', clipId: '' });
    expect(track.id).not.toBe('');
    expect(track.clips[0].id).not.toBe('');
  });

  it('defaults the track fields', () => {
    const track = audioTrack({ src: 'a.mp3' });
    expect(track).toMatchObject({ kind: 'audio', muted: false, soloed: false, volume: 1, pan: 0 });
  });

  it('passes the track fields through', () => {
    const track = audioTrack({
      src: 'a.mp3',
      muted: true,
      soloed: true,
      volume: 0.5,
      pan: -1,
      renderMode: 'spectrogram',
    });
    expect(track).toMatchObject({
      muted: true,
      soloed: true,
      volume: 0.5,
      pan: -1,
      renderMode: 'spectrogram',
    });
  });
});

describe('audioTrack with audio already in memory', () => {
  it('builds an AudioClip from audioBuffer', () => {
    const track = audioTrack({ audioBuffer: buffer, start: 1, offset: 0.5 });
    const clip = track.clips[0] as AudioClip;
    expect(isLoadingClip(clip)).toBe(false);
    expect(clip.audioBuffer).toBe(buffer);
    expect(clip.startSample).toBe(48000);
    expect(clip.offsetSamples).toBe(24000);
    expect(clip.durationSamples).toBe(72000); // 2 s - 0.5 s offset
  });

  it('uses a given duration', () => {
    const clip = audioTrack({ audioBuffer: buffer, duration: 1 }).clips[0] as AudioClip;
    expect(clip.durationSamples).toBe(48000);
  });

  it('builds an AudioClip from waveformData alone', () => {
    const clip = audioTrack({ waveformData: peaks }).clips[0] as AudioClip;
    expect(isLoadingClip(clip)).toBe(false);
    expect(clip.sampleRate).toBe(44100);
    expect(clip.durationSamples).toBe(3 * 44100);
  });

  it('keeps both src and audioBuffer on an AudioClip', () => {
    const clip = audioTrack({ src: 'a.mp3', audioBuffer: buffer }).clips[0] as AudioClip;
    expect(isLoadingClip(clip)).toBe(false);
    expect(clip.src).toBe('a.mp3');
    expect(clip.audioBuffer).toBe(buffer);
  });

  it('uses the given ids', () => {
    const track = audioTrack({ audioBuffer: buffer, id: 't', clipId: 'c' });
    expect(track.id).toBe('t');
    expect(track.clips[0].id).toBe('c');
  });
});

describe('audioTrack validation', () => {
  it('throws with nothing to build a clip from', () => {
    expect(() => audioTrack({})).toThrow('audioTrack: give src, audioBuffer or waveformData');
  });

  it.each([
    ['start', { start: -1 }],
    ['start', { start: NaN }],
    ['offset', { offset: -0.1 }],
    ['offset', { offset: Infinity }],
    ['duration', { duration: 0 }],
    ['duration', { duration: -1 }],
    ['duration', { duration: NaN }],
  ])('throws naming %s', (name, extra) => {
    expect(() => audioTrack({ src: 'a.mp3', ...extra })).toThrow(
      new RegExp(`^audioTrack: .*${name}`)
    );
  });
});

describe('audioTrack name', () => {
  it('is the file name of a string src without its extension', () => {
    expect(audioTrack({ src: '/audio/drums.mp3' }).name).toBe('drums');
    expect(audioTrack({ src: 'https://x.test/a/b/bass.line.wav?v=2' }).name).toBe('bass.line');
  });

  it('is a File name without its extension', () => {
    const file = new File(['x'], 'vocal.flac');
    expect(audioTrack({ src: file }).name).toBe('vocal');
  });

  it('is Untitled for a Blob or no src', () => {
    expect(audioTrack({ src: new Blob(['x']) }).name).toBe('Untitled');
    expect(audioTrack({ audioBuffer: buffer }).name).toBe('Untitled');
  });

  it('uses the given name', () => {
    expect(audioTrack({ src: 'a.mp3', name: 'Kick' }).name).toBe('Kick');
  });
});
