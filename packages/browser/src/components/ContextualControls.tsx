import React from 'react';
import {
  MasterVolumeControl as BaseMasterVolumeControl,
  TimeFormatSelect as BaseTimeFormatSelect,
  AutomaticScrollCheckbox as BaseAutomaticScrollCheckbox,
  AudioPosition as BaseAudioPosition,
  SelectionTimeInputs as BaseSelectionTimeInputs,
} from '@waveform-playlist/ui-components';
import { usePlaybackAnimation, usePlaylistState, usePlaylistControls, usePlaylistData } from '../WaveformPlaylistContext';

/**
 * Master volume control that uses the playlist context
 */
export const MasterVolumeControl: React.FC<{ className?: string }> = ({ className }) => {
  const { masterVolume } = usePlaylistData();
  const { setMasterVolume } = usePlaylistControls();

  return (
    <BaseMasterVolumeControl
      volume={masterVolume}
      onChange={setMasterVolume}
      className={className}
    />
  );
};

/**
 * Time format selector that uses the playlist context
 */
export const TimeFormatSelect: React.FC<{ className?: string }> = ({ className }) => {
  const { timeFormat } = usePlaylistData();
  const { setTimeFormat } = usePlaylistControls();

  return (
    <BaseTimeFormatSelect
      value={timeFormat as any}
      onChange={setTimeFormat as any}
      className={className}
    />
  );
};

/**
 * Audio position display that uses the playlist context
 * This component subscribes to animation context for high-frequency updates
 */
export const AudioPosition: React.FC<{ className?: string }> = ({ className }) => {
  const { currentTime } = usePlaybackAnimation();
  const { formatTime } = usePlaylistControls();

  return (
    <BaseAudioPosition
      formattedTime={formatTime(currentTime)}
      className={className}
    />
  );
};

/**
 * Selection time inputs that use the playlist context
 */
export const SelectionTimeInputs: React.FC<{ className?: string }> = ({ className }) => {
  const { selectionStart, selectionEnd } = usePlaylistState();
  const { setSelection } = usePlaylistControls();

  return (
    <BaseSelectionTimeInputs
      selectionStart={selectionStart}
      selectionEnd={selectionEnd}
      onSelectionChange={setSelection}
      className={className}
    />
  );
};

/**
 * Automatic scroll checkbox that uses the playlist context
 * Uses split contexts to avoid re-rendering during animation
 */
export const AutomaticScrollCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { isAutomaticScroll } = usePlaylistState();
  const { setAutomaticScroll } = usePlaylistControls();

  return (
    <BaseAutomaticScrollCheckbox
      checked={isAutomaticScroll}
      onChange={setAutomaticScroll}
      className={className}
    />
  );
};
