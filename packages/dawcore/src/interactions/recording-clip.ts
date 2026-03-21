/**
 * Recording clip creation extracted from daw-editor to keep the editor under 800 lines.
 * Operates on the editor instance via a narrow interface.
 */

import type { ClipTrack, PeakData } from '@waveform-playlist/core';
import { createClip } from '@waveform-playlist/core';
import type { PeakPipeline } from '../workers/peakPipeline';
import type { DawErrorDetail } from '../events';
import type { TrackDescriptor, ClipDescriptor } from '../types';

export interface RecordingClipHost {
  readonly samplesPerPixel: number;
  readonly mono: boolean;
  readonly isConnected: boolean;
  readonly effectiveSampleRate: number;
  _tracks: Map<string, TrackDescriptor>;
  _engineTracks: Map<string, ClipTrack>;
  _peaksData: Map<string, PeakData>;
  _clipBuffers: Map<string, AudioBuffer>;
  _peakPipeline: PeakPipeline;
  _engine: { setTracks(tracks: ClipTrack[]): void } | null;
  _recomputeDuration(): void;
  dispatchEvent(event: Event): boolean;
}

export function addRecordedClip(
  host: RecordingClipHost,
  trackId: string,
  buf: AudioBuffer,
  startSample: number,
  durSamples: number
) {
  const clip = createClip({
    audioBuffer: buf,
    startSample,
    durationSamples: durSamples,
    offsetSamples: 0,
    gain: 1,
    name: 'Recording',
  });
  host._clipBuffers = new Map(host._clipBuffers).set(clip.id, buf);
  host._peakPipeline
    .generatePeaks(buf, host.samplesPerPixel, host.mono)
    .then((pd) => {
      host._peaksData = new Map(host._peaksData).set(clip.id, pd);
      const t = host._engineTracks.get(trackId);
      if (!t) {
        // Track was removed during peak generation — clean up orphaned buffer
        const next = new Map(host._clipBuffers);
        next.delete(clip.id);
        host._clipBuffers = next;
        return;
      }
      host._engineTracks = new Map(host._engineTracks).set(trackId, {
        ...t,
        clips: [...t.clips, clip],
      });
      // Keep _tracks in sync so public API and track controls reflect the clip
      const desc = host._tracks.get(trackId);
      if (desc) {
        const sr = host.effectiveSampleRate;
        const clipDesc: ClipDescriptor = {
          src: '',
          start: startSample / sr,
          duration: durSamples / sr,
          offset: 0,
          gain: 1,
          name: 'Recording',
          fadeIn: 0,
          fadeOut: 0,
          fadeType: 'linear',
        };
        host._tracks = new Map(host._tracks).set(trackId, {
          ...desc,
          clips: [...desc.clips, clipDesc],
        });
      }
      host._recomputeDuration();
      host._engine?.setTracks([...host._engineTracks.values()]);
    })
    .catch((err) => {
      console.warn('[dawcore] Failed to generate peaks for recorded clip: ' + String(err));
      const next = new Map(host._clipBuffers);
      next.delete(clip.id);
      host._clipBuffers = next;
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
