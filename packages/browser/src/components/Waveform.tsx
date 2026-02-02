import React, { ReactNode } from 'react';
import type { RenderPlayheadFunction } from '@waveform-playlist/ui-components';
import type { AnnotationAction, AnnotationActionOptions, RenderAnnotationItemProps } from '@waveform-playlist/core';
import { usePlaylistState } from '../WaveformPlaylistContext';
import type { GetAnnotationBoxLabelFn } from '../types/annotations';
import { PlaylistVisualization } from './PlaylistVisualization';
import { PlaylistAnnotationList } from './PlaylistAnnotationList';

export interface WaveformProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  renderTimestamp?: (timeMs: number, pixelPosition: number) => ReactNode;
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
  interactiveClips?: boolean; // Enable dragging/trimming interactions on clips (requires @dnd-kit setup)
  showFades?: boolean; // Show fade in/out overlays on clips
  /**
   * Enable mobile-optimized touch interactions.
   * When true, increases touch target sizes for clip boundaries.
   * Use with useDragSensors({ touchOptimized: true }) for best results.
   */
  touchOptimized?: boolean;
  /** Callback when a track's close button is clicked. Only renders close button when provided. */
  onRemoveTrack?: (trackIndex: number) => void;
  // Live recording state for real-time waveform preview
  recordingState?: {
    isRecording: boolean;
    trackId: string; // Which track is being recorded into
    startSample: number; // Where recording started
    durationSamples: number; // Current recording length
    peaks: Int8Array | Int16Array; // Live peaks data
  };
}

/**
 * Waveform visualization component that uses the playlist context.
 *
 * Composes PlaylistVisualization (waveform + tracks) and
 * PlaylistAnnotationList (annotation text list below the waveform).
 */
export const Waveform: React.FC<WaveformProps> = ({
  renderTrackControls,
  renderTimestamp,
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
  interactiveClips = false,
  showFades = false,
  touchOptimized = false,
  onRemoveTrack,
  recordingState,
}) => {
  const { annotations } = usePlaylistState();

  return (
    <>
      <PlaylistVisualization
        renderTrackControls={renderTrackControls}
        renderTimestamp={renderTimestamp}
        renderPlayhead={renderPlayhead}
        annotationControls={annotationControls}
        getAnnotationBoxLabel={getAnnotationBoxLabel}
        className={className}
        showClipHeaders={showClipHeaders}
        interactiveClips={interactiveClips}
        showFades={showFades}
        touchOptimized={touchOptimized}
        onRemoveTrack={onRemoveTrack}
        recordingState={recordingState}
      />
      {annotations.length > 0 && (
        <PlaylistAnnotationList
          height={annotationTextHeight}
          renderAnnotationItem={renderAnnotationItem}
          controls={annotationControls}
          annotationListConfig={annotationListConfig}
          scrollActivePosition={scrollActivePosition}
          scrollActiveContainer={scrollActiveContainer}
        />
      )}
    </>
  );
};
