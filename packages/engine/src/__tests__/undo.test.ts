import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaylistEngine } from '../PlaylistEngine';
import { createClip, createTrack } from '@waveform-playlist/core';

function makeClip(startSample: number, durationSamples: number) {
  return createClip({
    startSample,
    durationSamples,
    offsetSamples: 0,
    sampleRate: 48000,
    sourceDurationSamples: 96000,
  });
}

function makeTrack(clips: ReturnType<typeof makeClip>[]) {
  return createTrack({ name: 'Test', clips });
}

describe('PlaylistEngine — Undo/Redo', () => {
  let engine: PlaylistEngine;

  beforeEach(() => {
    engine = new PlaylistEngine({ sampleRate: 48000 });
  });

  describe('basic undo/redo', () => {
    it('canUndo is false initially', () => {
      expect(engine.canUndo).toBe(false);
    });

    it('canRedo is false initially', () => {
      expect(engine.canRedo).toBe(false);
    });

    it('undo restores previous track state after moveClip', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;
      const originalStart = engine.getState().tracks[0].clips[0].startSample;

      engine.moveClip(trackId, clipId, 10000);
      expect(engine.getState().tracks[0].clips[0].startSample).toBe(originalStart + 10000);
      expect(engine.canUndo).toBe(true);

      engine.undo();
      expect(engine.getState().tracks[0].clips[0].startSample).toBe(originalStart);
      expect(engine.canUndo).toBe(false);
    });

    it('redo re-applies undone operation', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      engine.moveClip(trackId, clipId, 10000);
      const movedStart = engine.getState().tracks[0].clips[0].startSample;

      engine.undo();
      expect(engine.canRedo).toBe(true);

      engine.redo();
      expect(engine.getState().tracks[0].clips[0].startSample).toBe(movedStart);
      expect(engine.canRedo).toBe(false);
    });

    it('new edit clears redo stack', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      engine.moveClip(trackId, clipId, 10000);
      engine.undo();
      expect(engine.canRedo).toBe(true);

      engine.moveClip(trackId, clipId, 5000);
      expect(engine.canRedo).toBe(false);
    });
  });

  describe('undoable operations', () => {
    it('trimClip is undoable', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;
      const originalDuration = engine.getState().tracks[0].clips[0].durationSamples;

      engine.trimClip(trackId, clipId, 'right', -10000);

      engine.undo();
      expect(engine.getState().tracks[0].clips[0].durationSamples).toBe(originalDuration);
    });

    it('splitClip is undoable', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      expect(engine.getState().tracks[0].clips).toHaveLength(1);

      engine.splitClip(trackId, clipId, 24000);
      expect(engine.getState().tracks[0].clips).toHaveLength(2);

      engine.undo();
      expect(engine.getState().tracks[0].clips).toHaveLength(1);
    });
  });

  describe('non-undoable operations', () => {
    it('setSelection does not create undo step', () => {
      engine.setSelection(1.0, 2.0);
      expect(engine.canUndo).toBe(false);
    });

    it('setZoomLevel does not create undo step', () => {
      engine.setZoomLevel(2048);
      expect(engine.canUndo).toBe(false);
    });

    it('setMasterVolume does not create undo step', () => {
      engine.setMasterVolume(0.5);
      expect(engine.canUndo).toBe(false);
    });
  });

  describe('stack limit', () => {
    it('respects undoLimit', () => {
      engine = new PlaylistEngine({ sampleRate: 48000, undoLimit: 3 });
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      // 4 moves but limit is 3
      engine.moveClip(trackId, clipId, 1000);
      engine.moveClip(trackId, clipId, 1000);
      engine.moveClip(trackId, clipId, 1000);
      engine.moveClip(trackId, clipId, 1000);

      // Can undo 3 times, not 4
      engine.undo();
      engine.undo();
      engine.undo();
      expect(engine.canUndo).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('clears both undo and redo stacks', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      engine.moveClip(trackId, clipId, 1000);
      engine.moveClip(trackId, clipId, 1000);
      engine.undo();

      expect(engine.canUndo).toBe(true);
      expect(engine.canRedo).toBe(true);

      engine.clearHistory();
      expect(engine.canUndo).toBe(false);
      expect(engine.canRedo).toBe(false);
    });

    it('setTracks clears history', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      engine.moveClip(trackId, clipId, 1000);
      expect(engine.canUndo).toBe(true);

      engine.setTracks([makeTrack([makeClip(0, 24000)])]);
      expect(engine.canUndo).toBe(false);
    });
  });

  describe('transactions', () => {
    it('groups multiple operations into one undo step', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      engine.beginTransaction();
      engine.moveClip(trackId, clipId, 1000);
      engine.moveClip(trackId, clipId, 2000);
      engine.moveClip(trackId, clipId, 3000);
      engine.commitTransaction();

      // One undo step undoes all three moves
      engine.undo();
      expect(engine.getState().tracks[0].clips[0].startSample).toBe(0);
    });

    it('abortTransaction restores pre-transaction state', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      engine.beginTransaction();
      engine.moveClip(trackId, clipId, 5000);
      engine.moveClip(trackId, clipId, 5000);

      engine.abortTransaction();
      expect(engine.getState().tracks[0].clips[0].startSample).toBe(0);
      // Abort does not add to undo stack
      expect(engine.canUndo).toBe(false);
    });

    it('operations during transaction do not create individual undo steps', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;

      engine.beginTransaction();
      engine.moveClip(trackId, clipId, 1000);
      engine.moveClip(trackId, clipId, 1000);
      engine.commitTransaction();

      // Only one undo step, not two
      engine.undo();
      expect(engine.canUndo).toBe(false);
    });
  });

  describe('addTrack/removeTrack undo', () => {
    it('undo after addTrack removes the track', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);
      expect(engine.getState().tracks).toHaveLength(1);

      const newTrack = makeTrack([makeClip(0, 24000)]);
      engine.addTrack(newTrack);
      expect(engine.getState().tracks).toHaveLength(2);

      engine.undo();
      expect(engine.getState().tracks).toHaveLength(1);
    });

    it('undo after removeTrack restores the track', () => {
      const clip1 = makeClip(0, 48000);
      const clip2 = makeClip(0, 24000);
      const track1 = makeTrack([clip1]);
      const track2 = makeTrack([clip2]);
      engine.setTracks([track1, track2]);
      expect(engine.getState().tracks).toHaveLength(2);

      const trackId = engine.getState().tracks[1].id;
      engine.removeTrack(trackId);
      expect(engine.getState().tracks).toHaveLength(1);

      engine.undo();
      expect(engine.getState().tracks).toHaveLength(2);
    });
  });

  describe('empty stack safety', () => {
    it('undo on empty stack is a no-op (no throw, no state change)', () => {
      expect(engine.canUndo).toBe(false);
      expect(() => engine.undo()).not.toThrow();
      expect(engine.canUndo).toBe(false);
      expect(engine.canRedo).toBe(false);
    });

    it('redo on empty stack is a no-op (no throw, no state change)', () => {
      expect(engine.canRedo).toBe(false);
      expect(() => engine.redo()).not.toThrow();
      expect(engine.canUndo).toBe(false);
      expect(engine.canRedo).toBe(false);
    });
  });

  describe('transaction edge cases', () => {
    it('commitTransaction without beginTransaction is a no-op', () => {
      expect(() => engine.commitTransaction()).not.toThrow();
      expect(engine.canUndo).toBe(false);
    });

    it('abortTransaction without beginTransaction is a no-op', () => {
      expect(() => engine.abortTransaction()).not.toThrow();
      expect(engine.canUndo).toBe(false);
    });

    it('double beginTransaction warns but does not throw', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      engine.beginTransaction();
      engine.beginTransaction();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already in a transaction'));
      // Clean up — commit the second transaction
      engine.commitTransaction();
      warnSpy.mockRestore();
    });

    it('double commitTransaction warns on second call', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      engine.beginTransaction();
      engine.moveClip(
        engine.getState().tracks[0].id,
        engine.getState().tracks[0].clips[0].id,
        1000
      );
      engine.commitTransaction();
      expect(engine.canUndo).toBe(true);

      engine.commitTransaction(); // second commit — no active transaction
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no active transaction to commit')
      );
      warnSpy.mockRestore();
    });
  });

  describe('statechange', () => {
    it('undo emits statechange with canUndo/canRedo', () => {
      const clip = makeClip(0, 48000);
      const track = makeTrack([clip]);
      engine.setTracks([track]);

      const trackId = engine.getState().tracks[0].id;
      const clipId = engine.getState().tracks[0].clips[0].id;
      engine.moveClip(trackId, clipId, 1000);

      const states: { canUndo: boolean; canRedo: boolean }[] = [];
      engine.on('statechange', (state) => {
        states.push({ canUndo: state.canUndo, canRedo: state.canRedo });
      });

      engine.undo();
      expect(states).toHaveLength(1);
      expect(states[0].canUndo).toBe(false);
      expect(states[0].canRedo).toBe(true);
    });
  });
});
