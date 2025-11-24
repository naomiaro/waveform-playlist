import React, { useEffect, useState } from 'react';
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
 * format and parses user input on blur.
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
  const [displayValue, setDisplayValue] = useState('');

  // Update display value when value or format changes
  useEffect(() => {
    const formatted = formatTime(value, format);
    setDisplayValue(formatted);
  }, [value, format, id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDisplayValue = e.target.value;
    setDisplayValue(newDisplayValue);
  };

  const handleBlur = () => {
    // Parse the display value and notify parent
    if (onChange) {
      const parsedValue = parseTime(displayValue, format);
      onChange(parsedValue);
    }
    // Re-format to ensure consistent display
    setDisplayValue(formatTime(value, format));
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
