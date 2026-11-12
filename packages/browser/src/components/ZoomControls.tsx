import React from 'react';
import { BaseControlButton } from '@waveform-playlist/ui-components';
import { useEditorControls, usePlaylistZoom } from '../contexts/playlistContexts';

export const ZoomInButton: React.FC<{ className?: string; disabled?: boolean }> = ({
  className,
  disabled,
}) => {
  const { zoomIn } = useEditorControls();
  const { canZoomIn } = usePlaylistZoom();

  return (
    <BaseControlButton onClick={zoomIn} disabled={disabled || !canZoomIn} className={className}>
      Zoom In
    </BaseControlButton>
  );
};

export const ZoomOutButton: React.FC<{ className?: string; disabled?: boolean }> = ({
  className,
  disabled,
}) => {
  const { zoomOut } = useEditorControls();
  const { canZoomOut } = usePlaylistZoom();

  return (
    <BaseControlButton onClick={zoomOut} disabled={disabled || !canZoomOut} className={className}>
      Zoom Out
    </BaseControlButton>
  );
};
