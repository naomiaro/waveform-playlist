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

export interface ClipInfo {
  buffer: AudioBuffer;
  startTime: number; // When this clip starts in the track timeline (seconds)
  duration: number; // How long this clip plays (seconds)
  offset: number; // Where to start playing within the buffer (seconds)
  fadeIn?: { start: number; end: number; type: FadeType };
  fadeOut?: { start: number; end: number; type: FadeType };
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

      // Apply fades if they exist for this clip
      if (clipInfo.fadeIn) {
        const audioParam = (fadeGain.gain as any)._param as AudioParam;
        createFadeIn(
          audioParam,
          clipInfo.fadeIn.type,
          clipInfo.fadeIn.start,
          clipInfo.fadeIn.end - clipInfo.fadeIn.start
        );
      }

      if (clipInfo.fadeOut) {
        const audioParam = (fadeGain.gain as any)._param as AudioParam;
        createFadeOut(
          audioParam,
          clipInfo.fadeOut.type,
          clipInfo.fadeOut.start,
          clipInfo.fadeOut.end - clipInfo.fadeOut.start
        );
      }

      return {
        player,
        clipInfo,
        fadeGain,
        pausedPosition: 0,
        playStartTime: 0,
      };
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
    this.muteGain.gain.value = muted ? 0 : 1;
  }

  setSolo(soloed: boolean): void {
    this.track.soloed = soloed;
  }

  play(when?: number, offset: number = 0, duration?: number): void {
    // Evaluate now() inside function body, not in parameter default (which is evaluated at module load time)
    const startWhen = when ?? now();

    // Don't start if already playing
    if (this.isPlaying) return;

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
          player.start(startWhen, clipOffset, clipDuration);
        } else {
          // This clip starts later - schedule it
          const delay = clipStart - playbackPosition;
          const clipDuration = duration ? Math.min(duration - delay, clipInfo.duration) : clipInfo.duration;

          if (delay < (duration ?? Infinity)) {
            clipPlayer.pausedPosition = clipInfo.offset;
            player.start(startWhen + delay, clipInfo.offset, clipDuration);
          } else {
            this.activePlayers--;
          }
        }
      }
    });
  }

  pause(): void {
    if (!this.isPlaying) return;

    // Stop all playing clips and update their paused positions
    this.clips.forEach(clipPlayer => {
      if (clipPlayer.player.state === 'started') {
        const elapsed = (now() - clipPlayer.playStartTime) * clipPlayer.player.playbackRate;
        clipPlayer.pausedPosition = clipPlayer.pausedPosition + elapsed;
        clipPlayer.player.stop();
      }
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
