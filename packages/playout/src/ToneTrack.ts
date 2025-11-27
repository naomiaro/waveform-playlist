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
import { Track, type Fade } from '@waveform-playlist/core';
import { applyFadeIn, applyFadeOut } from './fades';

// Effects function no longer receives ToneLib - effects should import Tone themselves
export type TrackEffectsFunction = (graphEnd: Gain, masterGainNode: ToneAudioNode, isOffline: boolean) => void | (() => void);

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
  pausedPosition: number;
  playStartTime: number;
}

export class ToneTrack {
  private clips: ClipPlayer[]; // Array of clip players
  private volumeNode: Volume;
  private panNode: Panner;
  private muteGain: Gain;
  private track: Track;
  private effectsCleanup?: () => void;
  private onStopCallback?: () => void;
  private activePlayers: number = 0; // Count of currently playing clips

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
    const clipInfos: ClipInfo[] = options.clips || (options.buffer ? [{
      buffer: options.buffer,
      startTime: 0, // Legacy: single buffer starts at timeline position 0
      duration: options.buffer.duration, // Legacy: play full buffer duration
      offset: 0,
      fadeIn: options.track.fadeIn,
      fadeOut: options.track.fadeOut,
      gain: 1,
    }] : []);

    // Create ClipPlayer for each clip
    this.clips = clipInfos.map(clipInfo => {
      const player = new Player({
        url: clipInfo.buffer,
        loop: false,
        onstop: () => {
          this.activePlayers--;
          if (this.activePlayers === 0 && this.onStopCallback) {
            this.onStopCallback();
          }
        },
      });

      const fadeGain = new Gain(clipInfo.gain);

      // Chain: Player -> FadeGain -> Volume -> Pan -> MuteGain
      player.connect(fadeGain);
      fadeGain.chain(this.volumeNode, this.panNode, this.muteGain);

      // Note: Fades are scheduled in play() method, not here in constructor,
      // because AudioParam automation requires absolute AudioContext time

      return {
        player,
        clipInfo,
        fadeGain,
        pausedPosition: 0,
        playStartTime: 0,
      };
    });
  }

  /**
   * Schedule fade envelopes for a clip at the given start time
   */
  private scheduleFades(clipPlayer: ClipPlayer, clipStartTime: number, clipOffset: number = 0): void {
    const { clipInfo, fadeGain } = clipPlayer;
    const audioParam = (fadeGain.gain as any)._param as AudioParam;

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
    this.muteGain.gain.value = muted ? 0 : 1;
  }

  setSolo(soloed: boolean): void {
    this.track.soloed = soloed;
  }

  play(when?: number, offset: number = 0, duration?: number): void {
    // Evaluate now() inside function body, not in parameter default (which is evaluated at module load time)
    const startWhen = when ?? now();

    // Stop any existing playback before starting new playback
    // This handles cases where play is called while still playing (e.g., selection replay)
    if (this.isPlaying) {
      this.stop();
    }

    this.activePlayers = 0;

    // Play each clip that should be active at this offset
    this.clips.forEach(clipPlayer => {
      const { player, clipInfo } = clipPlayer;

      // Calculate absolute timeline position we're starting from
      const playbackPosition = offset;

      // Check if this clip should be playing at this position
      const clipStart = clipInfo.startTime;
      const clipEnd = clipInfo.startTime + clipInfo.duration;

      if (playbackPosition < clipEnd) {
        // This clip should play
        this.activePlayers++;
        clipPlayer.playStartTime = now();

        if (playbackPosition >= clipStart) {
          // We're starting in the middle of this clip
          const clipOffset = playbackPosition - clipStart + clipInfo.offset;
          const remainingDuration = clipInfo.duration - (playbackPosition - clipStart);
          const clipDuration = duration ? Math.min(duration, remainingDuration) : remainingDuration;

          clipPlayer.pausedPosition = clipOffset;
          // Schedule fades at the actual playback start time
          this.scheduleFades(clipPlayer, startWhen, clipOffset);
          player.start(startWhen, clipOffset, clipDuration);
        } else {
          // This clip starts later - schedule it
          const delay = clipStart - playbackPosition;
          const clipDuration = duration ? Math.min(duration - delay, clipInfo.duration) : clipInfo.duration;

          if (delay < (duration ?? Infinity)) {
            clipPlayer.pausedPosition = clipInfo.offset;
            // Schedule fades at the delayed start time
            this.scheduleFades(clipPlayer, startWhen + delay, clipInfo.offset);
            player.start(startWhen + delay, clipInfo.offset, clipDuration);
          } else {
            this.activePlayers--;
          }
        }
      }
    });
  }

  pause(): void {
    // Stop all clips - both started and scheduled
    // Scheduled clips have state 'stopped' but still need to be cancelled
    this.clips.forEach(clipPlayer => {
      if (clipPlayer.player.state === 'started') {
        const elapsed = (now() - clipPlayer.playStartTime) * clipPlayer.player.playbackRate;
        clipPlayer.pausedPosition = clipPlayer.pausedPosition + elapsed;
      }
      // Always call stop() to cancel any scheduled playback
      clipPlayer.player.stop();
    });

    this.activePlayers = 0;
  }

  stop(when?: number): void {
    // Evaluate now() inside function body, not in parameter default (which is evaluated at module load time)
    const stopWhen = when ?? now();
    this.clips.forEach(clipPlayer => {
      clipPlayer.player.stop(stopWhen);
      clipPlayer.pausedPosition = 0;
    });
    this.activePlayers = 0;
  }

  dispose(): void {
    // Clean up effects if cleanup function was provided
    if (this.effectsCleanup) {
      this.effectsCleanup();
    }

    // Dispose all clip players
    this.clips.forEach(clipPlayer => {
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
    return this.clips.some(clipPlayer => clipPlayer.player.state === 'started');
  }

  get muted(): boolean {
    return this.track.muted;
  }

  get startTime(): number {
    // Return the track's start time from the Track object
    // This is the absolute timeline position where the track starts
    return this.track.startTime;
  }

  setOnStopCallback(callback: () => void): void {
    this.onStopCallback = callback;
  }
}
