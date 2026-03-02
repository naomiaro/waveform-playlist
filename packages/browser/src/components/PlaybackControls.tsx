import React from 'react';
import { BaseControlButton } from '@waveform-playlist/ui-components';
import {
  usePlaybackAnimation,
  usePlaylistState,
  usePlaylistControls,
  usePlaylistData,
} from '../WaveformPlaylistContext';

export const PlayButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying, currentTimeRef } = usePlaybackAnimation();
  const { selectionStart, selectionEnd, isLoopEnabled } = usePlaylistState();
  const { play } = usePlaylistControls();

  const handleClick = async () => {
    const hasSelection = selectionStart !== selectionEnd && selectionEnd > selectionStart;

    if (hasSelection && !isLoopEnabled) {
      // Without loop: Play selection region only, then stop
      const duration = selectionEnd - selectionStart;
      await play(selectionStart, duration);
    } else {
      // With loop or no selection: Play from current cursor position.
      // Transport loop handles boundaries when loop is enabled.
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

  const handleClick = () => {
    setCurrentTime(0);

    if (isPlaying) {
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
  const { duration } = usePlaylistData();

  const handleClick = () => {
    setCurrentTime(duration);

    if (isPlaying) {
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
  className,
}) => {
  const { currentTimeRef, isPlaying } = usePlaybackAnimation();
  const { play, setCurrentTime } = usePlaylistControls();

  const handleClick = () => {
    const newTime = Math.max(0, (currentTimeRef.current ?? 0) - skipAmount);
    setCurrentTime(newTime);

    if (isPlaying) {
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
  className,
}) => {
  const { currentTimeRef, isPlaying } = usePlaybackAnimation();
  const { play, setCurrentTime } = usePlaylistControls();
  const { duration } = usePlaylistData();

  const handleClick = () => {
    const newTime = Math.min(duration, (currentTimeRef.current ?? 0) + skipAmount);
    setCurrentTime(newTime);

    if (isPlaying) {
      play(newTime);
    }
  };

  return (
    <BaseControlButton onClick={handleClick} className={className}>
      Skip Forward
    </BaseControlButton>
  );
};

export const LoopButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isLoopEnabled, loopStart, loopEnd } = usePlaylistState();
  const { setLoopEnabled, setLoopRegion } = usePlaylistControls();
  const { duration } = usePlaylistData();

  const hasValidLoopRegion = loopStart !== loopEnd && loopEnd > loopStart;

  const handleClick = () => {
    if (!isLoopEnabled && !hasValidLoopRegion) {
      // Create a default loop region when enabling loop without one
      // Default to first 10 seconds or 25% of duration, whichever is smaller
      const defaultEnd = Math.min(10, duration * 0.25);
      setLoopRegion(0, Math.max(1, defaultEnd)); // At least 1 second
    }
    setLoopEnabled(!isLoopEnabled);
  };

  return (
    <BaseControlButton
      onClick={handleClick}
      className={className}
      title={isLoopEnabled ? 'Disable loop' : 'Enable loop'}
    >
      {isLoopEnabled ? 'Loop On' : 'Loop Off'}
    </BaseControlButton>
  );
};

export const SetLoopRegionButton: React.FC<{ className?: string }> = ({ className }) => {
  const { selectionStart, selectionEnd, loopStart, loopEnd } = usePlaylistState();
  const { setLoopRegionFromSelection, clearLoopRegion } = usePlaylistControls();

  const hasValidSelection = selectionStart !== selectionEnd && selectionEnd > selectionStart;
  const hasLoopRegion = loopStart !== loopEnd && loopEnd > loopStart;

  const handleClick = () => {
    if (hasLoopRegion) {
      clearLoopRegion();
    } else {
      setLoopRegionFromSelection();
    }
  };

  return (
    <BaseControlButton
      onClick={handleClick}
      disabled={!hasValidSelection && !hasLoopRegion}
      className={className}
      title={
        hasLoopRegion
          ? 'Clear loop region'
          : hasValidSelection
            ? 'Set loop region from selection'
            : 'Create a selection first'
      }
    >
      {hasLoopRegion ? 'Clear Loop' : 'Set Loop'}
    </BaseControlButton>
  );
};
