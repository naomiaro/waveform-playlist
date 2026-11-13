import React from 'react';
import type { RenderPlayheadFunction } from '@waveform-playlist/ui-components';
import { MediaElementRoot } from './MediaElementRoot';
import { TracksPart, FadesPart } from './TrackRows';
import { TimescalePart } from './waveformParts';
import { MediaElementAnnotationBoxes } from './MediaElementAnnotationBoxes';
import { SelectionOverlay, PlayheadOverlay } from './VisualizationOverlays';
import type { GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';

export interface MediaElementPlaylistProps {
  /** Custom function to generate the label shown on annotation boxes */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  /** Whether annotation boundaries can be edited by dragging. Defaults to false. */
  editable?: boolean;
  /** Whether dragging one annotation boundary also moves the adjacent annotation's boundary. Defaults to false. */
  linkEndpoints?: boolean;
  /**
   * Callback when annotations are updated (e.g., boundaries dragged).
   * Called with the full updated annotations array.
   */
  onAnnotationUpdate?: OnAnnotationUpdateFn;
  /** Custom playhead render function. Receives position, color, and animation refs for smooth 60fps animation. */
  renderPlayhead?: RenderPlayheadFunction;
  /** Show fade in/out overlays on the waveform. Defaults to false. */
  showFades?: boolean;
  className?: string;
}

/**
 * Standalone waveform + annotation boxes component for MediaElementPlaylistProvider.
 *
 * Renders the waveform visualization, annotation boxes, selection, and playhead.
 * Does NOT render the annotation text list — use `MediaElementAnnotationList` for that.
 *
 * Must be used inside a `MediaElementPlaylistProvider`.
 *
 * This component can be placed independently in consumer layouts, allowing the
 * waveform and annotation list to be positioned separately (e.g., in different
 * panels or with custom elements between them).
 *
 * It is the default composition of the view's parts for this provider (#685):
 * `MediaElementRoot` with the parts of the multitrack view, each prop handed
 * to the part it configures. It reads no context, so it renders only when its
 * parent does; what follows the player's state is the root and the parts
 * themselves (see MediaElementRoot.tsx and waveformFrame.tsx).
 */
export const MediaElementPlaylist: React.FC<MediaElementPlaylistProps> = ({
  getAnnotationBoxLabel,
  editable = false,
  linkEndpoints = false,
  onAnnotationUpdate,
  renderPlayhead,
  showFades = false,
  className,
}) => (
  <MediaElementRoot className={className}>
    <TimescalePart />
    <TracksPart>{showFades ? <FadesPart /> : null}</TracksPart>
    <MediaElementAnnotationBoxes
      getAnnotationBoxLabel={getAnnotationBoxLabel}
      editable={editable}
      linkEndpoints={linkEndpoints}
      onAnnotationUpdate={onAnnotationUpdate}
    />
    <SelectionOverlay />
    <PlayheadOverlay renderPlayhead={renderPlayhead} />
  </MediaElementRoot>
);
