import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { SchedulerEvent, SchedulerListener } from '../types';
import type { SampleTimeline } from '../timeline/sample-timeline';
import type { TrackNode } from './track-node';

export interface ClipEvent extends SchedulerEvent {
  trackId: string;
  clipId: string;
  audioBuffer: AudioBuffer;
  /** When to start the source (audioContext time) */
  audioTime: number;
  /** Offset into the audioBuffer (seconds) */
  offset: number;
  /** Duration to play (seconds) */
  duration: number;
  /** Clip gain multiplier */
  gain: number;
  /** Fade in duration in seconds */
  fadeInDuration: number;
  /** Fade out duration in seconds */
  fadeOutDuration: number;
}

interface TrackClipState {
  track: ClipTrack;
  clips: AudioClip[];
}

export class ClipPlayer implements SchedulerListener<ClipEvent> {
  private _audioContext: AudioContext;
  private _sampleTimeline: SampleTimeline;
  private _tracks: Map<string, TrackClipState> = new Map();
  private _trackNodes: Map<string, TrackNode> = new Map();
  private _activeSources: Map<
    AudioBufferSourceNode,
    { trackId: string; gainNode: GainNode }
  > = new Map();

  constructor(audioContext: AudioContext, sampleTimeline: SampleTimeline) {
    this._audioContext = audioContext;
    this._sampleTimeline = sampleTimeline;
  }

  setTracks(
    tracks: ClipTrack[],
    trackNodes: Map<string, TrackNode>
  ): void {
    this._tracks.clear();
    this._trackNodes = trackNodes;
    for (const track of tracks) {
      this._tracks.set(track.id, { track, clips: track.clips });
    }
  }

  updateTrack(trackId: string, track: ClipTrack): void {
    this._tracks.set(trackId, { track, clips: track.clips });
    // Silence only this track's active sources
    this._silenceTrack(trackId);
  }

  generate(fromTime: number, toTime: number): ClipEvent[] {
    const events: ClipEvent[] = [];

    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        const clipStartTime = this._sampleTimeline.samplesToSeconds(
          clip.startSample
        );
        const clipDuration = this._sampleTimeline.samplesToSeconds(
          clip.durationSamples
        );
        const clipEndTime = clipStartTime + clipDuration;
        const clipOffsetTime = this._sampleTimeline.samplesToSeconds(
          clip.offsetSamples
        );

        // Skip clips entirely before or after the window
        if (clipEndTime <= fromTime) continue;
        if (clipStartTime >= toTime) continue;

        // Compute effective start and duration
        const effectiveStart = Math.max(clipStartTime, fromTime);
        const effectiveEnd = Math.min(clipEndTime, toTime);

        // Offset into the audio buffer
        const offsetIntoClip = effectiveStart - clipStartTime;
        const offset = clipOffsetTime + offsetIntoClip;

        // Duration: play from effective start to clip end (not window end)
        // The scheduler generates once; the source plays its full duration
        const duration = clipEndTime - effectiveStart;

        const fadeInDuration = clip.fadeIn
          ? this._sampleTimeline.samplesToSeconds(clip.fadeIn.duration ?? 0)
          : 0;
        const fadeOutDuration = clip.fadeOut
          ? this._sampleTimeline.samplesToSeconds(clip.fadeOut.duration ?? 0)
          : 0;

        events.push({
          trackId,
          clipId: clip.id,
          audioBuffer: clip.audioBuffer,
          audioTime: effectiveStart,
          offset,
          duration,
          gain: clip.gain,
          fadeInDuration,
          fadeOutDuration,
        });
      }
    }

    return events;
  }

  consume(event: ClipEvent): void {
    const trackNode = this._trackNodes.get(event.trackId);
    if (!trackNode) return;

    const source = this._audioContext.createBufferSource();
    source.buffer = event.audioBuffer;

    // Create a gain node for per-clip gain and fades
    const gainNode = this._audioContext.createGain();
    gainNode.gain.value = event.gain;

    // Apply fades
    if (event.fadeInDuration > 0) {
      gainNode.gain.setValueAtTime(0, event.audioTime);
      gainNode.gain.linearRampToValueAtTime(
        event.gain,
        event.audioTime + event.fadeInDuration
      );
    }
    if (event.fadeOutDuration > 0) {
      const fadeOutStart =
        event.audioTime + event.duration - event.fadeOutDuration;
      gainNode.gain.setValueAtTime(event.gain, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(
        0,
        event.audioTime + event.duration
      );
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
      } catch {
        // Already disconnected
      }
    });

    source.start(event.audioTime, event.offset, event.duration);
  }

  onPositionJump(newTime: number): void {
    // Stop all active sources
    this.silence();

    // Re-schedule mid-clip sources for clips that span the new position
    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        const clipStartTime = this._sampleTimeline.samplesToSeconds(
          clip.startSample
        );
        const clipDuration = this._sampleTimeline.samplesToSeconds(
          clip.durationSamples
        );
        const clipEndTime = clipStartTime + clipDuration;
        const clipOffsetTime = this._sampleTimeline.samplesToSeconds(
          clip.offsetSamples
        );

        // Check if clip spans the new position
        if (clipStartTime <= newTime && clipEndTime > newTime) {
          const offsetIntoClip = newTime - clipStartTime;
          const offset = clipOffsetTime + offsetIntoClip;
          const duration = clipEndTime - newTime;

          const fadeOutDuration = clip.fadeOut
            ? this._sampleTimeline.samplesToSeconds(clip.fadeOut.duration ?? 0)
            : 0;

          this.consume({
            trackId,
            clipId: clip.id,
            audioBuffer: clip.audioBuffer,
            audioTime: newTime,
            offset,
            duration,
            gain: clip.gain,
            fadeInDuration: 0, // No fade-in on mid-clip start
            fadeOutDuration,
          });
        }
      }
    }
  }

  silence(): void {
    for (const [source, { gainNode }] of this._activeSources) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
      try {
        gainNode.disconnect();
      } catch {
        // Already disconnected
      }
    }
    this._activeSources.clear();
  }

  private _silenceTrack(trackId: string): void {
    for (const [source, info] of this._activeSources) {
      if (info.trackId === trackId) {
        try {
          source.stop();
        } catch {
          // Already stopped
        }
        try {
          info.gainNode.disconnect();
        } catch {
          // Already disconnected
        }
        this._activeSources.delete(source);
      }
    }
  }
}
