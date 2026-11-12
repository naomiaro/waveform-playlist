import React from 'react';
import styled from 'styled-components';
import { BaseSelect } from '../styled/index';

const SelectWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;

/** The speeds offered when `rates` is not given. */
export const DEFAULT_PLAYBACK_RATES: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface PlaybackRateSelectProps {
  /** The current speed, where 1 is normal. */
  value: number;
  onChange: (rate: number) => void;
  /** The speeds to offer, in the order to list them. */
  rates?: readonly number[];
  disabled?: boolean;
  className?: string;
}

const label = (rate: number) => `${rate}×`;

/**
 * Dropdown select for the playback speed. A current speed that is not among
 * `rates` (set from code) is listed as an extra option, so the select never
 * shows a speed that is not the one playing.
 */
export const PlaybackRateSelect: React.FC<PlaybackRateSelectProps> = ({
  value,
  onChange,
  rates = DEFAULT_PLAYBACK_RATES,
  disabled = false,
  className,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(Number(e.target.value));
  };
  const options = rates.includes(value) ? rates : [...rates, value].sort((a, b) => a - b);

  return (
    <SelectWrapper className={className}>
      <BaseSelect
        className="playback-rate"
        value={String(value)}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Playback speed"
      >
        {options.map((rate) => (
          <option key={rate} value={String(rate)}>
            {label(rate)}
          </option>
        ))}
      </BaseSelect>
    </SelectWrapper>
  );
};
