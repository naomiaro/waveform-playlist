/**
 * Sample count corresponding to the audible-latency window
 * (`outputLatency` + scheduler `lookAhead`). Used to skip leading silence in
 * recordings: between record-start and audible playback the user heard nothing,
 * so that prefix should be trimmed from buffers / peaks. Returns 0 for
 * non-finite or non-positive inputs.
 *
 * Single source of truth for `useIntegratedRecording` (buffer trim) and
 * `PlaylistVisualization` (live preview peak slice). Keep the two in lockstep
 * so the live preview width matches the finalized clip.
 */
export function audibleLatencySamples(
  outputLatency: number,
  lookAhead: number,
  sampleRate: number
): number {
  const total = outputLatency + lookAhead;
  if (!Number.isFinite(total) || !Number.isFinite(sampleRate)) return 0;
  if (total <= 0 || sampleRate <= 0) return 0;
  return Math.floor(total * sampleRate);
}

/**
 * Resolve the recording latency offset in samples.
 *
 * When `overrideSeconds` is provided it is an **absolute replacement** for the
 * auto-computed value — a latency in seconds, converted at `sampleRate`
 * (`0` disables compensation; negative/non-finite resolve to `0`). Otherwise the
 * offset is the auto-computed audible-latency window (`outputLatency + lookAhead`).
 *
 * Single source of truth for the override-vs-auto decision across dawcore
 * (`RecordingController`) and React (`useIntegratedRecording` finalization +
 * `PlaylistVisualization` live preview). The override branch is the same math as
 * the auto branch with `lookAhead = 0`, so both inherit the finite/positive
 * guards in `audibleLatencySamples`.
 */
export function resolveRecordingOffsetSamples(params: {
  /** Public override (seconds). Absolute replacement when defined. */
  overrideSeconds?: number;
  /** Browser-reported output latency (seconds). */
  outputLatency: number;
  /** Scheduler look-ahead (seconds). Pass 0 for engines without one (native transport). */
  lookAhead: number;
  /** Sample rate the recording was captured at. */
  sampleRate: number;
}): number {
  const { overrideSeconds, outputLatency, lookAhead, sampleRate } = params;
  return overrideSeconds !== undefined
    ? audibleLatencySamples(overrideSeconds, 0, sampleRate)
    : audibleLatencySamples(outputLatency, lookAhead, sampleRate);
}
