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
  const { setSelectedTrackId, reorderTrack, bumpTrackReorderEpoch } = usePlaylistControls();
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
    engineRef: playoutRef,
    isDraggingRef,
    snapSamplePosition,
  });

  // Wrap onDragStart to auto-select track
  const onDragStart = React.useCallback(
    (event: Parameters<typeof handleDragStart>[0]) => {
      const data = event.operation?.source?.data as
        | { kind?: string; trackId?: string; trackIndex?: number }
        | undefined;
      if (data?.kind === 'track-reorder') {
        if (data.trackId) setSelectedTrackId(data.trackId);
        return; // clip handler guards also skip this kind
      }
      const trackIndex = data?.trackIndex;
      if (trackIndex !== undefined && tracks[trackIndex]) {
        setSelectedTrackId(tracks[trackIndex].id);
      }
      handleDragStart(event);
    },
    [handleDragStart, tracks, setSelectedTrackId]
  );

  // Wrap onDragEnd: track-reorder sources commit via reorderTrack, clip sources
  // flow through to the existing move/trim handler unchanged.
  const handleDragEnd = React.useCallback(
    (event: Parameters<typeof onDragEnd>[0]) => {
      const data = event.operation.source?.data as { kind?: string; trackId?: string } | undefined;
      if (data?.kind === 'track-reorder') {
        // Unconditional, regardless of canceled/committed: @dnd-kit/react's
        // sortable plugins can splice React-owned DOM nodes (Feedback's
        // placeholder, OptimisticSortingPlugin's reorder()) during the drag
        // that just ended, desyncing React's fiber tree from the true DOM.
        // Bumping this forces PlaylistVisualization to remount the
        // track-controls slots, healing the corruption before the next
        // reorder (drag or button) needs to touch the DOM. See
        // bumpTrackReorderEpoch's doc comment in WaveformPlaylistContext.
        bumpTrackReorderEpoch();
        if (event.canceled || !data.trackId) return;
        const sortable = (
          event.operation.source as unknown as {
            sortable?: { index: number; initialIndex: number };
          }
        ).sortable;
        if (sortable && sortable.index !== sortable.initialIndex) {
          reorderTrack(data.trackId, sortable.index);
        }
        return;
      }
      onDragEnd(event);
    },
    [onDragEnd, reorderTrack, bumpTrackReorderEpoch]
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
        onDragEnd={handleDragEnd}
        modifiers={modifiers}
        plugins={noDropAnimationPlugins}
      >
        {children}
      </DragDropProvider>
    </ClipInteractionContextProvider>
  );
};
