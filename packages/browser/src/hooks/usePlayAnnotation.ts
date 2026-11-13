import { useCallback } from 'react';
import type { AnnotationData } from '@waveform-playlist/core';
import { useAnnotationOptions, usePlaybackControls } from '../contexts/playlistContexts';

/**
 * What a click on an annotation does, in the row of boxes and in the list:
 * the annotation becomes the active one and is played from its start. With
 * continuous play off, playback ends where the annotation ends.
 *
 * The function is a prop of every memoized box and row, so it keeps its
 * identity while only the active annotation changes; it changes with the
 * continuous-play toggle.
 */
export function usePlayAnnotation(): (annotation: AnnotationData) => void {
  const { continuousPlay } = useAnnotationOptions();
  const { play, setActiveAnnotationId } = usePlaybackControls();

  return useCallback(
    (annotation: AnnotationData) => {
      setActiveAnnotationId(annotation.id);
      const playDuration = continuousPlay ? undefined : annotation.end - annotation.start;
      play(annotation.start, playDuration).catch((err) => {
        console.warn(
          '[waveform-playlist] Failed to start playback for annotation ' +
            annotation.id +
            ': ' +
            String(err)
        );
      });
    },
    [continuousPlay, play, setActiveAnnotationId]
  );
}
