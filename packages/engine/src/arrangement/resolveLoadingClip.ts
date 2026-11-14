/**
 * A loading clip and its decoded audio become an `AudioClip`.
 *
 * Times in seconds become integer samples at the BUFFER's rate; the clip
 * keeps its id and its display fields. A duration that runs past the end of
 * the audio is cut to it, with one warning per loading-clip object. A clip
 * that cannot be made (its numbers are not usable, its offset is past the
 * end) is not left out: the caller gets the reason and keeps the loading
 * clip. Never throws.
 */

import { createClip } from '@waveform-playlist/core';
import type { AudioClip, LoadingClip } from '@waveform-playlist/core';

export type ResolvedLoadingClip = { clip: AudioClip } | { unusable: string };

/** Messages already written, per loading-clip object, for the life of the page. */
const warned = new WeakMap<LoadingClip, Set<string>>();

function label(loading: LoadingClip): string {
  return `clip "${loading.id}"`;
}

function warnOnce(loading: LoadingClip, message: string): void {
  const seen = warned.get(loading) ?? new Set<string>();
  warned.set(loading, seen);
  if (seen.has(message)) return;
  seen.add(message);
  console.warn(`[waveform-playlist] ${label(loading)}: ${message}`);
}

const isNonNegative = (n: number): boolean => Number.isFinite(n) && n >= 0;

/** The clip's duration; `null` (plain JavaScript, JSON) is a duration that was not given. */
function givenDuration(loading: LoadingClip): number | undefined {
  return loading.duration ?? undefined;
}

/** What is wrong with the loading clip's own numbers, or null. */
function fieldProblem(loading: LoadingClip): string | null {
  if (!isNonNegative(loading.start ?? 0)) {
    return `start must be a finite number of seconds >= 0, got ${String(loading.start)}`;
  }
  if (!isNonNegative(loading.offset ?? 0)) {
    return `offset must be a finite number of seconds >= 0, got ${String(loading.offset)}`;
  }
  const duration = givenDuration(loading);
  if (duration !== undefined && !(Number.isFinite(duration) && duration > 0)) {
    return `duration must be a positive, finite number of seconds, got ${String(duration)}`;
  }
  return null;
}

/** The clip's duration in samples against a source of `total` samples, or what is wrong. */
function fitDuration(
  loading: LoadingClip,
  offsetSamples: number,
  total: number,
  rate: number
): { samples: number } | { problem: string } {
  if (!(offsetSamples < total)) return { problem: 'offset is at or past the end of the audio' };
  const rest = total - offsetSamples;
  const duration = givenDuration(loading);
  const wanted = duration === undefined ? rest : Math.round(duration * rate);
  if (!(wanted >= 1)) return { problem: 'duration is shorter than one sample' };
  if (wanted > rest + 1) {
    warnOnce(loading, 'duration runs past the end of the audio and was cut to it');
  }
  return { samples: Math.min(wanted, rest) };
}

function convert(loading: LoadingClip, buffer: AudioBuffer): AudioClip | string {
  const rate = buffer?.sampleRate;
  if (!(Number.isFinite(rate) && rate > 0 && buffer.length >= 1)) {
    return 'the decoded buffer is empty or has no usable sample rate';
  }
  const problem = fieldProblem(loading);
  if (problem) return problem;
  const offsetSamples = Math.round((loading.offset ?? 0) * rate);
  const startSample = Math.round((loading.start ?? 0) * rate);
  if (!Number.isSafeInteger(offsetSamples) || !Number.isSafeInteger(startSample)) {
    return 'start or offset is too large';
  }
  const fitted = fitDuration(loading, offsetSamples, buffer.length, rate);
  if ('problem' in fitted) return fitted.problem;
  return {
    ...createClip({
      audioBuffer: buffer,
      startSample,
      offsetSamples,
      durationSamples: fitted.samples,
      gain: loading.gain,
      name: loading.name,
      color: loading.color,
      fadeIn: loading.fadeIn,
      fadeOut: loading.fadeOut,
      waveformData: loading.waveformData,
      src: loading.src,
    }),
    id: loading.id,
  };
}

export function resolveLoadingClip(loading: LoadingClip, buffer: AudioBuffer): ResolvedLoadingClip {
  let converted: AudioClip | string;
  try {
    converted = convert(loading, buffer);
  } catch (error) {
    // The clip factory checks its input too; whatever it refuses is a reason.
    converted = error instanceof Error ? error.message : String(error);
  }
  return typeof converted === 'string'
    ? { unusable: `${label(loading)}: ${converted}` }
    : { clip: converted };
}
