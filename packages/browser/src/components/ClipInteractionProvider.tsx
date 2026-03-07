import React, { useEffect, useMemo } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import type { Modifiers } from '@dnd-kit/abstract';
import {
  samplesToTicks,
  ticksToSamples,
  snapToGrid,
  ticksPerBeat,
  ticksPerBar,
} from '@waveform-playlist/core';
import { useBeatsAndBars, getScaleInfo } from '@waveform-playlist/ui-components';

import { usePlaylistData, usePlaylistControls } from '../WaveformPlaylistContext';
import { useClipDragHandlers } from '../hooks/useClipDragHandlers';
import { useDragSensors } from '../hooks/useDragSensors';
import { ClipCollisionModifier } from '../modifiers/ClipCollisionModifier';
import { SnapToGridModifier } from '../modifiers/SnapToGridModifier';
import { noDropAnimationPlugins } from '../plugins/noDropAnimationPlugins';
import { ClipInteractionContextProvider } from '../contexts/ClipInteractionContext';

// Stable noop to avoid creating a new function reference on every render
const NOOP_TRACKS_CHANGE = () => {};

export interface ClipInteractionProviderProps {
  /** Enable snap-to-grid for clip moves and boundary trims. When true,
   *  auto-detects beats snapping from BeatsAndBarsProvider context
   *  (if present with scaleMode="beats" and snapTo!="off"), otherwise
   *  falls back to timescale-based snapping. Default: false. */
  snap?: boolean;
  touchOptimized?: boolean;
  children: React.ReactNode;
}

export const ClipInteractionProvider: React.FC<ClipInteractionProviderProps> = ({
  snap = false,
  touchOptimized = false,
  children,
}) => {
  const { tracks, samplesPerPixel, sampleRate, playoutRef, isDraggingRef, onTracksChange } =
    usePlaylistData();
  const { setSelectedTrackId } = usePlaylistControls();
  const beatsAndBars = useBeatsAndBars();

  // Derive snap mode from context: beats if provider is in beats mode with snap enabled,
  // timescale otherwise, off when snap prop is false.
  const useBeatsSnap =
    snap &&
    beatsAndBars != null &&
    beatsAndBars.scaleMode === 'beats' &&
    beatsAndBars.snapTo !== 'off';
  const useTimescaleSnap = snap && !useBeatsSnap;

  // Warn once if onTracksChange is missing — drag/trim edits will be lost
  useEffect(() => {
    if (onTracksChange == null) {
      console.warn(
        '[waveform-playlist] ClipInteractionProvider: onTracksChange is not set on ' +
          'WaveformPlaylistProvider. Drag and trim edits will not be persisted.'
      );
    }
  }, [onTracksChange]);

  // Build snapSamplePosition for boundary trim snapping
  const snapSamplePosition = useMemo(() => {
    if (useBeatsSnap && beatsAndBars) {
      const { bpm, timeSignature, snapTo } = beatsAndBars;
      const gridTicks = snapTo === 'bar' ? ticksPerBar(timeSignature) : ticksPerBeat(timeSignature);
      return (samplePos: number) => {
        const ticks = samplesToTicks(samplePos, bpm, sampleRate);
        const snapped = snapToGrid(ticks, gridTicks);
        return ticksToSamples(snapped, bpm, sampleRate);
      };
    }
    if (useTimescaleSnap) {
      const gridSamples = Math.round((getScaleInfo(samplesPerPixel).smallStep / 1000) * sampleRate);
      return (samplePos: number) => Math.round(samplePos / gridSamples) * gridSamples;
    }
    return undefined;
  }, [useBeatsSnap, useTimescaleSnap, beatsAndBars, sampleRate, samplesPerPixel]);

  // Sensors
  const sensors = useDragSensors({ touchOptimized });

  // Drag handlers
  const {
    onDragStart: handleDragStart,
    onDragMove,
    onDragEnd,
  } = useClipDragHandlers({
    tracks,
    onTracksChange: onTracksChange ?? NOOP_TRACKS_CHANGE,
    samplesPerPixel,
    sampleRate,
    engineRef: playoutRef,
    isDraggingRef,
    snapSamplePosition,
  });

  // Wrap onDragStart to auto-select track
  const onDragStart = React.useCallback(
    (event: Parameters<typeof handleDragStart>[0]) => {
      const trackIndex = event.operation?.source?.data?.trackIndex as number | undefined;
      if (trackIndex !== undefined && tracks[trackIndex]) {
        setSelectedTrackId(tracks[trackIndex].id);
      }
      handleDragStart(event);
    },
    [handleDragStart, tracks, setSelectedTrackId]
  );

  // Build modifiers array
  const modifiers = useMemo(() => {
    const mods: Modifiers = [RestrictToHorizontalAxis];

    if (useBeatsSnap && beatsAndBars) {
      mods.push(
        SnapToGridModifier.configure({
          mode: 'beats',
          snapTo: beatsAndBars.snapTo,
          bpm: beatsAndBars.bpm,
          timeSignature: beatsAndBars.timeSignature,
          samplesPerPixel,
          sampleRate,
        })
      );
    } else if (useTimescaleSnap) {
      mods.push(
        SnapToGridModifier.configure({
          mode: 'timescale',
          gridSamples: Math.round((getScaleInfo(samplesPerPixel).smallStep / 1000) * sampleRate),
          samplesPerPixel,
        })
      );
    }

    mods.push(ClipCollisionModifier.configure({ tracks, samplesPerPixel }));
    return mods;
  }, [useBeatsSnap, useTimescaleSnap, beatsAndBars, tracks, samplesPerPixel, sampleRate]);

  return (
    <ClipInteractionContextProvider value={true}>
      <DragDropProvider
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        modifiers={modifiers}
        plugins={noDropAnimationPlugins}
      >
        {children}
      </DragDropProvider>
    </ClipInteractionContextProvider>
  );
};
