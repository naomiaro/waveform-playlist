import type { RecordingProgress, RecordingProgressSource } from '@waveform-playlist/core';
import { useThrottledValue, type UseThrottledValueOptions } from '@waveform-playlist/ui-components';

/**
 * A recording's elapsed time and preview peaks as React state, at most
 * `updateRate` times a second (default 10). Use it for slow displays such as
 * an elapsed-time label; the live waveform takes the source itself
 * (`<Waveform recordingState={{ …, progress }} />`).
 */
export function useRecordingProgress(
  progress: RecordingProgressSource,
  options: UseThrottledValueOptions = {}
): RecordingProgress {
  return useThrottledValue(progress, options);
}
