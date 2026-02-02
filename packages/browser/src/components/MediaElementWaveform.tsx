import React from 'react';
import type { RenderAnnotationItemProps } from '@waveform-playlist/core';
import { useMediaElementState } from '../MediaElementPlaylistContext';
import type { GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';
import { MediaElementPlaylist } from './MediaElementPlaylist';
import { MediaElementAnnotationList } from './MediaElementAnnotationList';

// Re-export annotation types for convenience
export type { GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';

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
 * Simplified Waveform component for MediaElementPlaylistProvider
 *
 * This is a stripped-down version of Waveform that works with the
 * MediaElement context. It supports:
 * - Single track visualization
 * - Click to seek
 * - Annotation display and click-to-play
 * - Playhead animation
 *
 * For multi-track editing, use the full Waveform with WaveformPlaylistProvider.
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
  const { annotations } = useMediaElementState();

  return (
    <>
      <MediaElementPlaylist
        getAnnotationBoxLabel={getAnnotationBoxLabel}
        editable={editable}
        linkEndpoints={linkEndpoints}
        onAnnotationUpdate={onAnnotationUpdate}
        className={className}
      />
      {annotations.length > 0 && (
        <MediaElementAnnotationList
          height={annotationTextHeight}
          renderAnnotationItem={renderAnnotationItem}
          onAnnotationUpdate={onAnnotationUpdate}
          editable={editable}
          annotationListConfig={{ linkEndpoints, continuousPlay: false }}
          scrollActivePosition={scrollActivePosition}
          scrollActiveContainer={scrollActiveContainer}
        />
      )}
    </>
  );
};
