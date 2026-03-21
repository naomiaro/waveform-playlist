/**
 * Recording UI Controls
 *
 * Simple presentational components for the recording example.
 * These are example-specific UI — not part of the library.
 */

import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import type { MicrophoneDevice } from '@waveform-playlist/recording';
import { BaseSelectSmall } from '@waveform-playlist/ui-components';
import {
  Play as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Record as RecordIcon,
  SkipBack as SkipBackIcon,
} from '@phosphor-icons/react';

// --- Transport Buttons (icon-only, Audacity-style) ---

const ICON_SIZE = 18;

const TransportButton = styled.button<{ $active?: boolean; $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--gray-5);
  border-radius: 4px;
  cursor: pointer;
  color: var(--gray-11);
  background: var(--gray-2);
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  ${(props) =>
    props.$active &&
    css`
      background: var(--gray-4);
      border-color: var(--gray-7);
    `}

  ${(props) =>
    props.$danger &&
    css`
      color: #dc3545;
    `}

  &:hover:not(:disabled) {
    background: var(--gray-4);
    border-color: var(--gray-7);
  }

  &:active:not(:disabled) {
    background: var(--gray-5);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--accent-8);
    outline-offset: 1px;
  }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const RecordCircle = styled.span<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${(props) => (props.$active ? css`${pulse} 1.5s ease-in-out infinite` : 'none')};
`;

export interface TransportButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const RewindButton: React.FC<TransportButtonProps> = ({ onClick, disabled }) => (
  <TransportButton onClick={onClick} disabled={disabled} aria-label="Rewind to start" title="Rewind to start (0)">
    <SkipBackIcon size={ICON_SIZE} weight="fill" />
  </TransportButton>
);

export const TransportPlayButton: React.FC<TransportButtonProps & { active?: boolean }> = ({
  onClick,
  disabled,
  active,
}) => (
  <TransportButton onClick={onClick} disabled={disabled} $active={active} aria-label="Play" title="Play (Space)">
    <PlayIcon size={ICON_SIZE} weight="fill" />
  </TransportButton>
);

export const TransportPauseButton: React.FC<TransportButtonProps> = ({ onClick, disabled }) => (
  <TransportButton onClick={onClick} disabled={disabled} aria-label="Pause" title="Pause">
    <PauseIcon size={ICON_SIZE} weight="fill" />
  </TransportButton>
);

export const TransportStopButton: React.FC<TransportButtonProps> = ({ onClick, disabled }) => (
  <TransportButton onClick={onClick} disabled={disabled} aria-label="Stop" title="Stop (Esc)">
    <StopIcon size={ICON_SIZE} weight="fill" />
  </TransportButton>
);

export interface RecordButtonProps {
  isRecording: boolean;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  onClick,
  disabled = false,
}) => (
  <TransportButton
    onClick={onClick}
    disabled={disabled || isRecording}
    $active={isRecording}
    $danger
    aria-label={isRecording ? 'Recording' : 'Start recording'}
    title={isRecording ? 'Recording...' : 'Record (R) / New track (Shift+R)'}
  >
    <RecordCircle $active={isRecording}>
      <RecordIcon size={ICON_SIZE} weight="fill" />
    </RecordCircle>
  </TransportButton>
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
  /** Optional hint text rendered below the dropdown (e.g., sample rate info) */
  hint?: React.ReactNode;
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

const SelectorHint = styled.span`
  font-size: 0.7rem;
  font-family: 'Courier New', Monaco, monospace;
  color: var(--gray-10);
`;

export const MicrophoneSelector: React.FC<MicrophoneSelectorProps> = ({
  devices,
  selectedDeviceId,
  onDeviceChange,
  disabled = false,
  hint,
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
      {hint && <SelectorHint>{hint}</SelectorHint>}
    </SelectorLabel>
  );
};
