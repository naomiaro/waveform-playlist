import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { Tick, Sample, SchedulerEvent, SchedulerListener } from '../types';
import type { SampleTimeline } from '../timeline/sample-timeline';
import type { TempoMap } from '../timeline/tempo-map';
import type { TrackNode } from './track-node';

export interface ClipEvent extends SchedulerEvent {
  trackId: string;
  clipId: string;
  audioBuffer: AudioBuffer;
  /** Clip position on timeline (integer samples, at the TIMELINE sample rate) */
  startSample: Sample;
  /** Offset into audioBuffer (integer samples, at the BUFFER's own sample
   *  rate — they index the buffer, not the timeline) */
  offsetSamples: Sample;
  /** Duration to play (integer samples, at the BUFFER's own sample rate) */
  durationSamples: Sample;
  /** Clip gain multiplier */
  gain: number;
  /** Fade in duration (integer samples, at the TIMELINE sample rate) */
  fadeInDurationSamples: Sample;
  /** Fade out duration (integer samples, at the TIMELINE sample rate) */
  fadeOutDurationSamples: Sample;
}

interface TrackClipState {
  track: ClipTrack;
  clips: AudioClip[];
}

export class ClipPlayer implements SchedulerListener<ClipEvent> {
  private _audioContext: AudioContext;
  private _sampleTimeline: SampleTimeline;
  private _tempoMap: TempoMap;
  private _toAudioTime: (transportTime: number) => number;
  private _tracks: Map<string, TrackClipState> = new Map();
  private _trackNodes: Map<string, TrackNode> = new Map();
  private _activeSources: Map<AudioBufferSourceNode, { trackId: string; gainNode: GainNode }> =
    new Map();
  private _loopEnabled = false;
  private _loopEndSamples = 0;

  constructor(
    audioContext: AudioContext,
    sampleTimeline: SampleTimeline,
    tempoMap: TempoMap,
    toAudioTime: (transportTime: number) => number
  ) {
    this._audioContext = audioContext;
    this._sampleTimeline = sampleTimeline;
    this._tempoMap = tempoMap;
    this._toAudioTime = toAudioTime;
  }

  setTracks(tracks: ClipTrack[], trackNodes: Map<string, TrackNode>): void {
    this._tracks.clear();
    this._trackNodes = trackNodes;
    for (const track of tracks) {
      this._tracks.set(track.id, { track, clips: track.clips });
    }
  }

  /** Set loop region using ticks. startTick is unused — loop clamping only needs
   *  the end boundary; mid-clip restart at loopStart is handled by onPositionJump. */
  setLoop(enabled: boolean, _startTick: Tick, endTick: Tick): void {
    this._loopEnabled = enabled;
    this._loopEndSamples = this._sampleTimeline.ticksToSamples(endTick);
  }

  /** Set loop region using samples directly */
  setLoopSamples(enabled: boolean, _startSample: Sample, endSample: Sample): void {
    this._loopEnabled = enabled;
    this._loopEndSamples = endSample;
  }

  updateTrack(trackId: string, track: ClipTrack): void {
    this._tracks.set(trackId, { track, clips: track.clips });
    this._silenceTrack(trackId);
  }

