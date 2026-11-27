import React, {
  use,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { DevicePixelRatioProvider, CLIP_HEADER_HEIGHT } from '@waveform-playlist/ui-components';
import {
  usePlaylistView,
  usePlaylistZoom,
  usePlaylistTimeline,
  useTrackReorderPreview,
  useEditorControls,
} from '../contexts/playlistContexts';
import {
  applyTrackOrderPreview,
  computeTrackLayout,
  trackIdAtOffset,
} from '../utils/trackOrderPreview';
import { useTrailingActive } from '../hooks/useTrailingActive';
import { useRecordingLayout } from '../hooks/useRecordingLayout';
import { useTrimPreviewExtent } from '../hooks/useTrimPreviewView';
import { trackKind, type RenderMode, type SpectrogramConfig } from '@waveform-playlist/core';
import { SpectrogramIntegrationContext } from '../SpectrogramIntegrationContext';
import { trackRenderMode } from '../utils/trackRenderMode';
import { placeholdersEnd } from '../utils/placeholderPeaks';
import type { SpectrogramTrackHelpers } from './TrackRows';
import { getTrackChannelCount } from './visualizationLayout';
import type { WaveformRow, WaveformRowsValue } from './waveformLayoutContext';
import { useWaveformFrame, useWaveformParts } from './waveformFrame';
import { useResolvedViewOptions } from './WaveformViewOptions';

// Default duration in seconds for empty tracks (used for recording workflow)
const DEFAULT_EMPTY_TRACK_DURATION = 60;

// Passed to the spectrogram settings modal when no config exists at any level.
// A module constant, so the prop keeps its identity across renders.
const EMPTY_SPECTROGRAM_CONFIG: SpectrogramConfig = {};

export interface WaveformRootProps {
  className?: string;
  /** The parts (see waveformParts.tsx), and anything else to draw over the tracks. */
  children?: ReactNode;
}

/**
 * The root of the multitrack view (#685), exported from the package.
 *
 * It owns what the parts share and nothing they draw: the size of the
 * timeline, the vertical layout of the rows (one layout for the tracks and
 * the controls column, so they cannot disagree), what a press on the tracks
 * does beyond the selection drag, and the spectrogram settings modal. The
 * scrolling frame (`Playlist`), the selection drag and the context for the
 * drawing primitives are shared with the MediaElement root: `useWaveformFrame`.
 *
 * It renders on its own state (a drag in progress, the settings modal, the
 * measured container width), on play and stop (its selection drag reads
 * `isPlaying`), on every change of the timeline, the zoom, the view settings,
 * the reorder preview, the spectrogram integration and the theme, on a
 * recording layout step, on a 10-second step of a trim dragged past the end
 * of the timeline, and whenever the component that composes it renders.
 * None of that renders a part by itself: the
 * parts are `children`, whose elements are the same as on the previous render
 * unless the component that composed them rendered too, and each part follows
 * the two layout values below and the provider contexts it reads. Keep it so:
 * both values are memoized, and everything in them must keep its identity
 * across a render that did not change it.
 */
export const WaveformRoot: React.FC<WaveformRootProps> = ({ className, children }) => {
  const { setSelectedTrackId, setCurrentTime } = useEditorControls();
  const { sampleRate, mono, indefinitePlayback } = usePlaylistView();
  const viewOptions = useResolvedViewOptions();
  const { waveHeight, fillViewport } = viewOptions;
  const { samplesPerPixel } = usePlaylistZoom();
  const { peaksDataArray, tracks, duration, isReady } = usePlaylistTimeline();
  const { trackDragPreview } = useTrackReorderPreview();

  // Optional spectrogram integration (only available when SpectrogramProvider is present)
  const spectrogram = use(SpectrogramIntegrationContext);

  // The parts by place, and what the tracks part was given.
  const parts = useWaveformParts(children);
  const { showClipHeaders, recordingState } = parts.tracksOptions;

  // Per-track spectrogram rendering helpers (memoized) — only computed when spectrogram is available
  const spectrogramHelpersById = useMemo(() => {
    const helpers = new Map<string, SpectrogramTrackHelpers>();
    if (!spectrogram) return helpers;
    tracks.forEach((track) => {
      if (trackRenderMode(track) === 'waveform') return;
      const cm = track.spectrogramColorMap ?? spectrogram.spectrogramColorMap ?? 'viridis';
      const cfg = track.spectrogramConfig ?? spectrogram.spectrogramConfig;
      helpers.set(track.id, {
        colorLUT: spectrogram.getColorMap(cm),
        frequencyScaleFn: spectrogram.getFrequencyScale(cfg?.frequencyScale ?? 'mel'),
        config: cfg,
      });
    });
    return helpers;
  }, [tracks, spectrogram]);

  // Render mode per track (see trackRenderMode): an audio track's own mode,
  // else a waveform. A MIDI track is drawn as a piano roll from its kind and
  // has no render mode.
  const renderModeById = useMemo(() => {
    const modes = new Map<string, RenderMode>();
    tracks.forEach((track) => {
      modes.set(track.id, trackRenderMode(track));
    });
    return modes;
  }, [tracks]);

  // The recording, reduced to what the layout depends on: numbers that change
  // rarely, read through selectors. `recordingState` itself is usually a new
  // object literal on every render of the consumer.
  const recordingProgress = recordingState?.isRecording ? recordingState.progress : undefined;
  const recordingLayout = useRecordingLayout(
    recordingProgress,
    recordingState?.startSample ?? 0,
    sampleRate
  );
  const recordingTrackId = recordingState?.isRecording ? recordingState.trackId : null;
  // A trim dragged past the end of the timeline: its end, in 10-second steps (#812).
  const trimPreviewEnd = useTrimPreviewExtent(sampleRate, duration);
  const recordingChannelCount = recordingProgress ? (mono ? 1 : recordingLayout.channelCount) : 0;

  // State for spectrogram settings modal
  const [settingsModalTrackId, setSettingsModalTrackId] = useState<string | null>(null);
  const closeSettingsModal = useCallback(() => setSettingsModalTrackId(null), []);

  // The frame hands over the scroll container (a state setter: stable).
  const [scrollContainerElement, setScrollContainerElement] = useState<HTMLDivElement | null>(null);

  // Fill the visible scroll container when requested — indefinitePlayback
  // implies it (endless playback needs an endless-looking timeline);
  // fillViewport requests the layout alone.
  const fillsContainer = indefinitePlayback || fillViewport;

  // The container's width is state, measured in a layout effect (so the first
  // paint already fills it) and kept current by a ResizeObserver. Reading
  // clientWidth in the render body instead forced layout on every render while
  // recording, was 0 on the first render and never followed a container resize.
  const [scrollContainerWidth, setScrollContainerWidth] = useState(0);
  useLayoutEffect(() => {
    if (!fillsContainer || !scrollContainerElement) return;
    const measure = () => setScrollContainerWidth(scrollContainerElement.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(scrollContainerElement);
    return () => observer.disconnect();
  }, [fillsContainer, scrollContainerElement]);

  // Calculate dimensions. `duration` is derived from `tracks` in the provider,
  // so it is already current in this render. It is the loaded audio; a clip
  // still loading is drawn as a placeholder, and the view is as wide as the
  // last one (#812).
  const placeholdersEndSeconds = useMemo(() => placeholdersEnd(peaksDataArray), [peaksDataArray]);
  let displayDuration = Math.max(
    duration > 0 ? duration : DEFAULT_EMPTY_TRACK_DURATION,
    placeholdersEndSeconds
  );

  if (fillsContainer) {
    const minContainerDuration = (scrollContainerWidth * samplesPerPixel) / sampleRate;
    displayDuration = Math.max(displayDuration, minContainerDuration);
  }

  if (recordingProgress) {
    // Grows in steps, not with every frame of the take (#695).
    displayDuration = Math.max(displayDuration, recordingLayout.displayEndSeconds);
  }

  displayDuration = Math.max(displayDuration, trimPreviewEnd);

  // Reads `tracks` through a ref so its identity survives `tracks` changes: it
  // is a prop of every memoized clip and control panel.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const selectTrack = useCallback(
    (trackIndex: number) => {
      const track = tracksRef.current[trackIndex];
      if (track) {
        setSelectedTrackId(track.id);
      }
    },
    [setSelectedTrackId]
  );

  // Shared vertical layout for BOTH columns (waveform rows + control slots).
  // Heights use the existing slot formula; order applies the live drag
  // preview so both columns slide together. Worked out here, once, so the two
  // columns can never disagree.
  const trackHeightById = useMemo(() => {
    const m = new Map<string, number>();
    peaksDataArray.forEach((trackClipPeaks, trackIndex) => {
      const track = tracks[trackIndex];
      if (!track) return;
      const maxChannels = getTrackChannelCount(
        trackClipPeaks,
        track.id === recordingTrackId ? recordingChannelCount : 0
      );
      m.set(track.id, waveHeight * maxChannels + (showClipHeaders ? CLIP_HEADER_HEIGHT : 0));
    });
    return m;
  }, [
    peaksDataArray,
    tracks,
    recordingTrackId,
    recordingChannelCount,
    waveHeight,
    showClipHeaders,
  ]);

  const displayOrderIds = useMemo(
    () => applyTrackOrderPreview(tracks, trackDragPreview).map((t) => t.id),
    [tracks, trackDragPreview]
  );

  const trackLayout = useMemo(
    () => computeTrackLayout(displayOrderIds, trackHeightById),
    [displayOrderIds, trackHeightById]
  );

  const animateTrackLayout = useTrailingActive(trackDragPreview !== null, 200);

  // What the parts need to know of each track. Changes with `tracks`, as the
  // peaks beside it do.
  const rowList = useMemo<WaveformRow[]>(
    () => tracks.map((track) => ({ id: track.id, kind: trackKind(track) })),
    [tracks]
  );
  const dragSourceTrackId = trackDragPreview?.trackId ?? null;

  const rows = useMemo<WaveformRowsValue>(
    () => ({
      rows: rowList,
      peaksDataArray,
      showClipHeaders,
      trackHeightById,
      trackLayout,
      animateTrackLayout,
      renderModeById,
      spectrogramHelpersById,
      selectTrack,
      setSettingsModalTrackId,
      recordingChannelCount,
      dragSourceTrackId,
    }),
    [
      rowList,
      peaksDataArray,
      showClipHeaders,
      trackHeightById,
      trackLayout,
      animateTrackLayout,
      renderModeById,
      spectrogramHelpersById,
      selectTrack,
      recordingChannelCount,
      dragSourceTrackId,
    ]
  );

  // The frame, with the multitrack extras of the selection drag: a press
  // selects the row under the pointer, and a click while stopped moves the
  // cursor only (the selection the press collapsed stays).
  const frame = useWaveformFrame({
    className,
    viewOptions,
    parts,
    displayDuration,
    rows,
    playlistState: isReady ? 'ready' : 'loading',
    controlsWidth: parts.controlsWidth,
    onScrollContainer: setScrollContainerElement,
    onPress: ({ offsetY }) => {
      // The row under the pointer, from the layout the rows are positioned with.
      const clickedTrackId = trackIdAtOffset(
        displayOrderIds,
        trackLayout,
        trackHeightById,
        offsetY
      );
      if (clickedTrackId !== null) {
        setSelectedTrackId(clickedTrackId);
      }
    },
    onClickWhileStopped: setCurrentTime,
  });

  const settingsTrack =
    settingsModalTrackId !== null ? tracks.find((t) => t.id === settingsModalTrackId) : undefined;

  return (
    <DevicePixelRatioProvider>
      {frame}
      {spectrogram?.SettingsModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <spectrogram.SettingsModal
            open={settingsModalTrackId !== null}
            onClose={closeSettingsModal}
            config={
              settingsTrack?.spectrogramConfig ??
              spectrogram.spectrogramConfig ??
              EMPTY_SPECTROGRAM_CONFIG
            }
            colorMap={
              settingsTrack?.spectrogramColorMap ?? spectrogram.spectrogramColorMap ?? 'viridis'
            }
            sampleRate={sampleRate}
            onApply={(newConfig, newColorMap) => {
              if (settingsModalTrackId !== null) {
                spectrogram.setTrackSpectrogramConfig(settingsModalTrackId, newConfig, newColorMap);
              }
            }}
          />,
          document.body
        )}
    </DevicePixelRatioProvider>
  );
};
