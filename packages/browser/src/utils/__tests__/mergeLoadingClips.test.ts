import { describe, it, expect } from 'vitest';
import type { AudioClip, ClipTrack, LoadingClip, PlaylistTrack } from '@waveform-playlist/core';
import { mergeLoadingClips } from '../mergeLoadingClips';

const audio = (id: string): AudioClip =>
  ({
    id,
    sampleRate: 48000,
    startSample: 0,
    durationSamples: 100,
    offsetSamples: 0,
    gain: 1,
  }) as AudioClip;

const loading = (id: string): LoadingClip => ({ id, src: `${id}.mp3` });

const base = { kind: 'audio', muted: false, soloed: false, volume: 1, pan: 0 } as const;
const ptrack = (id: string, clips: PlaylistTrack['clips'], name = id): PlaylistTrack => ({
  ...base,
  id,
  name,
  clips,
});
const ctrack = (id: string, clips: AudioClip[], name = id): ClipTrack => ({
  ...base,
  id,
  name,
  clips,
});

const none: ReadonlySet<string> = new Set();

describe('mergeLoadingClips', () => {
  it('returns the outgoing array when nothing changes', () => {
    const a = audio('a');
    const outgoing = [ctrack('t', [a])];
    const result = mergeLoadingClips(outgoing, [ptrack('t', [a])], none);
    expect(result).toBe(outgoing);
  });

  it('removes a placeholder and puts its loading clip back in the same position', () => {
    const a = audio('a');
    const c = audio('c');
    const l = loading('l');
    const result = mergeLoadingClips(
      [ctrack('t', [a, audio('l'), c])],
      [ptrack('t', [a, l, c])],
      new Set(['l'])
    );
    expect(result[0].clips).toEqual([a, l, c]);
    expect(result[0].clips[1]).toBe(l);
  });

  it('appends a loading clip absent from the outgoing track, in the order of latest', () => {
    const a = audio('a');
    const l1 = loading('l1');
    const l2 = loading('l2');
    const result = mergeLoadingClips([ctrack('t', [a])], [ptrack('t', [l1, a, l2])], none);
    expect(result[0].clips).toEqual([a, l1, l2]);
    expect(result[0].clips[1]).toBe(l1);
    expect(result[0].clips[2]).toBe(l2);
  });

  it('does not put back a loading clip whose id is present (resolved in the engine)', () => {
    const resolved = audio('l');
    const outgoing = [ctrack('t', [resolved])];
    const result = mergeLoadingClips(outgoing, [ptrack('t', [loading('l')])], none);
    expect(result).toBe(outgoing);
    expect(result[0].clips).toEqual([resolved]);
  });

  it('does not re-add a track the outgoing list lacks', () => {
    const outgoing = [ctrack('t', [audio('a')])];
    const result = mergeLoadingClips(
      outgoing,
      [ptrack('t', [audio('a')]), ptrack('gone', [loading('x')])],
      none
    );
    expect(result.map((t) => t.id)).toEqual(['t']);
  });

  it('passes through a track unknown to latest', () => {
    const t = ctrack('new', [audio('a')]);
    const outgoing = [t];
    const result = mergeLoadingClips(outgoing, [], none);
    expect(result).toBe(outgoing);
    expect(result[0]).toBe(t);
  });

  it('drops a placeholder whose loading clip the app removed', () => {
    const a = audio('a');
    const result = mergeLoadingClips(
      [ctrack('t', [a, audio('l')])],
      [ptrack('t', [a])],
      new Set(['l'])
    );
    expect(result[0].clips).toEqual([a]);
  });

  it('keeps the non-clip fields of the outgoing track', () => {
    const l = loading('l');
    const result = mergeLoadingClips(
      [ctrack('t', [], 'engine name')],
      [ptrack('t', [l], 'app name')],
      none
    );
    expect(result[0].name).toBe('engine name');
    expect(result[0].clips).toEqual([l]);
  });

  it('changes only the track that needs it', () => {
    const t1 = ctrack('t1', [audio('a')]);
    const t2 = ctrack('t2', [audio('b')]);
    const result = mergeLoadingClips(
      [t1, t2],
      [ptrack('t1', [audio('a')]), ptrack('t2', [audio('b'), loading('l')])],
      none
    );
    expect(result[0]).toBe(t1);
    expect(result[1]).not.toBe(t2);
    expect(result[1].clips).toHaveLength(2);
  });

  it('handles loaded, placeholder and engine clips in mixed order', () => {
    const a = audio('a');
    const e = audio('e');
    const l1 = loading('l1');
    const l2 = loading('l2');
    const result = mergeLoadingClips(
      [ctrack('t', [e, audio('l1'), a])],
      [ptrack('t', [a, l1, l2])],
      new Set(['l1'])
    );
    expect(result[0].clips).toEqual([e, l1, a, l2]);
    expect(result[0].clips[1]).toBe(l1);
    expect(result[0].clips[3]).toBe(l2);
  });

  it('strips placeholders from a track latest does not know', () => {
    const outgoing = [ctrack('x', [audio('p')])];
    const result = mergeLoadingClips(outgoing, [], new Set(['p']));
    expect(result[0].clips).toEqual([]);
    expect(result[0].id).toBe('x');
  });

  it('returns the same track and array for an unknown track with no placeholder', () => {
    const outgoing = [ctrack('x', [audio('p')])];
    const result = mergeLoadingClips(outgoing, [], none);
    expect(result).toBe(outgoing);
    expect(result[0]).toBe(outgoing[0]);
  });

  it('keeps a clip that has a buffer even when its id is in a stale placeholder set', () => {
    const resolved = { ...audio('L1'), audioBuffer: { length: 1 } as AudioBuffer };
    const outgoing = [ctrack('t', [resolved])];
    const result = mergeLoadingClips(outgoing, [ptrack('t', [loading('L1')])], new Set(['L1']));
    expect(result).toBe(outgoing);
    expect(result[0]).toBe(outgoing[0]);
    expect(result[0].clips[0]).toBe(resolved);
  });

  it('with two loading clips of one id in latest, the later one is put back (pinned)', () => {
    const first = loading('d');
    const second = loading('d');
    const result = mergeLoadingClips([ctrack('t', [])], [ptrack('t', [first, second])], none);
    expect(result[0].clips).toHaveLength(1);
    expect(result[0].clips[0]).toBe(second);
  });

  it('with two tracks of one id in latest, the later one supplies the loading clips (pinned)', () => {
    const l1 = loading('l1');
    const l2 = loading('l2');
    const result = mergeLoadingClips(
      [ctrack('t', [])],
      [ptrack('t', [l1]), ptrack('t', [l2])],
      none
    );
    expect(result[0].clips).toEqual([l2]);
  });
});
