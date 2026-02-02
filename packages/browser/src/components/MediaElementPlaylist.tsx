import React, { useContext, useRef, useState, useCallback } from 'react';
import { DndContext } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  Playlist,
  Track as TrackComponent,
  Clip,
  Selection,
  PlaylistInfoContext,
  TrackControlsContext,
  DevicePixelRatioProvider,
  SmartScale,
  useTheme,
  waveformColorToCss,
} from '@waveform-playlist/ui-components';
import { AnnotationIntegrationContext } from '../AnnotationIntegrationContext';
import type { Peaks } from '@waveform-playlist/webaudio-peaks';
import {
  useMediaElementAnimation,
  useMediaElementState,
  useMediaElementControls,
  useMediaElementData,
} from '../MediaElementPlaylistContext';
import { useAnnotationDragHandlers } from '../hooks/useAnnotationDragHandlers';
import { AnimatedMediaElementPlayhead } from './AnimatedMediaElementPlayhead';
import { ChannelWithMediaElementProgress } from './ChannelWithMediaElementProgress';
import type { AnnotationData, GetAnnotationBoxLabelFn, OnAnnotationUpdateFn } from '../types/annotations';

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
  className,
}) => {
  const theme = useTheme() as import('@waveform-playlist/ui-components').WaveformPlaylistTheme;

  // MediaElement context hooks
  const { isPlaying, currentTimeRef } = useMediaElementAnimation();
  const { annotations, activeAnnotationId } = useMediaElementState();
  const annotationIntegration = useContext(AnnotationIntegrationContext);
  const { play, seekTo, setActiveAnnotationId, setAnnotations, setScrollContainer } = useMediaElementControls();
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
  } = useMediaElementData();

  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);

  // Local ref for scroll container - also register with context for auto-scroll
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Callback to register scroll container with context
  const handleScrollContainerRef = useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    setScrollContainer(el);
  }, [setScrollContainer]);

  // Calculate dimensions
  const tracksFullWidth = Math.floor((duration * sampleRate) / samplesPerPixel);

  // Annotation click handler
  const handleAnnotationClick = useCallback(async (annotation: AnnotationData) => {
    setActiveAnnotationId(annotation.id);
    try {
      await play(annotation.start);
    } catch (err) {
      console.error('waveform-playlist: Failed to start playback for annotation', annotation.id, err);
    }
  }, [setActiveAnnotationId, play]);

  // Handle annotation boundary updates
  const handleAnnotationUpdate = useCallback((updatedAnnotations: AnnotationData[]) => {
    setAnnotations(updatedAnnotations);
    onAnnotationUpdate?.(updatedAnnotations);
  }, [setAnnotations, onAnnotationUpdate]);

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
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const clickTime = (x * samplesPerPixel) / sampleRate;

    setIsSelecting(true);
    setSelectionStart(clickTime);
    setSelectionEnd(clickTime);
  }, [controls, samplesPerPixel, sampleRate]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const moveTime = (x * samplesPerPixel) / sampleRate;

    setSelectionEnd(moveTime);
  }, [isSelecting, controls, samplesPerPixel, sampleRate]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    setIsSelecting(false);

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const endTime = (x * samplesPerPixel) / sampleRate;

    const start = Math.min(selectionStart, endTime);
    const end = Math.max(selectionStart, endTime);

    // If it's just a click (not a drag), seek to that position
    if (Math.abs(end - start) < 0.1) {
      seekTo(start);
      setSelectionStart(start);
      setSelectionEnd(start);

      if (isPlaying && playoutRef.current) {
        playoutRef.current.stop();
        play(start);
      }
    } else {
      // It was a drag - finalize the selection
      setSelectionStart(start);
      setSelectionEnd(end);
    }
  }, [isSelecting, selectionStart, samplesPerPixel, sampleRate, controls, seekTo, isPlaying, playoutRef, play]);

  // Show loading if peaks not ready
  if (peaksDataArray.length === 0) {
    return <div className={className}>Loading waveform...</div>;
  }

  // Empty track controls (MediaElement is single-track, no mute/solo needed)
  const emptyControls = null;

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
          scrollContainerWidth={tracksFullWidth + (controls.show ? controls.width : 0)}
          timescaleWidth={tracksFullWidth}
          tracksWidth={tracksFullWidth}
          controlsWidth={controls.show ? controls.width : 0}
          onTracksMouseDown={handleMouseDown}
          onTracksMouseMove={handleMouseMove}
          onTracksMouseUp={handleMouseUp}
          scrollContainerRef={handleScrollContainerRef}
          isSelecting={isSelecting}
          timescale={
            timeScaleHeight > 0 ? (
              <SmartScale />
            ) : undefined
          }
        >
          <>
            {peaksDataArray.map((trackClipPeaks, trackIndex) => {
              // For MediaElement, we have a single track with a single clip
              const maxChannels = trackClipPeaks.length > 0
                ? Math.max(...trackClipPeaks.map(clip => clip.peaks.data.length))
                : 1;

              return (
                <TrackControlsContext.Provider key={trackIndex} value={emptyControls}>
                  <TrackComponent
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
                        </Clip>
                      );
                    })}
                  </TrackComponent>
                </TrackControlsContext.Provider>
              );
            })}
            {annotations.length > 0 && annotationIntegration && (
              <DndContext
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                modifiers={editable ? [restrictToHorizontalAxis] : []}
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
              </DndContext>
            )}
            {selectionStart !== selectionEnd && (
              <Selection
                startPosition={
                  (Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel +
                  (controls.show ? controls.width : 0)
                }
                endPosition={
                  (Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel +
                  (controls.show ? controls.width : 0)
                }
                color={theme.selectionColor}
              />
            )}
            <AnimatedMediaElementPlayhead
              color={theme.playheadColor}
              controlsOffset={controls.show ? controls.width : 0}
            />
          </>
        </Playlist>
      </PlaylistInfoContext.Provider>
    </DevicePixelRatioProvider>
  );
};
