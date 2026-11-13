import React from 'react';
import { MediaElementWaveformRoot } from './MediaElementWaveformRoot';
import {
  WaveformPlayhead,
  WaveformSelection,
  WaveformTimescale,
  WaveformTracks,
} from './waveformParts';
import { WaveformAnnotationBoxes } from './WaveformAnnotationBoxes';
import { AnnotationList } from './AnnotationList';

/**
 * `className`. What the view is made of is not an option here, and neither
 * are the options of its parts: compose the parts inside
 * `MediaElementWaveformRoot` for anything else.
 */
export interface MediaElementWaveformProps {
  className?: string;
}

// The same elements on every render, so a render of the composition does not
// render these parts (see Waveform.tsx).
const TIMESCALE = <WaveformTimescale />;
const TRACKS = <WaveformTracks />;
const SELECTION = <WaveformSelection />;
const PLAYHEAD = <WaveformPlayhead />;
const ANNOTATION_BOXES = <WaveformAnnotationBoxes />;
// Draws nothing while there are no annotations.
const ANNOTATION_LIST = <AnnotationList />;

/**
 * The view of `MediaElementPlaylistProvider`, ready-made: the timescale, the
 * one track, the annotation boxes, the selection and the playhead, with the
 * annotation text list below when there are annotations.
 *
 * It is a composition of the public parts with no options for them. To leave
 * the timescale out, show fades, use your own playhead or give the
 * annotation boxes or the annotation list an option, write the composition
 * yourself:
 *
 * ```tsx
 * <MediaElementWaveformRoot>
 *   <WaveformTimescale />
 *   <WaveformTracks>
 *     <WaveformFades />
 *   </WaveformTracks>
 *   <WaveformAnnotationBoxes />
 *   <WaveformSelection />
 *   <WaveformPlayhead renderPlayhead={…} />
 * </MediaElementWaveformRoot>
 * <AnnotationList />
 * ```
 */
export const MediaElementWaveform: React.FC<MediaElementWaveformProps> = ({ className }) => (
  <>
    <MediaElementWaveformRoot className={className}>
      {TIMESCALE}
      {TRACKS}
      {ANNOTATION_BOXES}
      {SELECTION}
      {PLAYHEAD}
    </MediaElementWaveformRoot>
    {ANNOTATION_LIST}
  </>
);
