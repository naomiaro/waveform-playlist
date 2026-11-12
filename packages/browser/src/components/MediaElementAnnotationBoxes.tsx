import React, { useCallback, useContext } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import { AnnotationIntegrationContext } from '../AnnotationIntegrationContext';
import {
  useMediaElementState,
  useMediaElementControls,
  useMediaElementData,
} from '../MediaElementPlaylistContext';
import { useAnnotationDragHandlers } from '../hooks/useAnnotationDragHandlers';
import { useAnnotationsWithPreview } from '../hooks/useAnnotationsWithPreview';
import { AnnotationBoxes } from './AnnotationBoxes';
import type {
  AnnotationData,
  GetAnnotationBoxLabelFn,
  OnAnnotationUpdateFn,
} from '../types/annotations';

const HORIZONTAL_ONLY = [RestrictToHorizontalAxis];
const NO_MODIFIERS: never[] = [];

export interface MediaElementAnnotationBoxesProps {
  /** Width of the row in pixels (the full timeline width). */
  width: number;
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  editable: boolean;
  linkEndpoints: boolean;
  onAnnotationUpdate?: OnAnnotationUpdateFn;
}

/**
 * The annotation boxes of the MediaElement player, with the drag wiring for
 * their edges. This is the only part of `MediaElementPlaylist` that reads the
 * annotations and the active annotation, so an annotation boundary during
 * playback renders this and not the waveform (#744).
 */
export const MediaElementAnnotationBoxes: React.FC<MediaElementAnnotationBoxesProps> = ({
  width,
  getAnnotationBoxLabel,
  editable,
  linkEndpoints,
  onAnnotationUpdate,
}) => {
  const annotationIntegration = useContext(AnnotationIntegrationContext);
  const { annotations, activeAnnotationId } = useMediaElementState();
  const { play, setActiveAnnotationId, setAnnotations, annotationPreview } =
    useMediaElementControls();
  // The drag publishes its moves to the preview and reports once, on
  // release; the boxes follow the preview meanwhile.
  const shownAnnotations = useAnnotationsWithPreview(annotations, annotationPreview);
  const { duration, sampleRate, samplesPerPixel } = useMediaElementData();

  // A prop of every memoized box: its dependencies do not change when only
  // the active annotation does. Where playback ends (the annotation's end, or
  // not at all with continuous play) is the provider's animation loop's job.
  const handleAnnotationClick = useCallback(
    (annotation: AnnotationData) => {
      setActiveAnnotationId(annotation.id);
      play(annotation.start).catch((err) => {
        console.warn(
          '[waveform-playlist] Failed to start playback for annotation ' +
            annotation.id +
            ': ' +
            String(err)
        );
      });
    },
    [setActiveAnnotationId, play]
  );

  const handleAnnotationUpdate = useCallback(
    (updatedAnnotations: AnnotationData[]) => {
      setAnnotations(updatedAnnotations);
      onAnnotationUpdate?.(updatedAnnotations);
    },
    [setAnnotations, onAnnotationUpdate]
  );

  const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
    annotations,
    onAnnotationsChange: handleAnnotationUpdate,
    preview: annotationPreview,
    samplesPerPixel,
    sampleRate,
    duration,
    linkEndpoints,
  });

  if (annotations.length === 0 || !annotationIntegration) return null;

  return (
    <DragDropProvider
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={editable ? HORIZONTAL_ONLY : NO_MODIFIERS}
    >
      <AnnotationBoxes
        annotations={shownAnnotations}
        activeAnnotationId={activeAnnotationId}
        editable={editable}
        width={width}
        sampleRate={sampleRate}
        samplesPerPixel={samplesPerPixel}
        getAnnotationBoxLabel={getAnnotationBoxLabel}
        onSelect={handleAnnotationClick}
      />
    </DragDropProvider>
  );
};
