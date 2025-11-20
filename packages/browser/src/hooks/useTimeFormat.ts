import { useState } from 'react';
import { formatTime as formatTimeUtil, type TimeFormat } from '@waveform-playlist/ui-components';

export interface TimeFormatControls {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (seconds: number) => string;
}

/**
 * Hook to manage time format state
 *
 * @example
 * ```tsx
 * const { timeFormat, setTimeFormat, formatTime } = useTimeFormat();
 *
 * <TimeFormatSelect
 *   value={timeFormat}
 *   onChange={setTimeFormat}
 * />
 * <span>{formatTime(currentTime)}</span>
 * ```
 */
export function useTimeFormat(): TimeFormatControls {
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('hh:mm:ss.uuu');

  const formatTime = (seconds: number) => {
    return formatTimeUtil(seconds, timeFormat);
  };

  return {
    timeFormat,
    setTimeFormat,
    formatTime,
  };
}
