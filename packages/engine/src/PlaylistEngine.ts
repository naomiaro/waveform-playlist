/**
 * PlaylistEngine — Stateful, framework-agnostic timeline engine.
 *
 * Composes pure operations from ./operations with an event emitter
 * and optional PlayoutAdapter for audio playback delegation.
 */

import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { sortClipsByTime } from '@waveform-playlist/core';
import {
  constrainClipDrag,
  constrainBoundaryTrim,
  canSplitAt,
  splitClip as splitClipOp,
} from './operations/clipOperations';
import {
  calculateDuration,
  clampSeekPosition,
  findClosestZoomIndex,
} from './operations/timelineOperations';
import type { PlayoutAdapter, EngineState, EngineEvents, PlaylistEngineOptions } from './types';

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_SAMPLES_PER_PIXEL = 1000;
const DEFAULT_ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192];
const DEFAULT_MIN_DURATION_SECONDS = 0.1;

type EventName = keyof EngineEvents;

export class PlaylistEngine {
  private _tracks: ClipTrack[] = [];
  private _currentTime = 0;
  private _isPlaying = false;
  private _selectedTrackId: string | null = null;
  private _sampleRate: number;
  private _zoomLevels: number[];
  private _zoomIndex: number;
  private _selectionStart = 0;
  private _selectionEnd = 0;
  private _masterVolume = 1.0;
  private _loopStart = 0;
  private _loopEnd = 0;
  private _isLoopEnabled = false;
  private _adapter: PlayoutAdapter | null;
  private _animFrameId: number | null = null;
  private _disposed = false;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private _listeners: Map<string, Set<Function>> = new Map();

  constructor(options: PlaylistEngineOptions = {}) {
    this._sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this._zoomLevels = [...(options.zoomLevels ?? DEFAULT_ZOOM_LEVELS)];
    this._adapter = options.adapter ?? null;

    if (this._zoomLevels.length === 0) {
      throw new Error('PlaylistEngine: zoomLevels must not be empty');
    }

    const initialSpp = options.samplesPerPixel ?? DEFAULT_SAMPLES_PER_PIXEL;
    this._zoomIndex = findClosestZoomIndex(initialSpp, this._zoomLevels);
  }

  // ---------------------------------------------------------------------------
  // State snapshot
  // ---------------------------------------------------------------------------

  getState(): EngineState {
    return {
      tracks: this._tracks.map((t) => ({ ...t, clips: [...t.clips] })),
      duration: calculateDuration(this._tracks),
      currentTime: this._currentTime,
      isPlaying: this._isPlaying,
      samplesPerPixel: this._zoomLevels[this._zoomIndex],
      sampleRate: this._sampleRate,
      selectedTrackId: this._selectedTrackId,
      zoomIndex: this._zoomIndex,
      canZoomIn: this._zoomIndex > 0,
      canZoomOut: this._zoomIndex < this._zoomLevels.length - 1,
      selectionStart: this._selectionStart,
      selectionEnd: this._selectionEnd,
      masterVolume: this._masterVolume,
      loopStart: this._loopStart,
      loopEnd: this._loopEnd,
      isLoopEnabled: this._isLoopEnabled,
    };
  }

  // ---------------------------------------------------------------------------
  // Track Management
  // ---------------------------------------------------------------------------

  setTracks(tracks: ClipTrack[]): void {
    this._tracks = [...tracks];
    this._adapter?.setTracks(this._tracks);
    this._emitStateChange();
  }

  addTrack(track: ClipTrack): void {
    this._tracks = [...this._tracks, track];
    this._adapter?.setTracks(this._tracks);
    this._emitStateChange();
  }

  removeTrack(trackId: string): void {
    if (!this._tracks.some((t) => t.id === trackId)) return;
    this._tracks = this._tracks.filter((t) => t.id !== trackId);
    if (this._selectedTrackId === trackId) {
      this._selectedTrackId = null;
    }
    this._adapter?.setTracks(this._tracks);
    this._emitStateChange();
  }

  selectTrack(trackId: string | null): void {
    if (trackId === this._selectedTrackId) return;
    this._selectedTrackId = trackId;
    this._emitStateChange();
  }

  // ---------------------------------------------------------------------------
  // Clip Editing (delegates to operations/)
  // ---------------------------------------------------------------------------

  moveClip(trackId: string, clipId: string, deltaSamples: number): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (!track) return;

    const clipIndex = track.clips.findIndex((c: AudioClip) => c.id === clipId);
    if (clipIndex === -1) return;

