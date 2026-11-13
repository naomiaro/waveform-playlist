import React, { ReactNode } from 'react';
import type {
  AnnotationAction,
  AnnotationActionOptions,
  RenderAnnotationItemProps,
} from '@waveform-playlist/core';
import { useAnnotations } from '../contexts/playlistContexts';
import type { GetAnnotationBoxLabelFn } from '../types/annotations';
import { WaveformRoot } from './WaveformRoot';
import {
  WaveformAnnotationBoxes,
  WaveformClipHeaders,
  WaveformFades,
  WaveformLoopRegion,
  WaveformPlayhead,
  WaveformSelection,
  WaveformTimescale,
  WaveformTrackControls,
  WaveformTracks,
} from './waveformParts';
import { PlaylistAnnotationList, type PlaylistAnnotationListProps } from './PlaylistAnnotationList';

/**
 * The text list, only when there are annotations. It reads the annotations so
 * that Waveform does not: Waveform then renders only when its own props change
 * (#768), as MediaElementWaveform does (#744).
 */
const AnnotationListWhenPresent: React.FC<PlaylistAnnotationListProps> = (props) => {
  const { annotations } = useAnnotations();
  if (annotations.length === 0) return null;
  return <PlaylistAnnotationList {...props} />;
};

/**
 * The props of the two ready-made multitrack views. They are the annotation
 * options (until #686 gives the annotation parts their own) and `className`:
 * what the view is made of is not an option here. For anything else, compose
 * the parts inside `WaveformRoot`.
 */
export interface WaveformProps {
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

interface CompositionProps extends WaveformProps {
  tracks: React.ReactElement;
}

/** Not a component: called by the two below, so neither gains a layer. */
function composeWaveform({
  tracks,
  annotationControls,
  annotationListConfig,
  annotationTextHeight,
  renderAnnotationItem,
  getAnnotationBoxLabel,
  scrollActivePosition = 'center',
  scrollActiveContainer = 'nearest',
  className,
}: CompositionProps) {
  return (
    <>
      <WaveformRoot className={className}>
        {TIMESCALE}
        {LOOP_REGION}
        {TRACK_CONTROLS}
        {tracks}
        <WaveformAnnotationBoxes getAnnotationBoxLabel={getAnnotationBoxLabel} />
        {SELECTION}
        {PLAYHEAD}
      </WaveformRoot>
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
}

/**
 * The multitrack view, ready-made: the timescale, the loop region, the track
 * controls (200 px), the tracks, the annotation boxes, the selection and the
 * playhead, with the annotation text list below when there are annotations.
 *
 * It is a composition of the public parts with no options for them. To leave
 * a part out, give one an option (`renderTick`, a column width), compose the
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
 * <PlaylistAnnotationList />
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
