import React from 'react';
import { BaseControlButton } from '@waveform-playlist/ui-components';
import { usePlaybackAnimation, usePlaylistState, usePlaylistControls, usePlaylistData } from '../WaveformPlaylistContext';

export const PlayButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying, currentTimeRef } = usePlaybackAnimation();
  const { selectionStart, selectionEnd } = usePlaylistState();
  const { play } = usePlaylistControls();

  const handleClick = async () => {
    // Check if there's a selection
    if (selectionStart !== selectionEnd && selectionEnd > selectionStart) {
      // Play only the selected region
      const duration = selectionEnd - selectionStart;
      await play(selectionStart, duration);
    } else {
      // Play from current position to the end
      await play(currentTimeRef.current ?? 0);
    }
  };

  return (
    <BaseControlButton onClick={handleClick} disabled={isPlaying} className={className}>
      Play
    </BaseControlButton>
  );
};

export const PauseButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying } = usePlaybackAnimation();
  const { pause } = usePlaylistControls();

  return (
    <BaseControlButton onClick={pause} disabled={!isPlaying} className={className}>
      Pause
    </BaseControlButton>
  );
};

export const StopButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying } = usePlaybackAnimation();
  const { stop } = usePlaylistControls();

  return (
    <BaseControlButton onClick={stop} disabled={!isPlaying} className={className}>
      Stop
    </BaseControlButton>
  );
};

export const RewindButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying } = usePlaybackAnimation();
  const { play, setCurrentTime } = usePlaylistControls();
  const { playoutRef } = usePlaylistData();

  const handleClick = () => {
    setCurrentTime(0);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      play(0);
    }
  };

  return (
    <BaseControlButton onClick={handleClick} className={className}>
      Rewind
    </BaseControlButton>
  );
};

export const FastForwardButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying } = usePlaybackAnimation();
  const { play, setCurrentTime } = usePlaylistControls();
  const { duration, playoutRef } = usePlaylistData();

  const handleClick = () => {
    setCurrentTime(duration);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      play(duration);
    }
  };

  return (
    <BaseControlButton onClick={handleClick} className={className}>
      Fast Forward
    </BaseControlButton>
  );
};

export const SkipBackwardButton: React.FC<{ skipAmount?: number; className?: string }> = ({
  skipAmount = 5,
  className
}) => {
  const { currentTimeRef, isPlaying } = usePlaybackAnimation();
  const { play, setCurrentTime } = usePlaylistControls();
  const { playoutRef } = usePlaylistData();

  const handleClick = () => {
    const newTime = Math.max(0, (currentTimeRef.current ?? 0) - skipAmount);
    setCurrentTime(newTime);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      play(newTime);
    }
  };

  return (
    <BaseControlButton onClick={handleClick} className={className}>
      Skip Backward
    </BaseControlButton>
  );
};

export const SkipForwardButton: React.FC<{ skipAmount?: number; className?: string }> = ({
  skipAmount = 5,
  className
}) => {
  const { currentTimeRef, isPlaying } = usePlaybackAnimation();
  const { play, setCurrentTime } = usePlaylistControls();
  const { duration, playoutRef } = usePlaylistData();

  const handleClick = () => {
    const newTime = Math.min(duration, (currentTimeRef.current ?? 0) + skipAmount);
    setCurrentTime(newTime);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      play(newTime);
    }
  };

  return (
    <BaseControlButton onClick={handleClick} className={className}>
      Skip Forward
    </BaseControlButton>
  );
};
