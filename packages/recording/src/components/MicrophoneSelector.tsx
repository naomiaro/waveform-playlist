/**
 * MicrophoneSelector - Dropdown for selecting microphone input device
 */

import React, { useEffect } from 'react';
import styled from 'styled-components';
import { MicrophoneDevice } from '../types';

export interface MicrophoneSelectorProps {
  devices: MicrophoneDevice[];
  selectedDeviceId?: string;
  onDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
  className?: string;
}

const Select = styled.select`
  padding: 0.5rem;
  font-size: 0.875rem;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  background: white;
  cursor: pointer;
  min-width: 200px;

  &:hover:not(:disabled) {
    border-color: #adb5bd;
  }

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f8f9fa;
  }
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
`;

export const MicrophoneSelector: React.FC<MicrophoneSelectorProps> = ({
  devices,
  selectedDeviceId,
  onDeviceChange,
  disabled = false,
  className,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onDeviceChange(event.target.value);
  };

  // Use first device if no selection provided
  const currentValue = selectedDeviceId || (devices.length > 0 ? devices[0].deviceId : '');

  return (
    <Label className={className}>
      Microphone
      <Select
        value={currentValue}
        onChange={handleChange}
        disabled={disabled || devices.length === 0}
      >
        {devices.length === 0 ? (
          <option value="">No microphones found</option>
        ) : (
          devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))
        )}
      </Select>
    </Label>
  );
};
