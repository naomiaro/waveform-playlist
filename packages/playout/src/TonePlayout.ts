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

    // Clear any pending completion event
    this.clearCompletionEvent();

    // Cancel stale fades and re-schedule for all tracks
    const transportOffset = offset ?? 0;
    this.tracks.forEach((track) => {
      track.cancelFades();
      track.prepareFades(startTime, transportOffset);
    });

    // Schedule duration-limited stop via Transport
    if (duration !== undefined) {
      this._completionEventId = getTransport().scheduleOnce(() => {
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
      if (offset !== undefined) {
        getTransport().start(startTime, offset);
      } else {
        // No offset — let Transport resume from its current position
        getTransport().start(startTime);
      }
    } catch (err) {
      // Clean up scheduled events since Transport failed to start
      this.clearCompletionEvent();
      this.tracks.forEach((track) => track.cancelFades());
      console.warn(
        '[waveform-playlist] Transport.start() failed. Audio playback could not begin.',
        err
      );
    }
  }

  pause(): void {
    getTransport().pause();
    this.tracks.forEach((track) => track.cancelFades());
    this.clearCompletionEvent();
  }

  stop(): void {
    getTransport().stop();
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
    transport.loop = enabled;
    transport.loopStart = loopStart;
    transport.loopEnd = loopEnd;

    if (enabled && !this._loopHandler) {
      this._loopHandler = () => {
        // Re-schedule fades for the new loop iteration
        const currentTime = now();
        const transportOffset = transport.seconds;
        this.tracks.forEach((track) => {
          track.cancelFades();
          track.prepareFades(currentTime, transportOffset);
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
