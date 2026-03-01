// Named imports for tree-shaking
import { Player, Volume, Gain, Panner, ToneAudioNode, getDestination } from 'tone';
import { Track, type Fade } from '@waveform-playlist/core';
import { applyFadeIn, applyFadeOut, getUnderlyingAudioParam } from './fades';

// Effects function no longer receives ToneLib - effects should import Tone themselves
export type TrackEffectsFunction = (
  graphEnd: Gain,
  masterGainNode: ToneAudioNode,
  isOffline: boolean
) => void | (() => void);

export interface ClipInfo {
  buffer: AudioBuffer;
  startTime: number; // When this clip starts in the track timeline (seconds)
  duration: number; // How long this clip plays (seconds)
  offset: number; // Where to start playing within the buffer (seconds)
  fadeIn?: Fade;
  fadeOut?: Fade;
  gain: number; // Clip-level gain
}

export interface ToneTrackOptions {
  buffer?: AudioBuffer; // Legacy: single buffer (deprecated, use clips instead)
  clips?: ClipInfo[]; // Modern: array of clips
  track: Track;
  effects?: TrackEffectsFunction;
  destination?: ToneAudioNode;
}

interface ClipPlayer {
  player: Player;
  clipInfo: ClipInfo;
  fadeGain: Gain;
}

export class ToneTrack {
  private clips: ClipPlayer[]; // Array of clip players
  private volumeNode: Volume;
  private panNode: Panner;
  private muteGain: Gain;
  private track: Track;
  private effectsCleanup?: () => void;

  constructor(options: ToneTrackOptions) {
    this.track = options.track;

    // Create shared track-level nodes
    this.volumeNode = new Volume(this.gainToDb(options.track.gain));
    this.panNode = new Panner(options.track.stereoPan);
    this.muteGain = new Gain(options.track.muted ? 0 : 1);

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

    // Create clips array - support both legacy single buffer and modern clips array
    const clipInfos: ClipInfo[] =
      options.clips ||
      (options.buffer
        ? [
            {
              buffer: options.buffer,
              startTime: 0, // Legacy: single buffer starts at timeline position 0
              duration: options.buffer.duration, // Legacy: play full buffer duration
              offset: 0,
              fadeIn: options.track.fadeIn,
              fadeOut: options.track.fadeOut,
              gain: 1,
            },
          ]
        : []);

    // Create ClipPlayer for each clip, sync to Transport
    this.clips = clipInfos.map((clipInfo) => {
      const player = new Player({
        url: clipInfo.buffer,
        loop: false,
      });

      const fadeGain = new Gain(clipInfo.gain);

      // Chain: Player -> FadeGain -> Volume -> Pan -> MuteGain
      player.connect(fadeGain);
      fadeGain.chain(this.volumeNode, this.panNode, this.muteGain);

      // Sync to Transport: player starts at absolute timeline position
      // with buffer offset and duration. Transport drives all playback.
      const absTransportTime = this.track.startTime + clipInfo.startTime;
      player.sync().start(absTransportTime, clipInfo.offset, clipInfo.duration);

      return {
        player,
        clipInfo,
        fadeGain,
      };
    });
  }

  /**
   * Schedule fade envelopes for a clip at the given AudioContext time
   */
  private scheduleFades(
    clipPlayer: ClipPlayer,
    clipStartTime: number,
    clipOffset: number = 0
  ): void {
    const { clipInfo, fadeGain } = clipPlayer;
    const audioParam = getUnderlyingAudioParam(fadeGain.gain);
    if (!audioParam) return;

    // Cancel any previous automation
    audioParam.cancelScheduledValues(0);

    // Calculate how much of the clip we're skipping (for seeking)
    const skipTime = clipOffset - clipInfo.offset;

    // Apply fade in if it exists and we haven't skipped past it
    if (clipInfo.fadeIn && skipTime < clipInfo.fadeIn.duration) {
      const fadeInDuration = clipInfo.fadeIn.duration;

      if (skipTime <= 0) {
        // Starting from the beginning - full fade in
        applyFadeIn(
          audioParam,
          clipStartTime,
          fadeInDuration,
          clipInfo.fadeIn.type || 'linear',
          0,
          clipInfo.gain
        );
      } else {
        // Starting partway through fade in - calculate partial fade
        const remainingFadeDuration = fadeInDuration - skipTime;
        const fadeProgress = skipTime / fadeInDuration;
        const startValue = clipInfo.gain * fadeProgress; // Approximate current fade value
        applyFadeIn(
          audioParam,
          clipStartTime,
          remainingFadeDuration,
          clipInfo.fadeIn.type || 'linear',
          startValue,
          clipInfo.gain
        );
      }
    } else {
      // No fade in or skipped past it - set to full gain
      audioParam.setValueAtTime(clipInfo.gain, clipStartTime);
    }

    // Apply fade out if it exists
    if (clipInfo.fadeOut) {
      const fadeOutStart = clipInfo.duration - clipInfo.fadeOut.duration;
      const fadeOutStartInClip = fadeOutStart - skipTime; // Relative to where we're starting

      if (fadeOutStartInClip > 0) {
        // Fade out hasn't started yet
        const absoluteFadeOutStart = clipStartTime + fadeOutStartInClip;
        applyFadeOut(
          audioParam,
          absoluteFadeOutStart,
          clipInfo.fadeOut.duration,
          clipInfo.fadeOut.type || 'linear',
          clipInfo.gain,
          0
        );
      } else if (fadeOutStartInClip > -clipInfo.fadeOut.duration) {
        // We're starting partway through the fade out
        const elapsedFadeOut = -fadeOutStartInClip;
        const remainingFadeDuration = clipInfo.fadeOut.duration - elapsedFadeOut;
        const fadeProgress = elapsedFadeOut / clipInfo.fadeOut.duration;
        const startValue = clipInfo.gain * (1 - fadeProgress); // Approximate current fade value
        applyFadeOut(
          audioParam,
          clipStartTime,
          remainingFadeDuration,
          clipInfo.fadeOut.type || 'linear',
          startValue,
          0
        );
      }
      // If fadeOutStartInClip <= -duration, we've skipped past the entire fade out
    }
  }

