import { MediaElementTrack, type MediaElementTrackOptions } from './MediaElementTrack';

export interface MediaElementPlayoutOptions {
  /** Initial master volume (0.0 to 1.0) */
  masterVolume?: number;
  /** Initial playback rate (0.5 to 2.0) */
  playbackRate?: number;
}

/**
 * Single-track playout engine using HTMLAudioElement.
 *
 * This is a lightweight alternative to TonePlayout for single-track use cases
 * that need pitch-preserving playback rate control.
 *
 * Key features:
 * - Pitch-preserving playback rate (0.5x - 2.0x)
 * - Uses pre-computed peaks (no AudioBuffer required)
 * - Simpler API for single-track playback
 *
 * Limitations:
 * - Single track only - will warn if multiple tracks added
 * - No multi-track mixing
 *
 * For multi-track editing, use TonePlayout from @waveform-playlist/playout instead.
 */
export class MediaElementPlayout {
  private track: MediaElementTrack | null = null;
  private _masterVolume: number;
  private _playbackRate: number;
  private _isPlaying: boolean = false;
  private onPlaybackCompleteCallback?: () => void;

  constructor(options: MediaElementPlayoutOptions = {}) {
    this._masterVolume = options.masterVolume ?? 1;
    this._playbackRate = options.playbackRate ?? 1;
  }

  /**
   * Initialize the playout engine.
   * For MediaElementPlayout this is a no-op — HTMLAudioElement doesn't require
   * explicit initialization. When an AudioContext is provided for fades/effects,
   * it resumes automatically on first play via MediaElementTrack.
   */
  async init(): Promise<void> {
    // No initialization needed — audio element handles autoplay policy automatically
  }

  /**
   * Add a track to the playout.
   * Note: Only one track is supported. Adding a second track will dispose the first.
   */
  addTrack(options: MediaElementTrackOptions): MediaElementTrack {
    if (this.track) {
      console.warn(
        'MediaElementPlayout: Only one track is supported. ' +
          'Disposing previous track. For multi-track, use TonePlayout.'
      );
      this.track.dispose();
    }

    this.track = new MediaElementTrack({
      ...options,
      volume: this._masterVolume * (options.volume ?? 1),
      playbackRate: this._playbackRate,
    });

    // Set up stop callback
    this.track.setOnStopCallback(() => {
      this._isPlaying = false;
      if (this.onPlaybackCompleteCallback) {
        this.onPlaybackCompleteCallback();
      }
    });

    return this.track;
  }

  /**
   * Remove a track by ID.
   */
  removeTrack(trackId: string): void {
    if (this.track && this.track.id === trackId) {
      this.track.dispose();
      this.track = null;
    }
  }

  /**
   * Get a track by ID.
   */
  getTrack(trackId: string): MediaElementTrack | undefined {
    if (this.track && this.track.id === trackId) {
      return this.track;
    }
    return undefined;
  }

  /**
   * Start playback.
   * @param _when - Ignored (HTMLAudioElement doesn't support scheduled start)
   * @param offset - Start position in seconds
   * @param duration - Duration to play in seconds (optional)
   */
  play(_when?: number, offset?: number, duration?: number): void {
    if (!this.track) {
      console.warn('MediaElementPlayout: No track to play');
      return;
    }

    const startPosition = offset ?? 0;
    this._isPlaying = true;

    this.track.play(startPosition);

    // If duration is specified, schedule stop
    if (duration !== undefined) {
      const adjustedDuration = duration / this._playbackRate;
      setTimeout(() => {
        if (this._isPlaying) {
          this.pause();
          if (this.onPlaybackCompleteCallback) {
            this.onPlaybackCompleteCallback();
          }
        }
      }, adjustedDuration * 1000);
    }
  }

  /**
   * Pause playback.
   */
  pause(): void {
    if (this.track) {
      this.track.pause();
    }
    this._isPlaying = false;
  }

  /**
   * Stop playback and reset to start.
   */
  stop(): void {
    if (this.track) {
      this.track.stop();
    }
    this._isPlaying = false;
  }

  /**
   * Seek to a specific time.
   */
  seekTo(time: number): void {
    if (this.track) {
      this.track.seekTo(time);
    }
  }

  /**
   * Get current playback time.
   */
  getCurrentTime(): number {
    if (this.track) {
      return this.track.currentTime;
    }
    return 0;
  }

  /**
   * Set master volume.
   */
  setMasterVolume(volume: number): void {
    this._masterVolume = Math.max(0, Math.min(1, volume));
    if (this.track) {
      this.track.setVolume(this._masterVolume);
    }
  }

  /**
   * Set playback rate (0.5 to 2.0, pitch preserved).
   */
  setPlaybackRate(rate: number): void {
    this._playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.track) {
      this.track.setPlaybackRate(this._playbackRate);
    }
  }

  /**
   * Set mute state for a track.
   */
  setMute(trackId: string, muted: boolean): void {
    const track = this.getTrack(trackId);
    if (track) {
      track.setMuted(muted);
    }
  }

  /**
   * Set solo state for a track.
   * Note: With single track, solo is effectively the same as unmute.
   */
  setSolo(_trackId: string, _soloed: boolean): void {
    // No-op for single track - solo doesn't make sense
    console.warn('MediaElementPlayout: Solo is not applicable for single-track playback');
  }

  /**
   * Set callback for when playback completes.
   */
  setOnPlaybackComplete(callback: () => void): void {
    this.onPlaybackCompleteCallback = callback;
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    if (this.track) {
      this.track.dispose();
      this.track = null;
    }
  }

  // Getters
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get masterVolume(): number {
    return this._masterVolume;
  }

  get playbackRate(): number {
    return this._playbackRate;
  }

  get duration(): number {
    return this.track?.duration ?? 0;
  }

  get sampleRate(): number {
    // HTMLAudioElement doesn't expose sample rate directly
    // Return a common default - peaks will have the actual sample rate
    return this.track?.peaks.sample_rate ?? 44100;
  }

  /**
   * Get the volume GainNode output for connecting external effects chains.
   * Returns null if no AudioContext was provided to the track.
   *
   * Usage: disconnect from default destination, connect to effect input,
   * then connect effect output to audioContext.destination.
   */
  get outputNode(): GainNode | null {
    return this.track?.outputNode ?? null;
  }
}
