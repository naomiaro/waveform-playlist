import React, { useContext } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import { useTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import {
  useActiveAnnotation,
  useAnnotationOptions,
  useAnnotations,
  usePlaybackControls,
  usePlaylistView,
  usePlaylistZoom,
} from '../contexts/playlistContexts';
import { AnnotationIntegrationContext } from '../AnnotationIntegrationContext';
import { useClipInteraction } from '../contexts/ClipInteractionContext';
import { useAnnotationDragHandlers } from '../hooks/useAnnotationDragHandlers';
import { useAnnotationsWithPreview } from '../hooks/useAnnotationsWithPreview';
import { useDragSensors } from '../hooks/useDragSensors';
import { usePlayAnnotation } from '../hooks/usePlayAnnotation';
import type { GetAnnotationBoxLabelFn } from '../types/annotations';
import { AnnotationBoxes } from './AnnotationBoxes';
import { useWaveformExtent } from './waveformLayoutContext';

/** An edge moves along time only. */
const HORIZONTAL_ONLY = [RestrictToHorizontalAxis];

/** Height in pixels of the row of annotation boxes when `height` is not given. */
export const DEFAULT_ANNOTATION_BOXES_HEIGHT = 30;

export interface WaveformAnnotationBoxesProps {
  /**
   * The label of a box, from the annotation and its index. Default: the
   * annotation's id. Pass a function that keeps its identity (defined outside
   * the component, or memoized): a new one renders every box.
   */
  getLabel?: GetAnnotationBoxLabelFn;
  /** Height of the row in pixels. Default: 30. */
  height?: number;
}

/**
 * The row of annotation boxes: a part of either root (`WaveformRoot`,
 * `MediaElementWaveformRoot`), as wide as the root's timeline. Needs the
 * annotation integration (`<AnnotationProvider>`); draws nothing without it
 * or without annotations.
 *
 * It wires the drag of a box's edges itself (#686): its own
 * `DragDropProvider` around the row, the moves shown through the provider's
 * preview, one `onAnnotationsChange` on release. The edges can be dragged
 * while the provider's `editable` option is on; `linkEndpoints` and
 * `continuousPlay` come from the same place (`useAnnotationOptions()`). The
 * touch setting of the drag is `ClipInteractionOptions`' `touchOptimized`.
 * The box colour is the theme's `annotationBoxBorder`.
 *
 * It is the one part of the view that reads the annotations and the active
 * annotation, so an annotation boundary during playback renders this and not
 * the waveform (#744). Memoized: a render of the component that composes the
 * view does not render it while its props keep their identity.
 */
export const WaveformAnnotationBoxes = React.memo(function WaveformAnnotationBoxes({
  getLabel,
  height = DEFAULT_ANNOTATION_BOXES_HEIGHT,
}: WaveformAnnotationBoxesProps) {
  // An edge can be dragged as far as the timeline is drawn, not only as far as
  // there is audio: annotations may mark what is not recorded yet (chords, a
  // lyric sheet), on an empty timeline or past the end of a take (maintainer's
  // choice, #686). Under the MediaElement root the two lengths are the same.
  const { tracksFullWidth: width, displayDuration } = useWaveformExtent('The annotation boxes');
  const integration = useContext(AnnotationIntegrationContext);
  const { annotations } = useAnnotations();
  const { editable, linkEndpoints } = useAnnotationOptions();
  const { activeAnnotationId } = useActiveAnnotation();
  const { setAnnotations, annotationPreview } = usePlaybackControls();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const { touchOptimized } = useClipInteraction();
  const theme = useTheme() as Partial<WaveformPlaylistTheme>;
  // While an edge is dragged, the boxes follow the drag.
  const shownAnnotations = useAnnotationsWithPreview(annotations, annotationPreview);
  const playAnnotation = usePlayAnnotation();
  const sensors = useDragSensors({ touchOptimized });

  const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
    annotations,
    onAnnotationsChange: setAnnotations,
    preview: annotationPreview,
    samplesPerPixel,
    sampleRate,
    duration: displayDuration,
    linkEndpoints,
  });

  // Nothing to draw: mount no drag provider either.
  if (annotations.length === 0 || !integration) return null;

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={HORIZONTAL_ONLY}
    >
      <AnnotationBoxes
        annotations={shownAnnotations}
        activeAnnotationId={activeAnnotationId}
        editable={editable}
        width={width}
        height={height}
        color={theme.annotationBoxBorder}
        sampleRate={sampleRate}
        samplesPerPixel={samplesPerPixel}
        getLabel={getLabel}
        onSelect={playAnnotation}
      />
    </DragDropProvider>
  );
});
