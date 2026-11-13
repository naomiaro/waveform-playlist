import React, { type ReactNode } from 'react';
import type { RenderPlayheadFunction } from '@waveform-playlist/ui-components';
import type { AnnotationAction } from '@waveform-playlist/core';
import type { GetAnnotationBoxLabelFn } from '../types/annotations';
import type { WaveformRecordingState } from './visualizationLayout';
import { WaveformRoot } from './WaveformRoot';
import {
  WaveformAnnotationBoxes,
  WaveformClipHeaders,
  WaveformFades,
  WaveformLoopRegion,
  WaveformPlayhead,
  WaveformRecordingPreview,
  WaveformSelection,
  WaveformTimescale,
  WaveformTrackControls,
  WaveformTracks,
} from './waveformParts';

export interface PlaylistVisualizationProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
  /** Custom playhead render function. Receives position (pixels) and color from theme. */
  renderPlayhead?: RenderPlayheadFunction;
  annotationControls?: AnnotationAction[];
  /**
   * Custom function to generate the label shown on annotation boxes in the waveform.
   * Receives the annotation data and its index, returns a string label.
   * Default: annotation.id
   */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  className?: string;
  showClipHeaders?: boolean;
  /** Draw each clip's waveform scaled by its gain. Default: false. */
  gainScaledWaveforms?: boolean;
  showFades?: boolean;
  /** Callback when a track's close button is clicked. Only renders close button when provided. */
  onRemoveTrack?: (trackIndex: number) => void;
  // Live recording state for real-time waveform preview
  recordingState?: WaveformRecordingState;
  /** Enable vertical track reordering: a drag grip + move up/down buttons on
   *  each default track control panel. Drag requires ClipInteractionProvider
   *  (the ambient DragDropProvider); the buttons work regardless. Default: false. */
  trackReordering?: boolean;
}

/**
 * Standalone playlist visualization component (WebAudio version).
 *
 * Renders the waveform tracks, timescale, annotations boxes, selection,
 * playhead, loop regions, and track controls.
 *
 * Does NOT render AnnotationText (the annotation list below the waveform).
 * Pair with PlaylistAnnotationList for a full annotation editing UI.
 *
 * It is the default composition of the view's parts (#685): `WaveformRoot`
 * with one part per thing that is drawn, each prop handed to the part it
 * configures. It reads no context, so it renders only when its parent does;
 * what follows the playlist's state is the root and the parts themselves (see
 * WaveformRoot.tsx and waveformParts.tsx).
 */
export const PlaylistVisualization: React.FC<PlaylistVisualizationProps> = ({
  renderTrackControls,
  renderTick,
  renderPlayhead,
  getAnnotationBoxLabel,
  className,
  showClipHeaders = false,
  gainScaledWaveforms,
  showFades = false,
  onRemoveTrack,
  recordingState,
  trackReordering,
}) => (
  <WaveformRoot className={className}>
    <WaveformTimescale renderTick={renderTick} />
    <WaveformLoopRegion />
    <WaveformTrackControls
      renderTrackControls={renderTrackControls}
      onRemoveTrack={onRemoveTrack}
      trackReordering={trackReordering}
    />
    <WaveformTracks gainScaled={gainScaledWaveforms}>
      {showClipHeaders ? <WaveformClipHeaders /> : null}
      {showFades ? <WaveformFades /> : null}
      {recordingState ? <WaveformRecordingPreview recordingState={recordingState} /> : null}
    </WaveformTracks>
    <WaveformAnnotationBoxes getAnnotationBoxLabel={getAnnotationBoxLabel} />
    <WaveformSelection />
    <WaveformPlayhead renderPlayhead={renderPlayhead} />
  </WaveformRoot>
);
