import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

import {
  usePlaylistView,
  usePlaylistZoom,
  usePlaylistTimeline,
  useEngineRefs,
  useEditorControls,
} from '../contexts/playlistContexts';
import { useClipDragHandlers } from '../hooks/useClipDragHandlers';
import { useDragSensors } from '../hooks/useDragSensors';
import { ClipCollisionModifier } from '../modifiers/ClipCollisionModifier';
import { SnapToGridModifier } from '../modifiers/SnapToGridModifier';
import { ClipInteractionOptions, useClipInteraction } from '../contexts/ClipInteractionContext';

// Stable noop to avoid creating a new function reference on every render
const NOOP_TRACKS_CHANGE = () => {};

export interface ClipInteractionProviderProps {
  /** Enable snap-to-grid for clip moves and boundary trims. When true,
   *  auto-detects beats snapping from BeatsAndBarsProvider context
   *  (if present with scaleMode="beats" and snapTo!="off"), otherwise
   *  falls back to timescale-based snapping. Default: false. */
  snap?: boolean;
  /** Touch-friendly interaction: drag sensors that wait 250ms on touch (so a
   *  swipe still scrolls) and wider clip trim handles. Left out: inherited from
   *  a `ClipInteractionOptions` or `ClipInteractionProvider` above (false at
   *  the top). */
  touchOptimized?: boolean;
  children: React.ReactNode;
}

export const ClipInteractionProvider: React.FC<ClipInteractionProviderProps> = ({
  snap = false,
  touchOptimized: touchOptimizedProp,
  children,
}) => {
  // One value for the sensors and for the handles (which `ClipInteractionOptions`
  // below resolves the same way): the prop, else what is set above.
  const inherited = useClipInteraction();
  const touchOptimized = touchOptimizedProp ?? inherited.touchOptimized;
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const { tracks, onTracksChange } = usePlaylistTimeline();
  const { playoutRef, isDraggingRef } = useEngineRefs();
  const { setSelectedTrackId, reorderTrack, bumpTrackReorderEpoch, setTrackDragPreview } =
    useEditorControls();
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

  // Handlers and modifiers read tracks through this ref, so their identity does
  // not change when tracks do. A boundary trim replaces tracks on every pointer
  // move; keyed on tracks, the handlers and the modifiers array handed to
  // DragDropProvider were rebuilt mid-drag.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const getTracks = useCallback(() => tracksRef.current, []);

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

  // True from the start of a track-reorder drag to its end. dnd-kit can send
  // one more dragover AFTER the dragend of a canceled drag (the sorting
  // plugin putting the item back): seen with Escape mid-drag once the slot's
  // element was registered from the reorder handle's effect (#687), where it
  // set the preview again for good. A preview without a drag is never wanted.
  const trackReorderDragActiveRef = React.useRef(false);

  // Wrap onDragStart to auto-select track
  const onDragStart = React.useCallback(
    (event: Parameters<typeof handleDragStart>[0]) => {
      const data = event.operation?.source?.data as
        | { kind?: string; trackId?: string; trackIndex?: number }
        | undefined;
      if (data?.kind === 'track-reorder') {
        trackReorderDragActiveRef.current = true;
        if (data.trackId) setSelectedTrackId(data.trackId);
        return; // clip handler guards also skip this kind
      }
      const trackIndex = data?.trackIndex;
      const track = trackIndex !== undefined ? tracksRef.current[trackIndex] : undefined;
      if (track) {
        setSelectedTrackId(track.id);
      }
      handleDragStart(event);
    },
    [handleDragStart, setSelectedTrackId]
  );

  // Publish the live track-reorder preview. dnd-kit fires dragover on every
  // collision change; OptimisticSortingPlugin has already updated
  // source.sortable.index by then. Functional set with an equality guard so
  // repeated dragovers at the same index don't re-render the playlist.
  const handleDragOver = React.useCallback(
    (event: { operation: { source?: { data?: unknown } | null } }) => {
      const data = event.operation.source?.data as { kind?: string; trackId?: string } | undefined;
      if (data?.kind !== 'track-reorder' || !data.trackId) return;
      if (!trackReorderDragActiveRef.current) return;
      const sortable = (
        event.operation.source as unknown as {
          sortable?: { index: number; initialIndex: number };
        }
      ).sortable;
      if (!sortable) return;
      const trackId = data.trackId;
      const toIndex = sortable.index;
      setTrackDragPreview((prev) =>
        prev && prev.trackId === trackId && prev.toIndex === toIndex ? prev : { trackId, toIndex }
      );
    },
    [setTrackDragPreview]
  );

  // Wrap onDragEnd: track-reorder sources commit via reorderTrack, clip sources
  // flow through to the existing move/trim handler unchanged.
  const handleDragEnd = React.useCallback(
    (event: Parameters<typeof onDragEnd>[0]) => {
      const data = event.operation.source?.data as { kind?: string; trackId?: string } | undefined;
      if (data?.kind === 'track-reorder') {
        trackReorderDragActiveRef.current = false;
        // Unconditional, regardless of canceled/committed: @dnd-kit/react's
        // sortable plugins can splice React-owned DOM nodes (Feedback's
        // placeholder, OptimisticSortingPlugin's reorder()) during the drag
        // that just ended, desyncing React's fiber tree from the true DOM.
        // Bumping this forces the view's track-controls part to remount the
        // track-controls slots, healing the corruption before the next
        // reorder (drag or button) needs to touch the DOM. See
        // bumpTrackReorderEpoch's doc comment in WaveformPlaylistContext.
        bumpTrackReorderEpoch();
        // Clear the preview in the same handler that commits: React batches this
        // with reorderTrack's state updates, so the columns go straight from
        // previewed layout to committed layout with no intermediate frame.
        setTrackDragPreview(null);
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
    [onDragEnd, reorderTrack, bumpTrackReorderEpoch, setTrackDragPreview]
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

    mods.push(ClipCollisionModifier.configure({ tracks: getTracks, samplesPerPixel }));
    return mods;
  }, [useBeatsSnap, useTimescaleSnap, beatsAndBars, getTracks, samplesPerPixel, sampleRate]);

  return (
    <ClipInteractionOptions enabled touchOptimized={touchOptimized}>
      <DragDropProvider
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        modifiers={modifiers}
      >
        {children}
      </DragDropProvider>
    </ClipInteractionOptions>
  );
};
