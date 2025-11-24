import React from 'react';
import { BaseControlButton } from '@waveform-playlist/ui-components';
import { usePlaylistControls, usePlaylistData } from '../WaveformPlaylistContext';

export const ZoomInButton: React.FC<{ className?: string; disabled?: boolean }> = ({ className, disabled }) => {
  const { zoomIn } = usePlaylistControls();
  const { canZoomIn } = usePlaylistData();

  return (
    <BaseControlButton variant="success" onClick={zoomIn} disabled={disabled || !canZoomIn} className={className}>
      Zoom In
    </BaseControlButton>
  );
};

export const ZoomOutButton: React.FC<{ className?: string; disabled?: boolean }> = ({ className, disabled }) => {
  const { zoomOut } = usePlaylistControls();
  const { canZoomOut } = usePlaylistData();

  return (
    <BaseControlButton variant="success" onClick={zoomOut} disabled={disabled || !canZoomOut} className={className}>
      Zoom Out
    </BaseControlButton>
  );
};
