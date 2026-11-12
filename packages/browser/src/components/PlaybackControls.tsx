import React, { useCallback } from 'react';
import { BaseControlButton } from '@waveform-playlist/ui-components';
import {
  useSelection,
  usePlaybackControls,
  useEditorControls,
  usePlaylistTimeline,
  usePlaybackRefs,
  usePlaylistView,
  useLoop,
  useIsPlaying,
} from '../contexts/playlistContexts';
import { usePlayFromSelectionOrCursor } from '../hooks/usePlayFromSelectionOrCursor';

// Play, Pause, Stop, Rewind, Fast Forward and the two skips read only what
// both providers have (#688), so they work under WaveformPlaylistProvider and
// under MediaElementPlaylistProvider. The loop buttons below are
// WaveformPlaylistProvider only.

export const PlayButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying } = useIsPlaying();
  // Shared with the Space shortcut: the selection if one is highlighted, else the cursor.
  const handleClick = usePlayFromSelectionOrCursor();

  return (
    <BaseControlButton onClick={handleClick} disabled={isPlaying} className={className}>
      Play
    </BaseControlButton>
  );
};

export const PauseButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying } = useIsPlaying();
  const { pause } = usePlaybackControls();

  return (
    <BaseControlButton onClick={pause} disabled={!isPlaying} className={className}>
      Pause
    </BaseControlButton>
  );
};

export const StopButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isPlaying } = useIsPlaying();
  const { stop } = usePlaybackControls();

  return (
    <BaseControlButton onClick={stop} disabled={!isPlaying} className={className}>
      Stop
    </BaseControlButton>
  );
};

// The four below move the cursor with `seekTo`, which clamps to the audio and
// restarts playback at the new position when it is running.

export const RewindButton: React.FC<{ className?: string }> = ({ className }) => {
  const { seekTo } = usePlaybackControls();
  const handleClick = () => seekTo(0);

  return (
    <BaseControlButton onClick={handleClick} className={className}>
      Rewind
    </BaseControlButton>
  );
};

export const FastForwardButton: React.FC<{ className?: string }> = ({ className }) => {
  const { seekTo } = usePlaybackControls();
  // A provider with `indefinitePlayback` has no end to go to: its transport
  // runs on past the audio (never set under the MediaElement provider).
  const { indefinitePlayback } = usePlaylistView();
  // An infinite time is the end of the audio.
  const handleClick = () => seekTo(Infinity);

  return (
    <BaseControlButton onClick={handleClick} disabled={indefinitePlayback} className={className}>
      Fast Forward
    </BaseControlButton>
  );
};

export const SkipBackwardButton: React.FC<{ skipAmount?: number; className?: string }> = ({
  skipAmount = 5,
  className,
}) => {
  const { currentTimeRef } = usePlaybackRefs();
  const { seekTo } = usePlaybackControls();
  const handleClick = () => seekTo((currentTimeRef.current ?? 0) - skipAmount);

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
  const { currentTimeRef } = usePlaybackRefs();
  const { seekTo } = usePlaybackControls();
  const handleClick = () => seekTo((currentTimeRef.current ?? 0) + skipAmount);

  return (
    <BaseControlButton onClick={handleClick} className={className}>
      Skip Forward
    </BaseControlButton>
  );
};

export const LoopButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isLoopEnabled, loopStart, loopEnd } = useLoop();
  const { setLoopEnabled, setLoopRegion } = useEditorControls();
  const { duration } = usePlaylistTimeline();

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
  const { selectionStart, selectionEnd } = useSelection();
  const { loopStart, loopEnd } = useLoop();
  const { setLoopRegionFromSelection, clearLoopRegion } = useEditorControls();

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

export interface ClearAllButtonProps {
  onClearAll: () => void;
  label?: string;
  className?: string;
}

export const ClearAllButton: React.FC<ClearAllButtonProps> = ({
  onClearAll,
  label = 'Clear All',
  className,
}) => {
  const { stop } = usePlaybackControls();

  const handleClick = useCallback(() => {
    stop();
    onClearAll();
  }, [stop, onClearAll]);

  return (
    <BaseControlButton onClick={handleClick} className={className} title="Remove all tracks">
      {label}
    </BaseControlButton>
  );
};
