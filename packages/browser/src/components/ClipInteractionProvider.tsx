import React, { useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
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
  useEditorControls,
} from '../contexts/playlistContexts';
import { useClipDragHandlers } from '../hooks/useClipDragHandlers';
import { useDragSensors } from '../hooks/useDragSensors';
import { ClipCollisionModifier } from '../modifiers/ClipCollisionModifier';
import { SnapToGridModifier } from '../modifiers/SnapToGridModifier';
import { ClipInteractionOptions, useClipInteraction } from '../contexts/ClipInteractionContext';

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
  const { tracks } = usePlaylistTimeline();
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

  // The modifiers and the track selection on drag start read the loaded
  // tracks through this ref, so their identity does not change when tracks
  // do: keyed on tracks, the modifiers array handed to DragDropProvider would
  // be rebuilt by any clip operation, also one that lands mid-drag.
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
  } = useClipDragHandlers({ samplesPerPixel, snapSamplePosition });

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
        const sortable = (
          event.operation.source as unknown as {
            sortable?: { index: number; initialIndex: number };
          }
        ).sortable;
        const trackId = data.trackId;
        const moves =
          !event.canceled && trackId && sortable && sortable.index !== sortable.initialIndex;
        // ONE commit for the three: the reorder, the cleared preview and the
        // epoch. dnd-kit calls this inside `startTransition`, where the two
        // state updates would wait as transition updates while the reorder
        // (the arrangement, read with `useSyncExternalStore`) renders at
        // once: React would first move the slots under their old keys, which
        // is what the epoch is there to avoid, and remount them a commit
        // later. `flushSync` renders all three together.
        flushSync(() => {
          // Unconditional, regardless of canceled/committed: @dnd-kit/react's
          // sortable plugins can splice React-owned DOM nodes (Feedback's
          // placeholder, OptimisticSortingPlugin's reorder()) during the drag
          // that just ended, desyncing React's fiber tree from the true DOM.
          // Bumping this forces the view's track-controls part to remount the
          // track-controls slots, healing the corruption before the next
          // reorder (drag or button) needs to touch the DOM. See
          // bumpTrackReorderEpoch's doc comment in WaveformPlaylistContext.
          bumpTrackReorderEpoch();
          // The columns go straight from the previewed layout to the
          // committed one, with no frame in between.
          setTrackDragPreview(null);
          if (moves) reorderTrack(trackId, sortable.index);
        });
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
