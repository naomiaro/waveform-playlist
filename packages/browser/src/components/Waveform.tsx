import React, { ReactNode } from 'react';
import type { RenderPlayheadFunction } from '@waveform-playlist/ui-components';
import type {
  AnnotationAction,
  AnnotationActionOptions,
  RenderAnnotationItemProps,
} from '@waveform-playlist/core';
import { usePlaylistAnnotations } from '../WaveformPlaylistContext';
import type { GetAnnotationBoxLabelFn } from '../types/annotations';
import { PlaylistVisualization } from './PlaylistVisualization';
import type { VisualizationRecordingState } from './visualizationLayout';
import { PlaylistAnnotationList, type PlaylistAnnotationListProps } from './PlaylistAnnotationList';

/**
 * The text list, only when there are annotations. It reads the annotations so
 * that Waveform does not: Waveform then renders only when its own props change
 * (#768), as MediaElementWaveform does (#744).
 */
const AnnotationListWhenPresent: React.FC<PlaylistAnnotationListProps> = (props) => {
  const { annotations } = usePlaylistAnnotations();
  if (annotations.length === 0) return null;
  return <PlaylistAnnotationList {...props} />;
};

export interface WaveformProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  /** Custom render function for timescale tick labels. `label` is a formatted string
   * (bar/beat notation like "2.3" in beats mode, or "m:ss" in temporal mode). */
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
  /** Custom playhead render function. Receives position (pixels) and color from theme. */
  renderPlayhead?: RenderPlayheadFunction;
  annotationControls?: AnnotationAction[];
  annotationListConfig?: AnnotationActionOptions;
  annotationTextHeight?: number; // Height in pixels for the annotation text list
  /**
   * Custom render function for annotation items in the text list.
   * Use this to completely customize how each annotation is displayed.
   */
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => ReactNode;
  /**
   * Custom function to generate the label shown on annotation boxes in the waveform.
   * Receives the annotation data and its index, returns a string label.
   * Default: annotation.id
   */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  /** Where to position the active annotation when auto-scrolling: 'center', 'start', 'end', or 'nearest'. Defaults to 'center'. */
  scrollActivePosition?: ScrollLogicalPosition;
  /** Which scrollable containers to scroll: 'nearest' (only the annotation list) or 'all' (including viewport). Defaults to 'nearest'. */
  scrollActiveContainer?: 'nearest' | 'all';
  className?: string;
  showClipHeaders?: boolean; // Show headers on clips for visual organization
  /** Draw each clip's waveform scaled by its `gain` (clamped to the channel
   *  height) so levelled clips look the way they sound. Default: false —
   *  waveforms show source level. Draw-time only; peaks are not regenerated. */
  gainScaledWaveforms?: boolean;
  showFades?: boolean; // Show fade in/out overlays on clips
  /** Callback when a track's close button is clicked. Only renders close button when provided. */
  onRemoveTrack?: (trackIndex: number) => void;
  /** Enable vertical track reordering: a drag grip + move up/down buttons on
   *  each default track control panel. Drag requires ClipInteractionProvider
   *  (the ambient DragDropProvider); the buttons work regardless. Default: false. */
  trackReordering?: boolean;
  // Live recording state for real-time waveform preview
  recordingState?: VisualizationRecordingState;
}

/**
 * Waveform visualization component that uses the playlist context.
 *
 * Composes PlaylistVisualization (waveform + tracks) and
 * PlaylistAnnotationList (annotation text list below the waveform).
 */
export const Waveform: React.FC<WaveformProps> = ({
  renderTrackControls,
  renderTick,
  renderPlayhead,
  annotationControls,
  annotationListConfig,
  annotationTextHeight,
  renderAnnotationItem,
  getAnnotationBoxLabel,
  scrollActivePosition = 'center',
  scrollActiveContainer = 'nearest',
  className,
  showClipHeaders = false,
  gainScaledWaveforms = false,
  showFades = false,
  onRemoveTrack,
  trackReordering = false,
  recordingState,
}) => {
  return (
    <>
      <PlaylistVisualization
        renderTrackControls={renderTrackControls}
        renderTick={renderTick}
        renderPlayhead={renderPlayhead}
        annotationControls={annotationControls}
        getAnnotationBoxLabel={getAnnotationBoxLabel}
        className={className}
        showClipHeaders={showClipHeaders}
        gainScaledWaveforms={gainScaledWaveforms}
        showFades={showFades}
        onRemoveTrack={onRemoveTrack}
        trackReordering={trackReordering}
        recordingState={recordingState}
      />
      <AnnotationListWhenPresent
        height={annotationTextHeight}
        renderAnnotationItem={renderAnnotationItem}
        controls={annotationControls}
        annotationListConfig={annotationListConfig}
        scrollActivePosition={scrollActivePosition}
        scrollActiveContainer={scrollActiveContainer}
      />
    </>
  );
};
