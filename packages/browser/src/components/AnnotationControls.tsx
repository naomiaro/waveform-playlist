import React from 'react';
import { useAnnotationIntegration } from '../AnnotationIntegrationContext';
import { usePlaylistState, usePlaylistControls } from '../WaveformPlaylistContext';

/**
 * Continuous play checkbox that uses the playlist context.
 * Must be used within <AnnotationProvider>.
 */
export const ContinuousPlayCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { ContinuousPlayCheckbox: Base } = useAnnotationIntegration();
  const { continuousPlay } = usePlaylistState();
  const { setContinuousPlay } = usePlaylistControls();

  return <Base checked={continuousPlay} onChange={setContinuousPlay} className={className} />;
};

/**
 * Link endpoints checkbox that uses the playlist context.
 * Must be used within <AnnotationProvider>.
 */
export const LinkEndpointsCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { LinkEndpointsCheckbox: Base } = useAnnotationIntegration();
  const { linkEndpoints } = usePlaylistState();
  const { setLinkEndpoints } = usePlaylistControls();

  return <Base checked={linkEndpoints} onChange={setLinkEndpoints} className={className} />;
};

/**
 * Editable annotations checkbox that uses the playlist context.
 * Must be used within <AnnotationProvider>.
 */
export const EditableCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { EditableCheckbox: Base } = useAnnotationIntegration();
  const { annotationsEditable } = usePlaylistState();
  const { setAnnotationsEditable } = usePlaylistControls();

  return <Base checked={annotationsEditable} onChange={setAnnotationsEditable} className={className} />;
};

/**
 * Download annotations button that uses the playlist context.
 * Must be used within <AnnotationProvider>.
 */
export const DownloadAnnotationsButton: React.FC<{ filename?: string; className?: string }> = ({
  filename,
  className,
}) => {
  const { DownloadAnnotationsButton: Base } = useAnnotationIntegration();
  const { annotations } = usePlaylistState();

  return <Base annotations={annotations} filename={filename} className={className} />;
};
