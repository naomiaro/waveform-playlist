import React, { useState } from 'react';
import { formatTime, parseTime, type TimeFormat } from '../utils/timeFormat';
import { BaseInput, ScreenReaderOnly } from '../styled/index';

export interface TimeInputProps {
  id: string;
  label: string;
  value: number; // Time in seconds
  format: TimeFormat;
  className?: string;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}

/**
 * TimeInput - A styled input for time values with format support
 *
 * Uses BaseInput for consistent theming. Displays time in the specified
 * format and parses user input on blur. `onChange` fires only when the text
 * was edited, so moving focus through the input never rounds the value.
 */
export const TimeInput: React.FC<TimeInputProps> = ({
  id,
  label,
  value,
  format,
  className,
  onChange,
  readOnly = false,
}) => {
  // Only an in-progress edit is state; otherwise the display is derived from the props.
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? formatTime(value, format);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
  };

  const handleBlur = () => {
    if (draft === null) return; // nothing was typed, so there is nothing to report
    // Dropping the draft returns the display to the formatted prop; the parent
    // decides whether the parsed value becomes the new prop.
    setDraft(null);
    onChange?.(parseTime(draft, format));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <>
      <ScreenReaderOnly as="label" htmlFor={id}>
        {label}
      </ScreenReaderOnly>
      <BaseInput
        type="text"
        className={className}
        id={id}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
      />
    </>
  );
};
