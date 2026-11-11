import React, { useCallback, useMemo } from 'react';
import type {
  AnnotationData,
  AnnotationAction,
  AnnotationActionOptions,
  RenderAnnotationItemProps,
} from '@waveform-playlist/core';
import { useAnnotationIntegration } from '../AnnotationIntegrationContext';
import type { OnAnnotationUpdateFn } from '../types/annotations';

/** The props both annotation list components take from their consumer. */
export interface AnnotationListCommonProps {
  /** Height in pixels for the annotation text list */
  height?: number;
  /**
   * Custom render function for annotation items in the text list.
   * When provided, completely replaces the default annotation item rendering.
   */
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => React.ReactNode;
  /**
   * Callback when annotations are updated (e.g., text edited).
   * Called with the full updated annotations array.
   */
  onAnnotationUpdate?: OnAnnotationUpdateFn;
  /** Where to position the active annotation when auto-scrolling. Defaults to 'center'. */
  scrollActivePosition?: ScrollLogicalPosition;
  /** Which scrollable containers to scroll: 'nearest' or 'all'. Defaults to 'nearest'. */
  scrollActiveContainer?: 'nearest' | 'all';
}

export interface AnnotationListViewProps extends AnnotationListCommonProps {
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  editable: boolean;
  /** Shown on each item only while `editable`. */
  controls?: AnnotationAction[];
  /** Replaces `{ linkEndpoints, continuousPlay }` when given. */
  annotationListConfig?: AnnotationActionOptions;
  linkEndpoints: boolean;
  continuousPlay: boolean;
  /** The provider's setter. Must keep its identity across renders. */
  setAnnotations: (annotations: AnnotationData[]) => void;
}

/**
 * The annotation text list both players render (#744). `PlaylistAnnotationList`
 * and `MediaElementAnnotationList` read their own provider and pass the values
 * in; nothing here knows which provider it is under.
 *
 * It renders at every annotation boundary during playback, and the rows of the
 * list are memoized, so everything it hands down except `activeAnnotationId`
 * keeps its identity across such a render.
 */
export const AnnotationListView: React.FC<AnnotationListViewProps> = ({
  annotations,
  activeAnnotationId,
  editable,
  controls,
  annotationListConfig,
  linkEndpoints,
  continuousPlay,
  setAnnotations,
  height,
  renderAnnotationItem,
  onAnnotationUpdate,
  scrollActivePosition = 'center',
  scrollActiveContainer = 'nearest',
}) => {
  const { AnnotationText } = useAnnotationIntegration();

  // Memoized: it is a dependency of a handler given to every memoized row.
  const resolvedConfig = useMemo(
    () => annotationListConfig ?? { linkEndpoints, continuousPlay },
    [annotationListConfig, linkEndpoints, continuousPlay]
  );

  const handleAnnotationUpdate = useCallback(
    (updatedAnnotations: AnnotationData[]) => {
      setAnnotations(updatedAnnotations);
      onAnnotationUpdate?.(updatedAnnotations);
    },
    [setAnnotations, onAnnotationUpdate]
  );

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
