import React from 'react';
import type { AnnotationAction, AnnotationActionOptions } from '@waveform-playlist/core';
import { useMediaElementState, useMediaElementControls } from '../MediaElementPlaylistContext';
import { AnnotationListView, type AnnotationListCommonProps } from './AnnotationListView';

export type { OnAnnotationUpdateFn } from '../types/annotations';

export interface MediaElementAnnotationListProps extends AnnotationListCommonProps {
  /** Whether annotation text can be edited. Defaults to false. */
  editable?: boolean;
  /**
   * Action controls to show on each annotation item (e.g., delete, split).
   * Only rendered when `editable` is true.
   */
  controls?: AnnotationAction[];
  /**
   * Override annotation list config. Falls back to
   * `{ linkEndpoints: false, continuousPlay }` (continuous play from context)
   * if not provided. Pass an object that keeps its identity between renders:
   * a new object re-renders every item of the list.
   */
  annotationListConfig?: AnnotationActionOptions;
}

/**
 * Standalone annotation text list component for MediaElementPlaylistProvider.
 *
 * Requires @waveform-playlist/annotations with AnnotationProvider.
 * Throws if used without `<AnnotationProvider>` wrapping the component tree.
 */
export const MediaElementAnnotationList: React.FC<MediaElementAnnotationListProps> = ({
  editable = false,
  ...props
}) => {
  const { annotations, activeAnnotationId, continuousPlay } = useMediaElementState();
  const { setAnnotations } = useMediaElementControls();

  return (
    <AnnotationListView
      {...props}
      annotations={annotations}
      activeAnnotationId={activeAnnotationId}
      editable={editable}
      linkEndpoints={false}
      continuousPlay={continuousPlay}
      setAnnotations={setAnnotations}
    />
  );
};
