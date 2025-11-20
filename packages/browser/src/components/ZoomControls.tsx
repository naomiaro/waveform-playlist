import React from 'react';
import { ControlButton } from '@waveform-playlist/ui-components';
import { useWaveformPlaylist } from '../WaveformPlaylistContext';

export const ZoomInButton: React.FC<{ className?: string }> = ({ className }) => {
  const { zoomIn, canZoomIn } = useWaveformPlaylist();

  return (
    <ControlButton variant="success" onClick={zoomIn} disabled={!canZoomIn} className={className}>
      Zoom In
    </ControlButton>
  );
};

export const ZoomOutButton: React.FC<{ className?: string }> = ({ className }) => {
  const { zoomOut, canZoomOut } = useWaveformPlaylist();

  return (
    <ControlButton variant="success" onClick={zoomOut} disabled={!canZoomOut} className={className}>
      Zoom Out
    </ControlButton>
  );
};
