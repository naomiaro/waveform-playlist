import React from 'react';
import { ControlButton } from '@waveform-playlist/ui-components';
import { useWaveformPlaylist } from '../WaveformPlaylistContext';

export const PlayButton: React.FC<{ className?: string }> = ({ className }) => {
  const { play, isPlaying, selectionStart, selectionEnd, currentTimeRef } = useWaveformPlaylist();

  const handleClick = async () => {
    // Check if there's a selection
    if (selectionStart !== selectionEnd && selectionEnd > selectionStart) {
      // Play only the selected region
      const duration = selectionEnd - selectionStart;
      await play(selectionStart, duration);
    } else {
      // Play from current position to the end
      await play(currentTimeRef.current);
    }
  };

  return (
    <ControlButton onClick={handleClick} disabled={isPlaying} className={className}>
      Play
    </ControlButton>
  );
};

export const PauseButton: React.FC<{ className?: string }> = ({ className }) => {
  const { pause, isPlaying } = useWaveformPlaylist();

  return (
    <ControlButton onClick={pause} disabled={!isPlaying} className={className}>
      Pause
    </ControlButton>
  );
};

export const StopButton: React.FC<{ className?: string }> = ({ className }) => {
  const { stop, isPlaying } = useWaveformPlaylist();

  return (
    <ControlButton onClick={stop} disabled={!isPlaying} className={className}>
      Stop
    </ControlButton>
  );
};

export const RewindButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying, play, playoutRef, setCurrentTime } = useWaveformPlaylist();

  const handleClick = () => {
    setCurrentTime(0);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      play(0);
    }
  };

  return (
    <ControlButton onClick={handleClick} className={className}>
      Rewind
    </ControlButton>
  );
};

export const FastForwardButton: React.FC<{ className?: string }> = ({ className }) => {
  const { duration, isPlaying, play, playoutRef, setCurrentTime } = useWaveformPlaylist();

  const handleClick = () => {
    setCurrentTime(duration);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      play(duration);
    }
  };

  return (
    <ControlButton onClick={handleClick} className={className}>
      Fast Forward
    </ControlButton>
  );
};

export const SkipBackwardButton: React.FC<{ skipAmount?: number; className?: string }> = ({
  skipAmount = 5,
  className
}) => {
  const { currentTimeRef, isPlaying, play, playoutRef, setCurrentTime } = useWaveformPlaylist();

  const handleClick = () => {
    const newTime = Math.max(0, currentTimeRef.current - skipAmount);
    setCurrentTime(newTime);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      play(newTime);
    }
  };

  return (
    <ControlButton onClick={handleClick} className={className}>
      Skip Backward
    </ControlButton>
  );
};

export const SkipForwardButton: React.FC<{ skipAmount?: number; className?: string }> = ({
  skipAmount = 5,
  className
}) => {
  const { currentTimeRef, duration, isPlaying, play, playoutRef, setCurrentTime } = useWaveformPlaylist();

  const handleClick = () => {
    const newTime = Math.min(duration, currentTimeRef.current + skipAmount);
    setCurrentTime(newTime);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      play(newTime);
    }
  };

  return (
    <ControlButton onClick={handleClick} className={className}>
      Skip Forward
    </ControlButton>
  );
};
