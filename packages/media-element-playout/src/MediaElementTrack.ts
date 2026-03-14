import type { WaveformDataObject, FadeConfig } from '@waveform-playlist/core';
import { applyFadeIn, applyFadeOut, generateCurve } from '@waveform-playlist/core';

export type { FadeConfig } from '@waveform-playlist/core';

/**
 * Extended HTMLAudioElement with vendor-prefixed preservesPitch properties.
 * `preservesPitch` is standard; the `moz` and `webkit` prefixes are for older browsers.
 */
interface VendorPrefixedPitch {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
}

export interface MediaElementTrackOptions {
  /** The audio source - can be a URL, Blob URL, or HTMLAudioElement */
  source: string | HTMLAudioElement;
  /** Pre-computed waveform data for visualization (required - no AudioBuffer decoding) */
  peaks: WaveformDataObject;
  /** Track ID */
  id?: string;
  /** Track name for display */
  name?: string;
  /** Initial volume (0.0 to 1.0) */
  volume?: number;
  /** Initial playback rate (0.5 to 2.0) */
  playbackRate?: number;
  /** Whether to preserve pitch when changing playback rate (default: true) */
  preservesPitch?: boolean;
  /**
   * AudioContext for Web Audio routing.
   * When provided, audio is routed through Web Audio nodes for fades and effects:
   *   HTMLAudioElement → MediaElementSourceNode → fadeGain → volumeGain → destination
   *
   * Without this, playback uses HTMLAudioElement directly (no fades or effects).
   *
   * Note: createMediaElementSource() can only be called once per element.
   * Once routed, HTMLAudioElement.volume no longer works — volume is controlled
   * via the Web Audio GainNode instead.
   */
  audioContext?: AudioContext;
  /** Fade in configuration (requires audioContext) */
  fadeIn?: FadeConfig;
  /** Fade out configuration (requires audioContext) */
  fadeOut?: FadeConfig;
}

/**
 * Single-track playback using HTMLAudioElement.
 *
 * Benefits over AudioBuffer/Tone.js:
 * - Pitch-preserving playback rate (0.5x - 2.0x) via browser's built-in algorithm
 * - No AudioBuffer decoding required (uses pre-computed peaks for visualization)
 * - Simpler, lighter-weight for single-track use cases
 *
 * When an AudioContext is provided:
 * - Audio routes through Web Audio graph for fades and effects
 * - Volume controlled via GainNode (HTMLAudioElement.volume is bypassed)
 * - Output node exposed for connecting external effects chains
 */
export class MediaElementTrack {
  private audioElement: HTMLAudioElement;
  private ownsElement: boolean; // Whether we created the element (need to clean up)
  private _peaks: WaveformDataObject;
  private _id: string;
  private _name: string;
  private _playbackRate: number = 1;
  private _volume: number;
  private onStopCallback?: () => void;
  private onTimeUpdateCallback?: (time: number) => void;

  // Web Audio nodes (only when audioContext is provided)
  private _audioContext: AudioContext | null = null;
  private _sourceNode: MediaElementAudioSourceNode | null = null;
  private _fadeGain: GainNode | null = null;
  private _volumeGain: GainNode | null = null;
  private _fadeIn: FadeConfig | undefined;
  private _fadeOut: FadeConfig | undefined;

  constructor(options: MediaElementTrackOptions) {
    this._peaks = options.peaks;
    this._id = options.id ?? `track-${Date.now()}`;
    this._name = options.name ?? 'Track';
    this._playbackRate = options.playbackRate ?? 1;
    this._volume = options.volume ?? 1;
    this._fadeIn = options.fadeIn;
    this._fadeOut = options.fadeOut;

    // Create or use provided audio element
    if (typeof options.source === 'string') {
      this.audioElement = new Audio(options.source);
      this.ownsElement = true;
    } else {
      this.audioElement = options.source;
      this.ownsElement = false;
    }

    // Configure audio element
    this.audioElement.preload = 'auto';
    this.audioElement.playbackRate = this._playbackRate;

    // Set pitch preservation (default: true).
    // When false, the browser won't apply its own pitch correction — useful
    // when an external processor like SoundTouch handles pitch compensation.
    // Vendor-prefixed properties are non-standard; cast once for type safety.
    const shouldPreservePitch = options.preservesPitch ?? true;
    const audio = this.audioElement as unknown as VendorPrefixedPitch;
    if ('preservesPitch' in this.audioElement) {
      audio.preservesPitch = shouldPreservePitch;
    } else if ('mozPreservesPitch' in this.audioElement) {
      audio.mozPreservesPitch = shouldPreservePitch;
    } else if ('webkitPreservesPitch' in this.audioElement) {
      audio.webkitPreservesPitch = shouldPreservePitch;
    }

    // Set up Web Audio routing if AudioContext provided
    if (options.audioContext) {
      this._audioContext = options.audioContext;
      try {
        this._sourceNode = options.audioContext.createMediaElementSource(this.audioElement);
      } catch (err) {
        throw new Error(
          '[waveform-playlist] MediaElementTrack: createMediaElementSource() failed. ' +
            'This can happen if the audio element is already connected to another AudioContext. ' +
            'Each audio element can only have one MediaElementSourceNode. ' +
            'Original error: ' +
            String(err)
        );
      }
      this._fadeGain = options.audioContext.createGain();
      this._volumeGain = options.audioContext.createGain();
      this._volumeGain.gain.value = this._volume;

      this._sourceNode.connect(this._fadeGain);
      this._fadeGain.connect(this._volumeGain);
      this._volumeGain.connect(options.audioContext.destination);

      // With Web Audio routing, HTMLAudioElement.volume is bypassed.
      // Set it to 1 so it doesn't attenuate the signal before the source node.
      this.audioElement.volume = 1;
    } else {
      // Without Web Audio, use HTMLAudioElement.volume directly
      this.audioElement.volume = this._volume;
    }

    // Set up event listeners
    this.audioElement.addEventListener('ended', this.handleEnded);
    this.audioElement.addEventListener('timeupdate', this.handleTimeUpdate);
  }

