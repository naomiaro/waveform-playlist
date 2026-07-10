/**
 * Recording clip creation extracted from daw-editor to keep the editor under 800 lines.
 * Operates on the editor instance via a narrow interface.
 */

import type { ClipTrack, PeakData } from '@waveform-playlist/core';
import { carveClipRange, createClip } from '@waveform-playlist/core';
import type { PeakPipeline } from '../workers/peakPipeline';
import type { DawErrorDetail } from '../events';
import type { TrackDescriptor, ClipDescriptor } from '../types';

export interface RecordingClipHost {
  readonly samplesPerPixel: number;
  /** Render-space samples-per-pixel — tick-derived in beats mode. Finalized
   * peaks MUST be generated at this scale (containers are laid out in render
   * space); the temporal samplesPerPixel draws the wrong width. */
  readonly renderSamplesPerPixel: number;
  readonly mono: boolean;
  readonly isConnected: boolean;
  readonly effectiveSampleRate: number;
  _tracks: Map<string, TrackDescriptor>;
  _engineTracks: Map<string, ClipTrack>;
  _peaksData: Map<string, PeakData>;
  _clipBuffers: Map<string, AudioBuffer>;
  _clipOffsets: Map<string, { offsetSamples: number; durationSamples: number }>;
  _peakPipeline: PeakPipeline;
  _engine: {
    setTracks(tracks: ClipTrack[]): void;
    updateTrack?(trackId: string, track: ClipTrack): void;
  } | null;
  _recomputeDuration(): void;
  dispatchEvent(event: Event): boolean;
}

export function addRecordedClip(
  host: RecordingClipHost,
  trackId: string,
  buf: AudioBuffer,
  startSample: number,
  durSamples: number,
  offsetSamples = 0,
  clipName?: string
) {
  // Slice off latency samples so peaks and playback only cover the audible portion
  let trimmedBuf = buf;
  if (offsetSamples > 0 && offsetSamples < buf.length) {
    const trimmed = new AudioBuffer({
      numberOfChannels: buf.numberOfChannels,
      length: durSamples,
      sampleRate: buf.sampleRate,
    });
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const source = buf.getChannelData(ch);
      trimmed.copyToChannel(source.subarray(offsetSamples, offsetSamples + durSamples), ch);
    }
    trimmedBuf = trimmed;
  }

  const clip = createClip({
    audioBuffer: trimmedBuf,
    startSample,
    durationSamples: durSamples,
    offsetSamples: 0, // offset already applied by slicing
    gain: 1,
    name: clipName ?? 'Recording',
  });
  host._clipBuffers = new Map(host._clipBuffers).set(clip.id, trimmedBuf);
  // Record the offsets like every other clip-insertion path — without this
  // entry the statechange peak-sync treats the clip as uncached and re-runs
  // the worker after EVERY recording.
  host._clipOffsets.set(clip.id, { offsetSamples: 0, durationSamples: durSamples });
  host._peakPipeline
    .generatePeaks(trimmedBuf, host.renderSamplesPerPixel, host.mono)
    .then((pd) => {
      const t = host._engineTracks.get(trackId);
      if (!t) {
        // Track was removed during peak generation — clean up the orphaned
        // buffer and never insert the peaks entry (this clip never reaches
        // the engine, so nothing else would ever delete it).
        const next = new Map(host._clipBuffers);
        next.delete(clip.id);
        host._clipBuffers = next;
        host._clipOffsets.delete(clip.id);
        return;
      }
      host._peaksData = new Map(host._peaksData).set(clip.id, pd);
      host._engineTracks = new Map(host._engineTracks).set(trackId, {
        ...t,
        // Punch-in replace (#579): the recorded clip owns [startSample,
        // startSample + durSamples) — carve overlapped content out of the
        // existing clips before inserting (parity with the React provider).
        clips: [...carveClipRange(t.clips, startSample, startSample + durSamples), clip],
      });
      // Keep _tracks in sync so public API and track controls reflect the clip
      const desc = host._tracks.get(trackId);
      if (desc) {
        const sr = host.effectiveSampleRate;
        const clipDesc: ClipDescriptor = {
          kind: 'drop',
          src: '',
          peaksSrc: '',
          start: startSample / sr,
          duration: durSamples / sr,
          offset: 0,
          gain: 1,
          name: clipName ?? 'Recording',
          fadeIn: 0,
          fadeOut: 0,
          fadeType: 'linear',
          midiNotes: null,
          midiChannel: null,
          midiProgram: null,
        };
        host._tracks = new Map(host._tracks).set(trackId, {
          ...desc,
          clips: [...desc.clips, clipDesc],
        });
      }
      host._recomputeDuration();
      const updatedTrack = host._engineTracks.get(trackId);
      if (host._engine?.updateTrack && updatedTrack) {
        host._engine.updateTrack(trackId, updatedTrack);
      } else {
        host._engine?.setTracks([...host._engineTracks.values()]);
      }
    })
    .catch((err) => {
      console.warn('[dawcore] Failed to generate peaks for recorded clip: ' + String(err));
      const next = new Map(host._clipBuffers);
      next.delete(clip.id);
      host._clipBuffers = next;
      host._clipOffsets.delete(clip.id);
      if (host.isConnected) {
        host.dispatchEvent(
          new CustomEvent<DawErrorDetail>('daw-error', {
            bubbles: true,
            composed: true,
            detail: { operation: 'recording-peaks', error: err },
          })
        );
      }
    });
}
