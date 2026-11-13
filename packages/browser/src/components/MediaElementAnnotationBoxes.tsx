import React, { useCallback, useContext } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import { AnnotationIntegrationContext } from '../AnnotationIntegrationContext';
import {
  useAnnotations,
  useActiveAnnotation,
  usePlaybackControls,
  usePlaylistView,
  usePlaylistZoom,
  useMediaElementTrack,
} from '../contexts/playlistContexts';
import { useAnnotationDragHandlers } from '../hooks/useAnnotationDragHandlers';
import { useAnnotationsWithPreview } from '../hooks/useAnnotationsWithPreview';
import { AnnotationBoxes } from './AnnotationBoxes';
import { useWaveformExtent } from './waveformLayoutContext';
import type {
  AnnotationData,
  GetAnnotationBoxLabelFn,
  OnAnnotationUpdateFn,
} from '../types/annotations';

const HORIZONTAL_ONLY = [RestrictToHorizontalAxis];
const NO_MODIFIERS: never[] = [];

export interface MediaElementAnnotationBoxesProps {
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  editable: boolean;
  linkEndpoints: boolean;
  onAnnotationUpdate?: OnAnnotationUpdateFn;
}

/**
 * The annotation boxes of the MediaElement player, with the drag wiring for
 * their edges: the annotation-boxes part of the MediaElement view. It is the
 * only part of that view that reads the annotations and the active
 * annotation, so an annotation boundary during playback renders this and not
 * the waveform (#744). As wide as the root's timeline. Memoized: a render of
 * the component that composes the view does not render it while its props
 * keep their identity.
 */
export const MediaElementAnnotationBoxes = React.memo(function MediaElementAnnotationBoxes({
  getAnnotationBoxLabel,
  editable,
  linkEndpoints,
  onAnnotationUpdate,
}: MediaElementAnnotationBoxesProps) {
  const { tracksFullWidth: width } = useWaveformExtent('The annotation boxes');
  const annotationIntegration = useContext(AnnotationIntegrationContext);
  const { annotations } = useAnnotations();
  const { activeAnnotationId } = useActiveAnnotation();
  const { play, setActiveAnnotationId, setAnnotations, annotationPreview } = usePlaybackControls();
  // The drag publishes its moves to the preview and reports once, on
  // release; the boxes follow the preview meanwhile.
  const shownAnnotations = useAnnotationsWithPreview(annotations, annotationPreview);
  const { duration } = useMediaElementTrack();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

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
});
