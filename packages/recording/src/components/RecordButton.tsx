/**
 * RecordButton - Control button for starting/stopping recording
 */

import React from 'react';
import styled from 'styled-components';

export interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const Button = styled.button<{ $isRecording: boolean }>`
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

const RecordingIndicator = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  margin-right: 0.5rem;
  animation: pulse 1.5s ease-in-out infinite;

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
  className,
}) => {
  return (
    <Button
      $isRecording={isRecording}
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording && <RecordingIndicator />}
      {isRecording ? 'Stop Recording' : 'Record'}
    </Button>
  );
};
