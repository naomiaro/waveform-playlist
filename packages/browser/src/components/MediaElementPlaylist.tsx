import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  Playlist,
  Track as TrackComponent,
  Clip,
  Selection,
  FadeOverlay,
  PlaylistInfoContext,
  DevicePixelRatioProvider,
  SmartScale,
  useTheme,
  waveformColorToCss,
} from '@waveform-playlist/ui-components';
import type { RenderPlayheadFunction } from '@waveform-playlist/ui-components';
import type { Peaks } from '@waveform-playlist/core';
import {
  useIsPlaying,
  useCurrentTime,
  useSelection,
  usePlaybackControls,
  usePlaybackRefs,
  usePlaylistView,
  usePlaylistZoom,
  useMediaElementTrack,
} from '../contexts/playlistContexts';
import { useWindowDrag, clampedOffsetX } from '../hooks/useWindowDrag';
import { AnimatedMediaElementPlayhead } from './AnimatedMediaElementPlayhead';
import { MediaElementAnnotationBoxes } from './MediaElementAnnotationBoxes';
import { ChannelWithMediaElementProgress } from './ChannelWithMediaElementProgress';
import type { GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';

/**
 * Wrapper that isolates the custom playhead's hooks from MediaElementPlaylist.
 * Calling renderPlayhead() directly inside MediaElementPlaylist's render would
 * merge its hooks into MediaElementPlaylist's hook count, causing "Rendered more
 * hooks" errors if renderPlayhead is conditionally provided.
 */
// Stable refs for MediaElement playback (no AudioContext, so these are always 0)
const ZERO_REF: React.RefObject<number> = { current: 0 };

const CustomMediaElementPlayhead: React.FC<{
  renderPlayhead: RenderPlayheadFunction;
  color: string;
  samplesPerPixel: number;
  sampleRate: number;
}> = ({ renderPlayhead, color, samplesPerPixel, sampleRate }) => {
  const { isPlaying } = useIsPlaying();
  const { currentTimeRef } = usePlaybackRefs();
  // Subscribed for the re-render only, so a seek while stopped moves a custom
  // playhead: the position below comes from the ref.
  useCurrentTime();

  return renderPlayhead({
    position: ((currentTimeRef.current ?? 0) * sampleRate) / samplesPerPixel,
    color,
    isPlaying,
    currentTimeRef,
    playbackStartTimeRef: ZERO_REF,
    audioStartPositionRef: ZERO_REF,
    samplesPerPixel,
    sampleRate,
    controlsOffset: 0,
  }) as React.ReactElement;
};

/**
 * The highlighted selection range. The only part of the playlist that follows
 * the selection, so a drag renders this and not the waveform (#769). Memoized:
 * a render of the playlist around it (play, pause, a seek) is not its concern.
 */
const MediaElementSelectionOverlay = React.memo(function MediaElementSelectionOverlay({
  color,
}: {
  color: string;
}) {
  const { selectionStart, selectionEnd } = useSelection();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

  if (selectionStart === selectionEnd) return null;

  return (
    <Selection
      startPosition={(Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel}
      endPosition={(Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel}
      color={color}
    />
  );
});

export interface MediaElementPlaylistProps {
  /** Custom function to generate the label shown on annotation boxes */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  /** Whether annotation boundaries can be edited by dragging. Defaults to false. */
  editable?: boolean;
  /** Whether dragging one annotation boundary also moves the adjacent annotation's boundary. Defaults to false. */
  linkEndpoints?: boolean;
  /**
   * Callback when annotations are updated (e.g., boundaries dragged).
   * Called with the full updated annotations array.
   */
  onAnnotationUpdate?: OnAnnotationUpdateFn;
  /** Custom playhead render function. Receives position, color, and animation refs for smooth 60fps animation. */
  renderPlayhead?: RenderPlayheadFunction;
  /** Show fade in/out overlays on the waveform. Defaults to false. */
  showFades?: boolean;
  className?: string;
}

/**
 * Standalone waveform + annotation boxes component for MediaElementPlaylistProvider.
 *
 * Renders the waveform visualization, annotation boxes, selection, and playhead.
 * Does NOT render the annotation text list — use `MediaElementAnnotationList` for that.
 *
 * Must be used inside a `MediaElementPlaylistProvider`.
 *
 * This component can be placed independently in consumer layouts, allowing the
 * waveform and annotation list to be positioned separately (e.g., in different
 * panels or with custom elements between them).
 */
export const MediaElementPlaylist: React.FC<MediaElementPlaylistProps> = ({
  getAnnotationBoxLabel,
  editable = false,
  linkEndpoints: linkEndpointsProp = false,
  onAnnotationUpdate,
  renderPlayhead,
  showFades = false,
  className,
}) => {
  const theme = useTheme() as import('@waveform-playlist/ui-components').WaveformPlaylistTheme;

  // Not the resting cursor position (`useCurrentTime()`): the playhead and the
  // progress overlay follow that themselves, so a seek or a leftward selection
  // drag does not render the waveform (#688).
  const { isPlaying } = useIsPlaying();
  // No annotation state here: it changes at every annotation boundary during
  // playback, and only MediaElementAnnotationBoxes needs it (#744).
  const { setScrollContainer, setSelection } = usePlaybackControls();
  const { duration, peaksDataArray, fadeIn, fadeOut } = useMediaElementTrack();
  const { sampleRate, waveHeight, timeScaleHeight, controls, barWidth, barGap, roundedBars } =
    usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

  // The selection is the provider's (#769); this component only writes it,
  // and MediaElementSelectionOverlay reads it.
  const [isSelecting, setIsSelecting] = useState(false);

  // Local ref for scroll container - also register with context for auto-scroll
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Callback to register scroll container with context
  const handleScrollContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      scrollContainerRef.current = el;
      setScrollContainer(el);
    },
    [setScrollContainer]
  );

  // Calculate dimensions
  const tracksFullWidth = Math.floor((duration * sampleRate) / samplesPerPixel);

  // Mouse handlers for click-to-seek
  const mouseDownTimeRef = useRef<number>(0);
  // The element the drag began on (the click overlay), for pointer positions
  // while the pointer is somewhere else.
  const dragElementRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Primary button only: a right-click opens the context menu and its
      // release may never be delivered.
      if (e.button !== 0) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickTime = (x * samplesPerPixel) / sampleRate;

      mouseDownTimeRef.current = clickTime;
      dragElementRef.current = e.currentTarget;
      setIsSelecting(true);
      setSelection(clickTime, clickTime);
    },
    [samplesPerPixel, sampleRate, setSelection]
  );

  // The drag is followed on the window, not on the overlay: the pointer may
  // leave the waveform (a fast drag past either end, or drifting above or
  // below it, which is easy on a single short track) and the button may be
  // released anywhere. Positions outside the overlay clamp to its ends.
  const dragTimeAt = (clientX: number): number | null => {
    const element = dragElementRef.current;
    const x = element ? clampedOffsetX(element, clientX) : null;
    return x === null ? null : (x * samplesPerPixel) / sampleRate;
  };

  const handleDragMove = (e: MouseEvent) => {
    // During playback the press was a seek; a range is not drawn over it.
    if (isPlaying) return;
    const moveTime = dragTimeAt(e.clientX);
    if (moveTime === null) return;
    // From where the press landed to the pointer, in order: the cursor
    // follows the start of the selection.
    const anchor = mouseDownTimeRef.current;
    setSelection(Math.min(anchor, moveTime), Math.max(anchor, moveTime));
  };

  const handleDragEnd = (e: MouseEvent | null) => {
    setIsSelecting(false);

    // The window lost focus mid-drag: there is no release position. Keep the
    // selection as the last move left it.
    if (e === null) return;

    // During playback the press was the seek (`setSelection` restarts a
    // running play at a collapsed selection) and moves were ignored: there is
    // nothing left to do, and the release position must not be used anyway
    // (auto-scroll shifts the overlay between the press and the release).
    if (isPlaying) return;

    const endTime = dragTimeAt(e.clientX);
    if (endTime === null) return;

    const anchor = mouseDownTimeRef.current;
    const start = Math.min(anchor, endTime);
    const end = Math.max(anchor, endTime);

    // If it's just a click (not a drag), seek to that position
    if (Math.abs(end - start) < 0.1) {
      setSelection(start, start);
    } else {
      // It was a drag - finalize the selection
      setSelection(start, end);
    }
  };

  useWindowDrag(isSelecting, handleDragMove, handleDragEnd);

  // Every Track, channel and the timescale read this context: a new object per render
  // of this component would re-render them all.
  const playlistInfo = useMemo(
    () => ({
      samplesPerPixel,
      sampleRate,
      zoomLevels: [samplesPerPixel],
      waveHeight,
      timeScaleHeight,
      controls,
      barWidth,
      barGap,
      roundedBars,
    }),
    [
      samplesPerPixel,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      controls,
      barWidth,
      barGap,
      roundedBars,
    ]
  );

  // Show loading if peaks not ready
  if (peaksDataArray.length === 0) {
    return <div className={className}>Loading waveform...</div>;
  }

  return (
    <DevicePixelRatioProvider>
      <PlaylistInfoContext.Provider value={playlistInfo}>
        <Playlist
          theme={theme}
          backgroundColor={waveformColorToCss(theme.waveOutlineColor)}
          timescaleBackgroundColor={theme.timescaleBackgroundColor}
          timescaleWidth={tracksFullWidth}
          tracksWidth={tracksFullWidth}
          controlsWidth={controls.show ? controls.width : 0}
          onTracksMouseDown={handleMouseDown}
          scrollContainerRef={handleScrollContainerRef}
          isSelecting={isSelecting}
          timescale={timeScaleHeight > 0 ? <SmartScale durationMs={duration * 1000} /> : undefined}
        >
          <>
            {peaksDataArray.map((trackClipPeaks, trackIndex) => {
              // For MediaElement, we have a single track with a single clip
              const maxChannels =
                trackClipPeaks.length > 0
                  ? Math.max(...trackClipPeaks.map((clip) => clip.peaks.data.length))
                  : 1;

              return (
                <TrackComponent
                  key={trackIndex}
                  numChannels={maxChannels}
                  backgroundColor={waveformColorToCss(theme.waveOutlineColor)}
                  offset={0}
                  width={tracksFullWidth}
                  hasClipHeaders={false}
                  trackId={`media-element-track-${trackIndex}`}
                  isSelected={true}
                >
                  {trackClipPeaks.map((clip, clipIndex) => {
                    const peaksData = clip.peaks;
                    const width = peaksData.length;

                    return (
                      <Clip
                        key={`${trackIndex}-${clipIndex}`}
                        clipId={clip.clipId}
                        trackIndex={trackIndex}
                        clipIndex={clipIndex}
                        trackName={clip.trackName}
                        startSample={clip.startSample}
                        durationSamples={clip.durationSamples}
                        samplesPerPixel={samplesPerPixel}
                        showHeader={false}
                        disableHeaderDrag={true}
                        isSelected={true}
                        trackId={`media-element-track-${trackIndex}`}
                      >
                        {peaksData.data.map((channelPeaks: Peaks, channelIndex: number) => (
                          <ChannelWithMediaElementProgress
                            key={`${trackIndex}-${clipIndex}-${channelIndex}`}
                            index={channelIndex}
                            data={channelPeaks}
                            bits={peaksData.bits}
                            length={width}
                            clipStartSample={clip.startSample}
                            clipDurationSamples={clip.durationSamples}
                          />
                        ))}
                        {showFades && fadeIn && fadeIn.duration > 0 && (
                          <FadeOverlay
                            left={0}
                            width={Math.floor((fadeIn.duration * sampleRate) / samplesPerPixel)}
                            type="fadeIn"
                            curveType={fadeIn.type}
                          />
                        )}
                        {showFades && fadeOut && fadeOut.duration > 0 && (
                          <FadeOverlay
                            left={
                              width - Math.floor((fadeOut.duration * sampleRate) / samplesPerPixel)
                            }
                            width={Math.floor((fadeOut.duration * sampleRate) / samplesPerPixel)}
                            type="fadeOut"
                            curveType={fadeOut.type}
                          />
                        )}
                      </Clip>
                    );
                  })}
                </TrackComponent>
              );
            })}
            <MediaElementAnnotationBoxes
              width={tracksFullWidth}
              getAnnotationBoxLabel={getAnnotationBoxLabel}
              editable={editable}
              linkEndpoints={linkEndpointsProp}
              onAnnotationUpdate={onAnnotationUpdate}
            />
            <MediaElementSelectionOverlay color={theme.selectionColor} />
            {renderPlayhead ? (
              <CustomMediaElementPlayhead
                renderPlayhead={renderPlayhead}
                color={theme.playheadColor}
                samplesPerPixel={samplesPerPixel}
                sampleRate={sampleRate}
              />
            ) : (
              <AnimatedMediaElementPlayhead color={theme.playheadColor} />
            )}
          </>
        </Playlist>
      </PlaylistInfoContext.Provider>
    </DevicePixelRatioProvider>
  );
};
