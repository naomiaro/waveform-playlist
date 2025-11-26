import { useState } from 'react';
import { formatTime as formatTimeUtil, parseTime as parseTimeUtil, type TimeFormat } from '@waveform-playlist/ui-components';

export interface TimeFormatControls {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (seconds: number) => string;
  parseTime: (timeString: string) => number;
}

/**
 * Hook to manage time format state
 *
 * @example
 * ```tsx
 * const { timeFormat, setTimeFormat, formatTime, parseTime } = useTimeFormat();
 *
 * <TimeFormatSelect
 *   value={timeFormat}
 *   onChange={setTimeFormat}
 * />
 * <span>{formatTime(currentTime)}</span>
 * <input onChange={(e) => seekTo(parseTime(e.target.value))} />
 * ```
 */
export function useTimeFormat(): TimeFormatControls {
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('hh:mm:ss.uuu');

  const formatTime = (seconds: number) => {
    return formatTimeUtil(seconds, timeFormat);
  };

  const parseTime = (timeString: string) => {
    return parseTimeUtil(timeString, timeFormat);
  };

  return {
    timeFormat,
    setTimeFormat,
    formatTime,
    parseTime,
  };
}
