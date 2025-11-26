import React, { useRef, useEffect } from 'react';
import { getContext } from 'tone';
import {
  MasterVolumeControl as BaseMasterVolumeControl,
  TimeFormatSelect as BaseTimeFormatSelect,
  AutomaticScrollCheckbox as BaseAutomaticScrollCheckbox,
  SelectionTimeInputs as BaseSelectionTimeInputs,
  formatTime,
  type TimeFormat,
} from '@waveform-playlist/ui-components';
import styled from 'styled-components';
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

const PositionDisplay = styled.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.theme?.textColor || '#333'};
  user-select: none;
`;

/**
 * Audio position display that uses the playlist context.
 * Uses requestAnimationFrame for smooth 60fps updates during playback.
 * Direct DOM manipulation avoids React re-renders.
 */
export const AudioPosition: React.FC<{ className?: string }> = ({ className }) => {
  const timeRef = useRef<HTMLSpanElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { isPlaying, currentTimeRef, playbackStartTimeRef, audioStartPositionRef } = usePlaybackAnimation();
  const { timeFormat } = usePlaylistData();
  const format = timeFormat as TimeFormat;

  useEffect(() => {
    const updateTime = () => {
      if (timeRef.current) {
        let time: number;
        if (isPlaying) {
          const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
          time = (audioStartPositionRef.current ?? 0) + elapsed;
        } else {
          time = currentTimeRef.current ?? 0;
        }
        timeRef.current.textContent = formatTime(time, format);
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else {
      updateTime();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, format, currentTimeRef, playbackStartTimeRef, audioStartPositionRef]);

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
