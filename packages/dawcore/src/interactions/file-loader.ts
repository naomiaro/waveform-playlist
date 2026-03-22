/**
 * File loading logic extracted from daw-editor to keep the editor under 800 lines.
 * Operates on the editor instance via a narrow interface.
 */

import type { ClipTrack, PeakData } from '@waveform-playlist/core';
import { createClipFromSeconds, createTrack } from '@waveform-playlist/core';
import type { PeakPipeline } from '../workers/peakPipeline';
import type { DawTrackIdDetail, DawFilesLoadErrorDetail, LoadFilesResult } from '../events';
import type { TrackDescriptor } from '../types';

export interface FileLoaderHost {
  readonly samplesPerPixel: number;
  readonly mono: boolean;
  readonly isConnected: boolean;
  _resolvedSampleRate: number | null;
  _tracks: Map<string, TrackDescriptor>;
  _engineTracks: Map<string, ClipTrack>;
  _peaksData: Map<string, PeakData>;
  _clipBuffers: Map<string, AudioBuffer>;
  _clipOffsets: Map<string, { offsetSamples: number; durationSamples: number }>;
  _audioCache: Map<string, Promise<AudioBuffer>>;
  _peakPipeline: PeakPipeline;
  _fetchAndDecode(src: string): Promise<AudioBuffer>;
  _recomputeDuration(): void;
  _ensureEngine(): Promise<{ setTracks(tracks: ClipTrack[]): void }>;
  dispatchEvent(event: Event): boolean;
}

export async function loadFiles(
  host: FileLoaderHost,
  files: FileList | File[]
): Promise<LoadFilesResult> {
  if (!files) {
    console.warn('[dawcore] loadFiles called with null/undefined');
    return { loaded: [], failed: [] };
  }

  const fileArray = Array.from(files);
  const loaded: string[] = [];
  const failed: Array<{ file: File; error: unknown }> = [];

  for (const file of fileArray) {
    if (file.type && !file.type.startsWith('audio/')) {
      failed.push({ file, error: new Error('Non-audio MIME type: ' + file.type) });
      console.warn('[dawcore] Skipping non-audio file: ' + file.name + ' (' + file.type + ')');
      continue;
    }

    const blobUrl = URL.createObjectURL(file);
    try {
      const audioBuffer = await host._fetchAndDecode(blobUrl);
      URL.revokeObjectURL(blobUrl);
      host._audioCache.delete(blobUrl);

      host._resolvedSampleRate = audioBuffer.sampleRate;

      const name = file.name.replace(/\.\w+$/, '');
      const clip = createClipFromSeconds({
        audioBuffer,
        startTime: 0,
        duration: audioBuffer.duration,
        offset: 0,
        gain: 1,
        name,
        sampleRate: audioBuffer.sampleRate,
        sourceDuration: audioBuffer.duration,
      });

      host._clipBuffers = new Map(host._clipBuffers).set(clip.id, audioBuffer);
      host._clipOffsets.set(clip.id, {
        offsetSamples: clip.offsetSamples,
        durationSamples: clip.durationSamples,
      });
      const peakData = await host._peakPipeline.generatePeaks(
        audioBuffer,
        host.samplesPerPixel,
        host.mono,
        clip.offsetSamples,
        clip.durationSamples
      );
      host._peaksData = new Map(host._peaksData).set(clip.id, peakData);

      const trackId = crypto.randomUUID();
      const track = createTrack({ name, clips: [clip] });
      track.id = trackId;

      host._tracks = new Map(host._tracks).set(trackId, {
        name,
        src: '',
        volume: 1,
        pan: 0,
        muted: false,
        soloed: false,
        clips: [
          {
            src: '',
            start: 0,
            duration: audioBuffer.duration,
            offset: 0,
            gain: 1,
            name,
            fadeIn: 0,
            fadeOut: 0,
            fadeType: 'linear',
          },
        ],
      });
      host._engineTracks = new Map(host._engineTracks).set(trackId, track);
      host._recomputeDuration();

      const engine = await host._ensureEngine();
      engine.setTracks([...host._engineTracks.values()]);

      loaded.push(trackId);
      host.dispatchEvent(
        new CustomEvent<DawTrackIdDetail>('daw-track-ready', {
          bubbles: true,
          composed: true,
          detail: { trackId },
        })
      );
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      console.warn('[dawcore] Failed to load file: ' + file.name + ' — ' + String(err));
      failed.push({ file, error: err });
      if (host.isConnected) {
        host.dispatchEvent(
          new CustomEvent<DawFilesLoadErrorDetail>('daw-files-load-error', {
            bubbles: true,
            composed: true,
            detail: { file, error: err },
          })
        );
      }
    }
  }

  return { loaded, failed };
}
