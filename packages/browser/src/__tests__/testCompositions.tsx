// Compositions for the tests, written as a consumer would write them (#685):
// each option goes to the part it belongs to, and a per-clip part is there or
// not. They stand where the prop-driven `PlaylistVisualization` and
// `MediaElementPlaylist` stood before the parts were public.
import React, { type ReactNode } from 'react';
import type { RenderPlayheadFunction } from '@waveform-playlist/ui-components';
import type { GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';
import type { WaveformRecordingState } from '../components/visualizationLayout';
import { WaveformRoot } from '../components/WaveformRoot';
import { DefaultTrackControls } from '../components/DefaultTrackControls';
import { TrackRemoveButton, TrackReorderGrip } from '../components/TrackControlPieces';
import { MediaElementWaveformRoot } from '../components/MediaElementWaveformRoot';
import { MediaElementAnnotationBoxes } from '../components/MediaElementAnnotationBoxes';
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
} from '../components/waveformParts';

export interface ComposedWaveformProps {
  /** The panel of a track (the children of the controls part). */
  trackControls?: ReactNode;
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
  renderPlayhead?: RenderPlayheadFunction;
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  className?: string;
  showClipHeaders?: boolean;
  gainScaledWaveforms?: boolean;
  showFades?: boolean;
  /** A remove button beside the default panel. */
  onRemoveTrack?: (trackId: string) => void;
  recordingState?: WaveformRecordingState;
  /** A reorder grip beside the default panel. */
  trackReordering?: boolean;
  /** Leave the timescale part out. */
  noTimescale?: boolean;
  /** Leave the controls part out. */
  noControls?: boolean;
  controlsWidth?: number;
}

export const ComposedWaveform: React.FC<ComposedWaveformProps> = ({
  trackControls,
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
  noTimescale = false,
  noControls = false,
  controlsWidth,
}) => (
  <WaveformRoot className={className}>
    {noTimescale ? null : <WaveformTimescale renderTick={renderTick} />}
    <WaveformLoopRegion />
    {noControls ? null : (
      <WaveformTrackControls width={controlsWidth}>
        {trackControls ??
          (onRemoveTrack || trackReordering ? (
            <>
              <DefaultTrackControls />
              {onRemoveTrack ? <TrackRemoveButton onRemove={onRemoveTrack} /> : null}
              {trackReordering ? <TrackReorderGrip /> : null}
            </>
          ) : undefined)}
      </WaveformTrackControls>
    )}
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

export interface ComposedMediaElementWaveformProps {
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  editable?: boolean;
  linkEndpoints?: boolean;
  onAnnotationUpdate?: OnAnnotationUpdateFn;
  renderPlayhead?: RenderPlayheadFunction;
  showFades?: boolean;
  className?: string;
  /** Leave the timescale part out. */
  noTimescale?: boolean;
}

export const ComposedMediaElementWaveform: React.FC<ComposedMediaElementWaveformProps> = ({
  getAnnotationBoxLabel,
  editable = false,
  linkEndpoints = false,
  onAnnotationUpdate,
  renderPlayhead,
  showFades = false,
  className,
  noTimescale = false,
}) => (
  <MediaElementWaveformRoot className={className}>
    {noTimescale ? null : <WaveformTimescale />}
    <WaveformTracks>{showFades ? <WaveformFades /> : null}</WaveformTracks>
    <MediaElementAnnotationBoxes
      getAnnotationBoxLabel={getAnnotationBoxLabel}
      editable={editable}
      linkEndpoints={linkEndpoints}
      onAnnotationUpdate={onAnnotationUpdate}
    />
    <WaveformSelection />
    <WaveformPlayhead renderPlayhead={renderPlayhead} />
  </MediaElementWaveformRoot>
);
