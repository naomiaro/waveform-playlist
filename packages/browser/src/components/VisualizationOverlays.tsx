/**
 * The parts of the visualization that follow selection, cursor, loop and
 * annotation state. They are small siblings of the track rows (#693): these
 * re-render on every pointer move of a selection drag and on every
 * active-annotation change during playback, and the rows do not.
 *
 * `WaveformSelection` and `WaveformPlayhead` read shared hooks only and are
 * rendered under both providers (#688). The loop region is multitrack only.
 * (The annotation boxes are `WaveformAnnotationBoxes.tsx`, for both providers.)
 */
import React, { use, useSyncExternalStore } from 'react';
import {
  Selection,
  TimescaleLoopRegion,
  useTheme,
  type RenderPlayheadFunction,
  type WaveformPlaylistTheme,
} from '@waveform-playlist/ui-components';
import {
  useCurrentTime,
  useSelection,
  usePlaylistView,
  usePlaylistZoom,
  usePlaybackRefs,
  useLoop,
  useIsPlaying,
  useEditorControls,
} from '../contexts/playlistContexts';
import { AnimatedPlayhead } from './AnimatedPlayhead';
import { useWaveformExtent, WaveformPartPlaceContext } from './waveformLayoutContext';
import { warnMisplacedPart } from './partWarnings';
import { SelectionPreviewContext, type SelectionRange } from '../hooks/useSelectionDrag';

const subscribeToNothing = () => () => {};
const noPreview = (): SelectionRange | null => null;

/**
 * The highlighted selection range. Renders nothing for a collapsed selection.
 * While a drag is drawing a range during playback it shows that range.
 * Memoized (it takes no props): a render of the view around it (play, pause,
 * a press) is not its concern, only the selection, the zoom, the view settings
 * and the theme are.
 */
export const WaveformSelection: React.FC = React.memo(function WaveformSelection() {
  const theme = useTheme() as WaveformPlaylistTheme;
  const { selectionStart, selectionEnd } = useSelection();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  // The range a drag is drawing during playback (see useSelectionDrag). It is
  // not the selection yet, and it is shown in its place until the release.
  // Called as methods (not detached), so a source written as a class works.
  const previewSource = use(SelectionPreviewContext);
  const preview = useSyncExternalStore(
    previewSource ? (onChange) => previewSource.subscribe(onChange) : subscribeToNothing,
    previewSource ? () => previewSource.getSnapshot() : noPreview,
    previewSource ? () => previewSource.getSnapshot() : noPreview
  );

  const start = preview ? preview.start : Math.min(selectionStart, selectionEnd);
  const end = preview ? preview.end : Math.max(selectionStart, selectionEnd);
  if (start === end) return null;

  return (
    <Selection
      startPosition={(start * sampleRate) / samplesPerPixel}
      endPosition={(end * sampleRate) / samplesPerPixel}
      color={theme.selectionColor}
    />
  );
});

/**
 * Wrapper that isolates the custom playhead's hooks from its parent.
 * Calling renderPlayhead() directly would merge its hooks into the parent,
 * causing "Rendered more hooks" errors if renderPlayhead is conditionally provided.
 * It reads shared hooks only, so it serves both providers.
 */
const CustomPlayhead: React.FC<{
  renderPlayhead: RenderPlayheadFunction;
  color: string;
  samplesPerPixel: number;
  sampleRate: number;
}> = ({ renderPlayhead, color, samplesPerPixel, sampleRate }) => {
  const { currentTimeRef, visualTimeRef } = usePlaybackRefs();
  const { isPlaying } = useIsPlaying();
  // Subscribed for the re-render only, so a seek while stopped moves a custom
  // playhead: the position below comes from the refs.
  useCurrentTime();

  // Use visualTimeRef so the initial position matches the audible output
  // (the default playhead and the progress fill are drawn from it too).
  const visualTime = visualTimeRef.current ?? currentTimeRef.current ?? 0;

  return renderPlayhead({
    position: (visualTime * sampleRate) / samplesPerPixel,
    color,
    isPlaying,
    currentTimeRef,
    visualTimeRef,
    samplesPerPixel,
    sampleRate,
  }) as React.ReactElement;
};

export interface WaveformPlayheadProps {
  /** Custom playhead render function. Receives position (pixels) and color from theme. */
  renderPlayhead?: RenderPlayheadFunction;
}

/**
 * The playhead: shown while playing, and at rest when no range is selected.
 * The same under either provider.
 */
export const WaveformPlayhead: React.FC<WaveformPlayheadProps> = ({ renderPlayhead }) => {
  const theme = useTheme() as WaveformPlaylistTheme;
  const { isPlaying } = useIsPlaying();
  const { selectionStart, selectionEnd } = useSelection();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

  if (!isPlaying && selectionStart !== selectionEnd) return null;

  return renderPlayhead ? (
    <CustomPlayhead
      renderPlayhead={renderPlayhead}
      color={theme.playheadColor}
      samplesPerPixel={samplesPerPixel}
      sampleRate={sampleRate}
    />
  ) : (
    <AnimatedPlayhead color={theme.playheadColor} />
  );
};

/**
 * The draggable loop region in the timescale, bounded by the root's timeline.
 * Renders nothing while looping is off. Memoized: it takes no props.
 */
export const WaveformLoopRegion = React.memo(function WaveformLoopRegion() {
  const { tracksFullWidth: maxPosition } = useWaveformExtent('The loop region');
  if (use(WaveformPartPlaceContext) !== 'timescale') {
    warnMisplacedPart(
      '<WaveformLoopRegion> is drawn among the tracks, not in the timescale strip: the root ' +
        'recognises a part by its element type, so it must be a child of the root (a fragment ' +
        'is fine), not wrapped in another component.'
    );
  }
  const theme = useTheme() as WaveformPlaylistTheme;
  const { isLoopEnabled, loopStart, loopEnd } = useLoop();
  const { setLoopRegion } = useEditorControls();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

  if (!isLoopEnabled) return null;

  return (
    <TimescaleLoopRegion
      startPosition={(Math.min(loopStart, loopEnd) * sampleRate) / samplesPerPixel}
      endPosition={(Math.max(loopStart, loopEnd) * sampleRate) / samplesPerPixel}
      markerColor={theme.loopMarkerColor}
      regionColor={theme.loopRegionColor}
      minPosition={0}
      maxPosition={maxPosition}
      onLoopRegionChange={(startPixels, endPixels) => {
        const startSeconds = (startPixels * samplesPerPixel) / sampleRate;
        const endSeconds = (endPixels * samplesPerPixel) / sampleRate;
        setLoopRegion(startSeconds, endSeconds);
      }}
    />
  );
});
