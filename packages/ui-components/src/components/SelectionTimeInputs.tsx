import React, { useEffect, useState } from 'react';
import { TimeInput } from './TimeInput';
import { type TimeFormat } from '../utils/timeFormat';

export interface SelectionTimeInputsProps {
  selectionStart: number; // Time in seconds
  selectionEnd: number; // Time in seconds
  onSelectionChange?: (start: number, end: number) => void;
  className?: string;
}

export const SelectionTimeInputs: React.FC<SelectionTimeInputsProps> = ({
  selectionStart,
  selectionEnd,
  onSelectionChange,
  className,
}) => {
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

  const handleStartChange = (value: number) => {
    if (onSelectionChange) {
      onSelectionChange(value, selectionEnd);
    }
  };

  const handleEndChange = (value: number) => {
    if (onSelectionChange) {
      onSelectionChange(selectionStart, value);
    }
  };

  return (
    <>
      <TimeInput
        id="audio_start"
        label="Start of audio selection"
        value={selectionStart}
        format={timeFormat}
        className="audio-start form-control mr-sm-2"
        onChange={handleStartChange}
      />
      <TimeInput
        id="audio_end"
        label="End of audio selection"
        value={selectionEnd}
        format={timeFormat}
        className="audio-end form-control mr-sm-2"
        onChange={handleEndChange}
      />
    </>
  );
};
