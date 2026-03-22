import {
  Volume,
  Gain,
  Panner,
  ToneAudioNode,
  getDestination,
  getTransport,
  getContext,
} from 'tone';
import { Track, type Fade } from '@waveform-playlist/core';
import { applyFadeIn, applyFadeOut, getUnderlyingAudioParam } from './fades';

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

/** Per-clip scheduling info and audio nodes */
interface ScheduledClip {
  clipInfo: ClipInfo;
  fadeGainNode: GainNode; // Native GainNode for per-clip fade envelope
  scheduleId: number; // Transport.schedule() event ID
}

export class ToneTrack {
  private scheduledClips: ScheduledClip[];
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private volumeNode: Volume;
  private panNode: Panner;
  private muteGain: Gain;
  private track: Track;
  private effectsCleanup?: () => void;
  // Guard against ghost tick schedule callbacks. After stop/start cycles with
  // loops, stale Clock._lastUpdate causes ticks from the previous cycle to fire
  // Transport.schedule() callbacks at past positions (e.g., time 0 clips fire
  // when starting at offset 5s). Clips before this offset are handled by
  // startMidClipSources(); schedule callbacks should only create sources for
  // clips at/after this offset.
  private _scheduleGuardOffset = 0;

  constructor(options: ToneTrackOptions) {
    this.track = options.track;

    // Create shared track-level Tone.js nodes
    this.volumeNode = new Volume(this.gainToDb(options.track.gain));
    // Tone.js Panner defaults to channelCount: 1 + channelCountMode: 'explicit',
    // which forces stereo→mono downmix (1/√2 attenuation) before panning.
    // Override to channelCount: 2 to preserve stereo recordings.
    this.panNode = new Panner({ pan: options.track.stereoPan, channelCount: 2 });
    this.muteGain = new Gain(options.track.muted ? 0 : 1);

    // Chain shared Tone.js nodes: Volume → Pan → MuteGain
    this.volumeNode.chain(this.panNode, this.muteGain);

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
              startTime: 0,
              duration: options.buffer.duration,
              offset: 0,
              fadeIn: options.track.fadeIn,
              fadeOut: options.track.fadeOut,
              gain: 1,
            },
          ]
        : []);

    const transport = getTransport();
    const rawContext = getContext().rawContext as AudioContext;

    // Get the native AudioNode input of the Volume for native→Tone connection.
    // Volume.input is a Tone.js Gain<"decibels"> whose .input is the native GainNode.
    // Cast through unknown since Gain<"decibels"> and Gain<"gain"> don't overlap.
    const volumeNativeInput = (this.volumeNode.input as unknown as Gain).input;

    // Schedule each clip via Transport.schedule() with native AudioBufferSourceNode
    this.scheduledClips = clipInfos.map((clipInfo) => {
      // Native GainNode for per-clip fade envelope — created once, reused across play cycles
      const fadeGainNode = rawContext.createGain();
      fadeGainNode.gain.value = clipInfo.gain;
      fadeGainNode.connect(volumeNativeInput);

      // Schedule a permanent Transport event at the clip's absolute timeline position.
      // This callback fires on every play and every loop iteration when Transport
      // passes this point.
      const absTransportTime = this.track.startTime + clipInfo.startTime;
      const scheduleId = transport.schedule((audioContextTime: number) => {
        // Guard: ghost ticks from stale Clock._lastUpdate can fire this callback
        // at past positions (see Tone.js #1419). Clips before the play/loop offset
        // are already handled by startMidClipSources().
        if (absTransportTime < this._scheduleGuardOffset) {
          return;
        }
        this.startClipSource(clipInfo, fadeGainNode, audioContextTime);
      }, absTransportTime);

      return { clipInfo, fadeGainNode, scheduleId };
    });
  }

  /**
   * Create and start an AudioBufferSourceNode for a clip.
   * Sources are one-shot: each play or loop iteration creates a fresh one.
   */
  private startClipSource(
    clipInfo: ClipInfo,
    fadeGainNode: GainNode,
    audioContextTime: number,
    bufferOffset?: number,
    playDuration?: number
  ): void {
    const rawContext = getContext().rawContext as AudioContext;
    const source = rawContext.createBufferSource();
    source.buffer = clipInfo.buffer;
    source.connect(fadeGainNode);

    const offset = bufferOffset ?? clipInfo.offset;
    const duration = playDuration ?? clipInfo.duration;

    try {
      source.start(audioContextTime, offset, duration);
    } catch (err) {
      console.warn(
        `[waveform-playlist] Failed to start source on track "${this.id}" ` +
          `(time=${audioContextTime}, offset=${offset}, duration=${duration}):`,
        err
      );
      source.disconnect();
      return;
    }

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };
  }

  /**
   * Set the schedule guard offset. Schedule callbacks for clips before this
   * offset are suppressed (already handled by startMidClipSources).
   * Must be called before transport.start() and in the loop handler.
   */
  setScheduleGuardOffset(offset: number): void {
    this._scheduleGuardOffset = offset;
  }

  /**
   * Start sources for clips that span the given Transport position.
   * Used for mid-playback seeking and loop boundary handling where
   * Transport.schedule() callbacks have already passed.
   *
   * Uses strict < for absClipStart to avoid double-creation with
   * schedule callbacks at exact Transport position (e.g., loopStart).
   */
  startMidClipSources(transportOffset: number, audioContextTime: number): void {
    for (const { clipInfo, fadeGainNode } of this.scheduledClips) {
      const absClipStart = this.track.startTime + clipInfo.startTime;
      const absClipEnd = absClipStart + clipInfo.duration;

      // Only handle clips that started before the transport position
      // but haven't ended yet (i.e., the transport is "inside" the clip)
      if (absClipStart < transportOffset && absClipEnd > transportOffset) {
        const elapsed = transportOffset - absClipStart;
        const adjustedOffset = clipInfo.offset + elapsed;
        const remainingDuration = clipInfo.duration - elapsed;
        this.startClipSource(
          clipInfo,
          fadeGainNode,
          audioContextTime,
          adjustedOffset,
          remainingDuration
        );
      }
    }
  }

  /**
   * Add a clip to this track at runtime. Creates a Transport.schedule event
   * and fadeGainNode. If playing, starts the source mid-clip if needed.
   */
  addClip(clipInfo: ClipInfo): ScheduledClip {
    const transport = getTransport();
    const rawContext = getContext().rawContext as AudioContext;
    const volumeNativeInput = (this.volumeNode.input as unknown as Gain).input;

    const fadeGainNode = rawContext.createGain();
    fadeGainNode.gain.value = clipInfo.gain;
    fadeGainNode.connect(volumeNativeInput);

    const absTransportTime = this.track.startTime + clipInfo.startTime;
    const scheduleId = transport.schedule((audioContextTime: number) => {
      if (absTransportTime < this._scheduleGuardOffset) return;
      this.startClipSource(clipInfo, fadeGainNode, audioContextTime);
    }, absTransportTime);

    const scheduled: ScheduledClip = { clipInfo, fadeGainNode, scheduleId };
    this.scheduledClips.push(scheduled);
    return scheduled;
  }

  /**
   * Remove a scheduled clip by index. Clears the Transport event and
   * disconnects the fadeGainNode.
   */
  removeScheduledClip(index: number): void {
    const scheduled = this.scheduledClips[index];
    if (!scheduled) return;
    const transport = getTransport();

    try {
      transport.clear(scheduled.scheduleId);
    } catch {
      /* already cleared */
    }
    try {
      scheduled.fadeGainNode.disconnect();
    } catch {
      /* already disconnected */
    }

    this.scheduledClips.splice(index, 1);
  }

  /**
   * Replace clips on this track. Diffs old vs new by buffer + timing —
   * unchanged clips keep their active sources playing (no audible interruption).
   * Changed/added/removed clips are rescheduled. Disconnecting a removed clip's
   * fadeGainNode silences its source immediately (audio path broken) without
   * needing to explicitly stop it.
   */
  replaceClips(newClips: ClipInfo[], newStartTime?: number): void {
    // Update track startTime if the minimum clip position changed (e.g., moveClip)
    if (newStartTime !== undefined) {
      this.track.startTime = newStartTime;
    }
    const tp = getTransport();

    // Diff old vs new clips — a clip is "unchanged" if buffer reference and
    // all timing properties match exactly
    const kept: ScheduledClip[] = [];
    const toAdd: ClipInfo[] = [];
    const matched = new Set<number>(); // indices into this.scheduledClips

    for (const clipInfo of newClips) {
      const idx = this.scheduledClips.findIndex(
        (s, i) => !matched.has(i) && this._clipsEqual(s.clipInfo, clipInfo)
      );
      if (idx !== -1) {
        kept.push(this.scheduledClips[idx]);
        matched.add(idx);
      } else {
        toAdd.push(clipInfo);
      }
    }

    // Remove old clips that weren't matched — disconnect fadeGainNode to
    // silence any active source (audio path broken, no audible pop)
    for (let i = 0; i < this.scheduledClips.length; i++) {
      if (!matched.has(i)) {
        const scheduled = this.scheduledClips[i];
        try {
          tp.clear(scheduled.scheduleId);
        } catch {
          /* */
        }
        try {
          scheduled.fadeGainNode.disconnect();
        } catch {
          /* */
        }
      }
    }

    this.scheduledClips = kept;

    // Add new/changed clips — start mid-clip source if Transport is running
    const isPlaying = tp.state === 'started';
    for (const clipInfo of toAdd) {
      const scheduled = this.addClip(clipInfo);
      if (isPlaying) {
        const context = getContext();
        const transportOffset = tp.seconds;
        const audioContextTime = context.currentTime;
        // Transport runs lookAhead ahead of what's audible. The old source was
        // disconnected but had ~lookAhead of buffered audio still playing.
        // Start the new source lookAhead earlier so it overlaps with the
        // remaining buffered audio, producing a seamless transition.
        const lookAhead = context.lookAhead ?? 0;
        const audibleOffset = Math.max(0, transportOffset - lookAhead);
        const absClipStart = this.track.startTime + clipInfo.startTime;
        const absClipEnd = absClipStart + clipInfo.duration;
        if (absClipStart < transportOffset && absClipEnd > audibleOffset) {
          const elapsed = audibleOffset - absClipStart;
          this.startClipSource(
            clipInfo,
            scheduled.fadeGainNode,
            audioContextTime,
            clipInfo.offset + Math.max(0, elapsed),
            clipInfo.duration - Math.max(0, elapsed)
          );
        }
      }
    }
  }

  /** Compare two clips by reference (buffer), timing, and fade properties */
  private _clipsEqual(a: ClipInfo, b: ClipInfo): boolean {
    return (
      a.buffer === b.buffer &&
      a.startTime === b.startTime &&
      a.duration === b.duration &&
      a.offset === b.offset &&
      a.gain === b.gain &&
      a.fadeIn?.duration === b.fadeIn?.duration &&
      a.fadeIn?.type === b.fadeIn?.type &&
      a.fadeOut?.duration === b.fadeOut?.duration &&
      a.fadeOut?.type === b.fadeOut?.type
    );
  }

  /**
   * Stop all active AudioBufferSourceNodes and clear the set.
   * Native AudioBufferSourceNodes ignore Transport state changes —
   * they must be explicitly stopped.
   */
  stopAllSources(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (err) {
        console.warn(`[waveform-playlist] Error stopping source on track "${this.id}":`, err);
      }
    });
    this.activeSources.clear();
  }

  /**
   * Schedule fade envelopes for a clip at the given AudioContext time.
   * Uses native GainNode.gain (AudioParam) directly — no _param workaround needed.
   */
  private scheduleFades(
    scheduled: ScheduledClip,
    clipStartTime: number,
    clipOffset: number = 0
  ): void {
    const { clipInfo, fadeGainNode } = scheduled;
    const audioParam = fadeGainNode.gain;

    // Cancel any previous automation
    audioParam.cancelScheduledValues(0);

    // Calculate how much of the clip we're skipping (for seeking)
    const skipTime = clipOffset - clipInfo.offset;

    // Apply fade in if it exists and we haven't skipped past it
    if (clipInfo.fadeIn && skipTime < clipInfo.fadeIn.duration) {
      const fadeInDuration = clipInfo.fadeIn.duration;

      if (skipTime <= 0) {
        applyFadeIn(
          audioParam,
          clipStartTime,
          fadeInDuration,
          clipInfo.fadeIn.type || 'linear',
          0,
          clipInfo.gain
        );
      } else {
        const remainingFadeDuration = fadeInDuration - skipTime;
        const fadeProgress = skipTime / fadeInDuration;
        const startValue = clipInfo.gain * fadeProgress;
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
      audioParam.setValueAtTime(clipInfo.gain, clipStartTime);
    }

    // Apply fade out if it exists
    if (clipInfo.fadeOut) {
      const fadeOutStart = clipInfo.duration - clipInfo.fadeOut.duration;
      const fadeOutStartInClip = fadeOutStart - skipTime;

      if (fadeOutStartInClip > 0) {
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
        const elapsedFadeOut = -fadeOutStartInClip;
        const remainingFadeDuration = clipInfo.fadeOut.duration - elapsedFadeOut;
        const fadeProgress = elapsedFadeOut / clipInfo.fadeOut.duration;
        const startValue = clipInfo.gain * (1 - fadeProgress);
        applyFadeOut(
          audioParam,
          clipStartTime,
          remainingFadeDuration,
          clipInfo.fadeOut.type || 'linear',
          startValue,
          0
        );
      }
    }
  }

  /**
   * Prepare fade envelopes for all clips based on Transport offset.
   * Called before Transport.start() to schedule fades at correct AudioContext times.
   */
  prepareFades(when: number, transportOffset: number): void {
    this.scheduledClips.forEach((scheduled) => {
      const absClipStart = this.track.startTime + scheduled.clipInfo.startTime;
      const absClipEnd = absClipStart + scheduled.clipInfo.duration;

      if (transportOffset >= absClipEnd) return; // clip already finished

      if (transportOffset >= absClipStart) {
        // Mid-clip: playing now
        const clipOffset = transportOffset - absClipStart + scheduled.clipInfo.offset;
        this.scheduleFades(scheduled, when, clipOffset);
      } else {
        // Clip starts later
        const delay = absClipStart - transportOffset;
        this.scheduleFades(scheduled, when + delay, scheduled.clipInfo.offset);
      }
    });
  }

  /**
   * Cancel all scheduled fade automation and reset to nominal gain.
   * Called on pause/stop to prevent stale fade envelopes.
   */
  cancelFades(): void {
    this.scheduledClips.forEach(({ fadeGainNode, clipInfo }) => {
      const audioParam = fadeGainNode.gain;
      audioParam.cancelScheduledValues(0);
      audioParam.setValueAtTime(clipInfo.gain, 0);
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
    const transport = getTransport();

    if (this.effectsCleanup) {
      try {
        this.effectsCleanup();
      } catch (err) {
        console.warn(`[waveform-playlist] Error during track "${this.id}" effects cleanup:`, err);
      }
    }

    this.stopAllSources();

    // Clear Transport schedule events and disconnect native fade gain nodes
    this.scheduledClips.forEach((scheduled, index) => {
      try {
        transport.clear(scheduled.scheduleId);
      } catch (err) {
        console.warn(
          `[waveform-playlist] Error clearing schedule ${index} on track "${this.id}":`,
          err
        );
      }
      try {
        scheduled.fadeGainNode.disconnect();
      } catch (err) {
        console.warn(
          `[waveform-playlist] Error disconnecting fadeGain ${index} on track "${this.id}":`,
          err
        );
      }
    });

    try {
      this.volumeNode.dispose();
    } catch (err) {
      console.warn(`[waveform-playlist] Error disposing volumeNode on track "${this.id}":`, err);
    }
    try {
      this.panNode.dispose();
    } catch (err) {
      console.warn(`[waveform-playlist] Error disposing panNode on track "${this.id}":`, err);
    }
    try {
      this.muteGain.dispose();
    } catch (err) {
      console.warn(`[waveform-playlist] Error disposing muteGain on track "${this.id}":`, err);
    }
  }

  get id(): string {
    return this.track.id;
  }

  get duration(): number {
    if (this.scheduledClips.length === 0) return 0;
    const lastClip = this.scheduledClips[this.scheduledClips.length - 1];
    return lastClip.clipInfo.startTime + lastClip.clipInfo.duration;
  }

  get buffer(): AudioBuffer {
    return this.scheduledClips[0]?.clipInfo.buffer;
  }

  get muted(): boolean {
    return this.track.muted;
  }

  get startTime(): number {
    return this.track.startTime;
  }
}
