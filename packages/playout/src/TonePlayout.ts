import {
  Volume,
  ToneAudioNode,
  getDestination,
  start,
  now,
  getTransport,
  getContext,
  BaseContext,
} from 'tone';
import { ToneTrack, ToneTrackOptions } from './ToneTrack';

export type EffectsFunction = (
  masterGainNode: Volume,
  destination: ToneAudioNode,
  isOffline: boolean
) => void | (() => void);

export interface TonePlayoutOptions {
  tracks?: ToneTrack[];
  masterGain?: number;
  effects?: EffectsFunction;
}

export class TonePlayout {
  private tracks: Map<string, ToneTrack> = new Map();
  private masterVolume: Volume;
  private isInitialized = false;
  private soloedTracks: Set<string> = new Set();
  private manualMuteState: Map<string, boolean> = new Map();
  private effectsCleanup?: () => void;
  private onPlaybackCompleteCallback?: () => void;
  private _completionEventId: number | null = null;
  private _loopHandler: (() => void) | null = null;
  private _loopEnabled = false;
  private _loopStart = 0;
  private _loopEnd = 0;

  constructor(options: TonePlayoutOptions = {}) {
    this.masterVolume = new Volume(this.gainToDb(options.masterGain ?? 1));

    // Setup effects chain if provided, otherwise connect directly to destination
    if (options.effects) {
      const cleanup = options.effects(this.masterVolume, getDestination(), false);
      if (cleanup) {
        this.effectsCleanup = cleanup;
      }
    } else {
      this.masterVolume.toDestination();
    }

    if (options.tracks) {
      options.tracks.forEach((track) => {
        this.tracks.set(track.id, track);
        this.manualMuteState.set(track.id, track.muted);
      });
    }
  }

  private gainToDb(gain: number): number {
    return 20 * Math.log10(gain);
  }

  private clearCompletionEvent(): void {
    if (this._completionEventId !== null) {
      try {
        getTransport().clear(this._completionEventId);
      } catch (err) {
        console.warn('[waveform-playlist] Error clearing Transport completion event:', err);
      }
      this._completionEventId = null;
    }
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    await start();
    this.isInitialized = true;
  }

  addTrack(trackOptions: ToneTrackOptions): ToneTrack {
    // Ensure tracks connect to master volume instead of destination
    const optionsWithDestination = {
      ...trackOptions,
      destination: this.masterVolume,
    };
    const toneTrack = new ToneTrack(optionsWithDestination);
    this.tracks.set(toneTrack.id, toneTrack);
    this.manualMuteState.set(toneTrack.id, trackOptions.track.muted ?? false);
    if (trackOptions.track.soloed) {
      this.soloedTracks.add(toneTrack.id);
    }
    return toneTrack;
  }

  /**
   * Apply solo muting after all tracks have been added.
   * Call this after adding all tracks to ensure solo logic is applied correctly.
   */
  applyInitialSoloState(): void {
    this.updateSoloMuting();
  }

  removeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.dispose();
      this.tracks.delete(trackId);
      this.manualMuteState.delete(trackId);
      this.soloedTracks.delete(trackId);
    }
  }

  getTrack(trackId: string): ToneTrack | undefined {
    return this.tracks.get(trackId);
  }

  play(when?: number, offset?: number, duration?: number): void {
    if (!this.isInitialized) {
      throw new Error('[waveform-playlist] TonePlayout not initialized. Call init() first.');
    }

    const startTime = when ?? now();
    const transport = getTransport();

    this.clearCompletionEvent();

    const transportOffset = offset ?? 0;
    this.tracks.forEach((track) => {
      track.cancelFades();
      track.prepareFades(startTime, transportOffset);
    });

    // Schedule duration-limited stop via Transport
    if (duration !== undefined) {
      this._completionEventId = transport.scheduleOnce(() => {
        this._completionEventId = null;
        try {
          this.onPlaybackCompleteCallback?.();
        } catch (err) {
          console.warn('[waveform-playlist] Error in playback completion callback:', err);
        }
      }, transportOffset + duration);
    }

    // Start Transport — triggers schedule() callbacks for clips at/after offset
    try {
      // Stop all active native sources before restarting to prevent layered audio.
      // Native AudioBufferSourceNodes don't respond to Transport state changes.
      if (transport.state !== 'stopped') {
        transport.stop();
      }
      this.tracks.forEach((track) => track.stopAllSources());

      // Set loop boundaries BEFORE enabling loop. _processTick checks
      // `ticks >= _loopEnd` every tick; _loopEnd defaults to 0.
      transport.loopStart = this._loopStart;
      transport.loopEnd = this._loopEnd;
      transport.loop = this._loopEnabled;

      // Set schedule guard BEFORE transport.start(). Ghost ticks from stale
      // Clock._lastUpdate can fire schedule callbacks at past positions;
      // the guard suppresses callbacks for clips before the play offset
      // (those are handled by startMidClipSources below).
      this.tracks.forEach((track) => track.setScheduleGuardOffset(transportOffset));

      if (offset !== undefined) {
        transport.start(startTime, offset);
      } else {
        transport.start(startTime);
      }

      // Advance Clock._lastUpdate past the stop/start boundary.
      //
      // After stop/start cycles, _lastUpdate is stale (set by the previous
      // context tick, before our stop/start). The next Clock._loop() processes
      // ticks from [_lastUpdate, now()]. In the gap [_lastUpdate, startTime),
      // the TickSource is still "started" from the PREVIOUS play cycle with
      // its old tick offset. Those accumulated ticks can exceed _loopEnd,
      // causing _processTick to wrap immediately to loopStart.
      //
      // By advancing _lastUpdate to startTime, we skip the stale range.
      // The next Clock._loop() only processes [startTime, now()] — ticks
      // from the current play cycle with the correct offset.
      (transport as any)._clock._lastUpdate = startTime;

      // Start sources for clips that span the current Transport position.
      // Transport.schedule() only fires for clips at/after the offset;
      // clips whose start time is before the offset need manual creation.
      this.tracks.forEach((track) => {
        track.startMidClipSources(transportOffset, startTime);
      });
    } catch (err) {
      // Clean up scheduled events since Transport failed to start
      this.clearCompletionEvent();
      this.tracks.forEach((track) => track.cancelFades());
      console.warn(
        '[waveform-playlist] Transport.start() failed. Audio playback could not begin.',
        err
      );
      throw err;
    }
  }

  pause(): void {
    const transport = getTransport();
    try {
      transport.pause();
    } catch (err) {
      console.warn('[waveform-playlist] Transport.pause() failed:', err);
    }
    // Native AudioBufferSourceNodes ignore Transport state changes —
    // they must be explicitly stopped.
    this.tracks.forEach((track) => track.stopAllSources());
    this.tracks.forEach((track) => track.cancelFades());
    this.clearCompletionEvent();
  }

  stop(): void {
    const transport = getTransport();
    try {
      transport.stop();
    } catch (err) {
      console.warn('[waveform-playlist] Transport.stop() failed:', err);
    }
    // Remove loop handler before stopping sources. Prevents any deferred
    // loop event from creating new sources via startMidClipSources() after
    // stopAllSources() runs. Defense-in-depth — setLoop(false) should
    // already have removed it, but stop() must be self-contained.
    if (this._loopHandler) {
      try {
        transport.off('loop', this._loopHandler);
      } catch (err) {
        console.warn('[waveform-playlist] Error removing loop handler:', err);
      }
      this._loopHandler = null;
    }
    // Stop all native sources explicitly
    this.tracks.forEach((track) => track.stopAllSources());
    this.tracks.forEach((track) => track.cancelFades());
    this.clearCompletionEvent();
  }

  setMasterGain(gain: number): void {
    this.masterVolume.volume.value = this.gainToDb(gain);
  }

  setSolo(trackId: string, soloed: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.setSolo(soloed);
      if (soloed) {
        this.soloedTracks.add(trackId);
      } else {
        this.soloedTracks.delete(trackId);
      }
      this.updateSoloMuting();
    }
  }

  private updateSoloMuting(): void {
    const hasSoloedTracks = this.soloedTracks.size > 0;

    this.tracks.forEach((track, id) => {
      if (hasSoloedTracks) {
        if (!this.soloedTracks.has(id)) {
          track.setMute(true);
        } else {
          const manuallyMuted = this.manualMuteState.get(id) ?? false;
          track.setMute(manuallyMuted);
        }
      } else {
        const manuallyMuted = this.manualMuteState.get(id) ?? false;
        track.setMute(manuallyMuted);
      }
    });
  }

  setMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      this.manualMuteState.set(trackId, muted);
      track.setMute(muted);
    }
  }

  setLoop(enabled: boolean, loopStart: number, loopEnd: number): void {
    // Update cached state first — play() uses these values to configure
    // the Transport on next start, so they must reflect the caller's intent
    // regardless of whether Transport property setting succeeds.
    this._loopEnabled = enabled;
    this._loopStart = loopStart;
    this._loopEnd = loopEnd;

    const transport = getTransport();
    try {
      // Set boundaries BEFORE enabling loop. Tone.js's _processTick checks
      // `ticks >= _loopEnd` on every tick. If we set transport.loop = true
      // first, a tick could fire before loopEnd is updated, seeing the stale
      // _loopEnd value (0 from Transport default) and wrapping immediately.
      transport.loopStart = loopStart;
      transport.loopEnd = loopEnd;
      transport.loop = enabled;
    } catch (err) {
      console.warn('[waveform-playlist] Error configuring Transport loop:', err);
      return;
    }

    if (enabled && !this._loopHandler) {
      this._loopHandler = () => {
        // On loop boundary: stop old sources, re-schedule fades, start mid-clip sources.
        // Event ordering in Transport's tick processing (Tone.js 15.x _processTick):
        //   loopEnd → ticks reset → loopStart → loop → forEachAtTime(ticks)
        // Our loop handler fires BEFORE schedule callbacks, so:
        // 1. stopAllSources + cancelFades — clean slate
        // 2. startMidClipSources — for clips spanning loopStart boundary
        // 3. prepareFades — fresh fade envelopes
        // Then Transport fires schedule callbacks for clips at/after loopStart.
        const currentTime = now();
        this.tracks.forEach((track) => {
          try {
            track.stopAllSources();
            track.cancelFades();
            track.setScheduleGuardOffset(this._loopStart);
            track.startMidClipSources(this._loopStart, currentTime);
            track.prepareFades(currentTime, this._loopStart);
          } catch (err) {
            console.warn(
              `[waveform-playlist] Error re-scheduling track "${track.id}" on loop:`,
              err
            );
          }
        });
      };
      transport.on('loop', this._loopHandler);
    } else if (!enabled && this._loopHandler) {
      transport.off('loop', this._loopHandler);
      this._loopHandler = null;
    }
  }

  getCurrentTime(): number {
    return getTransport().seconds;
  }

  seekTo(time: number): void {
    getTransport().seconds = time;
  }

  dispose(): void {
    this.clearCompletionEvent();

    if (this._loopHandler) {
      try {
        getTransport().off('loop', this._loopHandler);
      } catch (err) {
        console.warn('[waveform-playlist] Error removing Transport loop handler:', err);
      }
      this._loopHandler = null;
    }

    this.tracks.forEach((track) => {
      try {
        track.dispose();
      } catch (err) {
        console.warn(`[waveform-playlist] Error disposing track "${track.id}":`, err);
      }
    });
    this.tracks.clear();

    if (this.effectsCleanup) {
      try {
        this.effectsCleanup();
      } catch (err) {
        console.warn('[waveform-playlist] Error during master effects cleanup:', err);
      }
    }

    try {
      this.masterVolume.dispose();
    } catch (err) {
      console.warn('[waveform-playlist] Error disposing master volume:', err);
    }
  }

  get context(): BaseContext {
    return getContext();
  }

  get sampleRate(): number {
    return getContext().sampleRate;
  }

  setOnPlaybackComplete(callback: () => void): void {
    this.onPlaybackCompleteCallback = callback;
  }
}
