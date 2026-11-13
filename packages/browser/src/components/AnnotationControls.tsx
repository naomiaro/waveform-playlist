import React from 'react';
import { useAnnotationIntegration } from '../AnnotationIntegrationContext';
import {
  usePlaybackControls,
  useAnnotations,
  useAnnotationOptions,
} from '../contexts/playlistContexts';

/**
 * Continuous play checkbox: shows and sets the provider's `continuousPlay`
 * option. Works under both providers. Must be used within <AnnotationProvider>.
 */
export const ContinuousPlayCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { ContinuousPlayCheckbox: Base } = useAnnotationIntegration();
  const { continuousPlay } = useAnnotationOptions();
  const { setContinuousPlay } = usePlaybackControls();

  return <Base checked={continuousPlay} onChange={setContinuousPlay} className={className} />;
};

/**
 * Link endpoints checkbox: shows and sets the provider's `linkEndpoints`
 * option. Works under both providers. Must be used within <AnnotationProvider>.
 */
export const LinkEndpointsCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { LinkEndpointsCheckbox: Base } = useAnnotationIntegration();
  const { linkEndpoints } = useAnnotationOptions();
  const { setLinkEndpoints } = usePlaybackControls();

  return <Base checked={linkEndpoints} onChange={setLinkEndpoints} className={className} />;
};

/**
 * Editable annotations checkbox: shows and sets the provider's `editable`
 * option. Works under both providers. Must be used within <AnnotationProvider>.
 */
export const EditableCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { EditableCheckbox: Base } = useAnnotationIntegration();
  const { editable } = useAnnotationOptions();
  const { setAnnotationsEditable } = usePlaybackControls();

  return <Base checked={editable} onChange={setAnnotationsEditable} className={className} />;
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
