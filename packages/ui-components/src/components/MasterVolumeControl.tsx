import React from 'react';
import styled from 'styled-components';

const VolumeContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;

const VolumeLabel = styled.label`
  margin: 0;
  white-space: nowrap;
`;

const VolumeSlider = styled.input`
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

export interface MasterVolumeControlProps {
  volume: number; // 0-1.0 (linear gain, consistent with Web Audio API)
  onChange: (volume: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Master volume control slider component
 * Accepts volume as 0-1.0 range (linear gain) and displays as percentage
 */
export const MasterVolumeControl: React.FC<MasterVolumeControlProps> = ({
  volume,
  onChange,
  disabled = false,
  className,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert percentage (0-100) to linear gain (0-1.0)
    onChange(parseFloat(e.target.value) / 100);
  };

  return (
    <VolumeContainer className={className}>
      <VolumeLabel htmlFor="master-gain">Master Volume</VolumeLabel>
      <VolumeSlider
        type="range"
        min="0"
        max="100"
        value={volume * 100}
        onChange={handleChange}
        disabled={disabled}
        id="master-gain"
        className="master-gain form-control"
      />
    </VolumeContainer>
  );
};
