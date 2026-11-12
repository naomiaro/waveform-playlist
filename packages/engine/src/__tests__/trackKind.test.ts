import { describe, it, expect, vi } from 'vitest';
import type { AudioClip, ClipTrack, TrackKind } from '@waveform-playlist/core';
import { PlaylistEngine } from '../PlaylistEngine';
import type { PlayoutAdapter } from '../types';

function audioClip(id: string): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: 44100,
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
  };
}

function midiClip(id: string): AudioClip {
  return {
    ...audioClip(id),
    midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
  };
}

function makeTrack(id: string, kind: TrackKind, clips: AudioClip[]): ClipTrack {
  return { id, kind, name: `Track ${id}`, clips, muted: false, soloed: false, volume: 1, pan: 0 };
}

function createMockAdapter(): PlayoutAdapter {
  return {
    audioContext: { sampleRate: 44100, state: 'running' } as unknown as AudioContext,
    ppqn: 960,
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    addTrack: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    isPlaying: vi.fn().mockReturnValue(false),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
}

function setup() {
  const adapter = createMockAdapter();
  const engine = new PlaylistEngine({ adapter, sampleRate: 44100 });
  const good = makeTrack('a', 'audio', [audioClip('c1')]);
  engine.setTracks([good]);
  vi.mocked(adapter.setTracks).mockClear();
  return { adapter, engine, good };
}

describe('a track holds one kind of clip (#756)', () => {
  it('setTracks throws on a mixed track and leaves the engine and adapter as they were', () => {
    const { adapter, engine, good } = setup();
    const before = engine.getState();
    const mixed = makeTrack('b', 'audio', [audioClip('c2'), midiClip('c3')]);

    expect(() => engine.setTracks([good, mixed])).toThrow(/audio track.*midi clip/s);

    expect(adapter.setTracks).not.toHaveBeenCalled();
    expect(engine.getState().tracks.map((t) => t.id)).toEqual(['a']);
    expect(engine.getState().tracksVersion).toBe(before.tracksVersion);
  });

  it('addTrack throws on an audio clip in a MIDI track, without an undo step', () => {
    const { adapter, engine } = setup();

    expect(() => engine.addTrack(makeTrack('m', 'midi', [audioClip('c2')]))).toThrow(
      /midi track.*audio clip/s
    );

    expect(adapter.addTrack).not.toHaveBeenCalled();
    expect(engine.getState().tracks).toHaveLength(1);
    expect(engine.canUndo).toBe(false);
  });

  it('updateTrack throws when the replacement mixes kinds, without an undo step', () => {
    const { adapter, engine, good } = setup();

    expect(() =>
      engine.updateTrack('a', { ...good, clips: [...good.clips, midiClip('c2')] })
    ).toThrow(/audio track.*midi clip/s);

    expect(adapter.updateTrack).not.toHaveBeenCalled();
    expect(engine.getState().tracks[0].clips).toHaveLength(1);
    expect(engine.canUndo).toBe(false);
  });

  it('accepts audio tracks, MIDI tracks and empty tracks of either kind', () => {
    const { adapter, engine, good } = setup();
    const midi = makeTrack('m', 'midi', [midiClip('c2')]);

    engine.setTracks([good, midi, makeTrack('e', 'midi', [])]);
    engine.addTrack(makeTrack('e2', 'audio', []));
    engine.updateTrack('m', { ...midi, clips: [midiClip('c2'), midiClip('c3')] });

    expect(adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(adapter.addTrack).toHaveBeenCalledTimes(1);
    expect(adapter.updateTrack).toHaveBeenCalledTimes(1);
    expect(engine.getState().tracks.map((t) => t.kind)).toEqual(['audio', 'midi', 'midi', 'audio']);
  });
});
