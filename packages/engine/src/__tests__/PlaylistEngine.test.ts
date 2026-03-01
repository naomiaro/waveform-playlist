import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import { PlaylistEngine } from '../PlaylistEngine';
import type { PlayoutAdapter } from '../types';

function makeClip(
  overrides: Partial<AudioClip> & {
    id: string;
    startSample: number;
    durationSamples: number;
  }
): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    ...overrides,
  };
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return {
    id,
    name: `Track ${id}`,
    clips,
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  };
}

function createMockAdapter(): PlayoutAdapter {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
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
    dispose: vi.fn(),
  };
}

describe('PlaylistEngine', () => {
  describe('construction', () => {
    it('initializes with defaults', () => {
      const engine = new PlaylistEngine();
      const state = engine.getState();
      expect(state.tracks).toEqual([]);
      expect(state.sampleRate).toBe(44100);
      // Default samplesPerPixel (1000) is not in default zoom levels [256..8192],
      // so findClosestZoomIndex picks the closest value (1024)
      expect(state.samplesPerPixel).toBe(1024);
      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.selectedTrackId).toBeNull();
      engine.dispose();
    });

    it('accepts custom options', () => {
      const engine = new PlaylistEngine({
        sampleRate: 48000,
        samplesPerPixel: 512,
        zoomLevels: [256, 512, 1024],
      });
      const state = engine.getState();
      expect(state.sampleRate).toBe(48000);
      expect(state.samplesPerPixel).toBe(512);
      engine.dispose();
    });

    it('throws on empty zoomLevels', () => {
      expect(() => new PlaylistEngine({ zoomLevels: [] })).toThrow('zoomLevels must not be empty');
    });

    it('returns a defensive copy of tracks from getState', () => {
      const engine = new PlaylistEngine();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      engine.setTracks([makeTrack('t1', [clip])]);

      const state1 = engine.getState();
      const state2 = engine.getState();
      // Same content but different references
      expect(state1.tracks).toEqual(state2.tracks);
      expect(state1.tracks).not.toBe(state2.tracks);
      expect(state1.tracks[0]).not.toBe(state2.tracks[0]);
      engine.dispose();
    });
  });

  describe('track management', () => {
    let engine: PlaylistEngine;
    beforeEach(() => {
      engine = new PlaylistEngine();
    });

    it('sets tracks and emits statechange', () => {
      const listener = vi.fn();
      engine.on('statechange', listener);
      const tracks = [
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ];
      engine.setTracks(tracks);
      expect(engine.getState().tracks).toEqual(tracks);
      expect(engine.getState().duration).toBe(1);
      expect(listener).toHaveBeenCalledTimes(1);
      engine.dispose();
    });

    it('adds a track', () => {
      engine.addTrack(makeTrack('t1', []));
      expect(engine.getState().tracks).toHaveLength(1);
      engine.dispose();
    });

    it('removes a track', () => {
      engine.setTracks([makeTrack('t1', [])]);
      engine.removeTrack('t1');
      expect(engine.getState().tracks).toHaveLength(0);
      engine.dispose();
    });

    it('clears selection when selected track is removed', () => {
      engine.setTracks([makeTrack('t1', [])]);
      engine.selectTrack('t1');
      engine.removeTrack('t1');
      expect(engine.getState().selectedTrackId).toBeNull();
      engine.dispose();
    });

    it('selects a track', () => {
      engine.selectTrack('t1');
      expect(engine.getState().selectedTrackId).toBe('t1');
      engine.selectTrack(null);
      expect(engine.getState().selectedTrackId).toBeNull();
      engine.dispose();
    });

    it('selectTrack does not emit when track unchanged', () => {
      engine.selectTrack('t1');
      const listener = vi.fn();
      engine.on('statechange', listener);
      engine.selectTrack('t1'); // same track
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });

    it('copies input tracks to prevent external mutation', () => {
      const tracks = [makeTrack('t1', [])];
      engine.setTracks(tracks);
      // Mutate the original array after setTracks
      tracks.push(makeTrack('t2', []));
      expect(engine.getState().tracks).toHaveLength(1);
      engine.dispose();
    });

    it('removeTrack with non-existent ID does not emit', () => {
      engine.setTracks([makeTrack('t1', [])]);
      const listener = vi.fn();
      engine.on('statechange', listener);
      listener.mockClear();
      engine.removeTrack('nonexistent');
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });
  });

  describe('clip editing', () => {
    let engine: PlaylistEngine;
    beforeEach(() => {
      const clip1 = makeClip({
        id: 'c1',
        startSample: 0,
        durationSamples: 44100,
        name: 'Clip 1',
      });
      const clip2 = makeClip({
        id: 'c2',
        startSample: 88200,
        durationSamples: 44100,
      });
      engine = new PlaylistEngine();
      engine.setTracks([makeTrack('t1', [clip1, clip2])]);
    });

    it('moves a clip with collision constraints', () => {
      engine.moveClip('t1', 'c1', 22050);
      const clip = engine.getState().tracks[0].clips[0];
      expect(clip.startSample).toBe(22050);
      engine.dispose();
    });

    it('prevents clip overlap on move', () => {
      engine.moveClip('t1', 'c1', 100000);
      const clip = engine.getState().tracks[0].clips[0];
      // c1 (duration 44100) cannot overlap c2 (starts at 88200)
      // max position = 88200 - 44100 = 44100
      expect(clip.startSample).toBe(88200 - 44100);
      engine.dispose();
    });

    it('splits a clip', () => {
      engine.splitClip('t1', 'c1', 22050);
      const track = engine.getState().tracks[0];
      expect(track.clips).toHaveLength(3);
      expect(track.clips[0].name).toBe('Clip 1 (1)');
      expect(track.clips[1].name).toBe('Clip 1 (2)');
      engine.dispose();
    });

    it('trims right boundary', () => {
      engine.trimClip('t1', 'c1', 'right', -22050);
      const clip = engine.getState().tracks[0].clips[0];
      expect(clip.durationSamples).toBe(22050);
      engine.dispose();
    });

    it('trims left boundary', () => {
      engine.trimClip('t1', 'c1', 'left', 11025);
      const clip = engine.getState().tracks[0].clips[0];
      expect(clip.startSample).toBe(11025);
      expect(clip.offsetSamples).toBe(11025);
      expect(clip.durationSamples).toBe(44100 - 11025);
      engine.dispose();
    });

    it('does not emit when move constrained to zero delta', () => {
      // c1 starts at 0, moving left by -1000 gets clamped to 0
      const listener = vi.fn();
      engine.on('statechange', listener);
      listener.mockClear();
      engine.moveClip('t1', 'c1', -1000);
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });

    it('does not emit when trim constrained to zero delta', () => {
      // c1 starts at 0 with offsetSamples 0, trimming left further left is clamped to 0
      const listener = vi.fn();
      engine.on('statechange', listener);
      listener.mockClear();
      engine.trimClip('t1', 'c1', 'left', -1000);
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });

    it('ignores operations on non-existent track without emitting', () => {
      const listener = vi.fn();
      engine.on('statechange', listener);
      listener.mockClear(); // clear from setTracks in beforeEach

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      engine.moveClip('nonexistent', 'c1', 1000);
      engine.splitClip('nonexistent', 'c1', 22050);
      engine.trimClip('nonexistent', 'c1', 'left', 1000);
      expect(listener).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(3);
      warnSpy.mockRestore();
      engine.dispose();
    });

    it('ignores operations on non-existent clip without emitting', () => {
      const listener = vi.fn();
      engine.on('statechange', listener);
      listener.mockClear();

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      engine.moveClip('t1', 'nonexistent', 1000);
      engine.splitClip('t1', 'nonexistent', 22050);
      engine.trimClip('t1', 'nonexistent', 'left', 1000);
      expect(listener).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(3);
      warnSpy.mockRestore();
      engine.dispose();
    });
  });

  describe('tracksVersion counter', () => {
    it('starts at 0', () => {
      const engine = new PlaylistEngine();
      expect(engine.getState().tracksVersion).toBe(0);
      engine.dispose();
    });

    it('increments on setTracks, addTrack, removeTrack', () => {
      const engine = new PlaylistEngine();
      engine.setTracks([makeTrack('t1', [])]);
      expect(engine.getState().tracksVersion).toBe(1);

      engine.addTrack(makeTrack('t2', []));
      expect(engine.getState().tracksVersion).toBe(2);

      engine.removeTrack('t1');
      expect(engine.getState().tracksVersion).toBe(3);
      engine.dispose();
    });

    it('increments on moveClip, trimClip, splitClip', () => {
      const engine = new PlaylistEngine();
      const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 44100, name: 'C1' });
      engine.setTracks([makeTrack('t1', [clip])]);
      const versionAfterSet = engine.getState().tracksVersion;

      engine.moveClip('t1', 'c1', 1000);
      expect(engine.getState().tracksVersion).toBe(versionAfterSet + 1);

      engine.trimClip('t1', 'c1', 'right', -5000);
      expect(engine.getState().tracksVersion).toBe(versionAfterSet + 2);

      engine.splitClip('t1', 'c1', engine.getState().tracks[0].clips[0].startSample + 10000);
      expect(engine.getState().tracksVersion).toBe(versionAfterSet + 3);
      engine.dispose();
    });

    it('does not increment on selection, zoom, volume, or loop changes', () => {
      const engine = new PlaylistEngine({ zoomLevels: [256, 512, 1024] });
      engine.setTracks([makeTrack('t1', [])]);
      const version = engine.getState().tracksVersion;

      engine.setSelection(1, 2);
      engine.setLoopRegion(1, 3);
      engine.setLoopEnabled(true);
      engine.setMasterVolume(0.5);
      engine.zoomIn();
      engine.selectTrack('t1');

      expect(engine.getState().tracksVersion).toBe(version);
      engine.dispose();
    });

    it('does not increment on no-op mutations', () => {
      const engine = new PlaylistEngine();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      engine.setTracks([makeTrack('t1', [clip])]);
      const version = engine.getState().tracksVersion;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Move constrained to 0 (already at left edge)
      engine.moveClip('t1', 'c1', -1000);
      // Trim constrained to 0 (already at left edge)
      engine.trimClip('t1', 'c1', 'left', -1000);
      // Non-existent track/clip (produces console.warn)
      engine.moveClip('nope', 'c1', 1000);
      engine.splitClip('t1', 'nope', 22050);

      warnSpy.mockRestore();
      expect(engine.getState().tracksVersion).toBe(version);
      engine.dispose();
    });
  });

  describe('clip editing adapter sync', () => {
    it('moveClip syncs adapter with updated tracks', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      const clip2 = makeClip({ id: 'c2', startSample: 88200, durationSamples: 44100 });
      engine.setTracks([makeTrack('t1', [clip1, clip2])]);
      (adapter.setTracks as ReturnType<typeof vi.fn>).mockClear();

      engine.moveClip('t1', 'c1', 22050);
      expect(adapter.setTracks).toHaveBeenCalledTimes(1);
      const tracks = (adapter.setTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(tracks[0].clips[0].startSample).toBe(22050);
      engine.dispose();
    });

    it('trimClip syncs adapter with updated tracks', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      engine.setTracks([makeTrack('t1', [clip])]);
      (adapter.setTracks as ReturnType<typeof vi.fn>).mockClear();

      engine.trimClip('t1', 'c1', 'right', -22050);
      expect(adapter.setTracks).toHaveBeenCalledTimes(1);
      const tracks = (adapter.setTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(tracks[0].clips[0].durationSamples).toBe(22050);
      engine.dispose();
    });

    it('splitClip syncs adapter with updated tracks', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100, name: 'Clip 1' });
      engine.setTracks([makeTrack('t1', [clip])]);
      (adapter.setTracks as ReturnType<typeof vi.fn>).mockClear();

      engine.splitClip('t1', 'c1', 22050);
      expect(adapter.setTracks).toHaveBeenCalledTimes(1);
      const tracks = (adapter.setTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(tracks[0].clips).toHaveLength(2);
      // Verify left clip: starts at 0, duration up to split point
      expect(tracks[0].clips[0].startSample).toBe(0);
      expect(tracks[0].clips[0].durationSamples).toBe(22050);
      expect(tracks[0].clips[0].offsetSamples).toBe(0);
      expect(tracks[0].clips[0].name).toBe('Clip 1 (1)');
      // Verify right clip: starts at split point, remaining duration
      expect(tracks[0].clips[1].startSample).toBe(22050);
      expect(tracks[0].clips[1].durationSamples).toBe(22050);
      expect(tracks[0].clips[1].offsetSamples).toBe(22050);
      expect(tracks[0].clips[1].name).toBe('Clip 1 (2)');
      engine.dispose();
    });

    it('no-op operations do not call adapter.setTracks', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      engine.setTracks([makeTrack('t1', [clip])]);
      (adapter.setTracks as ReturnType<typeof vi.fn>).mockClear();

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Zero-delta move (already at left edge, constrained to 0)
      engine.moveClip('t1', 'c1', -1000);
      expect(adapter.setTracks).not.toHaveBeenCalled();

      // Zero-delta trim (already at left edge)
      engine.trimClip('t1', 'c1', 'left', -1000);
      expect(adapter.setTracks).not.toHaveBeenCalled();

      // Non-existent track
      engine.moveClip('nope', 'c1', 1000);
      expect(adapter.setTracks).not.toHaveBeenCalled();

      // Non-existent clip for split
      engine.splitClip('t1', 'nope', 22050);
      expect(adapter.setTracks).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      engine.dispose();
    });
  });

  describe('zoom', () => {
    it('zooms in and out', () => {
      const levels = [256, 512, 1024, 2048];
      const engine = new PlaylistEngine({
        samplesPerPixel: 1024,
        zoomLevels: levels,
      });
      engine.zoomIn();
      expect(engine.getState().samplesPerPixel).toBe(512);
      expect(engine.getState().canZoomIn).toBe(true);
      engine.zoomIn();
      expect(engine.getState().samplesPerPixel).toBe(256);
      expect(engine.getState().canZoomIn).toBe(false);
      engine.zoomOut();
      expect(engine.getState().samplesPerPixel).toBe(512);
      engine.dispose();
    });

    it('does nothing when zooming past limits', () => {
      const engine = new PlaylistEngine({
        samplesPerPixel: 256,
        zoomLevels: [256, 512],
      });
      const listener = vi.fn();
      engine.on('statechange', listener);
      engine.zoomIn(); // Already at min
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });

    it('setZoomLevel changes to closest level', () => {
      const engine = new PlaylistEngine({
        samplesPerPixel: 256,
        zoomLevels: [256, 512, 1024, 2048],
      });
      engine.setZoomLevel(900); // Closest to 1024
      expect(engine.getState().samplesPerPixel).toBe(1024);
      engine.dispose();
    });

    it('setZoomLevel does not emit when level unchanged', () => {
      const engine = new PlaylistEngine({
        samplesPerPixel: 1024,
        zoomLevels: [256, 512, 1024, 2048],
      });
      const listener = vi.fn();
      engine.on('statechange', listener);
      engine.setZoomLevel(1024); // Same level
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });
  });

  describe('playback delegation', () => {
    it('delegates play/pause/stop to adapter', async () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      engine.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 441000 })]),
      ]);
      await engine.play(1.5);
      expect(adapter.play).toHaveBeenCalledWith(1.5, undefined);
      engine.pause();
      expect(adapter.pause).toHaveBeenCalled();
      engine.stop();
      expect(adapter.stop).toHaveBeenCalled();
      engine.dispose();
    });

    it('delegates track audio controls to adapter', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      engine.setTrackVolume('t1', 0.5);
      expect(adapter.setTrackVolume).toHaveBeenCalledWith('t1', 0.5);
      engine.setTrackMute('t1', true);
      expect(adapter.setTrackMute).toHaveBeenCalledWith('t1', true);
      engine.setTrackSolo('t1', true);
      expect(adapter.setTrackSolo).toHaveBeenCalledWith('t1', true);
      engine.setTrackPan('t1', -0.5);
      expect(adapter.setTrackPan).toHaveBeenCalledWith('t1', -0.5);
      engine.dispose();
    });

    it('delegates setMasterVolume to adapter', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      engine.setMasterVolume(0.75);
      expect(adapter.setMasterVolume).toHaveBeenCalledWith(0.75);
      engine.dispose();
    });

    it('works without adapter (state-only mode)', async () => {
      const engine = new PlaylistEngine();
      await engine.play();
      engine.pause();
      engine.stop();
      engine.dispose();
    });

    it('pause captures currentTime from adapter', async () => {
      const adapter = createMockAdapter();
      (adapter.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(3.5);
      const engine = new PlaylistEngine({ adapter });
      engine.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 441000 })]),
      ]);
      await engine.play();
      engine.pause();
      expect(engine.getState().currentTime).toBe(3.5);
      engine.dispose();
    });

    it('updates currentTime on seek', () => {
      const engine = new PlaylistEngine();
      engine.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 441000 })]),
      ]);
      engine.seek(5);
      expect(engine.getState().currentTime).toBe(5);
      engine.dispose();
    });

    it('clamps seek to duration', () => {
      const engine = new PlaylistEngine();
      engine.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      engine.seek(100);
      expect(engine.getState().currentTime).toBe(1); // 44100 samples = 1 second
      engine.dispose();
    });

    it('clamps startTime in play()', async () => {
      const engine = new PlaylistEngine();
      engine.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      await engine.play(100); // Beyond duration of 1 second
      expect(engine.getState().currentTime).toBe(1);
      engine.dispose();
    });

    it('does not set isPlaying when adapter.play rejects', async () => {
      const adapter = createMockAdapter();
      (adapter.play as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('AudioContext not resumed')
      );
      const engine = new PlaylistEngine({ adapter });
      await expect(engine.play()).rejects.toThrow('AudioContext not resumed');
      expect(engine.getState().isPlaying).toBe(false);
      engine.dispose();
    });
  });

  describe('events', () => {
    it('supports on/off for statechange', () => {
      const engine = new PlaylistEngine();
      const listener = vi.fn();
      engine.on('statechange', listener);
      engine.setTracks([]);
      expect(listener).toHaveBeenCalledTimes(1);
      engine.off('statechange', listener);
      engine.setTracks([]);
      expect(listener).toHaveBeenCalledTimes(1);
      engine.dispose();
    });

    it('emits play/pause/stop events', async () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      const playListener = vi.fn();
      const pauseListener = vi.fn();
      const stopListener = vi.fn();
      engine.on('play', playListener);
      engine.on('pause', pauseListener);
      engine.on('stop', stopListener);
      await engine.play();
      expect(playListener).toHaveBeenCalled();
      engine.pause();
      expect(pauseListener).toHaveBeenCalled();
      engine.stop();
      expect(stopListener).toHaveBeenCalled();
      engine.dispose();
    });

    it('isolates listener errors from other listeners', () => {
      const engine = new PlaylistEngine();
      const errorListener = vi.fn(() => {
        throw new Error('listener bug');
      });
      const goodListener = vi.fn();
      engine.on('statechange', errorListener);
      engine.on('statechange', goodListener);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      engine.setTracks([]); // triggers statechange
      warnSpy.mockRestore();

      // Both listeners were called; the error didn't block the second
      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1);
      engine.dispose();
    });
  });

  describe('selection', () => {
    it('sets selection and emits statechange', () => {
      const engine = new PlaylistEngine();
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setSelection(1.5, 3.0);
      const state = engine.getState();
      expect(state.selectionStart).toBe(1.5);
      expect(state.selectionEnd).toBe(3.0);
      expect(listener).toHaveBeenCalledTimes(1);
      engine.dispose();
    });

    it('normalizes start > end so selectionStart <= selectionEnd', () => {
      const engine = new PlaylistEngine();
      engine.setSelection(5.0, 2.0);
      const state = engine.getState();
      expect(state.selectionStart).toBe(2.0);
      expect(state.selectionEnd).toBe(5.0);
      engine.dispose();
    });

    it('emits when only start changes', () => {
      const engine = new PlaylistEngine();
      engine.setSelection(1.0, 3.0);
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setSelection(1.5, 3.0);
      expect(listener).toHaveBeenCalledTimes(1);
      const state = engine.getState();
      expect(state.selectionStart).toBe(1.5);
      expect(state.selectionEnd).toBe(3.0);
      engine.dispose();
    });

    it('does not emit when selection unchanged', () => {
      const engine = new PlaylistEngine();
      engine.setSelection(1.0, 2.0);
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setSelection(1.0, 2.0);
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });
  });

  describe('loop region', () => {
    it('sets loop region and emits statechange', () => {
      const engine = new PlaylistEngine();
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setLoopRegion(2.0, 5.0);
      const state = engine.getState();
      expect(state.loopStart).toBe(2.0);
      expect(state.loopEnd).toBe(5.0);
      expect(listener).toHaveBeenCalledTimes(1);
      engine.dispose();
    });

    it('normalizes start > end so loopStart <= loopEnd', () => {
      const engine = new PlaylistEngine();
      engine.setLoopRegion(8.0, 3.0);
      const state = engine.getState();
      expect(state.loopStart).toBe(3.0);
      expect(state.loopEnd).toBe(8.0);
      engine.dispose();
    });

    it('does not emit when loop region unchanged', () => {
      const engine = new PlaylistEngine();
      engine.setLoopRegion(1.0, 3.0);
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setLoopRegion(1.0, 3.0);
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });

    it('sets loop enabled and emits statechange', () => {
      const engine = new PlaylistEngine();
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setLoopEnabled(true);
      expect(engine.getState().isLoopEnabled).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      engine.dispose();
    });

    it('does not emit when loop enabled unchanged', () => {
      const engine = new PlaylistEngine();
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setLoopEnabled(false); // default is false
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });
  });

  describe('master volume', () => {
    it('stores value, delegates to adapter, and emits statechange', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setMasterVolume(0.75);
      expect(engine.getState().masterVolume).toBe(0.75);
      expect(adapter.setMasterVolume).toHaveBeenCalledWith(0.75);
      expect(listener).toHaveBeenCalledTimes(1);
      engine.dispose();
    });

    it('does not emit when volume unchanged', () => {
      const engine = new PlaylistEngine();
      const listener = vi.fn();
      engine.on('statechange', listener);

      engine.setMasterVolume(1.0); // default is 1.0
      expect(listener).not.toHaveBeenCalled();
      engine.dispose();
    });
  });

  describe('getState defaults', () => {
    it('includes all new fields with correct defaults', () => {
      const engine = new PlaylistEngine();
      const state = engine.getState();
      expect(state.selectionStart).toBe(0);
      expect(state.selectionEnd).toBe(0);
      expect(state.masterVolume).toBe(1.0);
      expect(state.loopStart).toBe(0);
      expect(state.loopEnd).toBe(0);
      expect(state.isLoopEnabled).toBe(false);
      engine.dispose();
    });
  });

  describe('dispose', () => {
    it('disposes adapter and clears listeners', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      const listener = vi.fn();
      engine.on('statechange', listener);
      engine.dispose();
      expect(adapter.dispose).toHaveBeenCalled();
    });

    it('is idempotent — double dispose does not call adapter.dispose twice', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine({ adapter });
      engine.dispose();
      engine.dispose();
      expect(adapter.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
