import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { SchedulerEvent, SchedulerListener } from '../types';
import type { SampleTimeline } from '../timeline/sample-timeline';
import type { TrackNode } from './track-node';

export interface ClipEvent extends SchedulerEvent {
  trackId: string;
  clipId: string;
  audioBuffer: AudioBuffer;
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
  private _toAudioTime: (transportTime: number) => number;
  private _tracks: Map<string, TrackClipState> = new Map();
  private _trackNodes: Map<string, TrackNode> = new Map();
  private _activeSources: Map<AudioBufferSourceNode, { trackId: string; gainNode: GainNode }> =
    new Map();
  private _loopEnabled = false;
  private _loopEnd = 0;

  constructor(
    audioContext: AudioContext,
    sampleTimeline: SampleTimeline,
    toAudioTime: (transportTime: number) => number
  ) {
    this._audioContext = audioContext;
    this._sampleTimeline = sampleTimeline;
    this._toAudioTime = toAudioTime;
  }

  setTracks(tracks: ClipTrack[], trackNodes: Map<string, TrackNode>): void {
    this._tracks.clear();
    this._trackNodes = trackNodes;
    for (const track of tracks) {
      this._tracks.set(track.id, { track, clips: track.clips });
    }
  }

  setLoop(enabled: boolean, _start: number, end: number): void {
    this._loopEnabled = enabled;
    this._loopEnd = end;
  }

  updateTrack(trackId: string, track: ClipTrack): void {
    this._tracks.set(trackId, { track, clips: track.clips });
    this._silenceTrack(trackId);
  }

  generate(fromTime: number, toTime: number): ClipEvent[] {
    const events: ClipEvent[] = [];

    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        const clipStartTime = this._sampleTimeline.samplesToSeconds(clip.startSample);
        const clipDuration = this._sampleTimeline.samplesToSeconds(clip.durationSamples);
        const clipOffsetTime = this._sampleTimeline.samplesToSeconds(clip.offsetSamples);

        // Only schedule when the clip START falls within this window.
        // Clips that started in a previous window are already playing
        // (AudioBufferSourceNode runs for its full duration).
        // Mid-clip starts (seek, loop wrap) are handled by onPositionJump().
        if (clipStartTime < fromTime) continue;
        if (clipStartTime >= toTime) continue;

        const fadeInDuration = clip.fadeIn
          ? this._sampleTimeline.samplesToSeconds(clip.fadeIn.duration ?? 0)
          : 0;
        const fadeOutDuration = clip.fadeOut
          ? this._sampleTimeline.samplesToSeconds(clip.fadeOut.duration ?? 0)
          : 0;

        // Clamp duration at loopEnd so the source stops exactly at the
        // loop boundary. onPositionJump handles the mid-clip restart.
        let duration = clipDuration;
        if (this._loopEnabled && clipStartTime + duration > this._loopEnd) {
          duration = this._loopEnd - clipStartTime;
        }

        events.push({
          trackId,
          clipId: clip.id,
          audioBuffer: clip.audioBuffer,
          transportTime: clipStartTime,
          offset: clipOffsetTime,
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

    // Guard against invalid offset
    if (event.offset >= event.audioBuffer.duration) {
      return;
    }

    const source = this._audioContext.createBufferSource();
    source.buffer = event.audioBuffer;

    // Convert transport time → AudioContext.currentTime for scheduling
    const when = this._toAudioTime(event.transportTime);

    // Create a gain node for per-clip gain and fades
    const gainNode = this._audioContext.createGain();
    gainNode.gain.value = event.gain;

    // Apply fades (AudioParam scheduling uses AudioContext time)
    // Clamp fades so they don't overlap (split duration evenly if they would)
    let fadeIn = event.fadeInDuration;
    let fadeOut = event.fadeOutDuration;
    if (fadeIn + fadeOut > event.duration) {
      const ratio = event.duration / (fadeIn + fadeOut);
      fadeIn *= ratio;
      fadeOut *= ratio;
    }

    if (fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, when);
      gainNode.gain.linearRampToValueAtTime(event.gain, when + fadeIn);
    }
    if (fadeOut > 0) {
      const fadeOutStart = when + event.duration - fadeOut;
      gainNode.gain.setValueAtTime(event.gain, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, when + event.duration);
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

    source.start(when, event.offset, event.duration);
  }

  onPositionJump(newTime: number): void {
    this.silence();

    // Re-schedule mid-clip sources for clips that span the new position
    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        const clipStartTime = this._sampleTimeline.samplesToSeconds(clip.startSample);
        const clipDuration = this._sampleTimeline.samplesToSeconds(clip.durationSamples);
        const clipEndTime = clipStartTime + clipDuration;
        const clipOffsetTime = this._sampleTimeline.samplesToSeconds(clip.offsetSamples);

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
            transportTime: newTime,
            offset,
            duration,
            gain: clip.gain,
            fadeInDuration: 0,
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
