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
  // The draft remembers the format it was typed in: text typed as hh:mm:ss must not
  // be parsed as seconds, so a format change abandons the edit.
  const [draft, setDraft] = useState<{ text: string; format: TimeFormat } | null>(null);
  const activeDraft = draft?.format === format ? draft : null;
  const displayValue = activeDraft?.text ?? formatTime(value, format);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft({ text: e.target.value, format });
  };

  const handleBlur = () => {
    if (draft === null) return;
    // Dropping the draft returns the display to the formatted prop; the parent
    // decides whether the parsed value becomes the new prop.
    setDraft(null);
    // Nothing was typed in this format, so there is nothing to report.
    if (activeDraft === null) return;
    onChange?.(parseTime(activeDraft.text, format));
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
