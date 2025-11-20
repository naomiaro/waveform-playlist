import React from 'react';
import {
  ContinuousPlayCheckbox as BaseContinuousPlayCheckbox,
  LinkEndpointsCheckbox as BaseLinkEndpointsCheckbox,
  EditableCheckbox as BaseEditableCheckbox,
  DownloadAnnotationsButton as BaseDownloadAnnotationsButton,
} from '@waveform-playlist/annotations';
import { useWaveformPlaylist } from '../WaveformPlaylistContext';

/**
 * Continuous play checkbox that uses the playlist context
 */
export const ContinuousPlayCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { continuousPlay, setContinuousPlay } = useWaveformPlaylist();

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
 */
export const LinkEndpointsCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { linkEndpoints, setLinkEndpoints } = useWaveformPlaylist();

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
 */
export const EditableCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { annotationsEditable, setAnnotationsEditable } = useWaveformPlaylist();

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
 */
export const DownloadAnnotationsButton: React.FC<{ filename?: string; className?: string }> = ({
  filename,
  className,
}) => {
  const { annotations } = useWaveformPlaylist();

  return (
    <BaseDownloadAnnotationsButton
      annotations={annotations}
      filename={filename}
      className={className}
    />
  );
};
