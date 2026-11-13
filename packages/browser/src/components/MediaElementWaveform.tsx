import React, { useMemo } from 'react';
import type { RenderAnnotationItemProps } from '@waveform-playlist/core';
import { useAnnotations } from '../contexts/playlistContexts';
import type { GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';
import { MediaElementWaveformRoot } from './MediaElementWaveformRoot';
import {
  WaveformPlayhead,
  WaveformSelection,
  WaveformTimescale,
  WaveformTracks,
} from './waveformParts';
import { MediaElementAnnotationBoxes } from './MediaElementAnnotationBoxes';
import {
  MediaElementAnnotationList,
  type MediaElementAnnotationListProps,
} from './MediaElementAnnotationList';

// Re-export annotation types for convenience
export type { GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';

/**
 * The annotation options (until #686 gives the annotation parts their own)
 * and `className`. What the view is made of is not an option here: compose
 * the parts inside `MediaElementWaveformRoot` for anything else.
 */
export interface MediaElementWaveformProps {
  /** Height in pixels for the annotation text list */
  annotationTextHeight?: number;
  /** Custom function to generate the label shown on annotation boxes */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  /**
   * Custom render function for annotation items in the text list.
   * When provided, completely replaces the default annotation item rendering.
   * Use this to customize the appearance of each annotation (e.g., add furigana).
   */
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => React.ReactNode;
  /** Whether annotation boundaries can be edited by dragging. Defaults to false. */
  editable?: boolean;
  /** Whether dragging one annotation boundary also moves the adjacent annotation's boundary. Defaults to false. */
  linkEndpoints?: boolean;
  /**
   * Callback when annotations are updated (e.g., boundaries dragged).
   * Called with the full updated annotations array.
   */
  onAnnotationUpdate?: OnAnnotationUpdateFn;
  /** Where to position the active annotation when auto-scrolling: 'center', 'start', 'end', or 'nearest'. Defaults to 'center'. */
  scrollActivePosition?: ScrollLogicalPosition;
  /** Which scrollable containers to scroll: 'nearest' (only the annotation list) or 'all' (including viewport). Defaults to 'nearest'. */
  scrollActiveContainer?: 'nearest' | 'all';
  className?: string;
}

/**
 * The text list, only when there are annotations. It reads the provider state
 * so that MediaElementWaveform does not: that state changes at every
 * annotation boundary during playback (#744).
 */
const AnnotationListWhenPresent: React.FC<MediaElementAnnotationListProps> = (props) => {
  const { annotations } = useAnnotations();
  if (annotations.length === 0) return null;
  return <MediaElementAnnotationList {...props} />;
};

// The same elements on every render, so a render of the composition does not
// render these parts (see Waveform.tsx).
const TIMESCALE = <WaveformTimescale />;
const TRACKS = <WaveformTracks />;
const SELECTION = <WaveformSelection />;
const PLAYHEAD = <WaveformPlayhead />;

/**
 * The view of `MediaElementPlaylistProvider`, ready-made: the timescale, the
 * one track, the annotation boxes, the selection and the playhead, with the
 * annotation text list below when there are annotations.
 *
 * It is a composition of the public parts with no options for them. To leave
 * the timescale out, show fades or use your own playhead, write the
 * composition yourself:
 *
 * ```tsx
 * <MediaElementWaveformRoot>
 *   <WaveformTimescale />
 *   <WaveformTracks>
 *     <WaveformFades />
 *   </WaveformTracks>
 *   <MediaElementAnnotationBoxes />
 *   <WaveformSelection />
 *   <WaveformPlayhead renderPlayhead={…} />
 * </MediaElementWaveformRoot>
 * <MediaElementAnnotationList />
 * ```
 */
export const MediaElementWaveform: React.FC<MediaElementWaveformProps> = ({
  annotationTextHeight,
  getAnnotationBoxLabel,
  renderAnnotationItem,
  editable = false,
  linkEndpoints = false,
  onAnnotationUpdate,
  scrollActivePosition = 'center',
  scrollActiveContainer = 'nearest',
  className,
}) => {
  // Kept across renders: a new object re-renders every item of the list.
  const annotationListConfig = useMemo(
    () => ({ linkEndpoints, continuousPlay: false }),
    [linkEndpoints]
  );

  return (
    <>
      <MediaElementWaveformRoot className={className}>
        {TIMESCALE}
        {TRACKS}
        <MediaElementAnnotationBoxes
          getAnnotationBoxLabel={getAnnotationBoxLabel}
          editable={editable}
          linkEndpoints={linkEndpoints}
          onAnnotationUpdate={onAnnotationUpdate}
        />
        {SELECTION}
        {PLAYHEAD}
      </MediaElementWaveformRoot>
      <AnnotationListWhenPresent
        height={annotationTextHeight}
        renderAnnotationItem={renderAnnotationItem}
        onAnnotationUpdate={onAnnotationUpdate}
        editable={editable}
        annotationListConfig={annotationListConfig}
        scrollActivePosition={scrollActivePosition}
        scrollActiveContainer={scrollActiveContainer}
      />
    </>
  );
};
