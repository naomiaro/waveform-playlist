import { useSyncExternalStore } from 'react';
import type { AnnotationData } from '@waveform-playlist/core';
import type { AnnotationPreviewHandle } from './useAnnotationDragHandlers';

/**
 * The annotations to draw: the provider's, or while an edge is being dragged
 * with a preview (`useAnnotationDragHandlers({ preview })`), the annotations
 * as the drag would leave them.
 *
 * Call it in the component that draws annotations (a custom list or row of
 * boxes), with `annotationPreview` from the provider's controls. Only that
 * component then re-renders per pointer move of the drag.
 */
export function useAnnotationsWithPreview(
  annotations: AnnotationData[],
  preview: AnnotationPreviewHandle
): AnnotationData[] {
  const { subscribe, getSnapshot } = preview.source;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) ?? annotations;
}
