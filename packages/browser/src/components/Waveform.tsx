import React from 'react';
import { WaveformRoot } from './WaveformRoot';
import {
  WaveformClipHeaders,
  WaveformFades,
  WaveformLoopRegion,
  WaveformPlayhead,
  WaveformSelection,
  WaveformTimescale,
  WaveformTrackControls,
  WaveformTracks,
} from './waveformParts';
import { WaveformAnnotationBoxes } from './WaveformAnnotationBoxes';
import { AnnotationList } from './AnnotationList';

/**
 * The props of the two ready-made multitrack views: `className`. What the
 * view is made of is not an option here, and neither are the options of its
 * parts (#686 moved the annotation ones onto `WaveformAnnotationBoxes` and
 * `AnnotationList`). For anything else, compose the parts inside
 * `WaveformRoot`.
 */
export interface WaveformProps {
  className?: string;
}

export type WaveformEditorProps = WaveformProps;

// The parts that take no option are the same elements on every render: a
// render of the composition then hands the root children it has seen, and
// React skips every one of them (the tracks part included, which is not
// memoized because a consumer's children usually are new).
const TIMESCALE = <WaveformTimescale />;
const LOOP_REGION = <WaveformLoopRegion />;
const TRACK_CONTROLS = <WaveformTrackControls />;
const TRACKS = <WaveformTracks />;
const TRACKS_WITH_HEADERS_AND_FADES = (
  <WaveformTracks>
    <WaveformClipHeaders />
    <WaveformFades />
  </WaveformTracks>
);
const SELECTION = <WaveformSelection />;
const PLAYHEAD = <WaveformPlayhead />;
const ANNOTATION_BOXES = <WaveformAnnotationBoxes />;
// Draws nothing while there are no annotations.
const ANNOTATION_LIST = <AnnotationList />;

interface CompositionProps extends WaveformProps {
  tracks: React.ReactElement;
}

/** Not a component: called by the two below, so neither gains a layer. */
function composeWaveform({ tracks, className }: CompositionProps) {
  return (
    <>
      <WaveformRoot className={className}>
        {TIMESCALE}
        {LOOP_REGION}
        {TRACK_CONTROLS}
        {tracks}
        {ANNOTATION_BOXES}
        {SELECTION}
        {PLAYHEAD}
      </WaveformRoot>
      {ANNOTATION_LIST}
    </>
  );
}

/**
 * The multitrack view, ready-made: the timescale, the loop region, the track
 * controls (200 px), the tracks, the annotation boxes, the selection and the
 * playhead, with the annotation text list below when there are annotations.
 *
 * It is a composition of the public parts with no options for them. To leave
 * a part out, give one an option (`renderTick`, a column width, a label for
 * the annotation boxes, a height or actions for the annotation list), compose the
 * panel of a track (a remove button, a reorder grip, your own control) or
 * add your own element, write the composition yourself:
 *
 * ```tsx
 * <WaveformRoot>
 *   <WaveformTimescale />
 *   <WaveformLoopRegion />
 *   <WaveformTrackControls />
 *   <WaveformTracks />
 *   <WaveformAnnotationBoxes />
 *   <WaveformSelection />
 *   <WaveformPlayhead />
 * </WaveformRoot>
 * <AnnotationList />
 * ```
 */
export const Waveform: React.FC<WaveformProps> = (props) =>
  composeWaveform({ ...props, tracks: TRACKS });

/**
 * `Waveform` with clip headers and fade curves: `<WaveformTracks>` holds
 * `<WaveformClipHeaders />` and `<WaveformFades />`. Inside a
 * `ClipInteractionProvider` the header is what a clip is dragged by, and the
 * trim handles come with it.
 */
export const WaveformEditor: React.FC<WaveformEditorProps> = (props) =>
  composeWaveform({ ...props, tracks: TRACKS_WITH_HEADERS_AND_FADES });
