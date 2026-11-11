/**
 * useWaveformDataCache
 *
 * Generates a WaveformData object per unique AudioBuffer in a web worker.
 * These enable near-instant zoom changes via WaveformData.resample() instead
 * of re-scanning raw audio samples.
 *
 * Results are looked up by AudioBuffer during render (`getWaveformData`), so a
 * `tracks` change that only rearranges clips of already-generated buffers
 * causes no state update here (#692). The only state is `version`, bumped when
 * a worker job finishes: depend on it to recompute peaks for the clips that
 * share that buffer.
 *
 * Behavior:
 * - Creates the worker lazily on first clip needing generation
 * - Generates waveform data once per unique AudioBuffer; a job keeps running
 *   across `tracks` changes
 * - A failed job is tried again on the next `tracks` change, three attempts
 *   per buffer in all
 * - Terminates the worker on unmount
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ClipTrack } from '@waveform-playlist/core';
import type WaveformData from 'waveform-data';
import { createPeaksWorker, type PeaksWorkerApi } from '../workers/peaksWorker';

export interface UseWaveformDataCacheReturn {
  /** Worker-generated waveform data for a buffer, once ready. Stable identity. */
  getWaveformData: (audioBuffer: AudioBuffer) => WaveformData | undefined;
  /** Bumped each time a buffer's waveform data becomes available. */
  version: number;
}

/**
 * Attempts per buffer before giving up. A failed job is tried again on the
 * next `tracks` change (a crashed worker is replaced), but a buffer that can
 * never succeed (a CSP that blocks blob workers) must not be copied and sent
 * again on every pointer move of a trim.
 */
const MAX_GENERATION_ATTEMPTS = 3;

function buffersNeedingGeneration(
  tracks: ClipTrack[],
  generated: WeakMap<AudioBuffer, WaveformData>,
  inflight: WeakMap<AudioBuffer, Promise<void>>,
  failures: WeakMap<AudioBuffer, number>
): Set<AudioBuffer> {
  const buffers = new Set<AudioBuffer>();
  for (const track of tracks) {
    for (const clip of track.clips) {
      // Clips with their own waveformData never need the worker.
      if (!clip.audioBuffer || clip.waveformData) continue;
      if (generated.has(clip.audioBuffer) || inflight.has(clip.audioBuffer)) continue;
      if ((failures.get(clip.audioBuffer) ?? 0) >= MAX_GENERATION_ATTEMPTS) continue;
      buffers.add(clip.audioBuffer);
    }
  }
  return buffers;
}

export function useWaveformDataCache(
  tracks: ClipTrack[],
  baseScale: number
): UseWaveformDataCacheReturn {
  const [version, setVersion] = useState(0);

  const workerRef = useRef<PeaksWorkerApi | null>(null);
  const generatedByBufferRef = useRef<WeakMap<AudioBuffer, WaveformData>>(new WeakMap());
  const inflightByBufferRef = useRef<WeakMap<AudioBuffer, Promise<void>>>(new WeakMap());
  const failuresByBufferRef = useRef<WeakMap<AudioBuffer, number>>(new WeakMap());
  // Changes on unmount. A job started in an earlier mount (StrictMode
  // remounts, or a real unmount) must not set state or warn.
  const mountSessionRef = useRef(0);

  // Stable callback to get or create the worker.
  // Also replaces a crashed worker (onerror marks it terminated) — reusing
  // it would reject every later generation until the component remounts.
  const getWorker = useCallback(() => {
    if (!workerRef.current || workerRef.current.isTerminated()) {
      workerRef.current = createPeaksWorker();
    }
    return workerRef.current;
  }, []);

  const getWaveformData = useCallback(
    (audioBuffer: AudioBuffer) => generatedByBufferRef.current.get(audioBuffer),
    []
  );

  useEffect(() => {
    const generatedByBuffer = generatedByBufferRef.current;
    const inflightByBuffer = inflightByBufferRef.current;
    const session = mountSessionRef.current;
    const failuresByBuffer = failuresByBufferRef.current;
    const buffers = buffersNeedingGeneration(
      tracks,
      generatedByBuffer,
      inflightByBuffer,
      failuresByBuffer
    );
    if (buffers.size === 0) return;

    const worker = getWorker();

    for (const audioBuffer of buffers) {
      // .slice() channel buffers to avoid detaching the original AudioBuffer views
      const channels: ArrayBuffer[] = [];
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        channels.push(audioBuffer.getChannelData(c).slice().buffer as ArrayBuffer);
      }

      // Only clear the in-flight marker if it is still this job's: after an
      // unmount the map is replaced and a new job may own the buffer.
      const settle = () => {
        if (inflightByBuffer.get(audioBuffer) === job) {
          inflightByBuffer.delete(audioBuffer);
        }
      };

      const id = `buffer-${Math.random().toString(36).slice(2, 11)}`;
      const job: Promise<void> = worker
        .generate({
          id,
          channels,
          length: audioBuffer.length,
          sampleRate: audioBuffer.sampleRate,
          scale: baseScale,
          bits: 16,
          splitChannels: true,
        })
        .then((waveformData) => {
          generatedByBuffer.set(audioBuffer, waveformData);
          settle();
          if (mountSessionRef.current !== session) return;
          setVersion((v) => v + 1);
        })
        .catch((err) => {
          settle();
          // A job rejected by the unmount's terminate() is not a failure of
          // the buffer.
          if (mountSessionRef.current !== session) return;
          const attempts = (failuresByBuffer.get(audioBuffer) ?? 0) + 1;
          failuresByBuffer.set(audioBuffer, attempts);
          console.warn(
            '[waveform-playlist] Worker peak generation failed' +
              (attempts >= MAX_GENERATION_ATTEMPTS
                ? ' ' + attempts + ' times, giving up on this audio buffer: '
                : ': ') +
              String(err)
          );
        });

      inflightByBuffer.set(audioBuffer, job);
    }
  }, [tracks, baseScale, getWorker]);

  // Terminate worker on unmount. Terminating rejects the jobs still running,
  // so forget them: a remount (StrictMode) starts them again on a new worker.
  useEffect(() => {
    return () => {
      mountSessionRef.current += 1;
      inflightByBufferRef.current = new WeakMap();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return { getWaveformData, version };
}
