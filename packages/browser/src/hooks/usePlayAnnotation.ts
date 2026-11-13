import { useCallback, useRef } from 'react';
import type { AnnotationData } from '@waveform-playlist/core';
import { useAnnotationOptions, usePlaybackControls } from '../contexts/playlistContexts';

/**
 * What a click on an annotation does, in the row of boxes and in the list:
 * the annotation becomes the active one and is played from its start. With
 * continuous play off, playback ends where the annotation ends.
 *
 * The function is a prop of every memoized box and row, so it never changes:
 * continuous play is only needed when a click happens, and is read then
 * (through a ref written during render). A toggle of the option therefore
 * renders the component that calls this hook and none of its boxes or rows.
 */
export function usePlayAnnotation(): (annotation: AnnotationData) => void {
  const { continuousPlay } = useAnnotationOptions();
  const { play, setActiveAnnotationId } = usePlaybackControls();
  const continuousPlayRef = useRef(continuousPlay);
  continuousPlayRef.current = continuousPlay;

  return useCallback(
    (annotation: AnnotationData) => {
      setActiveAnnotationId(annotation.id);
      const playDuration = continuousPlayRef.current
        ? undefined
        : annotation.end - annotation.start;
      play(annotation.start, playDuration).catch((err) => {
        console.warn(
          '[waveform-playlist] Failed to start playback for annotation ' +
            annotation.id +
            ': ' +
            String(err)
        );
      });
    },
    [play, setActiveAnnotationId]
  );
}
