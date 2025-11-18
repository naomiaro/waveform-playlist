import * as Tone from 'tone';
import { Track, FadeType } from '@waveform-playlist/core';
import { createFadeIn, createFadeOut } from 'fade-maker';

export interface ToneTrackOptions {
  buffer: AudioBuffer;
  track: Track;
}

export class ToneTrack {
  private player: Tone.Player;
  private volumeNode: Tone.Volume;
  private panNode: Tone.Panner;
  private fadeGain: Tone.Gain;
  private muteGain: Tone.Gain;
  private track: Track;
  private audioBuffer: AudioBuffer;

  constructor(options: ToneTrackOptions) {
    this.track = options.track;
    this.audioBuffer = options.buffer;

    // Create the audio chain
    this.player = new Tone.Player({
      url: options.buffer,
      loop: false,
    });

    this.fadeGain = new Tone.Gain(1);
    this.volumeNode = new Tone.Volume(this.gainToDb(options.track.gain));
    this.panNode = new Tone.Panner(options.track.stereoPan);
    this.muteGain = new Tone.Gain(options.track.muted ? 0 : 1);

    // Chain: Player -> FadeGain -> Volume -> Pan -> MuteGain -> Destination
    this.player.chain(
      this.fadeGain,
      this.volumeNode,
      this.panNode,
      this.muteGain,
      Tone.getDestination()
    );

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

  play(when: number = Tone.now(), offset: number = 0, duration?: number): void {
    const startTime = this.track.startTime + offset;
    const playDuration = duration ?? (this.track.endTime ? this.track.endTime - startTime : undefined);

    if (playDuration !== undefined) {
      this.player.start(when, startTime, playDuration);
    } else {
      this.player.start(when, startTime);
    }
  }

  stop(when: number = Tone.now()): void {
    this.player.stop(when);
  }

  dispose(): void {
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
}
