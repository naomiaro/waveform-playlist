import {
  Volume,
  Gain,
  ToneAudioNode,
  connect,
  getDestination,
  getTransport,
  getContext,
} from 'tone';
import {
  Track,
  gainToDb,
  applyFadeIn,
  applyFadeOut,
  createPanStage,
  type Fade,
  type PanStage,
} from '@waveform-playlist/core';
import { getUnderlyingAudioParam } from './fades';

/**
 * Wires a track's effects, PRE-FADER (#660): connect `trackInput` through
 * your effects and into `faderInput`. The track's volume, pan and mute come
 * after, so the fader never changes how hard a compressor or distortion
 * works.
 *
 * The chain MUST end at `faderInput`. Anything connected elsewhere (the
 * master bus, `toDestination()`) bypasses the track's volume, pan, mute and
 * solo.
 *
 * @param trackInput - Where the track's clips/notes arrive (unity gain)
 * @param faderInput - The track's volume stage; connect the chain's end here
 * @param isOffline - Whether rendering offline (for export)
 * @returns Optional cleanup function called when the track is disposed
 */
export type TrackEffectsFunction = (
  trackInput: Gain,
  faderInput: ToneAudioNode,
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
  /** Max channel count across clips — selects the pan law (core's createPanStage). Default: 1 */
  channelCount?: number;
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
  /** Pre-fader summing point: clip sources → inputGain → [effects] → volume. */
  private inputGain: Gain;
  private volumeNode: Volume;
  private panStage: PanStage;
  private muteGain: Gain;
  private track: Track;
  private effectsCleanup?: () => void;
  private _hasClosureEffects: boolean;
  private _effectsChain: { input: AudioNode; output: AudioNode } | null = null;
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
    this.inputGain = new Gain({ gain: 1 });
    this.volumeNode = new Volume(gainToDb(options.track.gain));
    // Core's gain-matrix pan stage, built from native nodes on Tone's raw
    // context. The pan LAW is chosen by the source's channel count.
    this.panStage = createPanStage(
      getContext().rawContext as BaseAudioContext,
      options.track.stereoPan,
      options.channelCount ?? 1
    );
    this.muteGain = new Gain(options.track.muted ? 0 : 1);

    // Every source goes through the gain-matrix pan stage (never a Tone
    // Panner — see the playout CLAUDE.md): Volume → Pan → MuteGain → destination.
    // Tone's connect() helper makes the native → Tone edge.
    this.volumeNode.connect(this.panStage.input);
    connect(this.panStage.output, this.muteGain);
    this.muteGain.connect(options.destination || getDestination());

    // Pre-fader insert (#660): inputGain → [effects] → Volume. The fader,
    // pan and mute all come after the effects.
    this._hasClosureEffects = Boolean(options.effects);
    if (options.effects) {
      const cleanup = options.effects(this.inputGain, this.volumeNode, false);
      if (cleanup) {
        this.effectsCleanup = cleanup;
      }
    } else {
      this.inputGain.connect(this.volumeNode);
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

    // Native AudioNode behind the track input, for native→Tone connection
    // (plain Gain.input is the native GainNode).
    const trackNativeInput = this.inputGain.input;

    // Schedule each clip via Transport.schedule() with native AudioBufferSourceNode
    this.scheduledClips = clipInfos.map((clipInfo) => {
      // Native GainNode for per-clip fade envelope — created once, reused across play cycles
      const fadeGainNode = rawContext.createGain();
      fadeGainNode.gain.value = clipInfo.gain;
      fadeGainNode.connect(trackNativeInput);

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
          `(time=${audioContextTime}, offset=${offset}, duration=${duration}):` +
          ' ' +
          String(err)
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
    const fadeGainNode = rawContext.createGain();
    fadeGainNode.gain.value = clipInfo.gain;
    fadeGainNode.connect(this.inputGain.input);

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
    } catch (err) {
      console.warn(
        '[waveform-playlist] removeScheduledClip: clear failed on track "' +
          this.id +
          '": ' +
          String(err)
      );
    }
    try {
      scheduled.fadeGainNode.disconnect();
    } catch (err) {
      console.warn(
        '[waveform-playlist] removeScheduledClip: disconnect failed on track "' +
          this.id +
          '": ' +
          String(err)
      );
    }

    this.scheduledClips.splice(index, 1);
  }

  /**
   * Select the pan law from the track's source material: 1 = mono law,
   * 2+ = stereo law. Call when the track's clips change — a stereo clip
   * joining a mono track moves it to the stereo law (same rule as the
   * native transport and the offline export).
   */
  setSourceChannelCount(sourceChannelCount: number): void {
    this.panStage.setSourceChannelCount(sourceChannelCount);
  }

  /**
   * Replace clips on this track. Diffs old vs new by buffer + timing —
   * unchanged clips keep their active sources playing (no audible interruption).
   * Changed/added/removed clips are rescheduled. Disconnecting a removed clip's
   * fadeGainNode silences its source immediately (audio path broken) without
   * needing to explicitly stop it.
   */
  replaceClips(newClips: ClipInfo[], newStartTime?: number): void {
    // When track.startTime changes, all Transport events must be rescheduled
    // because absolute times (track.startTime + clip.startTime) shift even if
    // relative clip.startTime values stay the same.
    const startTimeChanged = newStartTime !== undefined && newStartTime !== this.track.startTime;

    // Update track startTime if the minimum clip position changed (e.g., moveClip)
    if (newStartTime !== undefined) {
      this.track.startTime = newStartTime;
    }
    const tp = getTransport();

    // Diff old vs new clips — a clip is "unchanged" if buffer reference and
    // all timing properties match exactly. Skip diff if startTime changed
    // (all clips need rescheduling for new absolute positions).
    const kept: ScheduledClip[] = [];
    const toAdd: ClipInfo[] = [];
    const matched = new Set<number>(); // indices into this.scheduledClips

    if (startTimeChanged) {
      // Force full reschedule — all new clips are "toAdd", none kept
      toAdd.push(...newClips);
    } else {
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
    }

    // Remove old clips that weren't matched — disconnect fadeGainNode to
    // silence any active source (audio path broken, no audible pop)
    for (let i = 0; i < this.scheduledClips.length; i++) {
      if (!matched.has(i)) {
        const scheduled = this.scheduledClips[i];
        try {
          tp.clear(scheduled.scheduleId);
        } catch (err) {
          console.warn(
            '[waveform-playlist] replaceClips: clear failed on track "' +
              this.id +
              '": ' +
              String(err)
          );
        }
        try {
          scheduled.fadeGainNode.disconnect();
        } catch (err) {
          console.warn(
            '[waveform-playlist] replaceClips: disconnect failed on track "' +
              this.id +
              '": ' +
              String(err)
          );
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
          // Schedule the clip's fade envelope for this play cycle — without
          // it the clip plays at flat gain until the next play().
          this.scheduleFades(scheduled, audioContextTime, clipInfo.offset + Math.max(0, elapsed));
        } else if (absClipStart >= transportOffset) {
          // Clip starts later this cycle: its schedule callback will create
          // the source, but fades were prepared at play() — before this clip
          // existed. Schedule them now at the clip's future start time.
          const delay = absClipStart - transportOffset;
          this.scheduleFades(scheduled, audioContextTime + delay, clipInfo.offset);
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
        console.warn(
          `[waveform-playlist] Error stopping source on track "${this.id}":` + ' ' + String(err)
        );
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

  setVolume(gain: number): void {
    this.track.gain = gain;
    this.volumeNode.volume.value = gainToDb(gain);
  }

  setPan(pan: number): void {
    this.track.stereoPan = pan;
    this.panStage.setPan(pan);
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

  /**
   * The pre-fader track input (clip sources arrive here, ahead of the
   * effects). The MIDI half of a mixed audio+MIDI track sums its voices into
   * it so both halves share one effects chain and one channel strip.
   */
  get trackInput(): Gain {
    return this.inputGain;
  }

  /** Native node behind the Volume stage — where an external chain returns. */
  private get _faderNativeInput(): AudioNode {
    // Volume.input is a Tone.js Gain<"decibels"> whose .input is the native
    // GainNode; cast through unknown (Gain<"decibels"> vs Gain<"gain">).
    return (this.volumeNode.input as unknown as Gain).input;
  }

  /**
   * Insert an external effects chain PRE-FADER (#660):
   * `inputGain → input … output → volume → pan → mute`. The track owns both
   * edges; the caller only builds what lies between the two nodes (pass the
   * same node twice for a single-node effect). Replaces any chain connected
   * earlier. Mutually exclusive with the TrackEffectsFunction closure model.
   */
  connectEffects(input: AudioNode, output: AudioNode): void {
    if (this._hasClosureEffects) {
      throw new Error(
        '[waveform-playlist] Track "' +
          this.track.id +
          '" was built with a TrackEffectsFunction closure — transport effects hooks and ' +
          'closure effects are mutually exclusive.'
      );
    }
    this._releaseEffectsChain();
    // Guard the disconnect — the rewire must proceed even if the direct edge
    // is already gone.
    try {
      this.inputGain.disconnect();
    } catch (err) {
      console.warn(
        '[waveform-playlist] connectEffects disconnect on track "' +
          this.track.id +
          '": ' +
          String(err)
      );
    }
    this.inputGain.connect(input);
    output.connect(this._faderNativeInput);
    this._effectsChain = { input, output };
  }

  /** Restore the direct inputGain → volume connection. Safe when nothing is connected. */
  disconnectEffects(): void {
    if (!this._effectsChain) return;
    this._releaseEffectsChain();
    try {
      this.inputGain.disconnect();
    } catch (err) {
      console.warn(
        '[waveform-playlist] disconnectEffects: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
    this.inputGain.connect(this.volumeNode);
  }

  /** Targeted disconnect of the chain's return edge (output → volume); a
   *  consumer may have disposed its chain first, so failures only warn. */
  private _releaseEffectsChain(): void {
    if (!this._effectsChain) return;
    try {
      this._effectsChain.output.disconnect(this._faderNativeInput);
    } catch (err) {
      console.warn(
        '[waveform-playlist] effects chain was already disconnected from track "' +
          this.track.id +
          '": ' +
          String(err)
      );
    }
    this._effectsChain = null;
  }

  dispose(): void {
    const transport = getTransport();

    if (this.effectsCleanup) {
      try {
        this.effectsCleanup();
      } catch (err) {
        console.warn(
          `[waveform-playlist] Error during track "${this.id}" effects cleanup:` + ' ' + String(err)
        );
      }
    }

    this.stopAllSources();

    // Clear Transport schedule events and disconnect native fade gain nodes
    this.scheduledClips.forEach((scheduled, index) => {
      try {
        transport.clear(scheduled.scheduleId);
      } catch (err) {
        console.warn(
          `[waveform-playlist] Error clearing schedule ${index} on track "${this.id}":` +
            ' ' +
            String(err)
        );
      }
      try {
        scheduled.fadeGainNode.disconnect();
      } catch (err) {
        console.warn(
          `[waveform-playlist] Error disconnecting fadeGain ${index} on track "${this.id}":` +
            ' ' +
            String(err)
        );
      }
    });

    // Drop an external chain's return edge so it stops feeding (and
    // retaining) this track's dead volume node.
    this._releaseEffectsChain();
    try {
      this.inputGain.dispose();
    } catch (err) {
      console.warn(
        `[waveform-playlist] Error disposing inputGain on track "${this.id}":` + ' ' + String(err)
      );
    }
    try {
      this.volumeNode.dispose();
    } catch (err) {
      console.warn(
        `[waveform-playlist] Error disposing volumeNode on track "${this.id}":` + ' ' + String(err)
      );
    }
    try {
      this.panStage.dispose();
    } catch (err) {
      console.warn(
        `[waveform-playlist] Error disposing panNode on track "${this.id}":` + ' ' + String(err)
      );
    }
    try {
      this.muteGain.dispose();
    } catch (err) {
      console.warn(
        `[waveform-playlist] Error disposing muteGain on track "${this.id}":` + ' ' + String(err)
      );
    }
  }

  get id(): string {
    return this.track.id;
  }

  get duration(): number {
    // Max end across clips — the array is NOT sorted by startTime
    // (replaceClips/addClip append), so array-last is not the latest-ending.
    let max = 0;
    for (const { clipInfo } of this.scheduledClips) {
      const end = clipInfo.startTime + clipInfo.duration;
      if (end > max) max = end;
    }
    return max;
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
