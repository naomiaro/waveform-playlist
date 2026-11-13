import React, { useRef, useCallback, useMemo } from 'react';
import {
  Playlist,
  Track as TrackComponent,
  Clip,
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
  usePlaybackControls,
  usePlaylistView,
  usePlaylistZoom,
  useMediaElementTrack,
} from '../contexts/playlistContexts';
import {
  useSelectionDrag,
  AutomaticScrollFlag,
  SelectionPreviewContext,
} from '../hooks/useSelectionDrag';
import { MediaElementAnnotationBoxes } from './MediaElementAnnotationBoxes';
import { ChannelWithProgress } from './ChannelWithProgress';
import { SelectionOverlay, PlayheadOverlay } from './VisualizationOverlays';
import type { GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';

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

  // No annotation state here: it changes at every annotation boundary during
  // playback, and only MediaElementAnnotationBoxes needs it (#744).
  const { setScrollContainer, setSelection } = usePlaybackControls();
  const { duration, peaksDataArray, fadeIn, fadeOut } = useMediaElementTrack();
  const { sampleRate, waveHeight, timeScaleHeight, controls, barWidth, barGap, roundedBars } =
    usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

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

  // The selection drag (shared with the multitrack view). A click while
  // stopped collapses the selection at its time, which moves the cursor.
  // Through it this view follows `isPlaying`, and not the resting cursor or
  // the selection: the playhead, the progress overlay and the selection
  // overlay follow those themselves, so a seek or a selection drag does not
  // render the waveform (#688).
  const {
    isSelecting,
    handleMouseDown,
    preview: selectionPreview,
    automaticScrollRef,
  } = useSelectionDrag({
    samplesPerPixel,
    sampleRate,
    onClickWhileStopped: (time) => setSelection(time, time),
  });

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
      <AutomaticScrollFlag flagRef={automaticScrollRef} />
      <PlaylistInfoContext.Provider value={playlistInfo}>
        <SelectionPreviewContext.Provider value={selectionPreview}>
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
            timescale={
              timeScaleHeight > 0 ? <SmartScale durationMs={duration * 1000} /> : undefined
            }
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
                            <ChannelWithProgress
                              key={`${trackIndex}-${clipIndex}-${channelIndex}`}
                              index={channelIndex}
                              data={channelPeaks}
                              bits={peaksData.bits}
                              length={width}
                              isSelected
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
                                width -
                                Math.floor((fadeOut.duration * sampleRate) / samplesPerPixel)
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
              <SelectionOverlay />
              <PlayheadOverlay renderPlayhead={renderPlayhead} />
            </>
          </Playlist>
        </SelectionPreviewContext.Provider>
      </PlaylistInfoContext.Provider>
    </DevicePixelRatioProvider>
  );
};
