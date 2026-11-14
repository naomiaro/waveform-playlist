/**
 * A loading clip and its decoded audio become an AudioClip (#812, part 4).
 * The conversion rules are those of the first design (ported from the
 * provider-side resolveTracks); what is new is that a clip that cannot be
 * made is reported with a reason instead of being left out.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { LoadingClip, WaveformDataObject } from '@waveform-playlist/core';
import { isLoadingClip } from '@waveform-playlist/core';
import { resolveLoadingClip } from '../arrangement/resolveLoadingClip';

const fakeBuffer = (sampleRate: number, length: number): AudioBuffer =>
  ({ sampleRate, length, duration: length / sampleRate, numberOfChannels: 1 }) as AudioBuffer;

const wd = (sample_rate: number, duration: number): WaveformDataObject =>
  ({ sample_rate, duration, scale: 256, length: 10, bits: 8, channels: 1 }) as WaveformDataObject;

/** Ten seconds at 44.1 kHz. */
const TEN_SECONDS = () => fakeBuffer(44100, 441000);

const clipOf = (result: ReturnType<typeof resolveLoadingClip>) => {
  if (!('clip' in result)) throw new Error('unusable: ' + result.unusable);
  return result.clip;
};
const reasonOf = (result: ReturnType<typeof resolveLoadingClip>) => {
  if (!('unusable' in result)) throw new Error('a clip was made');
  return result.unusable;
};

