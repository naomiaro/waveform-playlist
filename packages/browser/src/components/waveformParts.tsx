/**
 * The parts of the view (#685), exported from the package: a consumer
 * composes them inside `WaveformRoot` (or, the ones its provider can serve,
 * inside `MediaElementWaveformRoot`). `Waveform`, `WaveformEditor` and
 * `MediaElementWaveform` are ready-made compositions of them.
 *
 * A part reads what it draws from the provider's contexts and from the root's
 * two layout values (waveformLayoutContext.ts); its props are the options of
 * that part alone. The root sorts its children into the three places a
 * playlist has (the timescale strip, the controls column, the scrolling
 * tracks area) by part type, see `sortWaveformParts`.
 *
 * A part is the component that draws, not a wrapper that forwards to one:
 * the tracks part is in TrackRows.tsx, the controls in
 * TrackControlsColumn.tsx, the overlays in VisualizationOverlays.tsx. The
 * parts with no children are memoized, except the playhead: the component
 * that composes them usually re-renders with the tracks (it holds them), and
 * a part whose props did not change should not follow.
 */
import React, { useContext, type ReactNode } from 'react';
import { SmartScale } from '@waveform-playlist/ui-components';
import {
  WaveformTracks,
  scanTracksParts,
  type TracksMarkers,
  type WaveformTracksProps,
} from './TrackRows';
import {
  DEFAULT_TRACK_CONTROLS_WIDTH,
  WaveformTrackControls,
  type WaveformTrackControlsProps,
} from './TrackControlsColumn';
import { WaveformLoopRegion } from './VisualizationOverlays';
import { useWaveformExtent, WaveformPartPlaceContext } from './waveformLayoutContext';
import { warnMisplacedPart } from './partWarnings';

export {
  WaveformTracks,
  WaveformClipHeaders,
  WaveformFades,
  WaveformRecordingPreview,
  scanTracksParts,
} from './TrackRows';
export { WaveformTrackControls } from './TrackControlsColumn';

export interface WaveformTimescaleProps {
  /** Custom tick label. `label` is already formatted for the scale mode. */
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
}

/** The time ruler, as long as the root's timeline. */
export const WaveformTimescale = React.memo(function WaveformTimescale({
  renderTick,
}: WaveformTimescaleProps) {
  const { displayDuration } = useWaveformExtent('The timescale');
  if (useContext(WaveformPartPlaceContext) !== 'timescale') {
    warnMisplacedPart(
      '<WaveformTimescale> is drawn among the tracks, not in the timescale strip: the root ' +
        'recognises a part by its element type, so it must be a child of the root (a fragment ' +
        'is fine), not wrapped in another component.'
    );
  }
  return <SmartScale durationMs={displayDuration * 1000} renderTick={renderTick} />;
});

export {
  WaveformAnnotationBoxes,
  WaveformLoopRegion,
  WaveformPlayhead,
  WaveformSelection,
} from './VisualizationOverlays';

export interface SortedWaveformParts {
  /** Drawn in the timescale strip, in order. */
  timescale: ReactNode[];
  /** Drawn in the controls column, in order. */
  controls: ReactNode[];
  /**
   * Drawn in the scrolling tracks area, in order: one entry per child, `null`
   * for a child that is drawn elsewhere or not at all.
   */
  content: ReactNode[];
  /** The per-clip parts of the tracks part (all off when there is none). */
  tracksOptions: TracksMarkers;
  /** Width of the controls column in pixels, from the controls part; 0 without one. */
  controlsWidth: number;
}

const TIMESCALE_PARTS: ReadonlySet<unknown> = new Set([WaveformTimescale, WaveformLoopRegion]);
const CONTROLS_PARTS: ReadonlySet<unknown> = new Set([WaveformTrackControls]);

/**
 * Sorts the root's children into the places a playlist has. Fragments are
 * looked through; anything that is not a known part (the consumer's own
 * element, or a part wrapped in another component) goes to the tracks area.
 *
 * The elements are returned as they were given (no clone, no new key), so a
 * render of the root that received the same children hands React the same
 * elements and the parts are skipped. Call it from a `useMemo` on `children`.
 * The elements have no keys of their own: render the tracks-area and controls
 * lists as the children of one element (spread, not an array), and give the
 * strip's parts a key by kind (`useWaveformParts` does both).
 */
export function sortWaveformParts(children: ReactNode): SortedWaveformParts {
  const sorted: SortedWaveformParts = {
    timescale: [],
    controls: [],
    content: [],
    tracksOptions: { showClipHeaders: false, showFades: false, recordingState: undefined },
    controlsWidth: 0,
  };
  let tracksParts = 0;
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
          // The first controls part says how wide the column is.
          if (sorted.controls.length === 0) {
            const { width } = child.props as WaveformTrackControlsProps;
            // `null` (plain JavaScript) means "not given", like `undefined`.
            const given = width !== undefined && width !== null;
            if (given && !(width > 0)) {
              warnMisplacedPart(
                '<WaveformTrackControls width> must be a positive number of pixels: with ' +
                  String(width) +
                  ' no controls column is drawn. Leave the part out to have none.'
              );
            }
            // Not a positive number: no column, and 0 for whoever reads the width.
            sorted.controlsWidth = !given ? DEFAULT_TRACK_CONTROLS_WIDTH : width > 0 ? width : 0;
          }
          sorted.controls.push(child);
          sorted.content.push(null);
          return;
        }
        if (child.type === WaveformTracks) {
          tracksParts++;
          sorted.tracksOptions = scanTracksParts((child.props as WaveformTracksProps).children);
        }
      }
      // Every child keeps one position in the tracks area, also one that is
      // drawn elsewhere or not at all (`{flag && <Part />}`): the parts after
      // it are then not remounted when it comes or goes.
      // (`Children.forEach` already hands over `null` for `false` and `undefined`.)
      sorted.content.push(child);
    });
  };
  visit(children);
  if (sorted.controls.length > 1) {
    warnMisplacedPart(
      'A waveform root has more than one <WaveformTrackControls>: each draws a panel for every ' +
        'track in the one controls column, which is as wide as the first says.'
    );
  }
  if (tracksParts > 1) {
    warnMisplacedPart(
      'A waveform root has more than one <WaveformTracks>: each draws every row, and the row ' +
        'heights follow the per-clip parts of the last one.'
    );
  }
  return sorted;
}
