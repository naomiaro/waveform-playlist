import { useCallback, useState } from 'react';
import {
  formatTime as formatTimeUtil,
  parseTime as parseTimeUtil,
  type TimeFormat,
} from '@waveform-playlist/ui-components';

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

  const formatTime = useCallback(
    (seconds: number) => formatTimeUtil(seconds, timeFormat),
    [timeFormat]
  );

  const parseTime = useCallback(
    (timeString: string) => parseTimeUtil(timeString, timeFormat),
    [timeFormat]
  );

  return {
    timeFormat,
    setTimeFormat,
    formatTime,
    parseTime,
  };
}
