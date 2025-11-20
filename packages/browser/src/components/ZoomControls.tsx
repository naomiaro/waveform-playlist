import React from 'react';
import styled from 'styled-components';
import { useWaveformPlaylist } from '../WaveformPlaylistContext';

const Button = styled.button`
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;

  &:hover:not(:disabled) {
    background: #218838;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`;

export const ZoomInButton: React.FC<{ className?: string }> = ({ className }) => {
  const { zoomIn, canZoomIn } = useWaveformPlaylist();

  return (
    <Button onClick={zoomIn} disabled={!canZoomIn} className={className}>
      Zoom In
    </Button>
  );
};

export const ZoomOutButton: React.FC<{ className?: string }> = ({ className }) => {
  const { zoomOut, canZoomOut } = useWaveformPlaylist();

  return (
    <Button onClick={zoomOut} disabled={!canZoomOut} className={className}>
      Zoom Out
    </Button>
  );
};
