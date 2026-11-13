import React, { useRef, useEffect, useId } from 'react';
import {
  MasterVolumeControl as BaseMasterVolumeControl,
  TimeFormatSelect as BaseTimeFormatSelect,
  PlaybackRateSelect as BasePlaybackRateSelect,
  AutomaticScrollCheckbox as BaseAutomaticScrollCheckbox,
  SelectionTimeInputs as BaseSelectionTimeInputs,
  formatTime,
} from '@waveform-playlist/ui-components';
import styled from 'styled-components';
import {
  useCurrentTime,
  useSelection,
  usePlaybackControls,
  useEditorControls,
  usePlaybackRate,
  usePlaylistSettings,
  usePlaylistMixer,
  usePlaybackRefs,
  useIsPlaying,
} from '../contexts/playlistContexts';

/**
 * Master volume control that uses the playlist context
 */
export const MasterVolumeControl: React.FC<{ className?: string }> = ({ className }) => {
  const { masterVolume } = usePlaylistMixer();
  const { setMasterVolume } = useEditorControls();

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
  const { timeFormat } = usePlaylistSettings();
  const { setTimeFormat } = usePlaybackControls();

  return <BaseTimeFormatSelect value={timeFormat} onChange={setTimeFormat} className={className} />;
};

const PositionDisplay = styled.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: ${(props) => props.theme?.textColor || '#333'};
  user-select: none;
`;

/**
 * Audio position display that uses the playlist context.
 * Updates via the shared animation frame registry — no own rAF loop.
 * Direct DOM manipulation avoids React re-renders.
 */
export const AudioPosition: React.FC<{ className?: string }> = ({ className }) => {
  const timeRef = useRef<HTMLSpanElement>(null);
  const { currentTimeRef, registerFrameCallback, unregisterFrameCallback } = usePlaybackRefs();
  const { isPlaying } = useIsPlaying();
  // Subscribed for the re-render only: what is shown comes from the ref.
  useCurrentTime();
  const { timeFormat: format } = usePlaylistSettings();

  // Its own id in the frame registry: under a shared one, a second readout
  // under the same provider replaced the first one's callback.
  const id = useId();

  // Register per-frame callback during playback — uses raw time for display
  useEffect(() => {
    if (isPlaying) {
      registerFrameCallback(id, ({ time }) => {
        if (timeRef.current) {
          timeRef.current.textContent = formatTime(time, format);
        }
      });
    }
    return () => unregisterFrameCallback(id);
  }, [id, isPlaying, format, registerFrameCallback, unregisterFrameCallback]);

  // Update when stopped (for seeks)
  useEffect(() => {
    if (!isPlaying && timeRef.current) {
      timeRef.current.textContent = formatTime(currentTimeRef.current ?? 0, format);
    }
  });

  return (
    <PositionDisplay ref={timeRef} className={className} aria-label="Audio position">
      {formatTime(currentTimeRef.current ?? 0, format)}
    </PositionDisplay>
  );
};

/**
 * Playback speed dropdown. MediaElementPlaylistProvider only (#688).
 * `rates` lists the speeds to offer (default 0.5× to 2×).
 */
export const PlaybackRateSelect: React.FC<{ rates?: readonly number[]; className?: string }> = ({
  rates,
  className,
}) => {
  const { playbackRate, setPlaybackRate } = usePlaybackRate();
  return (
    <BasePlaybackRateSelect
      value={playbackRate}
      onChange={setPlaybackRate}
      rates={rates}
      className={className}
    />
  );
};

/**
 * Selection time inputs bound to the provider: its selection, and its time
 * format (the one `TimeFormatSelect` and `setTimeFormat()` set).
 */
export const SelectionTimeInputs: React.FC<{ className?: string }> = ({ className }) => {
  const { selectionStart, selectionEnd } = useSelection();
  const { timeFormat } = usePlaylistSettings();
  const { setSelection } = usePlaybackControls();

  return (
    <BaseSelectionTimeInputs
      selectionStart={selectionStart}
      selectionEnd={selectionEnd}
      onSelectionChange={setSelection}
      format={timeFormat}
      className={className}
    />
  );
};

/**
 * Automatic scroll checkbox that uses the playlist context
 * Uses split contexts to avoid re-rendering during animation
 */
export const AutomaticScrollCheckbox: React.FC<{ className?: string }> = ({ className }) => {
  const { isAutomaticScroll } = usePlaylistSettings();
  const { setAutomaticScroll } = usePlaybackControls();

  return (
    <BaseAutomaticScrollCheckbox
      checked={isAutomaticScroll}
      onChange={setAutomaticScroll}
      className={className}
    />
  );
};
