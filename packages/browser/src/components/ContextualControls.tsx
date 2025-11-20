import React from 'react';
import {
  MasterVolumeControl as BaseMasterVolumeControl,
  TimeFormatSelect as BaseTimeFormatSelect,
  AutomaticScrollCheckbox as BaseAutomaticScrollCheckbox,
  AudioPosition as BaseAudioPosition,
  SelectionTimeInputs as BaseSelectionTimeInputs,
} from '@waveform-playlist/ui-components';
import { useWaveformPlaylist } from '../WaveformPlaylistContext';

/**
 * Master volume control that uses the playlist context
 */
export const MasterVolumeControl: React.FC<{ className?: string }> = ({ className }) => {
  const { masterVolume, setMasterVolume } = useWaveformPlaylist();

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
  const { timeFormat, setTimeFormat } = useWaveformPlaylist();

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
 */
export const AudioPosition: React.FC<{ className?: string }> = ({ className }) => {
  const { currentTime, formatTime } = useWaveformPlaylist();

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
  const { selectionStart, selectionEnd, setSelection } = useWaveformPlaylist();

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
 * Automatic scroll checkbox (placeholder - needs implementation)
 */
export const AutomaticScrollCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  // TODO: Implement automatic scroll in context
  return (
    <BaseAutomaticScrollCheckbox
      checked={false}
      onChange={() => {}}
      className={className}
    />
  );
};