  private handleEnded = () => {
    this._cancelFades();
    if (this.onStopCallback) {
      this.onStopCallback();
    }
  };

  private handleTimeUpdate = () => {
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.audioElement.currentTime);
    }
  };

  /**
   * Schedule fade automation on the fade GainNode.
   * Called at the start of each play() — fades are relative to the playback offset.
   */
  private _scheduleFades(offset: number): void {
    if (!this._fadeGain || !this._audioContext) return;

    const fadeGain = this._fadeGain.gain;
    const now = this._audioContext.currentTime;
    const totalDuration = this.duration;

    // Reset fade gain
    fadeGain.cancelScheduledValues(0);
    fadeGain.setValueAtTime(1, now);

    // Fade in
    if (this._fadeIn && this._fadeIn.duration > 0) {
      const fadeInEnd = this._fadeIn.duration;
      if (offset < fadeInEnd) {
        const remainingFade = fadeInEnd - offset;
        const fadeType = this._fadeIn.type ?? 'linear';
        if (offset === 0) {
          // Full fade from beginning
          applyFadeIn(fadeGain, now, remainingFade, fadeType, 0, 1);
        } else {
          // Partial fade — slice the original curve to preserve shape
          const curve = generateCurve(fadeType, 1000, true);
          const startIndex = Math.round((offset / this._fadeIn.duration) * (curve.length - 1));
          const sliced = curve.slice(startIndex);
          fadeGain.setValueAtTime(sliced[0], now);
          fadeGain.setValueCurveAtTime(sliced, now, remainingFade);
        }
      }
    }

    // Fade out
    if (this._fadeOut && this._fadeOut.duration > 0) {
      const fadeOutStart = totalDuration - this._fadeOut.duration;
      if (offset < totalDuration && fadeOutStart < totalDuration) {
        if (offset > fadeOutStart) {
          // Already past the fade-out start — slice original curve to preserve shape
          const elapsed = offset - fadeOutStart;
          const fadeType = this._fadeOut.type ?? 'linear';
          const curve = generateCurve(fadeType, 1000, false);
          const startIndex = Math.round((elapsed / this._fadeOut.duration) * (curve.length - 1));
          const sliced = curve.slice(startIndex);
          const remainingDuration = this._fadeOut.duration - elapsed;
          fadeGain.setValueAtTime(sliced[0], now);
          fadeGain.setValueCurveAtTime(sliced, now, remainingDuration);
        } else {
          // Schedule full fade-out at the right time
          const delayUntilFadeOut = fadeOutStart - offset;
          applyFadeOut(
            fadeGain,
            now + delayUntilFadeOut,
            this._fadeOut.duration,
            this._fadeOut.type ?? 'linear',
            1,
            0
          );
        }
      }
    }
  }

  /**
   * Cancel any scheduled fade automation.
   */
  private _cancelFades(): void {
    if (this._fadeGain) {
      this._fadeGain.gain.cancelScheduledValues(0);
      this._fadeGain.gain.value = 1;
    }
  }

  /**
   * Start playback from a specific time.
   * Resumes the AudioContext first if suspended, then schedules fades
   * (fades depend on audioContext.currentTime being non-zero).
   */
  play(offset: number = 0): void {
    const startPlayback = () => {
      this._scheduleFades(offset);
      this.audioElement.currentTime = offset;
      this.audioElement.play().catch((err) => {
        console.warn('[waveform-playlist] MediaElementTrack: play() failed: ' + String(err));
      });
    };

    // Resume AudioContext if suspended (browser autoplay policy).
    // Must await resume before scheduling fades — audioContext.currentTime
    // is 0 while suspended, which would schedule all fades in the past.
    if (this._audioContext && this._audioContext.state === 'suspended') {
      this._audioContext
        .resume()
        .then(startPlayback)
        .catch((err) => {
          console.warn(
            '[waveform-playlist] MediaElementTrack: AudioContext.resume() failed: ' + String(err)
          );
        });
    } else {
      startPlayback();
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    this._cancelFades();
    this.audioElement.pause();
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this._cancelFades();
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  /**
   * Seek to a specific time
   */
  seekTo(time: number): void {
    this.audioElement.currentTime = Math.max(0, Math.min(time, this.duration));
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._volumeGain) {
      this._volumeGain.gain.value = this._volume;
    } else {
      this.audioElement.volume = this._volume;
    }
  }

  /**
   * Set playback rate (0.5 to 2.0, pitch preserved)
   */
  setPlaybackRate(rate: number): void {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    this._playbackRate = clampedRate;
    this.audioElement.playbackRate = clampedRate;
  }

  /**
   * Set muted state
   */
  setMuted(muted: boolean): void {
    this.audioElement.muted = muted;
  }

  /**
   * Set fade in configuration
   */
  setFadeIn(fadeIn: FadeConfig | undefined): void {
    this._fadeIn = fadeIn;
  }

  /**
   * Set fade out configuration
   */
  setFadeOut(fadeOut: FadeConfig | undefined): void {
    this._fadeOut = fadeOut;
  }

  /**
   * Set callback for when playback ends
   */
  setOnStopCallback(callback: () => void): void {
    this.onStopCallback = callback;
  }

  /**
   * Set callback for time updates
   */
  setOnTimeUpdateCallback(callback: (time: number) => void): void {
    this.onTimeUpdateCallback = callback;
  }

  /**
   * Connect the output to a different destination (for effects chains).
   * Disconnects from the current destination first.
   *
   * @param destination - The AudioNode to connect to
   */
  connectOutput(destination: AudioNode): void {
    if (!this._volumeGain) {
      console.warn(
        '[waveform-playlist] MediaElementTrack: connectOutput() requires audioContext. ' +
          'Pass audioContext in constructor options.'
      );
      return;
    }
    try {
      this._volumeGain.disconnect();
    } catch (err) {
      console.warn(
        '[waveform-playlist] MediaElementTrack: disconnect before connectOutput failed: ' +
          String(err)
      );
    }
    this._volumeGain.connect(destination);
  }

  /**
   * Disconnect the output and reconnect to the default AudioContext destination.
   */
  disconnectOutput(): void {
    if (!this._volumeGain || !this._audioContext) return;
    try {
      this._volumeGain.disconnect();
    } catch (err) {
      console.warn(
        '[waveform-playlist] MediaElementTrack: disconnect before disconnectOutput failed: ' +
          String(err)
      );
    }
    this._volumeGain.connect(this._audioContext.destination);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.audioElement.removeEventListener('ended', this.handleEnded);
    this.audioElement.removeEventListener('timeupdate', this.handleTimeUpdate);
    this._cancelFades();
    this.audioElement.pause();

    if (this._sourceNode) {
      try {
        this._sourceNode.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MediaElementTrack: sourceNode disconnect failed: ' + String(err)
        );
      }
    }
    if (this._fadeGain) {
      try {
        this._fadeGain.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MediaElementTrack: fadeGain disconnect failed: ' + String(err)
        );
      }
    }
    if (this._volumeGain) {
      try {
        this._volumeGain.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MediaElementTrack: volumeGain disconnect failed: ' + String(err)
        );
      }
    }

    if (this.ownsElement) {
      this.audioElement.src = '';
      this.audioElement.load(); // Release resources
    }
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get peaks(): WaveformDataObject {
    return this._peaks;
  }

  get currentTime(): number {
    return this.audioElement.currentTime;
  }

  get duration(): number {
    return this.audioElement.duration || this._peaks.duration;
  }

  get isPlaying(): boolean {
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  get volume(): number {
    return this._volume;
  }

  get playbackRate(): number {
    return this._playbackRate;
  }

  get muted(): boolean {
    return this.audioElement.muted;
  }

  /**
   * Get the underlying audio element (for advanced use cases)
   */
  get element(): HTMLAudioElement {
    return this.audioElement;
  }

  /**
   * Get the volume GainNode output (for connecting effects chains).
   * Returns null if no AudioContext was provided.
   */
  get outputNode(): GainNode | null {
    return this._volumeGain;
  }
}
