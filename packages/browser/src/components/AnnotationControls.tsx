import React from 'react';
import { useAnnotationIntegration } from '../AnnotationIntegrationContext';
import {
  usePlaybackControls,
  useEditorControls,
  useAnnotations,
  useAnnotationEditing,
} from '../contexts/playlistContexts';

/**
 * Continuous play checkbox that uses the playlist context.
 * Must be used within <AnnotationProvider>.
 */
export const ContinuousPlayCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { ContinuousPlayCheckbox: Base } = useAnnotationIntegration();
  const { continuousPlay } = useAnnotations();
  const { setContinuousPlay } = usePlaybackControls();

  return <Base checked={continuousPlay} onChange={setContinuousPlay} className={className} />;
};

/**
 * Link endpoints checkbox that uses the playlist context.
 * Must be used within <AnnotationProvider>.
 */
export const LinkEndpointsCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { LinkEndpointsCheckbox: Base } = useAnnotationIntegration();
  const { linkEndpoints } = useAnnotationEditing();
  const { setLinkEndpoints } = useEditorControls();

  return <Base checked={linkEndpoints} onChange={setLinkEndpoints} className={className} />;
};

/**
 * Editable annotations checkbox that uses the playlist context.
 * Must be used within <AnnotationProvider>.
 */
export const EditableCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { EditableCheckbox: Base } = useAnnotationIntegration();
  const { annotationsEditable } = useAnnotationEditing();
  const { setAnnotationsEditable } = useEditorControls();

  return (
    <Base checked={annotationsEditable} onChange={setAnnotationsEditable} className={className} />
  );
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
  const { annotations } = useAnnotations();

  return <Base annotations={annotations} filename={filename} className={className} />;
};
