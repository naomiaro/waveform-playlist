export const meterProcessorUrl = new URL('./worklet/meter-processor.worklet.js', import.meta.url)
  .href;

export const recordingProcessorUrl = new URL(
  './worklet/recording-processor.worklet.js',
  import.meta.url
).href;

/**
 * Register the recording-processor worklet module on any AudioContext.
 * Follows the SAC (standardized-audio-context) pattern: the caller provides the addModule
 * callback, so this works with both native AudioContext and standardized-audio-context.
 *
 * ```ts
 * // Native AudioContext
 * await addRecordingWorkletModule((url) => ctx.audioWorklet.addModule(url));
 *
 * // Tone.js Context (standardized-audio-context)
 * const rawCtx = context.rawContext;
 * await addRecordingWorkletModule((url) => rawCtx.audioWorklet.addModule(url));
 * ```
 */
export async function addRecordingWorkletModule(
  addModule: (url: string) => Promise<void>
): Promise<void> {
  await addModule(recordingProcessorUrl);
}

/**
 * Register the meter-processor worklet module on any AudioContext.
 * Same pattern as addRecordingWorkletModule — caller provides the addModule callback.
 */
export async function addMeterWorkletModule(
  addModule: (url: string) => Promise<void>
): Promise<void> {
  await addModule(meterProcessorUrl);
}

/**
 * Message posted by the meter-processor worklet.
 *
 * A Float32Array of length 2*N (N = metered channel count):
 * - indices [0..N-1]: per-channel peak (max absolute sample)
 * - indices [N..2N-1]: per-channel RMS
 *
 * The worklet reuses one buffer across flushes (each postMessage structured-
 * clones the contents) so the audio thread does no per-flush allocation.
 * Receivers get a fresh copy per message and derive the channel count as
 * `data.length / 2`.
 */
export type MeterMessage = Float32Array;
