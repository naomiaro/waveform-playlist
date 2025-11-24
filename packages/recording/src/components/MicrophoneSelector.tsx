/**
 * MicrophoneSelector - Dropdown for selecting microphone input device
 */

import React from 'react';
import styled from 'styled-components';
import { BaseSelect, BaseLabel } from '@waveform-playlist/ui-components';
import { MicrophoneDevice } from '../types';

export interface MicrophoneSelectorProps {
  devices: MicrophoneDevice[];
  selectedDeviceId?: string;
  onDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
  className?: string;
}

const Select = styled(BaseSelect)`
  min-width: 200px;
`;

const Label = styled(BaseLabel)`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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
