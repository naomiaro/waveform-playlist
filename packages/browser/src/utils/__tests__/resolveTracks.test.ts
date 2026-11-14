import { describe, it, expect, vi, afterEach } from 'vitest';
import type {
  AudioClip,
  ClipSource,
  ClipTrack,
  LoadingClip,
  PlaylistTrack,
  SourceState,
  WaveformDataObject,
} from '@waveform-playlist/core';
import { createClip } from '@waveform-playlist/core';
import { EMPTY_RESOLVE_CACHE, resolveTracks, seedResolved } from '../resolveTracks';

type Sources = ReadonlyMap<ClipSource, SourceState<AudioBuffer>>;

const fakeBuffer = (sampleRate: number, length: number): AudioBuffer =>
  ({ sampleRate, length, duration: length / sampleRate, numberOfChannels: 1 }) as AudioBuffer;

const loaded = (b: AudioBuffer): SourceState<AudioBuffer> => ({ status: 'loaded', value: b });
const pending: SourceState<AudioBuffer> = { status: 'pending' };
const failed: SourceState<AudioBuffer> = { status: 'failed', error: new Error('nope') };

const track = (
  id: string,
  clips: PlaylistTrack['clips'],
  extra: Partial<PlaylistTrack> = {}
): PlaylistTrack => ({
  id,
  kind: 'audio',
  name: id,
  clips,
  muted: false,
  soloed: false,
  volume: 1,
  pan: 0,
  ...extra,
});

const wd = (sample_rate: number, duration: number): WaveformDataObject =>
  ({ sample_rate, duration, scale: 256, length: 10, bits: 8, channels: 1 }) as WaveformDataObject;

