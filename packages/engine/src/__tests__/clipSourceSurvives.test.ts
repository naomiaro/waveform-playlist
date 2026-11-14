import { describe, it, expect, beforeEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { ClipSource, ClipTrack } from '@waveform-playlist/core';
import { PlaylistEngine } from '../PlaylistEngine';
import { splitClip } from '../operations/clipOperations';

// A clip the provider loaded carries `src`; every operation that makes a clip
// from another must keep it, or the provider cannot tell the clip is loaded.
function makeTrack(src: ClipSource): ClipTrack {
  const clip = {
    ...createClip({
      startSample: 1000,
      durationSamples: 48000,
      offsetSamples: 0,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
    }),
    src,
  };
  return createTrack({ name: 'T', clips: [clip] });
}

function firstClipSrc(engine: PlaylistEngine): ClipSource | undefined {
  return engine.getState().tracks[0].clips[0].src;
}

describe('a clip keeps its src through engine operations', () => {
  let engine: PlaylistEngine;
  let track: ClipTrack;
  let trackId: string;
  let clipId: string;

  beforeEach(() => {
    engine = new PlaylistEngine({ sampleRate: 48000 });
    track = makeTrack('a.mp3');
    engine.setTracks([track]);
    trackId = track.id;
    clipId = track.clips[0].id;
  });

  it('setTracks', () => {
    expect(firstClipSrc(engine)).toBe('a.mp3');
  });

  it('addTrack', () => {
    const e = new PlaylistEngine({ sampleRate: 48000 });
    e.addTrack(track);
    expect(firstClipSrc(e)).toBe('a.mp3');
  });

  it('updateTrack with a track', () => {
    engine.updateTrack(trackId, { ...track, name: 'renamed' });
    expect(firstClipSrc(engine)).toBe('a.mp3');
  });

  it('moveClip', () => {
    engine.moveClip(trackId, clipId, 500);
    expect(engine.getState().tracks[0].clips[0].startSample).toBe(1500);
    expect(firstClipSrc(engine)).toBe('a.mp3');
  });

  it('trimClip, left and right', () => {
    const before = engine.getState().tracks[0].clips[0];
    engine.trimClip(trackId, clipId, 'left', 100);
    const afterLeft = engine.getState().tracks[0].clips[0];
    expect(afterLeft.startSample).not.toBe(before.startSample);
    expect(firstClipSrc(engine)).toBe('a.mp3');
    engine.trimClip(trackId, clipId, 'right', -100);
    const afterRight = engine.getState().tracks[0].clips[0];
    expect(afterRight.durationSamples).not.toBe(afterLeft.durationSamples);
    expect(firstClipSrc(engine)).toBe('a.mp3');
  });

  it('splitClip keeps src on both halves', () => {
    engine.splitClip(trackId, clipId, 25000);
    const clips = engine.getState().tracks[0].clips;
    expect(clips).toHaveLength(2);
    expect(clips[0].src).toBe('a.mp3');
    expect(clips[1].src).toBe('a.mp3');
  });

  it('splitClip gives both halves the same Blob object', () => {
    const blob = new Blob(['x']);
    const e = new PlaylistEngine({ sampleRate: 48000 });
    const t = makeTrack(blob);
    e.setTracks([t]);
    e.splitClip(t.id, t.clips[0].id, 25000);
    const clips = e.getState().tracks[0].clips;
    expect(clips[0].src).toBe(blob);
    expect(clips[1].src).toBe(blob);
  });

  it('splitClip adds no src key when the clip had none', () => {
    const plain = createTrack({
      name: 'P',
      clips: [
        createClip({
          startSample: 0,
          durationSamples: 48000,
          sampleRate: 48000,
          sourceDurationSamples: 96000,
        }),
      ],
    });
    const { left, right } = splitClip(plain.clips[0], 24000);
    expect('src' in left).toBe(false);
    expect('src' in right).toBe(false);
  });

  it('undo and redo', () => {
    engine.moveClip(trackId, clipId, 500);
    engine.undo();
    expect(firstClipSrc(engine)).toBe('a.mp3');
    engine.redo();
    expect(firstClipSrc(engine)).toBe('a.mp3');
  });

  it('the splitClip operation, called directly', () => {
    const { left, right } = splitClip(track.clips[0], 25000);
    expect(left.src).toBe('a.mp3');
    expect(right.src).toBe('a.mp3');
  });
});
