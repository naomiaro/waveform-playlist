import React, { useCallback } from 'react';
import type { AnnotationData } from '@waveform-playlist/core';
import { useAnnotationIntegration } from '../AnnotationIntegrationContext';
import { useMediaElementState, useMediaElementControls } from '../MediaElementPlaylistContext';
import type { OnAnnotationUpdateFn } from '../types/annotations';

export type { OnAnnotationUpdateFn } from '../types/annotations';

export interface MediaElementAnnotationListProps {
  /** Height in pixels for the annotation text list */
  height?: number;
  /**
   * Custom render function for annotation items in the text list.
   * When provided, completely replaces the default annotation item rendering.
   */
  renderAnnotationItem?: (props: any) => React.ReactNode;
  /**
   * Callback when annotations are updated (e.g., text edited).
   * Called with the full updated annotations array.
   */
  onAnnotationUpdate?: OnAnnotationUpdateFn;
  /** Whether annotation text can be edited. Defaults to false. */
  editable?: boolean;
  /**
   * Action controls to show on each annotation item (e.g., delete, split).
   * Only rendered when `editable` is true.
   */
  controls?: any[];
  /**
   * Override annotation list config. Falls back to context values
   * `{ linkEndpoints: false, continuousPlay }` if not provided.
   */
  annotationListConfig?: any;
  /** Where to position the active annotation when auto-scrolling. Defaults to 'center'. */
  scrollActivePosition?: ScrollLogicalPosition;
  /** Which scrollable containers to scroll: 'nearest' or 'all'. Defaults to 'nearest'. */
  scrollActiveContainer?: 'nearest' | 'all';
}

/**
 * Standalone annotation text list component for MediaElementPlaylistProvider.
 *
 * Requires @waveform-playlist/annotations with AnnotationProvider.
 * Returns null if annotations package is not available.
 */
export const MediaElementAnnotationList: React.FC<MediaElementAnnotationListProps> = ({
  height,
  renderAnnotationItem,
  onAnnotationUpdate,
  editable = false,
  controls,
  annotationListConfig,
  scrollActivePosition = 'center',
  scrollActiveContainer = 'nearest',
}) => {
  const integration = useAnnotationIntegration();
  const { annotations, activeAnnotationId, continuousPlay } = useMediaElementState();
  const { setAnnotations } = useMediaElementControls();

  const resolvedConfig = annotationListConfig ?? { linkEndpoints: false, continuousPlay };

  const handleAnnotationUpdate = useCallback((updatedAnnotations: AnnotationData[]) => {
    setAnnotations(updatedAnnotations);
    onAnnotationUpdate?.(updatedAnnotations);
  }, [setAnnotations, onAnnotationUpdate]);

  if (!integration) return null;

  const { AnnotationText } = integration;

  return (
    <AnnotationText
      annotations={annotations}
      activeAnnotationId={activeAnnotationId ?? undefined}
      shouldScrollToActive={true}
      scrollActivePosition={scrollActivePosition}
      scrollActiveContainer={scrollActiveContainer}
      editable={editable}
      controls={editable ? controls : undefined}
      annotationListConfig={resolvedConfig}
      height={height}
      onAnnotationUpdate={handleAnnotationUpdate}
      renderAnnotationItem={renderAnnotationItem}
    />
  );
};