describe('resolveTracks', () => {
  afterEach(() => vi.restoreAllMocks());

  const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

  describe('a loaded clip', () => {
    it('converts at the buffer rate and carries the display fields', () => {
      const buf = fakeBuffer(44100, 441000);
      const w = wd(44100, 10);
      const fade = { duration: 0.1 } as never;
      const lc: LoadingClip = {
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
      const r = resolveTracks(
        [track('t', [lc])],
        new Map([['a.mp3', loaded(buf)]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      const clip = r.engineTracks[0].clips[0];
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
      expect(clip.audioBuffer).toBe(buf);
      expect(r.viewTracks[0].clips[0]).toBe(clip);
      expect(r.viewTracks[0]).toBe(r.engineTracks[0]);
    });

    it('defaults the duration to the rest of the buffer', () => {
      const buf = fakeBuffer(44100, 441000);
      const lc: LoadingClip = { id: 'c1', src: 'a', offset: 1 };
      const r = resolveTracks(
        [track('t', [lc])],
        new Map([['a', loaded(buf)]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      expect(r.engineTracks[0].clips[0].durationSamples).toBe(441000 - 44100);
      expect(r.engineTracks[0].clips[0].startSample).toBe(0);
    });

    it('cuts a duration past the end, with one warning naming the clip', () => {
      const warn = warnSpy();
      const buf = fakeBuffer(44100, 441000);
      const lc: LoadingClip = { id: 'long-one', src: 'a', offset: 5, duration: 20 };
      const r = resolveTracks(
        [track('t', [lc])],
        new Map([['a', loaded(buf)]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      expect(r.engineTracks[0].clips[0].durationSamples).toBe(441000 - 220500);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('long-one');
      expect(String(warn.mock.calls[0][0])).toContain('[waveform-playlist]');
    });

    it('cuts a duration within one sample of the end silently', () => {
      const warn = warnSpy();
      const buf = fakeBuffer(44100, 441000);
      // 441001 / 44100 s * 44100 = 441001 samples: one past the end
      const lc: LoadingClip = { id: 'c', src: 'a', duration: 441001 / 44100 };
      const r = resolveTracks(
        [track('t', [lc])],
        new Map([['a', loaded(buf)]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      expect(r.engineTracks[0].clips[0].durationSamples).toBe(441000);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['offset past the end', { offset: 11 }],
      ['offset at the end', { offset: 10 }],
      ['zero duration', { duration: 0 }],
      ['negative duration', { duration: -1 }],
      ['NaN duration', { duration: NaN }],
      ['infinite duration', { duration: Infinity }],
      ['negative start', { start: -1 }],
      ['NaN start', { start: NaN }],
      ['negative offset', { offset: -1 }],
    ])('leaves out a clip with %s and warns once', (_n, fields) => {
      const warn = warnSpy();
      const buf = fakeBuffer(44100, 441000);
      const lc: LoadingClip = { id: 'bad', src: 'a', ...fields };
      const keep = createClip({ audioBuffer: buf, startSample: 0 });
      const t = track('t', [lc, keep]);
      const r = resolveTracks([t], new Map([['a', loaded(buf)]]), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.engineTracks[0].clips).toEqual([keep]);
      expect(r.viewTracks[0].clips).toEqual([keep]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('bad');
      expect(JSON.stringify(r.engineTracks)).not.toContain('null');
    });
  });

  describe('placeholders', () => {
    it('pending with a duration: placeholder in view only, at the context rate', () => {
      const lc: LoadingClip = { id: 'p', src: 'a', start: 1, duration: 3 };
      const r = resolveTracks(
        [track('t', [lc])],
        new Map([['a', pending]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      const clip = r.viewTracks[0].clips[0];
      expect(clip).toMatchObject({
        id: 'p',
        src: 'a',
        startSample: 48000,
        durationSamples: 144000,
        sampleRate: 48000,
        sourceDurationSamples: 144000,
        offsetSamples: 0,
      });
      expect(clip.audioBuffer).toBeUndefined();
      expect(r.engineTracks[0].clips).toEqual([]);
      expect(r.placeholderIds).toEqual(new Set(['p']));
    });

    it('a missing source counts as pending', () => {
      const lc: LoadingClip = { id: 'p', src: 'a', duration: 1 };
      const r = resolveTracks([track('t', [lc])], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.viewTracks[0].clips).toHaveLength(1);
    });

    it('with waveformData and no duration: the waveform data rate and length', () => {
      const lc: LoadingClip = { id: 'p', src: 'a', offset: 1, waveformData: wd(22050, 4) };
      const r = resolveTracks(
        [track('t', [lc])],
        new Map([['a', pending]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      expect(r.viewTracks[0].clips[0]).toMatchObject({
        sampleRate: 22050,
        sourceDurationSamples: 88200,
        offsetSamples: 22050,
        durationSamples: 88200 - 22050,
      });
    });

    it('with neither duration nor waveformData: in neither list; the track stays', () => {
      const keep = createClip({ audioBuffer: fakeBuffer(48000, 48000), startSample: 0 });
      const lc: LoadingClip = { id: 'p', src: 'a' };
      const r = resolveTracks(
        [track('t', [lc, keep])],
        new Map([['a', pending]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      expect(r.viewTracks[0].clips).toEqual([keep]);
      expect(r.engineTracks[0].clips).toEqual([keep]);
      expect(r.placeholderIds.size).toBe(0);
    });

    it('a failed source is drawn as a pending one', () => {
      const lc: LoadingClip = { id: 'p', src: 'a', duration: 2 };
      const r = resolveTracks(
        [track('t', [lc])],
        new Map([['a', failed]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      expect(r.viewTracks[0].clips[0].durationSamples).toBe(96000);
      expect(r.engineTracks[0].clips).toEqual([]);
    });

    it('keeps its identity while pending and is replaced by the loaded clip', () => {
      const lc: LoadingClip = { id: 'p', src: 'a', duration: 2 };
      const t = track('t', [lc]);
      const r1 = resolveTracks([t], new Map([['a', pending]]), 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks([t], new Map([['a', pending]]), 48000, r1.cache);
      expect(r2.viewTracks[0].clips[0]).toBe(r1.viewTracks[0].clips[0]);
      const r3 = resolveTracks(
        [t],
        new Map([['a', loaded(fakeBuffer(44100, 88200))]]),
        48000,
        r2.cache
      );
      expect(r3.viewTracks[0].clips[0]).not.toBe(r1.viewTracks[0].clips[0]);
      expect(r3.viewTracks[0].clips[0].audioBuffer).toBeDefined();
      expect(r3.placeholderIds.size).toBe(0);
    });

    it('carries the display fields', () => {
      const fade = { duration: 0.2 } as never;
      const lc: LoadingClip = {
        id: 'p',
        src: 'a',
        duration: 1,
        name: 'N',
        gain: 0.3,
        fadeIn: fade,
        fadeOut: fade,
        color: '#0f0',
      };
      const r = resolveTracks([track('t', [lc])], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.viewTracks[0].clips[0]).toMatchObject({
        name: 'N',
        gain: 0.3,
        fadeIn: fade,
        fadeOut: fade,
        color: '#0f0',
      });
    });

    it('with duration and waveformData, the duration is cut to the waveform data like a loaded clip', () => {
      const warn = warnSpy();
      const lc: LoadingClip = {
        id: 'cut',
        src: 'a',
        offset: 1,
        duration: 9,
        waveformData: wd(1000, 4),
      };
      const r = resolveTracks([track('t', [lc])], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.viewTracks[0].clips[0]).toMatchObject({
        sampleRate: 1000,
        sourceDurationSamples: 4000,
        offsetSamples: 1000,
        durationSamples: 3000,
      });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('cut');
    });

    it('a new sample rate makes a new placeholder', () => {
      const t = track('t', [{ id: 'p', src: 'a', duration: 2 }]);
      const r1 = resolveTracks([t], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks([t], new Map(), 44100, r1.cache);
      expect(r2.viewTracks[0].clips[0].durationSamples).toBe(88200);
    });
  });

  describe('malformed input', () => {
    const SAMPLE_FIELDS = [
      'startSample',
      'offsetSamples',
      'durationSamples',
      'sampleRate',
      'sourceDurationSamples',
    ] as const;
    const expectSane = (r: ReturnType<typeof resolveTracks>) => {
      for (const list of [r.viewTracks, r.engineTracks]) {
        for (const t of list) {
          for (const c of t.clips) {
            for (const f of SAMPLE_FIELDS) {
              expect(Number.isInteger(c[f]), `${c.id}.${f} = ${c[f]}`).toBe(true);
            }
            expect(c.durationSamples).toBeGreaterThan(0);
          }
        }
      }
    };
    const badWd = (fields: object) => fields as unknown as WaveformDataObject;

    it.each([
      ['NaN sample_rate', { duration: 4, sample_rate: NaN }],
      ['missing sample_rate', { duration: 4 }],
      ['zero sample_rate', { duration: 4, sample_rate: 0 }],
      ['negative sample_rate', { duration: 4, sample_rate: -1 }],
      ['NaN duration', { duration: NaN, sample_rate: 1000 }],
      ['infinite duration', { duration: Infinity, sample_rate: 1000 }],
      ['negative duration', { duration: -1, sample_rate: 1000 }],
    ])(
      'waveformData with %s: placeholder from the clip duration, bad data ignored',
      (_n, fields) => {
        const warn = warnSpy();
        const lc: LoadingClip = { id: 'bw', src: 'a', duration: 1, waveformData: badWd(fields) };
        const r = resolveTracks([track('t', [lc])], new Map(), 48000, EMPTY_RESOLVE_CACHE);
        expect(r.viewTracks[0].clips[0]).toMatchObject({
          sampleRate: 48000,
          durationSamples: 48000,
        });
        expect(r.viewTracks[0].clips[0].waveformData).toBeUndefined();
        expect(r.engineTracks[0].clips).toEqual([]);
        expectSane(r);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('bw');
        expect(String(warn.mock.calls[0][0])).toContain(
          'waveformData has no usable sample_rate or duration'
        );
      }
    );

    it.each([
      ['NaN sample_rate', { duration: 4, sample_rate: NaN }],
      ['missing sample_rate', { duration: 4 }],
      ['zero sample_rate', { duration: 4, sample_rate: 0 }],
      ['NaN duration', { duration: NaN, sample_rate: 1000 }],
    ])('waveformData with %s and no clip duration: no placeholder', (_n, fields) => {
      const warn = warnSpy();
      const lc: LoadingClip = { id: 'bw2', src: 'a', waveformData: badWd(fields) };
      const r = resolveTracks([track('t', [lc])], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.viewTracks[0].clips).toEqual([]);
      expect(r.engineTracks[0].clips).toEqual([]);
      expectSane(r);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['zero length', { length: 0, sampleRate: 44100 }],
      ['NaN length', { length: NaN, sampleRate: 44100 }],
      ['zero rate', { length: 100, sampleRate: 0 }],
      ['NaN rate', { length: 100, sampleRate: NaN }],
      ['infinite rate', { length: 100, sampleRate: Infinity }],
    ])('a buffer with %s: no clip, one warning that says the buffer is empty', (_n, b) => {
      const warn = warnSpy();
      const buf = fakeBuffer(b.sampleRate, b.length);
      const t = track('t', [{ id: 'eb', src: 'a' }]);
      const r = resolveTracks([t], new Map([['a', loaded(buf)]]), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.viewTracks[0].clips).toEqual([]);
      expect(r.engineTracks[0].clips).toEqual([]);
      expectSane(r);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('eb');
      expect(String(warn.mock.calls[0][0])).toContain('buffer is empty');
    });

    it('a time too large for integer samples gives no clip', () => {
      warnSpy();
      const t = track('t', [{ id: 'big', src: 'a', start: 1e308, duration: 1 }]);
      const r = resolveTracks([t], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.viewTracks[0].clips).toEqual([]);
      expectSane(r);
    });
  });

  describe('identity', () => {
    it('a track with no loading clip is the same object in both lists', () => {
      const t = track('t', [createClip({ audioBuffer: fakeBuffer(48000, 48000), startSample: 0 })]);
      const r = resolveTracks([t], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.viewTracks[0]).toBe(t);
      expect(r.engineTracks[0]).toBe(t);
    });

    it('the same inputs twice give the same tracks and arrays', () => {
      const buf = fakeBuffer(44100, 44100);
      const t1 = track('a', [{ id: 'c', src: 'a' }]);
      const t2 = track('b', [{ id: 'd', src: 'b', duration: 1 }]);
      const input = [t1, t2];
      const sources: Sources = new Map([['a', loaded(buf)]]);
      const r1 = resolveTracks(input, sources, 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks(input, sources, 48000, r1.cache);
      expect(r2.viewTracks).toBe(r1.viewTracks);
      expect(r2.engineTracks).toBe(r1.engineTracks);
      expect(r2.placeholderIds).toBe(r1.placeholderIds);
      expect(r2.rejected).toBe(r1.rejected);
      expect(r2.viewTracks[0]).toBe(r1.viewTracks[0]);
      expect(r2.viewTracks[1]).toBe(r1.viewTracks[1]);
    });

    it('is safe to call twice with the same previous cache (StrictMode)', () => {
      const warn = warnSpy();
      const buf = fakeBuffer(44100, 44100);
      const t = track('a', [{ id: 'c', src: 'a', duration: 50 }]);
      const sources: Sources = new Map([['a', loaded(buf)]]);
      const first = resolveTracks([t], sources, 48000, EMPTY_RESOLVE_CACHE);
      const second = resolveTracks([t], sources, 48000, EMPTY_RESOLVE_CACHE);
      expect(second.engineTracks[0].clips[0].durationSamples).toBe(
        first.engineTracks[0].clips[0].durationSamples
      );
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('an invalid clip warns once in total, pending and then loaded', () => {
      const warn = warnSpy();
      const lc: LoadingClip = { id: 'inv', src: 'a', start: -1, duration: 1 };
      const t = track('a', [lc]);
      const r1 = resolveTracks([t], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const loadedSources: Sources = new Map([['a', loaded(fakeBuffer(44100, 44100))]]);
      resolveTracks([t], loadedSources, 48000, r1.cache);
      resolveTracks([t], loadedSources, 48000, EMPTY_RESOLVE_CACHE);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('the first clip keeps its object when a second clip of the track loads', () => {
      const bufA = fakeBuffer(44100, 44100);
      const t = track('t', [
        { id: 'a', src: 'a' },
        { id: 'b', src: 'b' },
      ]);
      const r1 = resolveTracks([t], new Map([['a', loaded(bufA)]]), 48000, EMPTY_RESOLVE_CACHE);
      const both: Sources = new Map([
        ['a', loaded(bufA)],
        ['b', loaded(fakeBuffer(44100, 22050))],
      ]);
      const r2 = resolveTracks([t], both, 48000, r1.cache);
      expect(r1.engineTracks[0].clips).toHaveLength(1);
      expect(r2.engineTracks[0].clips).toHaveLength(2);
      expect(r2.engineTracks[0].clips[0]).toBe(r1.engineTracks[0].clips[0]);
    });

    it('a placeholder keeps its identity under the same rate for a new input track object', () => {
      const lc: LoadingClip = { id: 'p', src: 'a', duration: 2 };
      const r1 = resolveTracks([track('t', [lc])], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks([track('t', [lc])], new Map(), 48000, r1.cache);
      expect(r2.viewTracks[0]).not.toBe(r1.viewTracks[0]);
      expect(r2.viewTracks[0].clips[0]).toBe(r1.viewTracks[0].clips[0]);
    });

    it('one source settling changes only the tracks naming it', () => {
      const buf = fakeBuffer(44100, 44100);
      const ta = track('a', [{ id: 'c', src: 'a', duration: 1 }]);
      const tb = track('b', [{ id: 'd', src: 'b', duration: 1 }]);
      const plain = track('p', []);
      const input = [ta, tb, plain];
      const r1 = resolveTracks(input, new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks(input, new Map([['a', loaded(buf)]]), 48000, r1.cache);
      expect(r2.viewTracks[0]).not.toBe(r1.viewTracks[0]);
      expect(r2.viewTracks[1]).toBe(r1.viewTracks[1]);
      expect(r2.viewTracks[2]).toBe(plain);
      expect(r2.viewTracks).not.toBe(r1.viewTracks);
      // the engine list gained a clip only on track a
      expect(r2.engineTracks[1]).toBe(r1.engineTracks[1]);
      expect(r2.engineTracks[0].clips).toHaveLength(1);
    });

    it('a pending source settling elsewhere keeps the engine list as it was', () => {
      const ta = track('a', [{ id: 'c', src: 'a', duration: 1 }]);
      const tp = track('p', []);
      const r1 = resolveTracks([ta, tp], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks([ta, tp], new Map([['zzz', pending]]), 48000, r1.cache);
      expect(r2.engineTracks).toBe(r1.engineTracks);
      expect(r2.viewTracks).toBe(r1.viewTracks);
    });

    // Until the #812 review this gave a new track object; the provider then
    // rebuilt its engine for a parent that re-creates its track objects.
    it('a new input object for an unchanged track: the same track, same clip objects', () => {
      const buf = fakeBuffer(44100, 44100);
      const lc: LoadingClip = { id: 'c', src: 'a' };
      const sources: Sources = new Map([['a', loaded(buf)]]);
      const r1 = resolveTracks([track('t', [lc])], sources, 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks([track('t', [lc])], sources, 48000, r1.cache);
      expect(r2.engineTracks[0]).toBe(r1.engineTracks[0]);
      expect(r2.engineTracks[0].clips[0]).toBe(r1.engineTracks[0].clips[0]);
      // A changed field still gives a new one.
      const renamed = resolveTracks([track('t', [lc], { name: 'x' })], sources, 48000, r2.cache);
      expect(renamed.engineTracks[0]).not.toBe(r1.engineTracks[0]);
      expect(renamed.engineTracks[0].name).toBe('x');
    });

    it('a new buffer for a source makes a new clip', () => {
      const lc: LoadingClip = { id: 'c', src: 'a' };
      const t = track('t', [lc]);
      const r1 = resolveTracks(
        [t],
        new Map([['a', loaded(fakeBuffer(44100, 44100))]]),
        48000,
        EMPTY_RESOLVE_CACHE
      );
      const r2 = resolveTracks(
        [t],
        new Map([['a', loaded(fakeBuffer(44100, 44100))]]),
        48000,
        r1.cache
      );
      expect(r2.engineTracks[0].clips[0]).not.toBe(r1.engineTracks[0].clips[0]);
    });

    it('does not warn again for the same loading clip and buffer', () => {
      const warn = warnSpy();
      const buf = fakeBuffer(44100, 44100);
      const t = track('t', [{ id: 'c', src: 'a', offset: 5 }]);
      const sources: Sources = new Map([['a', loaded(buf)]]);
      const r1 = resolveTracks([t], sources, 48000, EMPTY_RESOLVE_CACHE);
      resolveTracks([t], sources, 48000, r1.cache);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does not mutate its input', () => {
      const lc: LoadingClip = { id: 'c', src: 'a', duration: 1 };
      const t = track('t', [lc]);
      resolveTracks([t], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(t.clips).toEqual([{ id: 'c', src: 'a', duration: 1 }]);
    });
  });

  // An engine track keeps its object while nothing the engine sees changed
  // (#812 review): the engine clips are the same objects and every other field
  // is equal. The provider compares engine tracks by identity, so a new object
  // for an unchanged track is a full rebuild of the engine.
  describe('the engine track of a track id keeps its identity across passes', () => {
    it('a placeholder recomputed at another sample rate: same engine track, same engine array', () => {
      const buf = fakeBuffer(44100, 44100);
      const a = track('a', [{ id: 'c', src: 'a' }]);
      const b = track('b', [{ id: 'd', src: 'b', duration: 3 }]);
      const sources: Sources = new Map([
        ['a', loaded(buf)],
        ['b', failed],
      ]);
      const r1 = resolveTracks([a, b], sources, 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks([a, b], sources, 44100, r1.cache);
      // The placeholder was made again at the new rate...
      expect(r2.viewTracks[1].clips[0].sampleRate).toBe(44100);
      expect(r2.viewTracks[1]).not.toBe(r1.viewTracks[1]);
      // ...and the engine saw nothing of it.
      expect(r2.engineTracks[1]).toBe(r1.engineTracks[1]);
      expect(r2.engineTracks).toBe(r1.engineTracks);
    });

    it('a new input object with the same clips and fields: the previous engine track', () => {
      const clip = createClip({ audioBuffer: fakeBuffer(48000, 48000), startSample: 0 });
      const t1 = track('t', [clip]);
      const r1 = resolveTracks([t1], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const t2 = { ...t1, clips: [clip] };
      const r2 = resolveTracks([t2], new Map(), 48000, r1.cache);
      expect(r2.engineTracks[0]).toBe(t1);
      expect(r2.engineTracks).toBe(r1.engineTracks);
      expect(r2.viewTracks[0]).toBe(t1);
      // And again from that pass: the object does not change hands.
      const r3 = resolveTracks([{ ...t1, clips: [clip] }], new Map(), 48000, r2.cache);
      expect(r3.engineTracks[0]).toBe(t1);
    });

    it('a new input object with one field changed: a new engine track', () => {
      const clip = createClip({ audioBuffer: fakeBuffer(48000, 48000), startSample: 0 });
      const t1 = track('t', [clip]);
      const r1 = resolveTracks([t1], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const renamed = { ...t1, name: 'other' };
      const r2 = resolveTracks([renamed], new Map(), 48000, r1.cache);
      expect(r2.engineTracks[0]).toBe(renamed);
      const extra = { ...t1, color: '#f00' } as PlaylistTrack;
      expect(resolveTracks([extra], new Map(), 48000, r1.cache).engineTracks[0]).toBe(extra);
    });

    it('a new input object with a clip replaced: a new engine track', () => {
      const t1 = track('t', [
        createClip({ audioBuffer: fakeBuffer(48000, 48000), startSample: 0 }),
      ]);
      const r1 = resolveTracks([t1], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const t2 = { ...t1, clips: [{ ...t1.clips[0] }] } as PlaylistTrack;
      expect(resolveTracks([t2], new Map(), 48000, r1.cache).engineTracks[0]).toBe(t2);
    });

    it('a new input object that gained a pending loading clip: the previous engine track; after the load a new one that keeps the earlier clip objects', () => {
      const clip = createClip({ audioBuffer: fakeBuffer(48000, 48000), startSample: 0 });
      const t1 = track('t', [clip]);
      const r1 = resolveTracks([t1], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const lc: LoadingClip = { id: 'new', src: 'n' };
      const t2: PlaylistTrack = { ...t1, clips: [...t1.clips, lc] };
      const r2 = resolveTracks([t2], new Map([['n', pending]]), 48000, r1.cache);
      expect(r2.engineTracks[0]).toBe(t1);
      expect(r2.engineTracks).toBe(r1.engineTracks);

      const buf = fakeBuffer(48000, 48000);
      const r3 = resolveTracks([t2], new Map([['n', loaded(buf)]]), 48000, r2.cache);
      expect(r3.engineTracks[0]).not.toBe(t1);
      expect(r3.engineTracks[0].clips).toHaveLength(2);
      expect(r3.engineTracks[0].clips[0]).toBe(clip);
      expect(r3.engineTracks[0].clips[1].audioBuffer).toBe(buf);
    });

    it('a seed that matches still wins over the previous engine track', () => {
      const clip = createClip({ audioBuffer: fakeBuffer(48000, 48000), startSample: 0 });
      const t1 = track('t', [clip]);
      const r1 = resolveTracks([t1], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const fromEngine: ClipTrack = { ...t1, clips: [clip] };
      const cache = seedResolved(r1.cache, fromEngine, fromEngine);
      const r2 = resolveTracks([fromEngine], new Map(), 48000, cache);
      expect(r2.engineTracks[0]).toBe(fromEngine);
      expect(r2.viewTracks[0]).toBe(fromEngine);
    });
  });

  describe('seedResolved', () => {
    it('returns a new cache object; the seed is visible through any cache sharing the maps', () => {
      const buf = fakeBuffer(44100, 44100);
      const t = track('t', [{ id: 'c', src: 'a' }]);
      const sources: Sources = new Map([['a', loaded(buf)]]);
      const r0 = resolveTracks([t], sources, 48000, EMPTY_RESOLVE_CACHE);
      const seeded: ClipTrack = { ...t, clips: r0.engineTracks[0].clips };
      const cache = seedResolved(r0.cache, t, seeded);
      expect(cache).not.toBe(r0.cache);
      const r1 = resolveTracks([t], sources, 48000, cache);
      expect(r1.engineTracks[0]).toBe(seeded);
      expect(r1.viewTracks[0]).toBe(seeded);
    });

    it('works from the empty cache', () => {
      const t = track('t', [{ id: 'c', src: 'a' }]);
      const seeded: ClipTrack = { ...t, clips: [] };
      const r = resolveTracks([t], new Map(), 48000, seedResolved(EMPTY_RESOLVE_CACHE, t, seeded));
      expect(r.engineTracks[0]).toBe(seeded);
    });

    it('a seed never hides a clip that loads later', () => {
      const t = track('t', [{ id: 'c', src: 'a', duration: 1 }]);
      const seeded: ClipTrack = { ...t, clips: [] };
      const cache = seedResolved(EMPTY_RESOLVE_CACHE, t, seeded);
      const r1 = resolveTracks([t], new Map(), 48000, cache);
      expect(r1.engineTracks[0]).toBe(seeded);
      const r2 = resolveTracks(
        [t],
        new Map([['a', loaded(fakeBuffer(44100, 44100))]]),
        48000,
        r1.cache
      );
      expect(r2.engineTracks[0].clips.map((c) => c.id)).toEqual(['c']);
      expect(r2.viewTracks[0].clips.map((c) => c.id)).toEqual(['c']);
      expect(r2.viewTracks[0].clips[0].audioBuffer).toBeDefined();
    });

    it('a seed holding the input clip is used until a loading clip arrives, then A is kept', () => {
      const buf = fakeBuffer(44100, 44100);
      const a = createClip({ audioBuffer: buf, startSample: 0 });
      const t = track('t', [a, { id: 'l', src: 'x' }]);
      const seeded: ClipTrack = { ...t, clips: [a] };
      const cache = seedResolved(EMPTY_RESOLVE_CACHE, t, seeded);
      const r1 = resolveTracks([t], new Map(), 48000, cache);
      expect(r1.engineTracks[0]).toBe(seeded);
      expect(r1.viewTracks[0]).toBe(seeded);
      const r2 = resolveTracks([t], new Map([['x', loaded(buf)]]), 48000, r1.cache);
      expect(r2.engineTracks[0]).not.toBe(seeded);
      expect(r2.engineTracks[0].clips.map((c) => c.id)).toEqual([a.id, 'l']);
      expect(r2.engineTracks[0].clips[0]).toBe(a);
      expect(r2.viewTracks[0]).toBe(r2.engineTracks[0]);
    });

    it('a stale seed (clips differ from the input) is not returned', () => {
      const buf = fakeBuffer(44100, 44100);
      const a = createClip({ audioBuffer: buf, startSample: 0 });
      const other = createClip({ audioBuffer: buf, startSample: 5 });
      const t = track('t', [a]);
      const seeded: ClipTrack = { ...t, clips: [other] };
      const r = resolveTracks([t], new Map(), 48000, seedResolved(EMPTY_RESOLVE_CACHE, t, seeded));
      expect(r.engineTracks[0]).toBe(t);
      expect(r.viewTracks[0]).toBe(t);
    });

    it('keeps a placeholder in the view when the input has one', () => {
      const t = track('t', [{ id: 'c', src: 'a', duration: 1 }]);
      const seeded: ClipTrack = { ...t, clips: [] };
      const r = resolveTracks([t], new Map(), 48000, seedResolved(EMPTY_RESOLVE_CACHE, t, seeded));
      expect(r.engineTracks[0]).toBe(seeded);
      expect(r.viewTracks[0]).not.toBe(seeded);
      expect(r.viewTracks[0].clips).toHaveLength(1);
    });
  });

  describe('a loading clip on a MIDI track', () => {
    it('is left out and reported', () => {
      const t = track('m', [{ id: 'bad', src: 'a', duration: 1 }], { kind: 'midi' });
      const r = resolveTracks([t], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(r.viewTracks[0].clips).toEqual([]);
      expect(r.engineTracks[0].clips).toEqual([]);
      expect(r.rejected).toEqual([{ trackId: 'm', clipId: 'bad' }]);
      const r2 = resolveTracks([t], new Map(), 48000, r.cache);
      expect(r2.rejected).toBe(r.rejected);
    });

    it('reports nothing for tracks without such a clip, with a shared empty array', () => {
      const r1 = resolveTracks([track('a', [])], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      const r2 = resolveTracks([track('b', [])], new Map(), 48000, EMPTY_RESOLVE_CACHE);
      expect(r1.rejected).toEqual([]);
      expect(r1.rejected).toBe(r2.rejected);
    });
  });

  it('typed: results are ClipTrack with AudioClip clips', () => {
    const r = resolveTracks([], new Map(), 48000, EMPTY_RESOLVE_CACHE);
    const _check: ClipTrack[] = r.viewTracks;
    const _clips: AudioClip[] = _check.flatMap((t) => t.clips);
    expect(_clips).toEqual([]);
    expect(r.viewTracks).toEqual([]);
  });
});
