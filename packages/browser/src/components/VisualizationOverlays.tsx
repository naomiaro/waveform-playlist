/**
 * The parts of the visualization that follow selection, cursor, loop and
 * annotation state. They are small siblings of the track rows (#693): these
 * re-render on every pointer move of a selection drag and on every
 * active-annotation change during playback, and the rows do not.
 *
 * `SelectionOverlay` and `PlayheadOverlay` read shared hooks only and are
 * rendered by both views (`PlaylistVisualization` and `MediaElementPlaylist`,
 * #688). The annotation boxes and the loop region are multitrack only.
 */
import React, { useCallback } from 'react';
import {
  Selection,
  TimescaleLoopRegion,
  useTheme,
  type PlayheadProps,
  type RenderPlayheadFunction,
  type WaveformPlaylistTheme,
} from '@waveform-playlist/ui-components';
import {
  useActiveAnnotation,
  useCurrentTime,
  useSelection,
  usePlaylistView,
  usePlaylistZoom,
  usePlaybackRefs,
  useLoop,
  useIsPlaying,
  usePlaybackControls,
  useEditorControls,
  useAnnotations,
  useAnnotationEditing,
} from '../contexts/playlistContexts';
import type { AnnotationData, GetAnnotationBoxLabelFn } from '../types/annotations';
import { AnimatedPlayhead } from './AnimatedPlayhead';
import { useAnnotationsWithPreview } from '../hooks/useAnnotationsWithPreview';
import { AnnotationBoxes } from './AnnotationBoxes';

/**
 * The highlighted selection range. Renders nothing for a collapsed selection.
 * Memoized (it takes no props): a render of the view around it (play, pause,
 * a press) is not its concern, only the selection, the zoom and the theme are.
 */
export const SelectionOverlay: React.FC = React.memo(function SelectionOverlay() {
  const theme = useTheme() as WaveformPlaylistTheme;
  const { selectionStart, selectionEnd } = useSelection();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

  if (selectionStart === selectionEnd) return null;

  return (
    <Selection
      startPosition={(Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel}
      endPosition={(Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel}
      color={theme.selectionColor}
    />
  );
});

/**
 * What `renderPlayhead` was given until #688 part 3 and is not given any more,
 * with what to do instead.
 */
const REMOVED_PLAYHEAD_PROPS: Readonly<Record<string, string>> = {
  playbackStartTimeRef: 'read it from useEngineRefs() (WaveformPlaylistProvider only)',
  audioStartPositionRef: 'read it from useEngineRefs() (WaveformPlaylistProvider only)',
  getAudioContextTime: 'read it from useEngineRefs() (WaveformPlaylistProvider only)',
  getPlaybackTime:
    'read it from useEngineRefs() (WaveformPlaylistProvider only), or place the playhead from visualTimeRef',
  controlsOffset: 'it was always 0: delete it',
};

/**
 * INTERNAL: the props object handed to `renderPlayhead`. Five props were
 * removed from `PlayheadProps`; a leftover playhead in plain JavaScript that
 * still reads one would get `undefined` and draw at `NaN` pixels with no
 * error. Each removed name is a getter that throws instead. The getters are
 * not enumerable: the object still lists and spreads as its seven props, so
 * `<PlayheadWithMarker {...props} />` is unaffected.
 *
 * MIGRATION-GUARD: remove in the major after this one (#788).
 */
export function playheadProps(props: PlayheadProps): PlayheadProps {
  const value = { ...props };
  for (const [name, instead] of Object.entries(REMOVED_PLAYHEAD_PROPS)) {
    Object.defineProperty(value, name, {
      enumerable: false,
      get() {
        throw new Error(`${name} is no longer passed to renderPlayhead: ${instead}`);
      },
    });
  }
  return value;
}

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

  return renderPlayhead(
    playheadProps({
      position: (visualTime * sampleRate) / samplesPerPixel,
      color,
      isPlaying,
      currentTimeRef,
      visualTimeRef,
      samplesPerPixel,
      sampleRate,
    })
  ) as React.ReactElement;
};

export interface PlayheadOverlayProps {
  /** Custom playhead render function. Receives position (pixels) and color from theme. */
  renderPlayhead?: RenderPlayheadFunction;
}

/**
 * The playhead: shown while playing, and at rest when no range is selected.
 * The same under either provider.
 */
export const PlayheadOverlay: React.FC<PlayheadOverlayProps> = ({ renderPlayhead }) => {
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

export interface AnnotationBoxesOverlayProps {
  width: number;
  /**
   * Custom function to generate the label shown on annotation boxes in the waveform.
   * Receives the annotation data and its index, returns a string label.
   * Default: annotation.id
   */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
}

/** The row of annotation boxes under the tracks. Needs the annotation integration. */
export const AnnotationBoxesOverlay: React.FC<AnnotationBoxesOverlayProps> = ({
  width,
  getAnnotationBoxLabel,
}) => {
  const { annotations, continuousPlay } = useAnnotations();
  const { annotationsEditable } = useAnnotationEditing();
  const { activeAnnotationId } = useActiveAnnotation();
  const { setActiveAnnotationId, play, annotationPreview } = usePlaybackControls();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  // While an edge is dragged with the preview, the boxes follow the drag.
  const shownAnnotations = useAnnotationsWithPreview(annotations, annotationPreview);

  // A prop of every memoized box: its dependencies do not change when only
  // the active annotation does.
  const handleAnnotationClick = useCallback(
    async (annotation: AnnotationData) => {
      setActiveAnnotationId(annotation.id);
      const playDuration = !continuousPlay ? annotation.end - annotation.start : undefined;
      try {
        await play(annotation.start, playDuration);
      } catch (err) {
        console.error(
          'waveform-playlist: Failed to start playback for annotation',
          annotation.id,
          err
        );
      }
    },
    [continuousPlay, play, setActiveAnnotationId]
  );

  return (
    <AnnotationBoxes
      annotations={shownAnnotations}
      activeAnnotationId={activeAnnotationId}
      editable={annotationsEditable}
      width={width}
      sampleRate={sampleRate}
      samplesPerPixel={samplesPerPixel}
      getAnnotationBoxLabel={getAnnotationBoxLabel}
      onSelect={handleAnnotationClick}
    />
  );
};

export interface LoopRegionOverlayProps {
  /** Right edge of the timeline in pixels. */
  maxPosition: number;
}

/** The draggable loop region in the timescale. Renders nothing while looping is off. */
export const LoopRegionOverlay: React.FC<LoopRegionOverlayProps> = ({ maxPosition }) => {
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
};
