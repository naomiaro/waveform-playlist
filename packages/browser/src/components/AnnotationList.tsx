import React, { useContext, useMemo } from 'react';
import type { AnnotationAction, RenderAnnotationItemProps } from '@waveform-playlist/core';
import { AnnotationIntegrationContext } from '../AnnotationIntegrationContext';
import {
  useActiveAnnotation,
  useAnnotationOptions,
  useAnnotations,
  usePlaybackControls,
} from '../contexts/playlistContexts';
import { useAnnotationsWithPreview } from '../hooks/useAnnotationsWithPreview';
import { warnOnce } from './partWarnings';

export interface AnnotationListProps {
  /** Height of the list in pixels. Without it the list is at most 200 px high. */
  height?: number;
  /**
   * Buttons shown on each row while the provider's `editable` option is on
   * (delete, split, …). An action is called with the annotation, its index,
   * the annotations and `{ linkEndpoints, continuousPlay }` as the provider
   * has them. Pass an array that keeps its identity: a new one renders every
   * row.
   */
  actions?: AnnotationAction[];
  /**
   * Where the active annotation is put when the list scrolls to it during
   * playback, or `'none'` for a list that does not follow. Default: `'center'`.
   */
  scrollActivePosition?: ScrollLogicalPosition | 'none';
  /** Which containers scroll: only the list (`'nearest'`), or the page too (`'all'`). Default: `'nearest'`. */
  scrollActiveContainer?: 'nearest' | 'all';
  /**
   * Draws a row, in place of the default one: called with
   * `{ annotation, index, isActive, onClick, formatTime }`. Define the
   * function outside the component (or memoize it): one written inline is a
   * new function on every render of your component and renders every row.
   */
  children?: (item: RenderAnnotationItemProps) => React.ReactNode;
}

/**
 * The annotation text list, for both providers (#686). Render it anywhere
 * under the provider: below the view, in a sidebar, more than once. It reads
 * everything from the provider (the annotations, the active one, the
 * `editable` / `linkEndpoints` / `continuousPlay` options) and reports edits
 * through the provider's `onAnnotationsChange`. A click on a row plays the
 * annotation, as a click on its box does.
 *
 * Needs the annotation integration (`<AnnotationProvider>` from
 * `@waveform-playlist/annotations`). Without it, and without annotations, it
 * draws nothing.
 *
 * It renders at every annotation boundary during playback, and the rows are
 * memoized, so everything it hands down except the active annotation keeps
 * its identity across such a render.
 */
export const AnnotationList: React.FC<AnnotationListProps> = ({
  height,
  actions,
  scrollActivePosition = 'center',
  scrollActiveContainer = 'nearest',
  children,
}) => {
  const integration = useContext(AnnotationIntegrationContext);
  const { annotations } = useAnnotations();
  const { editable, linkEndpoints, continuousPlay } = useAnnotationOptions();
  const { activeAnnotationId } = useActiveAnnotation();
  const { setAnnotations, annotationPreview, playAnnotation } = usePlaybackControls();
  // While an edge is dragged, the times in the list follow it.
  const shownAnnotations = useAnnotationsWithPreview(annotations, annotationPreview);

  // The fourth argument of an action. Memoized: it is a dependency of a
  // handler given to every memoized row.
  const actionOptions = useMemo(
    () => ({ linkEndpoints, continuousPlay }),
    [linkEndpoints, continuousPlay]
  );

  if (annotations.length === 0) return null;

  if (!integration) {
    warnOnce(
      '<AnnotationList> draws nothing without the annotation components: ' +
        'install @waveform-playlist/annotations and render <AnnotationProvider> above it. ' +
        'See: https://naomiaro.github.io/waveform-playlist/docs/react/guides/annotations'
    );
    return null;
  }

  const { AnnotationText } = integration;
  const follows = scrollActivePosition !== 'none';

  return (
    <AnnotationText
      annotations={shownAnnotations}
      activeAnnotationId={activeAnnotationId ?? undefined}
      shouldScrollToActive={follows}
      scrollActivePosition={follows ? scrollActivePosition : undefined}
      scrollActiveContainer={scrollActiveContainer}
      editable={editable}
      controls={editable ? actions : undefined}
      annotationListConfig={actionOptions}
      height={height}
      onAnnotationClick={playAnnotation}
      onAnnotationUpdate={setAnnotations}
      renderAnnotationItem={children}
    />
  );
};
