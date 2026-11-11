import React from 'react';
import type { AnnotationAction, AnnotationActionOptions } from '@waveform-playlist/core';
import {
  useActiveAnnotation,
  usePlaylistState,
  usePlaylistControls,
} from '../WaveformPlaylistContext';
import { useAnnotationsWithPreview } from '../hooks/useAnnotationsWithPreview';
import { AnnotationListView, type AnnotationListCommonProps } from './AnnotationListView';

export type { OnAnnotationUpdateFn } from '../types/annotations';

export interface PlaylistAnnotationListProps extends AnnotationListCommonProps {
  /**
   * Action controls to show on each annotation item (e.g., delete, split).
   * Only rendered when `annotationsEditable` is true in context.
   */
  controls?: AnnotationAction[];
  /**
   * Override annotation list config. Falls back to context values
   * `{ linkEndpoints, continuousPlay }` if not provided.
   */
  annotationListConfig?: AnnotationActionOptions;
}

/**
 * Standalone annotation text list component for WaveformPlaylistProvider (WebAudio).
 *
 * Requires @waveform-playlist/annotations with AnnotationProvider.
 * Throws if used without `<AnnotationProvider>` wrapping the component tree.
 */
export const PlaylistAnnotationList: React.FC<PlaylistAnnotationListProps> = (props) => {
  const { annotations, annotationsEditable, linkEndpoints, continuousPlay } = usePlaylistState();
  const { activeAnnotationId } = useActiveAnnotation();
  const { setAnnotations, annotationPreview } = usePlaylistControls();
  // While an edge is dragged with the preview, the times in the list follow it.
  const shownAnnotations = useAnnotationsWithPreview(annotations, annotationPreview);

  return (
    <AnnotationListView
      {...props}
      annotations={shownAnnotations}
      activeAnnotationId={activeAnnotationId}
      editable={annotationsEditable}
      linkEndpoints={linkEndpoints}
      continuousPlay={continuousPlay}
      setAnnotations={setAnnotations}
    />
  );
};
