/**
 * Recording clip creation extracted from daw-editor to keep the editor under 800 lines.
 * Operates on the editor instance via a narrow interface.
 */

import type { AudioClip, LoadingClip, PeakData } from '@waveform-playlist/core';
import { carveClipRange, createClip, isLoadingClip } from '@waveform-playlist/core';
import type { Arrangement } from '@waveform-playlist/engine';
import type { PeakPipeline } from '../workers/peakPipeline';
import type { DawErrorDetail, DawRecordingClipAddDetail } from '../events';

export interface RecordingClipHost {
  readonly samplesPerPixel: number;
  /** Render-space samples-per-pixel — tick-derived in beats mode. Finalized
   * peaks MUST be generated at this scale (containers are laid out in render
   * space); the temporal samplesPerPixel draws the wrong width. */
  readonly renderSamplesPerPixel: number;
  readonly mono: boolean;
  readonly isConnected: boolean;
  readonly effectiveSampleRate: number;
  /** The take goes into the editor's arrangement (#848); the engine follows it. */
  _arrangement: Arrangement;
  _peaksData: Map<string, PeakData>;
  _clipBuffers: Map<string, AudioBuffer>;
  _clipOffsets: Map<string, { offsetSamples: number; durationSamples: number }>;
  /** Raise the editor zoom floor (recording worker-caches peaks at the
   * pipeline base scale like any other load — the floor must cover them). */
  _raiseZoomFloor(scale: number): void;
  _peakPipeline: PeakPipeline;
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
      if (!host._arrangement.getTracks().some((t) => t.id === trackId)) {
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
      // The same floor policy as every loaded clip (_clipPeaksReady): the worker cached this
      // buffer's WaveformData at the base scale — zooming finer than it
      // would render the recorded waveform squeezed in its container.
      host._raiseZoomFloor(host._peakPipeline.getCachedScale(trimmedBuf));
      // One undo step, in the function form so the track's loading clips
      // stay. Punch-in replace (#579): the recorded clip owns [startSample,
      // startSample + durSamples) — carve overlapped LOADED content out
      // before inserting (parity with the React provider); a clip still
      // loading has no samples to carve and is kept as it is.
      host._arrangement.updateTrack(trackId, (current) => ({
        ...current,
        clips: [
          ...current.clips.flatMap((c): (AudioClip | LoadingClip)[] =>
            isLoadingClip(c) ? [c] : carveClipRange([c], startSample, startSample + durSamples)
          ),
          clip,
        ],
      }));
      // daw-recording-complete fires BEFORE the clip exists (it is
      // cancelable), so it cannot carry the id. This follow-up fires once
      // the clip is in the engine and addressable (#659).
      if (host.isConnected) {
        host.dispatchEvent(
          new CustomEvent<DawRecordingClipAddDetail>('daw-recording-clip-add', {
            bubbles: true,
            composed: true,
            detail: { trackId, clipId: clip.id },
          })
        );
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
