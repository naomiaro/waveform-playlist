/**
 * Recording UI Controls
 *
 * Simple presentational components for the recording example.
 * These are example-specific UI — not part of the library.
 */

import React from 'react';
import styled from 'styled-components';
import type { MicrophoneDevice } from '@waveform-playlist/recording';
import { BaseSelectSmall } from '@waveform-playlist/ui-components';

// --- RecordButton ---

export interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const StyledButton = styled.button<{ $isRecording: boolean }>`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background: ${(props) => (props.$isRecording ? '#dc3545' : '#e74c3c')};
  color: white;

  &:hover:not(:disabled) {
    background: ${(props) => (props.$isRecording ? '#c82333' : '#c0392b')};
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.3);
  }
`;

const RecordDot = styled.span<{ $active: boolean }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  margin-right: 0.5rem;
  animation: ${(props) => (props.$active ? 'pulse 1.5s ease-in-out infinite' : 'none')};

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
`;

export const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  onClick,
  disabled = false,
}) => (
  <StyledButton
    $isRecording={isRecording}
    onClick={onClick}
    disabled={disabled || isRecording}
    aria-label={isRecording ? 'Recording' : 'Start recording'}
  >
    <RecordDot $active={isRecording} />
    Record
  </StyledButton>
);

// --- RecordingIndicator ---

export interface RecordingIndicatorProps {
  isRecording: boolean;
  duration: number;
}

const IndicatorContainer = styled.div<{ $isRecording: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: ${(props) => (props.$isRecording ? '#fff3cd' : 'transparent')};
  border-radius: 0.25rem;
  transition: background 0.2s ease-in-out;
`;

const BlinkingDot = styled.div<{ $isRecording: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #dc3545;
  opacity: ${(props) => (props.$isRecording ? 1 : 0)};

  ${(props) =>
    props.$isRecording &&
    `
    animation: blink 1.5s ease-in-out infinite;

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `}
`;

const Duration = styled.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  min-width: 70px;
`;

const Status = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: #dc3545;
  text-transform: uppercase;
`;

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  isRecording,
  duration,
}) => (
  <IndicatorContainer $isRecording={isRecording}>
    <BlinkingDot $isRecording={isRecording} />
    <Duration>{formatDuration(duration)}</Duration>
    {isRecording && <Status>Recording</Status>}
  </IndicatorContainer>
);

// --- MicrophoneSelector ---

export interface MicrophoneSelectorProps {
  devices: MicrophoneDevice[];
  selectedDeviceId?: string;
  onDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
}

const SelectorLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--gray-9);
`;

const MicSelect = styled(BaseSelectSmall)`
  min-width: 200px;
`;

export const MicrophoneSelector: React.FC<MicrophoneSelectorProps> = ({
  devices,
  selectedDeviceId,
  onDeviceChange,
  disabled = false,
}) => {
  const currentValue = selectedDeviceId || (devices.length > 0 ? devices[0].deviceId : '');

  return (
    <SelectorLabel>
      Microphone
      <MicSelect
        value={currentValue}
        onChange={(e) => onDeviceChange(e.target.value)}
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
      </MicSelect>
    </SelectorLabel>
  );
};
