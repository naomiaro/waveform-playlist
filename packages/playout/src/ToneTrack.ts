// Named imports for tree-shaking
import {
  Player,
  Volume,
  Gain,
  Panner,
  ToneAudioNode,
  getDestination,
  now,
} from 'tone';
import { Track, FadeType } from '@waveform-playlist/core';
import { createFadeIn, createFadeOut } from 'fade-maker';

// Effects function no longer receives ToneLib - effects should import Tone themselves
export type TrackEffectsFunction = (graphEnd: Gain, masterGainNode: ToneAudioNode, isOffline: boolean) => void | (() => void);

export interface ToneTrackOptions {
  buffer: AudioBuffer;
  track: Track;
  effects?: TrackEffectsFunction;
  destination?: ToneAudioNode;
}

export class ToneTrack {
  private player: Player;
  private volumeNode: Volume;
  private panNode: Panner;
  private fadeGain: Gain;
  private muteGain: Gain;
  private track: Track;
  private audioBuffer: AudioBuffer;
  private pausedPosition: number = 0;
  private playStartTime: number = 0;
  private effectsCleanup?: () => void;
  private onStopCallback?: () => void;

  constructor(options: ToneTrackOptions) {
    this.track = options.track;
    this.audioBuffer = options.buffer;

    // Create the audio chain
    this.player = new Player({
      url: options.buffer,
      loop: false,
      onstop: () => {
        if (this.onStopCallback) {
          this.onStopCallback();
        }
      },
    });

    this.fadeGain = new Gain(1);
    this.volumeNode = new Volume(this.gainToDb(options.track.gain));
    this.panNode = new Panner(options.track.stereoPan);
    this.muteGain = new Gain(options.track.muted ? 0 : 1);

    // Build base chain: Player -> FadeGain -> Volume -> Pan -> MuteGain
    this.player.chain(
      this.fadeGain,
      this.volumeNode,
      this.panNode,
      this.muteGain
    );

    // Connect to destination or apply effects chain
    const destination = options.destination || getDestination();
    if (options.effects) {
      const cleanup = options.effects(this.muteGain, destination, false);
      if (cleanup) {
        this.effectsCleanup = cleanup;
      }
    } else {
      this.muteGain.connect(destination);
    }

    // Apply fades if they exist
    if (options.track.fadeIn) {
      this.applyFadeIn(
        options.track.fadeIn.start,
        options.track.fadeIn.end - options.track.fadeIn.start,
        options.track.fadeIn.type
      );
    }

    if (options.track.fadeOut) {
      this.applyFadeOut(
        options.track.fadeOut.start,
        options.track.fadeOut.end - options.track.fadeOut.start,
        options.track.fadeOut.type
      );
    }
  }

  private gainToDb(gain: number): number {
    return 20 * Math.log10(gain);
  }

  applyFadeIn(start: number, duration: number, shape: FadeType = 'logarithmic'): void {
    // Get the raw audio param from Tone's Gain node
    const audioParam = (this.fadeGain.gain as any)._param as AudioParam;
    createFadeIn(audioParam, shape, start, duration);
  }

  applyFadeOut(start: number, duration: number, shape: FadeType = 'logarithmic'): void {
    // Get the raw audio param from Tone's Gain node
    const audioParam = (this.fadeGain.gain as any)._param as AudioParam;
    createFadeOut(audioParam, shape, start, duration);
  }

  setVolume(gain: number): void {
    this.track.gain = gain;
    this.volumeNode.volume.value = this.gainToDb(gain);
  }

  setPan(pan: number): void {
    this.track.stereoPan = pan;
    this.panNode.pan.value = pan;
  }

  setMute(muted: boolean): void {
    this.track.muted = muted;
    this.muteGain.gain.value = muted ? 0 : 1;
  }

  setSolo(soloed: boolean): void {
    this.track.soloed = soloed;
  }

  play(when: number = now(), offset: number = 0, duration?: number): void {
    // Don't start if already playing
    if (this.isPlaying) return;

    // Record when we started playing
    this.playStartTime = now();

    // Calculate the buffer position (not including track.startTime - that's handled by the playout scheduling)
    const bufferPosition = this.pausedPosition + offset;
    const playDuration = duration ?? (this.track.endTime ? this.track.endTime - bufferPosition : undefined);

    if (playDuration !== undefined) {
      this.player.start(when, bufferPosition, playDuration);
    } else {
      this.player.start(when, bufferPosition);
    }
  }

  pause(): void {
    if (!this.isPlaying) return;

    // Calculate current position based on elapsed time
    const elapsed = (now() - this.playStartTime) * this.player.playbackRate;
    this.pausedPosition = this.pausedPosition + elapsed;

    this.player.stop();
  }

  stop(when: number = now()): void {
    this.player.stop(when);
    this.pausedPosition = 0;
  }

  dispose(): void {
    // Clean up effects if cleanup function was provided
    if (this.effectsCleanup) {
      this.effectsCleanup();
    }

    this.player.dispose();
    this.volumeNode.dispose();
    this.panNode.dispose();
    this.fadeGain.dispose();
    this.muteGain.dispose();
  }

  get id(): string {
    return this.track.id;
  }

  get duration(): number {
    return this.audioBuffer.duration;
  }

  get buffer(): AudioBuffer {
    return this.audioBuffer;
  }

  get isPlaying(): boolean {
    return this.player.state === 'started';
  }

  get muted(): boolean {
    return this.track.muted;
  }

  get startTime(): number {
    return this.track.startTime;
  }

  setOnStopCallback(callback: () => void): void {
    this.onStopCallback = callback;
  }
}
