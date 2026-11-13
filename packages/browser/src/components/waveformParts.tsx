/**
 * The parts of the multitrack view (#685). Internal for now: `PlaylistVisualization`
 * composes them inside `WaveformRoot`, and nothing here is exported from the
 * package yet.
 *
 * A part reads what it draws from the provider's contexts and from the root's
 * two layout values; its props are the options of that part alone. The root
 * sorts its children into the three places a playlist has (the timescale
 * strip, the controls column, the scrolling tracks area) by part type, see
 * `sortWaveformParts`.
 *
 * The parts with no children are memoized: the component that composes them
 * usually re-renders with the tracks (it holds them), and a part whose props
 * did not change should not follow.
 */
import React, { useContext, type ReactNode } from 'react';
import { SmartScale, type RenderPlayheadFunction } from '@waveform-playlist/ui-components';
import {
  usePlaylistView,
  usePlaylistZoom,
  usePlaylistTimeline,
  useSelectedTrackId,
  useTrackReorderPreview,
} from '../contexts/playlistContexts';
import { SpectrogramIntegrationContext } from '../SpectrogramIntegrationContext';
import type { GetAnnotationBoxLabelFn } from '../types/annotations';
import { TrackRows } from './TrackRows';
import { TrackControlsColumn } from './TrackControlsColumn';
import {
  AnnotationBoxesOverlay,
  LoopRegionOverlay,
  PlayheadOverlay,
  SelectionOverlay,
} from './VisualizationOverlays';
import type { VisualizationRecordingState } from './visualizationLayout';
import { useWaveformExtent, useWaveformRows } from './waveformLayoutContext';

// ---------------------------------------------------------------------------
// Timescale strip
// ---------------------------------------------------------------------------

export interface TimescalePartProps {
  /** Custom tick label. `label` is already formatted for the scale mode. */
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
}

/** The time ruler. */
export const TimescalePart = React.memo(function TimescalePart({ renderTick }: TimescalePartProps) {
  const { displayDuration } = useWaveformExtent('The timescale');
  return <SmartScale durationMs={displayDuration * 1000} renderTick={renderTick} />;
});

/** The draggable loop region, drawn over the timescale. Nothing while looping is off. */
export const LoopRegionPart = React.memo(function LoopRegionPart() {
  const { tracksFullWidth } = useWaveformExtent('The loop region');
  return <LoopRegionOverlay maxPosition={tracksFullWidth} />;
});

// ---------------------------------------------------------------------------
// Controls column
// ---------------------------------------------------------------------------

export interface TrackControlsPartProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  /** The close button is drawn only when this is given. */
  onRemoveTrack?: (trackIndex: number) => void;
  /** A drag grip and move up/down buttons on each default panel. */
  trackReordering?: boolean;
}

/** One control panel per track, beside the tracks and outside the scroll area. */
export const TrackControlsPart = React.memo(function TrackControlsPart({
  renderTrackControls,
  onRemoveTrack,
  trackReordering = false,
}: TrackControlsPartProps) {
  const rows = useWaveformRows('The track controls');
  const { tracks } = usePlaylistTimeline();
  const { selectedTrackId } = useSelectedTrackId();
  const { trackReorderEpoch } = useTrackReorderPreview();
  const spectrogram = useContext(SpectrogramIntegrationContext);

  return (
    <TrackControlsColumn
      tracks={tracks}
      renderModeById={rows.renderModeById}
      trackLayout={rows.trackLayout}
      trackHeightById={rows.trackHeightById}
      animateTrackLayout={rows.animateTrackLayout}
      selectedTrackId={selectedTrackId}
      trackReorderEpoch={trackReorderEpoch}
      trackReordering={trackReordering}
      renderTrackControls={renderTrackControls}
      onRemoveTrack={onRemoveTrack}
      selectTrack={rows.selectTrack}
      spectrogram={spectrogram}
      setSettingsModalTrackId={rows.setSettingsModalTrackId}
    />
  );
});

// ---------------------------------------------------------------------------
// Tracks, and the parts that apply to every clip
// ---------------------------------------------------------------------------

/**
 * Marker: clips get a header. With clip interaction enabled the header is also
 * what a clip is dragged by, and the trim handles come with it. It adds to the
 * height of every row, which is why the root must know of it before anything
 * is drawn: it renders nothing itself.
 */
export const ClipHeadersPart: React.FC = () => null;

/** Marker: clips show their fade-in and fade-out curves. Renders nothing itself. */
export const FadesPart: React.FC = () => null;

export interface RecordingPreviewPartProps {
  recordingState: VisualizationRecordingState;
}

/**
 * Marker: the take being recorded is drawn into its track as it grows. The
 * preview clip is drawn by that track's row; this renders nothing itself.
 */
export const RecordingPreviewPart: React.FC<RecordingPreviewPartProps> = () => null;

export interface TracksPartOptions {
  showClipHeaders: boolean;
  showFades: boolean;
  recordingState: VisualizationRecordingState | undefined;
}

/**
 * Which per-clip parts are among the children of the tracks part. Looks
 * through fragments; a part wrapped in another component is not seen.
 */
export function scanTracksParts(children: ReactNode): TracksPartOptions {
  const found: TracksPartOptions = {
    showClipHeaders: false,
    showFades: false,
    recordingState: undefined,
  };
  const visit = (node: ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === ClipHeadersPart) found.showClipHeaders = true;
      else if (child.type === FadesPart) found.showFades = true;
      else if (child.type === RecordingPreviewPart) {
        found.recordingState = (child.props as RecordingPreviewPartProps).recordingState;
      } else if (child.type === React.Fragment) {
        visit((child.props as { children?: ReactNode }).children);
      }
    });
  };
  visit(children);
  return found;
}

