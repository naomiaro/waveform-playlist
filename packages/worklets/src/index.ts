export const meterProcessorUrl = new URL('./worklet/meter-processor.worklet.js', import.meta.url)
  .href;

export const recordingProcessorUrl = new URL(
  './worklet/recording-processor.worklet.js',
  import.meta.url
).href;

/** Message shape posted by the meter-processor worklet */
export interface MeterMessage {
  peak: number[];
  rms: number[];
}
