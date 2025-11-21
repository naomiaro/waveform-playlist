import React from 'react';
import { ControlButton } from '@waveform-playlist/ui-components';
import { usePlaylistControls, usePlaylistData } from '../WaveformPlaylistContext';

export const ZoomInButton: React.FC<{ className?: string }> = ({ className }) => {
  const { zoomIn } = usePlaylistControls();
  const { canZoomIn } = usePlaylistData();

  return (
    <ControlButton variant="success" onClick={zoomIn} disabled={!canZoomIn} className={className}>
      Zoom In
    </ControlButton>
  );
};

export const ZoomOutButton: React.FC<{ className?: string }> = ({ className }) => {
  const { zoomOut } = usePlaylistControls();
  const { canZoomOut } = usePlaylistData();

  return (
    <ControlButton variant="success" onClick={zoomOut} disabled={!canZoomOut} className={className}>
      Zoom Out
    </ControlButton>
  );
};
