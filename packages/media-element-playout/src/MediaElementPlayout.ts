import {
  MediaElementTrack,
  type MediaElementTrackOptions,
  type MediaElementTrackEvents,
} from './MediaElementTrack';

export interface MediaElementPlayoutOptions {
  /** Initial master volume (0.0 to 1.0) */
  masterVolume?: number;
  /** Initial playback rate (0.25 to 4.0) */
  playbackRate?: number;
  /** Whether to preserve pitch when changing playback rate (default: true).
   *  Set to false when using an external pitch processor like SoundTouch. */
  preservesPitch?: boolean;
}

/**
 * Single-track playout engine using HTMLAudioElement.
 *
 * This is a lightweight alternative to TonePlayout for single-track use cases
 * that need pitch-preserving playback rate control.
 *
 * Key features:
 * - Pitch-preserving playback rate (0.25x - 4.0x)
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
  private _preservesPitch: boolean;
  private _isPlaying: boolean = false;
  private onPlaybackCompleteCallback?: () => void;
  /** Consumer event listeners, retained so they re-attach across track swaps. */
  private _eventListeners: Map<
    string,
    Set<MediaElementTrackEvents[keyof MediaElementTrackEvents]>
  > = new Map();

  constructor(options: MediaElementPlayoutOptions = {}) {
    this._masterVolume = options.masterVolume ?? 1;
    this._playbackRate = options.playbackRate ?? 1;
    this._preservesPitch = options.preservesPitch ?? true;
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
      preservesPitch: this._preservesPitch,
    });

    // Set up stop callback
    this.track.setOnStopCallback(() => {
      this._isPlaying = false;
      if (this.onPlaybackCompleteCallback) {
        this.onPlaybackCompleteCallback();
      }
    });

    // Re-attach any consumer listeners to the newly created track (covers the
    // first track and the addTrack-replace path).
    this._attachListenersToTrack();

    return this.track;
  }

  /**
   * Replace the playout's source (player-mode affordance). The documented
   * single-track replace path — does NOT warn like addTrack().
   *
   * For URL (string) sources with an existing track, swaps in place via
   * track.load(), reusing the element and preserving Web Audio routing. For a
   * provided HTMLAudioElement source, or when there is no track yet, (re)creates
   * the track. Returns the active track.
   */
  setSource(options: MediaElementTrackOptions): MediaElementTrack {
    // A source swap stops current playback (in-place load() pauses; recreate disposes).
    this._isPlaying = false;
    if (this.track && typeof options.source === 'string') {
      this.track.load(options.source, { peaks: options.peaks, name: options.name });
      return this.track;
    }
    // First source, or swapping to a provided element: (re)create the track.
    // Dispose silently — this is the documented single-track replace path, not
    // the multi-track misuse that addTrack() warns about.
    if (this.track) {
      this.track.dispose();
      this.track = null;
    }
    return this.addTrack(options);
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
   * Resume playback from the current position (player-mode affordance).
   * Unlike play() with no offset (which resets to 0), this keeps currentTime.
   * Delegates to play() with the current position as the offset, so all of
   * play()'s machinery (AudioContext resume, fades, _isPlaying) is reused.
   */
  resume(): void {
    this.play(undefined, this.getCurrentTime());
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
   * Set playback rate (0.25 to 4.0, pitch preserved).
   */
  setPlaybackRate(rate: number): void {
    this._playbackRate = Math.max(0.25, Math.min(4.0, rate));
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
   * Subscribe to a lifecycle event (loadedmetadata / play / pause / error /
   * ended / timeupdate) without reaching into track.element. Listeners are
   * retained and re-attached automatically when the source is swapped.
   */
  on<K extends keyof MediaElementTrackEvents>(
    event: K,
    listener: MediaElementTrackEvents[K]
  ): void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(listener);
    this.track?.on(event, listener);
  }

  /**
   * Unsubscribe a previously registered lifecycle listener.
   */
  off<K extends keyof MediaElementTrackEvents>(
    event: K,
    listener: MediaElementTrackEvents[K]
  ): void {
    this._eventListeners.get(event)?.delete(listener);
    this.track?.off(event, listener);
  }

  /**
   * Attach every registered listener to the current track. Called after a new
   * track is created so subscriptions survive source swaps. The cast is safe:
   * the event→listener correlation was enforced by the typed on() that filled
   * the registry; TS cannot track it through this loop.
   */
  private _attachListenersToTrack(): void {
    const track = this.track;
    if (!track) return;
    for (const [event, listeners] of this._eventListeners) {
      for (const listener of listeners) {
        track.on(
          event as keyof MediaElementTrackEvents,
          listener as MediaElementTrackEvents[keyof MediaElementTrackEvents]
        );
      }
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    if (this.track) {
      this.track.dispose();
      this.track = null;
    }
    this._eventListeners.clear();
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
    return this.track?.peaks?.sample_rate ?? 44100;
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
