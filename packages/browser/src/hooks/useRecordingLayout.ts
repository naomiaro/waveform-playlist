import { useCallback, useSyncExternalStore } from 'react';
import type { RecordingProgressSource } from '@waveform-playlist/core';

/** How far the displayed timeline is extended at a time while a take runs. */
const RECORDING_EXTENT_STEP_SECONDS = 10;

/**
 * Where the displayed timeline should end for a take that currently ends at
 * `takeEndSeconds`: between 10 and 20 seconds further on, moving in 10-second
 * steps. A value that followed the take exactly would change on every
 * animation frame, and with it the width of every track row.
 */
export function recordingDisplayEnd(takeEndSeconds: number): number {
  const step = RECORDING_EXTENT_STEP_SECONDS;
  return (Math.floor(Math.max(0, takeEndSeconds) / step) + 2) * step;
}

const subscribeToNothing = () => () => {};

export interface RecordingLayout {
  /** Channels in the take's preview (0 when not recording). */
  channelCount: number;
  /** End of the timeline the take needs, in seconds (0 when not recording). */
  displayEndSeconds: number;
}

/**
 * The two things the visualization's layout needs from a recording in
 * progress. Both are read through selectors that return numbers, so the
 * calling component re-renders when a number changes (a channel appears, the
 * take crosses a 10-second step) and not on every frame of progress.
 */
export function useRecordingLayout(
  progress: RecordingProgressSource | undefined,
  startSample: number,
  sampleRate: number
): RecordingLayout {
  // Called as a method (not detached), so a source written as a class works.
  const subscribe = useCallback(
    (onChange: () => void) => (progress ? progress.subscribe(onChange) : subscribeToNothing()),
    [progress]
  );

  const getChannelCount = useCallback(
    () => (progress ? progress.getSnapshot().peaks.length : 0),
    [progress]
  );
  const getDisplayEnd = useCallback(
    () =>
      progress && sampleRate > 0
        ? recordingDisplayEnd(startSample / sampleRate + progress.getSnapshot().duration)
        : 0,
    [progress, startSample, sampleRate]
  );

  const channelCount = useSyncExternalStore(subscribe, getChannelCount, getChannelCount);
  const displayEndSeconds = useSyncExternalStore(subscribe, getDisplayEnd, getDisplayEnd);
  return { channelCount, displayEndSeconds };
}