afterEach(() => vi.restoreAllMocks());
const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('resolveLoadingClip: a clip that can be made', () => {
  it('converts seconds to samples at the BUFFER rate, keeps the id and carries the display fields', () => {
    const buffer = TEN_SECONDS();
    const w = wd(44100, 10);
    const fade = { duration: 0.1 } as never;
    const loading: LoadingClip = {
      id: 'c1',
      src: 'a.mp3',
      start: 1.5,
      offset: 0.5,
      duration: 2,
      name: 'Kick',
      gain: 0.5,
      fadeIn: fade,
      fadeOut: fade,
      color: '#f00',
      waveformData: w,
    };
    const clip = clipOf(resolveLoadingClip(loading, buffer));
    expect(clip).toMatchObject({
      id: 'c1',
      startSample: 66150,
      offsetSamples: 22050,
      durationSamples: 88200,
      sampleRate: 44100,
      sourceDurationSamples: 441000,
      src: 'a.mp3',
      name: 'Kick',
      gain: 0.5,
      fadeIn: fade,
      fadeOut: fade,
      color: '#f00',
      waveformData: w,
    });
    expect(clip.audioBuffer).toBe(buffer);
    expect(isLoadingClip(clip)).toBe(false);
  });

  it('defaults: start 0, offset 0, the duration is the rest of the buffer from the offset', () => {
    expect(clipOf(resolveLoadingClip({ id: 'c', src: 'a' }, TEN_SECONDS()))).toMatchObject({
      startSample: 0,
      offsetSamples: 0,
      durationSamples: 441000,
    });
    expect(
      clipOf(resolveLoadingClip({ id: 'c', src: 'a', offset: 1 }, TEN_SECONDS())).durationSamples
    ).toBe(441000 - 44100);
  });

  it('a duration of null (plain JavaScript, JSON) is a duration that was not given', () => {
    const loading = { id: 'c', src: 'a', offset: 1, duration: null } as unknown as LoadingClip;
    expect(clipOf(resolveLoadingClip(loading, TEN_SECONDS())).durationSamples).toBe(441000 - 44100);
  });

  it('cuts a duration past the end, with one warning naming the clip', () => {
    const warn = warnSpy();
    const loading: LoadingClip = { id: 'long-one', src: 'a', offset: 5, duration: 20 };
    const clip = clipOf(resolveLoadingClip(loading, TEN_SECONDS()));
    expect(clip.durationSamples).toBe(441000 - 220500);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toBe(
      '[waveform-playlist] clip "long-one": duration runs past the end of the audio and was cut to it'
    );
  });

  it('warns once per loading-clip object, however often it is resolved', () => {
    const warn = warnSpy();
    const loading: LoadingClip = { id: 'c', src: 'a', offset: 5, duration: 20 };
    resolveLoadingClip(loading, TEN_SECONDS());
    resolveLoadingClip(loading, TEN_SECONDS());
    expect(warn).toHaveBeenCalledTimes(1);
    // Another object with the same fields is another clip.
    resolveLoadingClip({ ...loading }, TEN_SECONDS());
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('cuts a duration within one sample of the end silently', () => {
    const warn = warnSpy();
    // 441001 samples: one past the end
    const loading: LoadingClip = { id: 'c', src: 'a', duration: 441001 / 44100 };
    expect(clipOf(resolveLoadingClip(loading, TEN_SECONDS())).durationSamples).toBe(441000);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not write to the loading clip', () => {
    const loading: LoadingClip = Object.freeze({ id: 'c', src: 'a', start: 1, duration: 2 });
    expect(clipOf(resolveLoadingClip(loading, TEN_SECONDS())).startSample).toBe(44100);
  });
});

describe('resolveLoadingClip: a clip that cannot be made', () => {
  it.each([
    ['an offset past the end', { offset: 11 }, 'offset is at or past the end of the audio'],
    ['an offset at the end', { offset: 10 }, 'offset is at or past the end of the audio'],
    [
      'a zero duration',
      { duration: 0 },
      'duration must be a positive, finite number of seconds, got 0',
    ],
    [
      'a negative duration',
      { duration: -1 },
      'duration must be a positive, finite number of seconds, got -1',
    ],
    [
      'a NaN duration',
      { duration: NaN },
      'duration must be a positive, finite number of seconds, got NaN',
    ],
    [
      'an infinite duration',
      { duration: Infinity },
      'duration must be a positive, finite number of seconds, got Infinity',
    ],
    ['a duration under one sample', { duration: 1e-9 }, 'duration is shorter than one sample'],
    ['a negative start', { start: -1 }, 'start must be a finite number of seconds >= 0, got -1'],
    ['a NaN start', { start: NaN }, 'start must be a finite number of seconds >= 0, got NaN'],
    ['a negative offset', { offset: -1 }, 'offset must be a finite number of seconds >= 0, got -1'],
    ['a start too large for whole samples', { start: 1e300 }, 'start or offset is too large'],
  ])(
    '%s: unusable, with the reason and the clip named, and no warning',
    (_name, fields, reason) => {
      const warn = warnSpy();
      const loading: LoadingClip = { id: 'bad', src: 'a', ...fields };
      expect(reasonOf(resolveLoadingClip(loading, TEN_SECONDS()))).toBe(`clip "bad": ${reason}`);
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['zero length', { length: 0, sampleRate: 44100 }],
    ['NaN length', { length: NaN, sampleRate: 44100 }],
    ['zero rate', { length: 100, sampleRate: 0 }],
    ['NaN rate', { length: 100, sampleRate: NaN }],
    ['infinite rate', { length: 100, sampleRate: Infinity }],
  ])('a buffer with %s: unusable, the buffer is empty', (_name, b) => {
    const result = resolveLoadingClip({ id: 'eb', src: 'a' }, fakeBuffer(b.sampleRate, b.length));
    expect(reasonOf(result)).toBe(
      'clip "eb": the decoded buffer is empty or has no usable sample rate'
    );
  });

  it('never throws: input from plain JavaScript that is not what the types say is unusable', () => {
    // No buffer at all (plain JavaScript): nothing to read a rate from.
    const result = resolveLoadingClip({ id: 'c', src: 'a' }, undefined as unknown as AudioBuffer);
    expect(reasonOf(result)).toBe(
      'clip "c": the decoded buffer is empty or has no usable sample rate'
    );
    // Whatever is thrown while the clip is made becomes the reason.
    const throwing = {
      id: 'c',
      src: 'a',
      get start(): number {
        throw new Error('boom');
      },
    } as LoadingClip;
    expect(reasonOf(resolveLoadingClip(throwing, TEN_SECONDS()))).toBe('clip "c": boom');
    // Fields that are not numbers at all.
    const odd = { id: 'c', src: 'a', start: 'soon' } as unknown as LoadingClip;
    expect(reasonOf(resolveLoadingClip(odd, TEN_SECONDS()))).toBe(
      'clip "c": start must be a finite number of seconds >= 0, got soon'
    );
  });
});