    const clip = track.clips[clipIndex];
    const sortedClips = sortClipsByTime(track.clips);
    const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clipId);

    const constrainedDelta = constrainClipDrag(clip, deltaSamples, sortedClips, sortedIndex);

    if (constrainedDelta === 0) return;

    this._tracks = this._tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newClips = t.clips.map((c: AudioClip, i: number) =>
        i === clipIndex
          ? {
              ...c,
              startSample: Math.floor(c.startSample + constrainedDelta),
            }
          : c
      );
      return { ...t, clips: newClips };
    });

    this._emitStateChange();
  }

  splitClip(trackId: string, clipId: string, atSample: number): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (!track) return;

    const clipIndex = track.clips.findIndex((c: AudioClip) => c.id === clipId);
    if (clipIndex === -1) return;

    const clip = track.clips[clipIndex];
    const minDuration = Math.floor(DEFAULT_MIN_DURATION_SECONDS * this._sampleRate);

    if (!canSplitAt(clip, atSample, minDuration)) return;

    const { left, right } = splitClipOp(clip, atSample);

    this._tracks = this._tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newClips = [...t.clips];
      newClips.splice(clipIndex, 1, left, right);
      return { ...t, clips: newClips };
    });

    this._emitStateChange();
  }

  trimClip(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (!track) return;

    const clipIndex = track.clips.findIndex((c: AudioClip) => c.id === clipId);
    if (clipIndex === -1) return;

    const clip = track.clips[clipIndex];
    const sortedClips = sortClipsByTime(track.clips);
    const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clipId);
    const minDuration = Math.floor(DEFAULT_MIN_DURATION_SECONDS * this._sampleRate);

    const constrained = constrainBoundaryTrim(
      clip,
      deltaSamples,
      boundary,
      sortedClips,
      sortedIndex,
      minDuration
    );

    if (constrained === 0) return;

    this._tracks = this._tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newClips = t.clips.map((c: AudioClip, i: number) => {
        if (i !== clipIndex) return c;
        if (boundary === 'left') {
          return {
            ...c,
            startSample: c.startSample + constrained,
            offsetSamples: c.offsetSamples + constrained,
            durationSamples: c.durationSamples - constrained,
          };
        } else {
          return { ...c, durationSamples: c.durationSamples + constrained };
        }
      });
      return { ...t, clips: newClips };
    });

    this._emitStateChange();
  }

  // ---------------------------------------------------------------------------
  // Playback (delegates to adapter, no-ops without adapter)
  // ---------------------------------------------------------------------------

  async play(startTime?: number, endTime?: number): Promise<void> {
    if (startTime !== undefined) {
      const duration = calculateDuration(this._tracks);
      this._currentTime = clampSeekPosition(startTime, duration);
    }

    if (this._adapter) {
      await this._adapter.play(this._currentTime, endTime);
      this._startTimeUpdateLoop();
    }

    this._isPlaying = true;
    this._emit('play');
    this._emitStateChange();
  }

  pause(): void {
    this._isPlaying = false;
    this._stopTimeUpdateLoop();
    this._adapter?.pause();
    if (this._adapter) {
      this._currentTime = this._adapter.getCurrentTime();
    }
    this._emit('pause');
    this._emitStateChange();
  }

  stop(): void {
    this._isPlaying = false;
    this._currentTime = 0;
    this._stopTimeUpdateLoop();
    this._adapter?.stop();
    this._emit('stop');
    this._emitStateChange();
  }

  seek(time: number): void {
    const duration = calculateDuration(this._tracks);
    this._currentTime = clampSeekPosition(time, duration);
    this._adapter?.seek(this._currentTime);
    this._emitStateChange();
  }

  setMasterVolume(volume: number): void {
    if (volume === this._masterVolume) return;
    this._masterVolume = volume;
    this._adapter?.setMasterVolume(volume);
    this._emitStateChange();
  }

  // ---------------------------------------------------------------------------
  // Selection & Loop
  // ---------------------------------------------------------------------------

  setSelection(start: number, end: number): void {
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    if (s === this._selectionStart && e === this._selectionEnd) return;
    this._selectionStart = s;
    this._selectionEnd = e;
    this._emitStateChange();
  }

  setLoopRegion(start: number, end: number): void {
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    if (s === this._loopStart && e === this._loopEnd) return;
    this._loopStart = s;
    this._loopEnd = e;
    this._emitStateChange();
  }

  setLoopEnabled(enabled: boolean): void {
    if (enabled === this._isLoopEnabled) return;
    this._isLoopEnabled = enabled;
    this._emitStateChange();
  }

  // ---------------------------------------------------------------------------
  // Per-Track Audio (delegates to adapter)
  // ---------------------------------------------------------------------------

  setTrackVolume(trackId: string, volume: number): void {
    this._adapter?.setTrackVolume(trackId, volume);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this._adapter?.setTrackMute(trackId, muted);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this._adapter?.setTrackSolo(trackId, soloed);
  }

  setTrackPan(trackId: string, pan: number): void {
    this._adapter?.setTrackPan(trackId, pan);
  }

  // ---------------------------------------------------------------------------
  // Zoom
  // ---------------------------------------------------------------------------

  zoomIn(): void {
    if (this._zoomIndex > 0) {
      this._zoomIndex--;
      this._emitStateChange();
    }
  }

  zoomOut(): void {
    if (this._zoomIndex < this._zoomLevels.length - 1) {
      this._zoomIndex++;
      this._emitStateChange();
    }
  }

  setZoomLevel(samplesPerPixel: number): void {
    const newIndex = findClosestZoomIndex(samplesPerPixel, this._zoomLevels);
    if (newIndex === this._zoomIndex) return;
    this._zoomIndex = newIndex;
    this._emitStateChange();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  on<K extends EventName>(event: K, listener: EngineEvents[K]): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
  }

  off<K extends EventName>(event: K, listener: EngineEvents[K]): void {
    this._listeners.get(event)?.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._stopTimeUpdateLoop();
    this._adapter?.dispose();
    this._listeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _emit(event: string, ...args: unknown[]): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (error) {
          console.warn('[waveform-playlist/engine] Error in event listener:', error);
        }
      }
    }
  }

  private _emitStateChange(): void {
    this._emit('statechange', this.getState());
  }

  private _startTimeUpdateLoop(): void {
    // Guard for Node.js / SSR environments where RAF is unavailable
    if (typeof requestAnimationFrame === 'undefined') return;

    this._stopTimeUpdateLoop();

    const tick = () => {
      if (this._disposed || !this._isPlaying) return;
      if (this._adapter) {
        this._currentTime = this._adapter.getCurrentTime();
        this._emit('timeupdate', this._currentTime);
      }
      this._animFrameId = requestAnimationFrame(tick);
    };

    this._animFrameId = requestAnimationFrame(tick);
  }

  private _stopTimeUpdateLoop(): void {
    if (this._animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  }
}