export interface TracksPartProps {
  /** Draw each clip's waveform scaled by its gain. */
  gainScaled?: boolean;
  /** `ClipHeadersPart`, `FadesPart`, `RecordingPreviewPart`. */
  children?: ReactNode;
}

/** The track rows with their clips. */
export const TracksPart: React.FC<TracksPartProps> = ({ gainScaled = false, children }) => {
  const rows = useWaveformRows('The tracks');
  const { tracksFullWidth } = useWaveformExtent('The tracks');
  const { tracks, peaksDataArray } = usePlaylistTimeline();
  const { selectedTrackId } = useSelectedTrackId();
  const { trackDragPreview } = useTrackReorderPreview();
  const { sampleRate, waveHeight, mono } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const spectrogram = useContext(SpectrogramIntegrationContext);
  const { showFades, recordingState } = scanTracksParts(children);

  return (
    <TrackRows
      tracks={tracks}
      peaksDataArray={peaksDataArray}
      renderModeById={rows.renderModeById}
      spectrogramHelpersById={rows.spectrogramHelpersById}
      trackLayout={rows.trackLayout}
      animateTrackLayout={rows.animateTrackLayout}
      width={tracksFullWidth}
      selectedTrackId={selectedTrackId}
      dragSourceTrackId={trackDragPreview?.trackId ?? null}
      waveHeight={waveHeight}
      mono={mono}
      recordingState={recordingState}
      recordingChannelCount={rows.recordingChannelCount}
      samplesPerPixel={samplesPerPixel}
      sampleRate={sampleRate}
      showClipHeaders={rows.showClipHeaders}
      gainScaledWaveforms={gainScaled}
      showFades={showFades}
      selectTrack={rows.selectTrack}
      registerSpectrogramCanvas={spectrogram?.registerSpectrogramCanvas}
      unregisterSpectrogramCanvas={spectrogram?.unregisterSpectrogramCanvas}
    />
  );
};

// ---------------------------------------------------------------------------
// Over the tracks
// ---------------------------------------------------------------------------

export interface AnnotationBoxesPartProps {
  /** Label of a box. Default: the annotation's id. */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
}

/** The row of annotation boxes under the tracks. */
export const AnnotationBoxesPart = React.memo(function AnnotationBoxesPart({
  getAnnotationBoxLabel,
}: AnnotationBoxesPartProps) {
  const { tracksFullWidth } = useWaveformExtent('The annotation boxes');
  return (
    <AnnotationBoxesOverlay width={tracksFullWidth} getAnnotationBoxLabel={getAnnotationBoxLabel} />
  );
});

/** The highlighted selection. Already a part: it takes no props and reads contexts only. */
export const SelectionPart = SelectionOverlay;

export interface PlayheadPartProps {
  renderPlayhead?: RenderPlayheadFunction;
}

/** The playhead. Already a part: its one option is its own. */
export const PlayheadPart: React.FC<PlayheadPartProps> = PlayheadOverlay;

// ---------------------------------------------------------------------------
// Sorting the root's children
// ---------------------------------------------------------------------------

export interface SortedWaveformParts {
  /** Drawn in the timescale strip, in order. */
  timescale: ReactNode[];
  /** Drawn in the controls column, in order. */
  controls: ReactNode[];
  /** Everything else: drawn in the scrolling tracks area, in order. */
  content: ReactNode[];
  /** The per-clip parts of the tracks part (defaults when there is none). */
  tracksOptions: TracksPartOptions;
}

const TIMESCALE_PARTS: ReadonlySet<unknown> = new Set([TimescalePart, LoopRegionPart]);
const CONTROLS_PARTS: ReadonlySet<unknown> = new Set([TrackControlsPart]);

/**
 * Sorts the root's children into the places a playlist has. Fragments are
 * looked through; anything that is not a known part (the consumer's own
 * element, or a part wrapped in another component) goes to the tracks area.
 *
 * The elements are returned as they were given (no clone, no new key), so a
 * render of the root that received the same children hands React the same
 * elements and the parts are skipped. Call it from a `useMemo` on `children`,
 * and render each list as the children of one element (spread, not an array):
 * the elements have no keys.
 */
export function sortWaveformParts(children: ReactNode): SortedWaveformParts {
  const sorted: SortedWaveformParts = {
    timescale: [],
    controls: [],
    content: [],
    tracksOptions: { showClipHeaders: false, showFades: false, recordingState: undefined },
  };
  const visit = (node: ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (React.isValidElement(child)) {
        if (child.type === React.Fragment) {
          visit((child.props as { children?: ReactNode }).children);
          return;
        }
        if (TIMESCALE_PARTS.has(child.type)) {
          sorted.timescale.push(child);
          sorted.content.push(null);
          return;
        }
        if (CONTROLS_PARTS.has(child.type)) {
          sorted.controls.push(child);
          sorted.content.push(null);
          return;
        }
        if (child.type === TracksPart) {
          sorted.tracksOptions = scanTracksParts((child.props as TracksPartProps).children);
        }
      }
      // Every child keeps one position in the tracks area, also one that is
      // drawn elsewhere or not at all (`{flag && <Part />}`): the parts after
      // it are then not remounted when it comes or goes.
      sorted.content.push(typeof child === 'boolean' ? null : child);
    });
  };
  visit(children);
  return sorted;
}
