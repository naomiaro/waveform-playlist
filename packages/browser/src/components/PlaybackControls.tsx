import React from 'react';
import styled from 'styled-components';
import { useWaveformPlaylist } from '../WaveformPlaylistContext';

const Button = styled.button`
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;

  &:hover:not(:disabled) {
    background: #0056b3;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`;

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
    <Button onClick={handleClick} disabled={isPlaying} className={className}>
      Play
    </Button>
  );
};

export const PauseButton: React.FC<{ className?: string }> = ({ className }) => {
  const { pause, isPlaying } = useWaveformPlaylist();

  return (
    <Button onClick={pause} disabled={!isPlaying} className={className}>
      Pause
    </Button>
  );
};

export const StopButton: React.FC<{ className?: string }> = ({ className }) => {
  const { stop, isPlaying } = useWaveformPlaylist();

  return (
    <Button onClick={stop} disabled={!isPlaying} className={className}>
      Stop
    </Button>
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
    <Button onClick={handleClick} className={className}>
      Rewind
    </Button>
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
    <Button onClick={handleClick} className={className}>
      Fast Forward
    </Button>
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
    <Button onClick={handleClick} className={className}>
      Skip Backward
    </Button>
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
    <Button onClick={handleClick} className={className}>
      Skip Forward
    </Button>
  );
};
