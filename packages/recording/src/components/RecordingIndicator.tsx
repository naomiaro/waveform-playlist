/**
 * RecordingIndicator - Shows recording status, duration, and visual indicator
 */

import React from 'react';
import styled from 'styled-components';

export interface RecordingIndicatorProps {
  isRecording: boolean;
  isPaused?: boolean;
  duration: number; // in seconds
  formatTime?: (seconds: number) => string;
  className?: string;
}

const Container = styled.div<{ $isRecording: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: ${(props) => (props.$isRecording ? '#fff3cd' : 'transparent')};
  border-radius: 0.25rem;
  transition: background 0.2s ease-in-out;
`;

const Dot = styled.div<{ $isRecording: boolean; $isPaused: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(props) => (props.$isPaused ? '#ffc107' : '#dc3545')};
  opacity: ${(props) => (props.$isRecording ? 1 : 0)};
  transition: opacity 0.2s ease-in-out;

  ${(props) =>
    props.$isRecording &&
    !props.$isPaused &&
    `
    animation: blink 1.5s ease-in-out infinite;

    @keyframes blink {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
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

const Status = styled.span<{ $isPaused: boolean }>`
  font-size: 0.75rem;
  font-weight: 500;
  color: ${(props) => (props.$isPaused ? '#ffc107' : '#dc3545')};
  text-transform: uppercase;
`;

const defaultFormatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  isRecording,
  isPaused = false,
  duration,
  formatTime = defaultFormatTime,
  className,
}) => {
  return (
    <Container $isRecording={isRecording} className={className}>
      <Dot $isRecording={isRecording} $isPaused={isPaused} />
      <Duration>{formatTime(duration)}</Duration>
      {isRecording && <Status $isPaused={isPaused}>{isPaused ? 'Paused' : 'Recording'}</Status>}
    </Container>
  );
};
