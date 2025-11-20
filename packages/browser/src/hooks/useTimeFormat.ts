import { useState, useEffect } from 'react';
import { formatTime as formatTimeUtil, type TimeFormat } from '@waveform-playlist/ui-components';

export interface TimeFormatControls {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (seconds: number) => string;
}

/**
 * Hook to manage time format state and listen to external time format selector
 */
export function useTimeFormat(): TimeFormatControls {
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('hh:mm:ss.uuu');

  // Listen to the external time-format dropdown
  useEffect(() => {
    const timeFormatSelect = document.querySelector('.time-format') as HTMLSelectElement;

    const handleFormatChange = () => {
      if (timeFormatSelect) {
        setTimeFormat(timeFormatSelect.value as TimeFormat);
      }
    };

    // Set initial value
    if (timeFormatSelect) {
      setTimeFormat(timeFormatSelect.value as TimeFormat);
      timeFormatSelect.addEventListener('change', handleFormatChange);
    }

    return () => {
      timeFormatSelect?.removeEventListener('change', handleFormatChange);
    };
  }, []);

  const formatTime = (seconds: number) => {
    return formatTimeUtil(seconds, timeFormat);
  };

  return {
    timeFormat,
    setTimeFormat,
    formatTime,
  };
}