  /**
   * Prepare fade envelopes for all clips based on Transport offset.
   * Called before Transport.start() to schedule fades at correct AudioContext times.
   */
  prepareFades(when: number, transportOffset: number): void {
    this.clips.forEach((clipPlayer) => {
      const absClipStart = this.track.startTime + clipPlayer.clipInfo.startTime;
      const absClipEnd = absClipStart + clipPlayer.clipInfo.duration;

      if (transportOffset >= absClipEnd) return; // clip already finished

      if (transportOffset >= absClipStart) {
        // Mid-clip: playing now
        const clipOffset = transportOffset - absClipStart + clipPlayer.clipInfo.offset;
        this.scheduleFades(clipPlayer, when, clipOffset);
      } else {
        // Clip starts later
        const delay = absClipStart - transportOffset;
        this.scheduleFades(clipPlayer, when + delay, clipPlayer.clipInfo.offset);
      }
    });
  }

  /**
   * Cancel all scheduled fade automation and reset to nominal gain.
   * Called on pause/stop to prevent stale fade envelopes.
   */
  cancelFades(): void {
    this.clips.forEach(({ fadeGain, clipInfo }) => {
      const audioParam = getUnderlyingAudioParam(fadeGain.gain);
      if (audioParam) {
        audioParam.cancelScheduledValues(0);
        audioParam.setValueAtTime(clipInfo.gain, 0);
      }
    });
  }

  private gainToDb(gain: number): number {
    return 20 * Math.log10(gain);
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
    const value = muted ? 0 : 1;
    // Use setValueAtTime on the raw AudioParam to ensure the value is applied
    // even when the AudioContext is suspended. Setting .gain.value on the Tone.js
    // Signal wrapper doesn't propagate to the underlying AudioParam until the
    // context resumes, causing a brief audio glitch (e.g., all tracks audible
    // before solo muting takes effect).
    const audioParam = getUnderlyingAudioParam(this.muteGain.gain);
    audioParam?.setValueAtTime(value, 0);
    this.muteGain.gain.value = value;
  }

  setSolo(soloed: boolean): void {
    this.track.soloed = soloed;
  }

  dispose(): void {
    // Clean up effects if cleanup function was provided
    if (this.effectsCleanup) {
      this.effectsCleanup();
    }

    // Dispose all clip players (Player.dispose() calls unsync() internally)
    this.clips.forEach((clipPlayer) => {
      clipPlayer.player.dispose();
      clipPlayer.fadeGain.dispose();
    });

    // Dispose shared track nodes
    this.volumeNode.dispose();
    this.panNode.dispose();
    this.muteGain.dispose();
  }

  get id(): string {
    return this.track.id;
  }

  get duration(): number {
    // Return the end time of the last clip
    if (this.clips.length === 0) return 0;
    const lastClip = this.clips[this.clips.length - 1];
    return lastClip.clipInfo.startTime + lastClip.clipInfo.duration;
  }

  get buffer(): AudioBuffer {
    // For backward compatibility, return the first clip's buffer
    return this.clips[0]?.clipInfo.buffer;
  }

  get isPlaying(): boolean {
    // Track is playing if any clip is playing
    return this.clips.some((clipPlayer) => clipPlayer.player.state === 'started');
  }

  get muted(): boolean {
    return this.track.muted;
  }

  get startTime(): number {
    // Return the track's start time from the Track object
    // This is the absolute timeline position where the track starts
    return this.track.startTime;
  }
}
