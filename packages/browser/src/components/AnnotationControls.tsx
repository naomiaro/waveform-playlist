import React from 'react';
import { useAnnotationIntegration } from '../AnnotationIntegrationContext';
import { usePlaylistState, usePlaylistControls } from '../WaveformPlaylistContext';

/**
 * Continuous play checkbox that uses the playlist context.
 * Returns null if @waveform-playlist/annotations is not available.
 */
export const ContinuousPlayCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const integration = useAnnotationIntegration();
  const { continuousPlay } = usePlaylistState();
  const { setContinuousPlay } = usePlaylistControls();

  if (!integration) return null;
  const Base = integration.ContinuousPlayCheckbox;

  return <Base checked={continuousPlay} onChange={setContinuousPlay} className={className} />;
};

/**
 * Link endpoints checkbox that uses the playlist context.
 * Returns null if @waveform-playlist/annotations is not available.
 */
export const LinkEndpointsCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const integration = useAnnotationIntegration();
  const { linkEndpoints } = usePlaylistState();
  const { setLinkEndpoints } = usePlaylistControls();

  if (!integration) return null;
  const Base = integration.LinkEndpointsCheckbox;

  return <Base checked={linkEndpoints} onChange={setLinkEndpoints} className={className} />;
};

/**
 * Editable annotations checkbox that uses the playlist context.
 * Returns null if @waveform-playlist/annotations is not available.
 */
export const EditableCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const integration = useAnnotationIntegration();
  const { annotationsEditable } = usePlaylistState();
  const { setAnnotationsEditable } = usePlaylistControls();

  if (!integration) return null;
  const Base = integration.EditableCheckbox;

  return <Base checked={annotationsEditable} onChange={setAnnotationsEditable} className={className} />;
};

/**
 * Download annotations button that uses the playlist context.
 * Returns null if @waveform-playlist/annotations is not available.
 */
export const DownloadAnnotationsButton: React.FC<{ filename?: string; className?: string }> = ({
  filename,
  className,
}) => {
  const integration = useAnnotationIntegration();
  const { annotations } = usePlaylistState();

  if (!integration) return null;
  const Base = integration.DownloadAnnotationsButton;

  return <Base annotations={annotations} filename={filename} className={className} />;
};
