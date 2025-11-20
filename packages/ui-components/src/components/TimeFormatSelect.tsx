import React from 'react';
import styled from 'styled-components';
import { type TimeFormat } from '../utils/timeFormat';

const SelectWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;

const Select = styled.select`
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  cursor: pointer;

  &:focus {
    border-color: #80bdff;
    outline: 0;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  }

  &:disabled {
    background-color: #e9ecef;
    cursor: not-allowed;
  }
`;

export interface TimeFormatSelectProps {
  value: TimeFormat;
  onChange: (format: TimeFormat) => void;
  disabled?: boolean;
  className?: string;
}

const TIME_FORMAT_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: 'seconds', label: 'seconds' },
  { value: 'thousandths', label: 'thousandths' },
  { value: 'hh:mm:ss', label: 'hh:mm:ss' },
  { value: 'hh:mm:ss.u', label: 'hh:mm:ss + tenths' },
  { value: 'hh:mm:ss.uu', label: 'hh:mm:ss + hundredths' },
  { value: 'hh:mm:ss.uuu', label: 'hh:mm:ss + milliseconds' },
];

/**
 * Dropdown select for choosing time display format
 */
export const TimeFormatSelect: React.FC<TimeFormatSelectProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as TimeFormat);
  };

  return (
    <SelectWrapper className={className}>
      <Select
        className="time-format"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Time format selection"
      >
        {TIME_FORMAT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </SelectWrapper>
  );
};
