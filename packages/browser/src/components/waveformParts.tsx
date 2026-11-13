/**
 * The parts of the multitrack view (#685). Internal for now: `PlaylistVisualization`
 * composes them inside `WaveformRoot`, and nothing here is exported from the
 * package yet.
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
 * parts with no children are memoized: the component that composes them
 * usually re-renders with the tracks (it holds them), and a part whose props
 * did not change should not follow.
 */
import React, { type ReactNode } from 'react';
import { SmartScale } from '@waveform-playlist/ui-components';
import {
  TracksPart,
  scanTracksParts,
  type TracksPartOptions,
  type TracksPartProps,
} from './TrackRows';
import { TrackControlsPart } from './TrackControlsColumn';
import {
  AnnotationBoxesOverlay,
  LoopRegionOverlay,
  PlayheadOverlay,
  SelectionOverlay,
} from './VisualizationOverlays';
import { useWaveformExtent } from './waveformLayoutContext';

export {
  TracksPart,
  ClipHeadersPart,
  FadesPart,
  RecordingPreviewPart,
  scanTracksParts,
} from './TrackRows';
export { TrackControlsPart } from './TrackControlsColumn';

export interface TimescalePartProps {
  /** Custom tick label. `label` is already formatted for the scale mode. */
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
}

/** The time ruler, as long as the root's timeline. */
export const TimescalePart = React.memo(function TimescalePart({ renderTick }: TimescalePartProps) {
  const { displayDuration } = useWaveformExtent('The timescale');
  return <SmartScale durationMs={displayDuration * 1000} renderTick={renderTick} />;
});

/** The draggable loop region, drawn over the timescale. */
export const LoopRegionPart = LoopRegionOverlay;
/** The row of annotation boxes under the tracks. */
export const AnnotationBoxesPart = AnnotationBoxesOverlay;
/** The highlighted selection. */
export const SelectionPart = SelectionOverlay;
/** The playhead. */
export const PlayheadPart = PlayheadOverlay;

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
      // (`Children.forEach` already hands over `null` for `false` and `undefined`.)
      sorted.content.push(child);
    });
  };
  visit(children);
  return sorted;
}
