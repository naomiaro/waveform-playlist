import React, { useEffect, useState } from 'react';
import { formatTime, parseTime, type TimeFormat } from '../utils/timeFormat';

export interface TimeInputProps {
  id: string;
  label: string;
  value: number; // Time in seconds
  format: TimeFormat;
  className?: string;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  id,
  label,
  value,
  format,
  className = 'form-control mr-sm-2',
  onChange,
  readOnly = false,
}) => {
  const [displayValue, setDisplayValue] = useState('');

  // Update display value when value or format changes
  useEffect(() => {
    const formatted = formatTime(value, format);
    console.log(`TimeInput (${id}): value or format changed`, { value, format, formatted });
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
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
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
