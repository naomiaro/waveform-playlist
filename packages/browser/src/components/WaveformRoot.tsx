import React, {
  useContext,
  useEffect,
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
import { trackKind, type RenderMode, type SpectrogramConfig } from '@waveform-playlist/core';
import { SpectrogramIntegrationContext } from '../SpectrogramIntegrationContext';
import { trackRenderMode } from '../utils/trackRenderMode';
import type { SpectrogramTrackHelpers } from './TrackRows';
import { getTrackChannelCount } from './visualizationLayout';
import type { WaveformRow, WaveformRowsValue } from './waveformLayoutContext';
import { useWaveformFrame, useWaveformParts } from './waveformFrame';

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
 * The root of the multitrack view (#685). Internal for now.
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
 * recording layout step, and whenever the component that composes it renders.
 * None of that renders a part by itself: the
 * parts are `children`, whose elements are the same as on the previous render
 * unless the component that composed them rendered too, and each part follows
 * the two layout values below and the provider contexts it reads. Keep it so:
 * both values are memoized, and everything in them must keep its identity
 * across a render that did not change it.
 */
export const WaveformRoot: React.FC<WaveformRootProps> = ({ className, children }) => {
  const { setSelectedTrackId, setCurrentTime, setRecordingActive } = useEditorControls();
  const { sampleRate, waveHeight, controls, mono, indefinitePlayback, fillViewport } =
    usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const { peaksDataArray, tracks, duration, isReady } = usePlaylistTimeline();
  const { trackDragPreview } = useTrackReorderPreview();

  // Optional spectrogram integration (only available when SpectrogramProvider is present)
  const spectrogram = useContext(SpectrogramIntegrationContext);

  // The parts by place, and what the tracks part was given.
  const parts = useWaveformParts(children);
  const { showClipHeaders, recordingState } = parts.tracksOptions;

  // Sync the recording session (and its armed track) to the provider so the
  // armed track's existing content is transiently muted for the take —
  // punch-in replaces whatever it overlaps (#579/#589). The cleanup releases
  // the session on recording end AND on unmount, restoring the track's
  // previous mute state. Consumers that start playback in the same handler
  // as the recording should also call setRecordingActive eagerly so the
  // doomed material never blips before this effect commits.
  const recordingActive = !!recordingState?.isRecording;
  const armedTrackId = recordingState?.trackId ?? null;
  useEffect(() => {
    if (!recordingActive) return undefined;
    setRecordingActive(true, armedTrackId);
    return () => setRecordingActive(false);
  }, [recordingActive, armedTrackId, setRecordingActive]);

  // Per-track spectrogram rendering helpers (memoized) — only computed when spectrogram is available
  const spectrogramHelpersById = useMemo(() => {
    const helpers = new Map<string, SpectrogramTrackHelpers>();
    if (!spectrogram) return helpers;
    tracks.forEach((track) => {
      const mode = trackRenderMode(
        track,
        spectrogram.trackSpectrogramOverrides.get(track.id)?.renderMode
      );
      if (mode === 'waveform') return;
      const overrides = spectrogram.trackSpectrogramOverrides.get(track.id);
      const cm =
        overrides?.colorMap ??
        track.spectrogramColorMap ??
        spectrogram.spectrogramColorMap ??
        'viridis';
      const cfg = overrides?.config ?? track.spectrogramConfig ?? spectrogram.spectrogramConfig;
      helpers.set(track.id, {
        colorLUT: spectrogram.getColorMap(cm),
        frequencyScaleFn: spectrogram.getFrequencyScale(cfg?.frequencyScale ?? 'mel'),
        config: cfg,
      });
    });
    return helpers;
  }, [tracks, spectrogram]);

  // Render mode per track (see trackRenderMode): an audio track takes a
  // spectrogram override, else its own mode, else a waveform. A MIDI track is
  // drawn as a piano roll from its kind and has no render mode.
  const renderModeById = useMemo(() => {
    const modes = new Map<string, RenderMode>();
    tracks.forEach((track) => {
      modes.set(
        track.id,
        trackRenderMode(track, spectrogram?.trackSpectrogramOverrides.get(track.id)?.renderMode)
      );
    });
    return modes;
  }, [tracks, spectrogram]);

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
  // so it is already current in this render.
  let displayDuration = duration > 0 ? duration : DEFAULT_EMPTY_TRACK_DURATION;

  if (fillsContainer) {
    const minContainerDuration = (scrollContainerWidth * samplesPerPixel) / sampleRate;
    displayDuration = Math.max(displayDuration, minContainerDuration);
  }

  if (recordingProgress) {
    // Grows in steps, not with every frame of the take (#695).
    displayDuration = Math.max(displayDuration, recordingLayout.displayEndSeconds);
  }

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
    parts,
    displayDuration,
    rows,
    playlistState: isReady ? 'ready' : 'loading',
    controlsWidth: controls.show ? controls.width : 0,
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
              settingsModalTrackId !== null
                ? (spectrogram.trackSpectrogramOverrides.get(settingsModalTrackId)?.config ??
                  tracks.find((t) => t.id === settingsModalTrackId)?.spectrogramConfig ??
                  spectrogram.spectrogramConfig ??
                  EMPTY_SPECTROGRAM_CONFIG)
                : EMPTY_SPECTROGRAM_CONFIG
            }
            colorMap={
              settingsModalTrackId !== null
                ? (spectrogram.trackSpectrogramOverrides.get(settingsModalTrackId)?.colorMap ??
                  tracks.find((t) => t.id === settingsModalTrackId)?.spectrogramColorMap ??
                  spectrogram.spectrogramColorMap ??
                  'viridis')
                : 'viridis'
            }
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
