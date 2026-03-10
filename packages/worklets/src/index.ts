export const meterProcessorUrl = new URL(
  './worklet/meter-processor.worklet.js',
  import.meta.url
).href;

export const recordingProcessorUrl = new URL(
  './worklet/recording-processor.worklet.js',
  import.meta.url
).href;
