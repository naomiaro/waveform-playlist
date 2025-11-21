import React from 'react';
import {
  ContinuousPlayCheckbox as BaseContinuousPlayCheckbox,
  LinkEndpointsCheckbox as BaseLinkEndpointsCheckbox,
  EditableCheckbox as BaseEditableCheckbox,
  DownloadAnnotationsButton as BaseDownloadAnnotationsButton,
} from '@waveform-playlist/annotations';
import { usePlaylistState, usePlaylistControls } from '../WaveformPlaylistContext';

/**
 * Continuous play checkbox that uses the playlist context
 * Uses split contexts to avoid re-rendering during animation
 */
export const ContinuousPlayCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { continuousPlay } = usePlaylistState();
  const { setContinuousPlay } = usePlaylistControls();

  return (
    <BaseContinuousPlayCheckbox
      checked={continuousPlay}
      onChange={setContinuousPlay}
      className={className}
    />
  );
};

/**
 * Link endpoints checkbox that uses the playlist context
 * Uses split contexts to avoid re-rendering during animation
 */
export const LinkEndpointsCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { linkEndpoints } = usePlaylistState();
  const { setLinkEndpoints } = usePlaylistControls();

  return (
    <BaseLinkEndpointsCheckbox
      checked={linkEndpoints}
      onChange={setLinkEndpoints}
      className={className}
    />
  );
};

/**
 * Editable annotations checkbox that uses the playlist context
 * Uses split contexts to avoid re-rendering during animation
 */
export const EditableCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { annotationsEditable } = usePlaylistState();
  const { setAnnotationsEditable } = usePlaylistControls();

  return (
    <BaseEditableCheckbox
      checked={annotationsEditable}
      onChange={setAnnotationsEditable}
      className={className}
    />
  );
};

/**
 * Download annotations button that uses the playlist context
 * Uses split contexts to avoid re-rendering during animation
 */
export const DownloadAnnotationsButton: React.FC<{ filename?: string; className?: string }> = ({
  filename,
  className,
}) => {
  const { annotations } = usePlaylistState();

  return (
    <BaseDownloadAnnotationsButton
      annotations={annotations}
      filename={filename}
      className={className}
    />
  );
};
