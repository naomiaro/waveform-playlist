// #812: clips the view draws that the engine does not hold yet (a source that
// finished loading during a trim drag).
import { describe, it, expect } from 'vitest';
import type { AudioClip, ClipTrack, LoadingClip, PlaylistTrack } from '@waveform-playlist/core';
import {
  hasUnappliedContent,
  keepUnappliedClipsLoading,
  sameElements,
} from '../utils/unappliedClips';

const RATE = 48000;

function clip(id: string, over: Partial<AudioClip> = {}): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: RATE,
    offsetSamples: 0,
    sampleRate: RATE,
    sourceDurationSamples: RATE,
    gain: 1,
    ...over,
  } as AudioClip;
}

function track(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, kind: 'audio', clips } as ClipTrack;
}

const BUFFER = { sampleRate: RATE, length: RATE } as unknown as AudioBuffer;

describe('sameElements', () => {
  it('compares by identity and order', () => {
    const a = {};
    const b = {};
    expect(sameElements([a, b], [a, b])).toBe(true);
    expect(sameElements([a, b], [b, a])).toBe(false);
    expect(sameElements([a], [a, b])).toBe(false);
    expect(sameElements([], [])).toBe(true);
  });
});

describe('hasUnappliedContent', () => {
  it('is false for the same tracks and for a clip that was only trimmed', () => {
    const applied = [track('a', [clip('a1')])];
    expect(hasUnappliedContent(applied, applied)).toBe(false);
    const trimmed = [track('a', [clip('a1', { durationSamples: RATE / 2 })])];
    expect(hasUnappliedContent(applied, trimmed)).toBe(false);
  });

  it('is true for a clip id the applied track does not hold', () => {
    const applied = [track('a', [clip('a1')]), track('b', [])];
    const current = [applied[0], track('b', [clip('b1')])];
    expect(hasUnappliedContent(applied, current)).toBe(true);
  });

  it('is true for a track id that was not applied', () => {
    const applied = [track('a', [clip('a1')])];
    expect(hasUnappliedContent(applied, [applied[0], track('b', [])])).toBe(true);
  });

  it('is false when a track or a clip went away', () => {
    const applied = [track('a', [clip('a1'), clip('a2')]), track('b', [])];
    expect(hasUnappliedContent(applied, [track('a', [clip('a1')])])).toBe(false);
  });
});

describe('keepUnappliedClipsLoading', () => {
  const loading: LoadingClip = { id: 'b1', src: '/b.mp3' };
  const latest: PlaylistTrack[] = [
    track('a', [clip('a1')]),
    { ...track('b', []), clips: [loading] },
  ];

  it('hands a resolved clip the engine does not hold back as its loading clip', () => {
    const resolved = clip('b1', { audioBuffer: BUFFER, src: '/b.mp3' });
    const outgoing = [track('a', [clip('a1')]), track('b', [resolved])];
    const engine = [track('a', [clip('a1')]), track('b', [])];
    const kept = keepUnappliedClipsLoading(outgoing, latest, engine);
    expect(kept[1].clips).toEqual([loading]);
    expect(kept[1].clips[0]).toBe(loading);
    expect(kept[0]).toBe(outgoing[0]);
  });

  it('keeps a resolved clip the engine holds: a trim of it must reach the app', () => {
    const trimmed = clip('b1', { audioBuffer: BUFFER, src: '/b.mp3', durationSamples: 10 });
    const outgoing = [track('a', [clip('a1')]), track('b', [trimmed])];
    const engine = [track('a', [clip('a1')]), track('b', [clip('b1', { audioBuffer: BUFFER })])];
    expect(keepUnappliedClipsLoading(outgoing, latest, engine)).toBe(outgoing);
  });

  it('leaves a clip alone when the app no longer names it as loading', () => {
    const resolved = clip('b1', { audioBuffer: BUFFER, src: '/b.mp3' });
    const outgoing = [track('b', [resolved])];
    const appHasResolved: PlaylistTrack[] = [track('b', [resolved])];
    expect(keepUnappliedClipsLoading(outgoing, appHasResolved, [track('b', [])])).toBe(outgoing);
  });

  it('leaves a track alone that the app or the engine does not know', () => {
    const resolved = clip('b1', { audioBuffer: BUFFER, src: '/b.mp3' });
    const outgoing = [track('b', [resolved])];
    expect(keepUnappliedClipsLoading(outgoing, [], [track('b', [])])).toBe(outgoing);
    expect(keepUnappliedClipsLoading(outgoing, latest, [])).toBe(outgoing);
  });

  it('keeps a loading clip that is already in the outgoing track', () => {
    const outgoing: PlaylistTrack[] = [{ ...track('b', []), clips: [loading] }];
    expect(keepUnappliedClipsLoading(outgoing, latest, [track('b', [])])).toBe(outgoing);
  });
});