  generate(fromTick: Tick, toTick: Tick): ClipEvent[] {
    const events: ClipEvent[] = [];

    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        // Use startTick when available, fall back to sample-derived tick
        const clipTick: number =
          clip.startTick !== undefined
            ? clip.startTick
            : (this._sampleTimeline.samplesToTicks(clip.startSample as Sample) as number);

        // Only schedule when the clip START falls within this window.
        // Clips that started in a previous window are already playing
        // (AudioBufferSourceNode runs for its full duration).
        // Mid-clip starts (seek, loop wrap) are handled by onPositionJump().
        if (clipTick < (fromTick as number)) continue;
        if (clipTick >= (toTick as number)) continue;

        // Two sample-count domains are in play and must not be mixed:
        // timeline samples (clip.startSample, the loop boundary) and
        // buffer samples (clip.offsetSamples / durationSamples index the
        // audio file, which may have a different rate than the timeline).
        const timelineRate = this._sampleTimeline.sampleRate;
        const bufferRate = clip.audioBuffer.sampleRate;

        // Fade.duration is SECONDS (the convention shared with the Tone
        // adapter); pack as timeline samples so consume() recovers the
        // seconds with one division.
        const fadeInDurationSamples = clip.fadeIn
          ? Math.round((clip.fadeIn.duration ?? 0) * timelineRate)
          : 0;
        const fadeOutDurationSamples = clip.fadeOut
          ? Math.round((clip.fadeOut.duration ?? 0) * timelineRate)
          : 0;

        // Clamp duration at loopEnd so the source stops exactly at the
        // loop boundary. The clamp lives in timeline samples; the event's
        // duration stays in buffer samples.
        let durationSamples = clip.durationSamples;
        if (this._loopEnabled) {
          const durationTimelineSamples = Math.round(
            (clip.durationSamples / bufferRate) * timelineRate
          );
          const allowedTimelineSamples = this._loopEndSamples - clip.startSample;
          if (durationTimelineSamples > allowedTimelineSamples) {
            durationSamples = Math.round((allowedTimelineSamples / timelineRate) * bufferRate);
          }
        }

        events.push({
          trackId,
          clipId: clip.id,
          audioBuffer: clip.audioBuffer,
          tick: clipTick as Tick,
          startSample: clip.startSample as Sample,
          offsetSamples: clip.offsetSamples as Sample,
          durationSamples: durationSamples as Sample,
          gain: clip.gain,
          fadeInDurationSamples: fadeInDurationSamples as Sample,
          fadeOutDurationSamples: fadeOutDurationSamples as Sample,
        });
      }
    }

    return events;
  }

  consume(event: ClipEvent): void {
    const trackNode = this._trackNodes.get(event.trackId);
    if (!trackNode) {
      console.warn(
        '[waveform-playlist] ClipPlayer.consume: no TrackNode for trackId "' +
          event.trackId +
          '", clipId "' +
          event.clipId +
          '" — clip will not play'
      );
      return;
    }

    // offsetSamples/durationSamples index the BUFFER, so the buffer's own
    // rate converts them to seconds; a 48 kHz file on a 44.1 kHz timeline
    // would otherwise start ~8.8% too deep and play the wrong duration.
    const bufferRate = event.audioBuffer.sampleRate;
    const offsetSeconds = event.offsetSamples / bufferRate;
    const durationSeconds = event.durationSamples / bufferRate;

    // Guard against invalid offset
    if (offsetSeconds >= event.audioBuffer.duration) {
      console.warn(
        '[waveform-playlist] ClipPlayer.consume: offset (' +
          offsetSeconds +
          's) exceeds audioBuffer.duration (' +
          event.audioBuffer.duration +
          's) for clipId "' +
          event.clipId +
          '" — clip will not play'
      );
      return;
    }

    const source = this._audioContext.createBufferSource();
    source.buffer = event.audioBuffer;

    // Convert tick → seconds → AudioContext.currentTime for scheduling
    const transportSeconds = this._tempoMap.ticksToSeconds(event.tick);
    const when = this._toAudioTime(transportSeconds);

    // Create a gain node for per-clip gain and fades
    const gainNode = this._audioContext.createGain();
    gainNode.gain.value = event.gain;

    // Apply fades (AudioParam scheduling uses AudioContext time). Fade
    // durations are packed as TIMELINE samples (see generate()).
    // Clamp fades so they don't overlap (split duration evenly if they would)
    const timelineRate = this._sampleTimeline.sampleRate;
    let fadeIn = event.fadeInDurationSamples / timelineRate;
    let fadeOut = event.fadeOutDurationSamples / timelineRate;
    if (fadeIn + fadeOut > durationSeconds) {
      const ratio = durationSeconds / (fadeIn + fadeOut);
      fadeIn *= ratio;
      fadeOut *= ratio;
    }

    if (fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, when);
      gainNode.gain.linearRampToValueAtTime(event.gain, when + fadeIn);
    }
    if (fadeOut > 0) {
      const fadeOutStart = when + durationSeconds - fadeOut;
      gainNode.gain.setValueAtTime(event.gain, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, when + durationSeconds);
    }

    source.connect(gainNode);
    gainNode.connect(trackNode.input);

    this._activeSources.set(source, {
      trackId: event.trackId,
      gainNode,
    });

    // Clean up when source finishes
    source.addEventListener('ended', () => {
      this._activeSources.delete(source);
      try {
        gainNode.disconnect();
      } catch (err) {
        console.warn('[waveform-playlist] ClipPlayer: error disconnecting gain node:', String(err));
      }
    });

    source.start(when, offsetSeconds, durationSeconds);
  }

  onPositionJump(newTick: Tick): void {
    this.silence();

    const newSample = this._sampleTimeline.ticksToSamples(newTick);

    // Re-schedule mid-clip sources for clips that span the new position
    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        // Start comparison in ticks (strict < to avoid double-scheduling)
        const clipTick: number =
          clip.startTick !== undefined
            ? clip.startTick
            : (this._sampleTimeline.samplesToTicks(clip.startSample as Sample) as number);

        if (clipTick >= (newTick as number)) continue; // hasn't started yet

        const timelineRate = this._sampleTimeline.sampleRate;
        const bufferRate = clip.audioBuffer.sampleRate;
        const bufToTimeline = (n: number) => Math.round((n / bufferRate) * timelineRate);
        const timelineToBuf = (n: number) => Math.round((n / timelineRate) * bufferRate);

        // End comparison on the TIMELINE axis: the clip occupies its
        // buffer-domain duration scaled to timeline samples.
        const clipEndSample = clip.startSample + bufToTimeline(clip.durationSamples);
        if (clipEndSample <= (newSample as number)) continue; // already finished

        // How far into the clip we are, on the timeline — converted to
        // buffer samples before indexing the buffer.
        const offsetIntoClipSamples = (newSample as number) - clip.startSample;
        const offsetSamples = clip.offsetSamples + timelineToBuf(offsetIntoClipSamples);
        let remainingTimelineSamples = clipEndSample - (newSample as number);

        // Clamp at loop boundary (same as generate), in timeline samples
        if (
          this._loopEnabled &&
          (newSample as number) + remainingTimelineSamples > this._loopEndSamples
        ) {
          remainingTimelineSamples = this._loopEndSamples - (newSample as number);
        }
        if (remainingTimelineSamples <= 0) continue;
        const durationSamples = timelineToBuf(remainingTimelineSamples);

        // Fade.duration is seconds; pack as timeline samples (see generate())
        const fadeOutDurationSamples = clip.fadeOut
          ? Math.round((clip.fadeOut.duration ?? 0) * timelineRate)
          : 0;

        this.consume({
          trackId,
          clipId: clip.id,
          audioBuffer: clip.audioBuffer,
          tick: newTick as Tick,
          startSample: newSample as Sample,
          offsetSamples: offsetSamples as Sample,
          durationSamples: durationSamples as Sample,
          gain: clip.gain,
          fadeInDurationSamples: 0 as Sample,
          fadeOutDurationSamples: fadeOutDurationSamples as Sample,
        });
      }
    }
  }

  silence(): void {
    for (const [source, { gainNode }] of this._activeSources) {
      try {
        source.stop();
      } catch (err) {
        console.warn('[waveform-playlist] ClipPlayer.silence: error stopping source:', String(err));
      }
      try {
        gainNode.disconnect();
      } catch (err) {
        console.warn('[waveform-playlist] ClipPlayer.silence: error disconnecting:', String(err));
      }
    }
    this._activeSources.clear();
  }

  private _silenceTrack(trackId: string): void {
    const toDelete: AudioBufferSourceNode[] = [];
    for (const [source, info] of this._activeSources) {
      if (info.trackId === trackId) {
        try {
          source.stop();
        } catch (err) {
          console.warn(
            '[waveform-playlist] ClipPlayer._silenceTrack: error stopping source:',
            String(err)
          );
        }
        try {
          info.gainNode.disconnect();
        } catch (err) {
          console.warn(
            '[waveform-playlist] ClipPlayer._silenceTrack: error disconnecting:',
            String(err)
          );
        }
        toDelete.push(source);
      }
    }
    for (const source of toDelete) {
      this._activeSources.delete(source);
    }
  }
}
