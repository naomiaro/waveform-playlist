import React, { useContext, useRef, useState, useCallback } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
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
import { AnnotationIntegrationContext } from '../AnnotationIntegrationContext';
import type { Peaks } from '@waveform-playlist/core';
import {
  useMediaElementAnimation,
  useMediaElementState,
  useMediaElementControls,
  useMediaElementData,
} from '../MediaElementPlaylistContext';
import { useAnnotationDragHandlers } from '../hooks/useAnnotationDragHandlers';
import { noDropAnimationPlugins } from '../plugins/noDropAnimationPlugins';
import { AnimatedMediaElementPlayhead } from './AnimatedMediaElementPlayhead';
import { ChannelWithMediaElementProgress } from './ChannelWithMediaElementProgress';
import type {
  AnnotationData,
  GetAnnotationBoxLabelFn,
  OnAnnotationUpdateFn,
} from '../types/annotations';

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
  const { isPlaying, currentTimeRef } = useMediaElementAnimation();

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

  // MediaElement context hooks
  const { isPlaying } = useMediaElementAnimation();
  const { annotations, activeAnnotationId } = useMediaElementState();
  const annotationIntegration = useContext(AnnotationIntegrationContext);
  const { play, seekTo, setActiveAnnotationId, setAnnotations, setScrollContainer } =
    useMediaElementControls();
  const {
    duration,
    peaksDataArray,
    sampleRate,
    waveHeight,
    timeScaleHeight,
    samplesPerPixel,
    controls,
    playoutRef,
    barWidth,
    barGap,
    fadeIn,
    fadeOut,
  } = useMediaElementData();

  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
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

  // Annotation click handler
  const handleAnnotationClick = useCallback(
    async (annotation: AnnotationData) => {
      setActiveAnnotationId(annotation.id);
      try {
        await play(annotation.start);
      } catch (err) {
        console.error(
          'waveform-playlist: Failed to start playback for annotation',
          annotation.id,
          err
        );
      }
    },
    [setActiveAnnotationId, play]
  );

  // Handle annotation boundary updates
  const handleAnnotationUpdate = useCallback(
    (updatedAnnotations: AnnotationData[]) => {
      setAnnotations(updatedAnnotations);
      onAnnotationUpdate?.(updatedAnnotations);
    },
    [setAnnotations, onAnnotationUpdate]
  );

  // Drag handlers for annotation boundary editing
  const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
    annotations,
    onAnnotationsChange: handleAnnotationUpdate,
    samplesPerPixel,
    sampleRate,
    duration,
    linkEndpoints: linkEndpointsProp,
  });

  // Mouse handlers for click-to-seek
  const mouseDownTimeRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickTime = (x * samplesPerPixel) / sampleRate;

      mouseDownTimeRef.current = clickTime;
      setIsSelecting(true);
      setSelectionStart(clickTime);
      setSelectionEnd(clickTime);
    },
    [samplesPerPixel, sampleRate]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSelecting) return;

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const moveTime = (x * samplesPerPixel) / sampleRate;

      setSelectionEnd(moveTime);
    },
    [isSelecting, samplesPerPixel, sampleRate]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSelecting) return;

      setIsSelecting(false);

      // During playback, use the time captured at mouseDown — auto-scroll shifts the
      // overlay between mouseDown and mouseUp, so recomputing from getBoundingClientRect()
      // would produce a wrong (shifted) position.
      if (isPlaying && playoutRef.current) {
        const clickTime = Math.max(0, mouseDownTimeRef.current);
        seekTo(clickTime);
        setSelectionStart(clickTime);
        setSelectionEnd(clickTime);
        playoutRef.current.stop();
        play(clickTime);
        return;
      }

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const endTime = (x * samplesPerPixel) / sampleRate;

      const start = Math.min(selectionStart, endTime);
      const end = Math.max(selectionStart, endTime);

      // If it's just a click (not a drag), seek to that position
      if (Math.abs(end - start) < 0.1) {
        seekTo(start);
        setSelectionStart(start);
        setSelectionEnd(start);
      } else {
        // It was a drag - finalize the selection
        setSelectionStart(start);
        setSelectionEnd(end);
      }
    },
    [isSelecting, selectionStart, samplesPerPixel, sampleRate, seekTo, isPlaying, playoutRef, play]
  );

  // Show loading if peaks not ready
  if (peaksDataArray.length === 0) {
    return <div className={className}>Loading waveform...</div>;
  }

  return (
    <DevicePixelRatioProvider>
      <PlaylistInfoContext.Provider
        value={{
          samplesPerPixel,
          sampleRate,
          zoomLevels: [samplesPerPixel],
          waveHeight,
          timeScaleHeight,
          duration: duration * 1000,
          controls,
          barWidth,
          barGap,
        }}
      >
        <Playlist
          theme={theme}
          backgroundColor={waveformColorToCss(theme.waveOutlineColor)}
          timescaleBackgroundColor={theme.timescaleBackgroundColor}
          timescaleWidth={tracksFullWidth}
          tracksWidth={tracksFullWidth}
          controlsWidth={controls.show ? controls.width : 0}
          onTracksMouseDown={handleMouseDown}
          onTracksMouseMove={handleMouseMove}
          onTracksMouseUp={handleMouseUp}
          scrollContainerRef={handleScrollContainerRef}
          isSelecting={isSelecting}
          timescale={timeScaleHeight > 0 ? <SmartScale /> : undefined}
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
            {annotations.length > 0 && annotationIntegration && (
              <DragDropProvider
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                modifiers={editable ? [RestrictToHorizontalAxis] : []}
                plugins={noDropAnimationPlugins}
              >
                <annotationIntegration.AnnotationBoxesWrapper height={30} width={tracksFullWidth}>
                  {annotations.map((annotation, index) => {
                    const startPosition = (annotation.start * sampleRate) / samplesPerPixel;
                    const endPosition = (annotation.end * sampleRate) / samplesPerPixel;
                    const label = getAnnotationBoxLabel
                      ? getAnnotationBoxLabel(annotation, index)
                      : annotation.id;
                    return (
                      <annotationIntegration.AnnotationBox
                        key={annotation.id}
                        annotationId={annotation.id}
                        annotationIndex={index}
                        startPosition={startPosition}
                        endPosition={endPosition}
                        label={label}
                        color="#ff9800"
                        isActive={annotation.id === activeAnnotationId}
                        onClick={() => handleAnnotationClick(annotation)}
                        editable={editable}
                      />
                    );
                  })}
                </annotationIntegration.AnnotationBoxesWrapper>
              </DragDropProvider>
            )}
            {selectionStart !== selectionEnd && (
              <Selection
                startPosition={
                  (Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel
                }
                endPosition={
                  (Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel
                }
                color={theme.selectionColor}
              />
            )}
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
