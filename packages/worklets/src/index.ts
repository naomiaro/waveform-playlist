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

/** Message shape posted by the meter-processor worklet */
export interface MeterMessage {
  peak: number[];
  rms: number[];
}
