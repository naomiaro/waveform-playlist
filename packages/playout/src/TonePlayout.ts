// Named imports for tree-shaking
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

// Effects function no longer receives ToneLib - effects should import Tone themselves
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
  private _loopStart = 0;

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
        // Initialize manual mute state for constructor-provided tracks
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
    // Initialize manual mute state from track options
    this.manualMuteState.set(toneTrack.id, trackOptions.track.muted ?? false);
    // Initialize solo state from track options
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
      console.warn('[waveform-playlist] TonePlayout not initialized. Call init() first.');
      return;
    }

    const startTime = when ?? now();
    const transport = getTransport();
    console.log('[DEBUG TonePlayout.play()]', { transportState: transport.state, startTime, offset, duration, loopEnabled: transport.loop, loopStart: transport.loopStart, loopEnd: transport.loopEnd });

    // Clear any pending completion event
    this.clearCompletionEvent();

    // Tell tracks what offset we're starting from (deterministic tick-0 guard)
    // and re-schedule fades for all tracks
    const transportOffset = offset ?? 0;
    this.tracks.forEach((track) => {
      track.cancelFades();
      track.setTransportStartOffset(transportOffset);
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

    // Start Transport — drives all synced Players
    try {
      // Only stop Transport if it's still running (e.g., rapid play calls
      // without an intervening stop).
      if (transport.state !== 'stopped') {
        console.log('[DEBUG TonePlayout.play()] stopping transport first');
        transport.stop();
        // Log active sources BEFORE force-stop
        this.tracks.forEach((track) => {
          const clips = (track as any).clips ?? [];
          const detail = clips.map((cp: any) => ({
            state: cp.player.state,
            activeSources: (cp.player as any)._activeSources?.size ?? '?',
          }));
          const hasActive = detail.some((d: any) => d.activeSources > 0 || d.state === 'started');
          if (hasActive) {
            console.warn(`[DEBUG pre-forceStop] ACTIVE track "${track.id}":`, JSON.stringify(detail));
          }
        });
        // Force-dispose orphaned active sources before restarting
        this.tracks.forEach((track) => track.forceStopSources());
        // Log active sources AFTER force-stop
        this.tracks.forEach((track) => {
          const clips = (track as any).clips ?? [];
          const activeCount = clips.reduce((sum: number, cp: any) =>
            sum + ((cp.player as any)._activeSources?.size ?? 0), 0);
          if (activeCount > 0) {
            console.warn(`[DEBUG post-forceStop] STILL ACTIVE track "${track.id}": ${activeCount}`);
          }
        });
      }

      if (offset !== undefined) {
        console.log('[DEBUG TonePlayout.play()] transport.start()', { startTime, offset });
        transport.start(startTime, offset);
      } else {
        transport.start(startTime);
      }
      // Log player states after transport.start()
      this.tracks.forEach((track) => {
        const clips = (track as any).clips ?? [];
        const detail = clips.map((cp: any) => ({
          state: cp.player.state,
          activeSources: (cp.player as any)._activeSources?.size ?? '?',
        }));
        console.log(`[DEBUG after start] track "${track.id}":`, JSON.stringify(detail));
      });
    } catch (err) {
      // Clean up scheduled events since Transport failed to start
      this.clearCompletionEvent();
      this.tracks.forEach((track) => track.cancelFades());
      console.warn(
        '[waveform-playlist] Transport.start() failed. Audio playback could not begin.',
        err
      );
      // Re-throw so the caller can avoid setting _isPlaying = true
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
    this.tracks.forEach((track) => track.cancelFades());
    this.clearCompletionEvent();
  }

  stop(): void {
    const transport = getTransport();
    console.log('[DEBUG TonePlayout.stop()]', { transportState: transport.state });
    try {
      transport.stop();
    } catch (err) {
      console.warn('[waveform-playlist] Transport.stop() failed:', err);
    }
    // Log active sources BEFORE force-stop
    this.tracks.forEach((track) => {
      const clips = (track as any).clips ?? [];
      const detail = clips.map((cp: any) => ({
        state: cp.player.state,
        activeSources: (cp.player as any)._activeSources?.size ?? '?',
      }));
      const hasActive = detail.some((d: any) => d.activeSources > 0 || d.state === 'started');
      if (hasActive) {
        console.warn(`[DEBUG stop() pre-forceStop] ACTIVE track "${track.id}":`, JSON.stringify(detail));
      }
    });
    // Force-dispose orphaned active sources immediately.
    // Transport.stop() triggers _syncedStop which calls source.stop(),
    // but cleanup (_activeSources.delete) is async via context.setTimeout.
    // Without this, a subsequent Transport.start() layers new sources on
    // top of orphaned ones, producing double audio.
    this.tracks.forEach((track) => track.forceStopSources());
    // Verify force-stop worked
    this.tracks.forEach((track) => {
      const clips = (track as any).clips ?? [];
      const activeCount = clips.reduce((sum: number, cp: any) =>
        sum + ((cp.player as any)._activeSources?.size ?? 0), 0);
      if (activeCount > 0) {
        console.warn(`[DEBUG stop() post-forceStop] STILL ACTIVE track "${track.id}": ${activeCount}`);
      }
    });
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

      // Update mute state of all tracks based on solo logic
      this.updateSoloMuting();
    }
  }

  private updateSoloMuting(): void {
    const hasSoloedTracks = this.soloedTracks.size > 0;

    this.tracks.forEach((track, id) => {
      if (hasSoloedTracks) {
        // If there are soloed tracks, mute all non-soloed tracks
        if (!this.soloedTracks.has(id)) {
          track.setMute(true);
        } else {
          // Restore manual mute state for soloed tracks
          const manuallyMuted = this.manualMuteState.get(id) ?? false;
          track.setMute(manuallyMuted);
        }
      } else {
        // No soloed tracks, restore original manual mute state for all tracks
        const manuallyMuted = this.manualMuteState.get(id) ?? false;
        track.setMute(manuallyMuted);
      }
    });
  }

  setMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      // Store the manual mute state
      this.manualMuteState.set(trackId, muted);
      track.setMute(muted);
    }
  }

  setLoop(enabled: boolean, loopStart: number, loopEnd: number): void {
    const transport = getTransport();
    console.log('[DEBUG TonePlayout.setLoop()]', { enabled, loopStart, loopEnd, transportState: transport.state, hadHandler: !!this._loopHandler });
    try {
      transport.loop = enabled;
      transport.loopStart = loopStart;
      transport.loopEnd = loopEnd;
    } catch (err) {
      console.warn('[waveform-playlist] Error configuring Transport loop:', err);
    }
    this._loopStart = loopStart;

    if (enabled && !this._loopHandler) {
      this._loopHandler = () => {
        // Re-schedule fades for the new loop iteration.
        // Transport stops all synced sources at loopEnd and restarts at loopStart.
        // Fade envelopes (AudioParam automations) don't persist across this cycle.
        // Use this._loopStart (exact configured value) for the tick-0 guard,
        // NOT transport.seconds which has floating-point drift after loop cycles.
        // transport.seconds is still used for fade scheduling (close enough).
        const currentTime = now();
        const transportOffset = transport.seconds;
        this.tracks.forEach((track) => {
          try {
            track.cancelFades();
            track.setTransportStartOffset(this._loopStart);
            track.prepareFades(currentTime, transportOffset);
          } catch (err) {
            console.warn(
              `[waveform-playlist] Error re-scheduling fades for track "${track.id}" on loop:`,
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

    // Clean up loop handler
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

    // Clean up effects if cleanup function was provided
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
