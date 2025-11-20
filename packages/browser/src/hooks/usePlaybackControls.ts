import { useRef, useCallback } from 'react';
import { TonePlayout } from '@waveform-playlist/playout';
import * as Tone from 'tone';

export interface PlaybackControls {
  play: (startTime?: number, duration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

export interface UsePlaybackControlsProps {
  playoutRef: React.RefObject<TonePlayout | null>;
  onPlayStart?: () => void;
  onPause?: (pauseTime: number) => void;
  onStop?: () => void;
  onTimeUpdate?: (time: number) => void;
}

export function usePlaybackControls({
  playoutRef,
  onPlayStart,
  onPause,
  onStop,
  onTimeUpdate,
}: UsePlaybackControlsProps): PlaybackControls {

  const play = useCallback(async (startTime?: number, duration?: number) => {
    if (!playoutRef.current) return;

    await playoutRef.current.init();
    playoutRef.current.play(Tone.now(), startTime, duration);
    onPlayStart?.();
  }, [playoutRef, onPlayStart]);

  const pause = useCallback(() => {
    if (!playoutRef.current) return;

    const pauseTime = playoutRef.current.getCurrentTime();
    playoutRef.current.pause();
    onPause?.(pauseTime);
  }, [playoutRef, onPause]);

  const stop = useCallback(() => {
    if (!playoutRef.current) return;

    playoutRef.current.stop();
    onStop?.();
  }, [playoutRef, onStop]);

  const seekTo = useCallback((time: number) => {
    if (!playoutRef.current) return;

    playoutRef.current.seekTo(time);
    onTimeUpdate?.(time);
  }, [playoutRef, onTimeUpdate]);

  const getCurrentTime = useCallback(() => {
    if (!playoutRef.current) return 0;
    return playoutRef.current.getCurrentTime();
  }, [playoutRef]);

  return {
    play,
    pause,
    stop,
    seekTo,
    getCurrentTime,
  };
}
