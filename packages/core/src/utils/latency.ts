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
