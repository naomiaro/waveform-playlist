import React, { useId } from 'react';
import { TimeInput } from './TimeInput';
import { type TimeFormat } from '../utils/timeFormat';

export interface SelectionTimeInputsProps {
  selectionStart: number; // Time in seconds
  selectionEnd: number; // Time in seconds
  onSelectionChange?: (start: number, end: number) => void;
  /** How the two times are shown and parsed. Default: `hh:mm:ss.uuu`. */
  format?: TimeFormat;
  className?: string;
}

export const SelectionTimeInputs: React.FC<SelectionTimeInputsProps> = ({
  selectionStart,
  selectionEnd,
  onSelectionChange,
  format = 'hh:mm:ss.uuu',
  className,
}) => {
  // Generated: two of this component on one page must not share ids.
  const id = useId();
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
    <div className={className}>
      <TimeInput
        id={`${id}-start`}
        label="Start of audio selection"
        value={selectionStart}
        format={format}
        className="audio-start form-control mr-sm-2"
        onChange={handleStartChange}
      />
      <TimeInput
        id={`${id}-end`}
        label="End of audio selection"
        value={selectionEnd}
        format={format}
        className="audio-end form-control mr-sm-2"
        onChange={handleEndChange}
      />
    </div>
  );
};
