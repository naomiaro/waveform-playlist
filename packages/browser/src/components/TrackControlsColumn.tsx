import React, { use, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RenderMode, TrackKind } from '@waveform-playlist/core';
import { useTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { warnMisplacedPart } from './partWarnings';
import {
  usePlaylistMixer,
  useEditorControls,
  useSelectedTrackId,
  useTrackReorderPreview,
} from '../contexts/playlistContexts';
import { SpectrogramIntegrationContext } from '../SpectrogramIntegrationContext';
import { useWaveformRows, WaveformPartPlaceContext } from './waveformLayoutContext';
import { DefaultTrackControls } from './DefaultTrackControls';
import { ControlSlot, TracksLayout } from './visualizationLayout';
import { useStableTemplate } from '../utils/stableTemplate';
import {
  TrackContext,
  TrackControlsSharedContext,
  TrackSlotWiringContext,
  type TrackContextValue,
  type TrackControlsShared,
  type TrackSlotWiring,
} from './trackContext';

/** Width of the controls column when the part does not say. */
export const DEFAULT_TRACK_CONTROLS_WIDTH = 200;

export interface WaveformTrackControlsProps {
  /**
   * Width of the controls column in pixels. Default 200. The root reads it
   * from the element (the column is its own, beside the scrolling area), so it
   * must be on the part itself.
   */
  width?: number;
  /**
   * The control panel of a track, as a template: it is rendered once per
   * track, inside that track's context, which `useTrack()` and the built-in
   * pieces (`<TrackName />`, `<TrackMuteButton />`, …) read. Default:
   * `<DefaultTrackControls />`.
   */
  children?: ReactNode;
}

/** What the part renders for a track when it has no children. */
const DEFAULT_TEMPLATE = <DefaultTrackControls />;

/** Drop-shadow for the floating (fully opaque) drag-source controls row. */
const DRAG_SOURCE_SHADOW = '0 4px 12px rgba(0, 0, 0, 0.35)';

/** Fills the slot; the element a reorder drag moves. */
const SLOT_BODY_STYLE = { height: '100%' } as const;

interface TrackControlsSlotProps {
  trackId: string;
  index: number;
  kind: TrackKind;
  /** `undefined` while the track has no mixer state (it is loading). */
  name: string | undefined;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
  isLoading: boolean;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  renderMode: RenderMode;
  hasSpectrogram: boolean;
  height: number;
  top: number;
  animate: boolean;
  template: ReactNode;
}

/**
 * One track's slot in the controls column: the height-synced box, the track's
 * context around the template, and the click that selects the track.
 *
 * Memoized, and every prop is a primitive or the template: the column renders
 * on each mixer change (it reads the mixer state), and only the slot whose
 * track changed renders with it. The template is the same object for every
 * slot and across renders (see `useStableTemplate`), so inside a slot that
 * does render React skips every element of it and only the components that
 * read the track's context follow.
 */
function TrackControlsSlotImpl({
  trackId,
  index,
  kind,
  name,
  muted,
  soloed,
  volume,
  pan,
  isLoading,
  isSelected,
  isFirst,
  isLast,
  renderMode,
  hasSpectrogram,
  height,
  top,
  animate,
  template,
}: TrackControlsSlotProps) {
  const {
    setTrackMute,
    setTrackSolo,
    setTrackVolume,
    setTrackPan,
    reorderTrack,
    setSelectedTrackId,
  } = useEditorControls();
  const theme = useTheme() as WaveformPlaylistTheme;
  const shared = use(TrackControlsSharedContext);

  // The position is read when an action runs, so the actions do not change
  // with it.
  const indexRef = useRef(index);
  indexRef.current = index;

  const actions = useMemo(
    () => ({
      setMuted: (value: boolean) => setTrackMute(trackId, value),
      setSoloed: (value: boolean) => setTrackSolo(trackId, value),
      setVolume: (value: number) => setTrackVolume(trackId, value),
      setPan: (value: number) => setTrackPan(trackId, value),
      select: () => setSelectedTrackId(trackId),
      // The engine clamps the target and ignores a move to the same place.
      moveUp: () => reorderTrack(trackId, indexRef.current - 1),
      moveDown: () => reorderTrack(trackId, indexRef.current + 1),
      setRenderMode: (mode: RenderMode) => shared?.setTrackRenderMode(trackId, mode),
      openSpectrogramSettings: () => shared?.openSpectrogramSettings(trackId),
    }),
    [
      trackId,
      setTrackMute,
      setTrackSolo,
      setTrackVolume,
      setTrackPan,
      setSelectedTrackId,
      reorderTrack,
      shared,
    ]
  );

  const value = useMemo<TrackContextValue>(
    () => ({
      id: trackId,
      kind,
      index,
      name: name || `Track ${index + 1}`,
      muted,
      soloed,
      volume,
      pan,
      renderMode,
      isLoading,
      isSelected,
      isFirst,
      isLast,
      hasSpectrogram,
      ...actions,
    }),
    [
      trackId,
      kind,
      index,
      name,
      muted,
      soloed,
      volume,
      pan,
      renderMode,
      isLoading,
      isSelected,
      isFirst,
      isLast,
      hasSpectrogram,
      actions,
    ]
  );

  // For a reorder handle inside the panel (`useTrackReorderHandle`).
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [isDragSource, setDragSource] = useState(false);
  const wiring = useMemo<TrackSlotWiring>(
    () => ({ elementRef, setDragSource, handleCount: { current: 0 } }),
    []
  );

  return (
    <ControlSlot
      $height={height}
      $top={top}
      $animate={animate}
      $isSelected={isSelected}
      onClick={actions.select}
    >
      <div
        ref={elementRef}
        data-track-controls={trackId}
        style={
          isDragSource
            ? {
                ...SLOT_BODY_STYLE,
                boxShadow: DRAG_SOURCE_SHADOW,
                // Opaque background for the floating (top-layer, popover-based)
                // drag-source row — without it the row underneath shows through.
                // onDragStart selects the dragged track, so its slot always shows
                // the selected-track background while lifted.
                background: theme.selectedTrackControlsBackground,
              }
            : SLOT_BODY_STYLE
        }
      >
        <TrackSlotWiringContext value={wiring}>
          <TrackContext value={value}>{template}</TrackContext>
        </TrackSlotWiringContext>
      </div>
    </ControlSlot>
  );
}

const TrackControlsSlot = React.memo(TrackControlsSlotImpl);

/**
 * The control panels of all tracks, one height-synced slot per track, for the
 * ControlsColumn outside the scroll area: the track-controls part of the view
 * (#685). Its children are the panel of ONE track, a template it renders once
 * per track inside that track's context (#687); without children the panel is
 * `<DefaultTrackControls />`.
 *
 * Memoized (#693): it takes the rows and the layout from the root's rows
 * value, reads the selected track itself, and no time selection, cursor or
 * annotation state, so a selection drag or an active-annotation change during
 * playback does not re-render the panels. It reads the mixer state itself
 * (#768), so a volume or pan step renders this column, the slot of that track
 * and the pieces of that track, and not the root above it.
 */
function WaveformTrackControlsImpl({ children }: WaveformTrackControlsProps) {
  const {
    rows: tracks,
    renderModeById,
    trackLayout,
    trackHeightById,
    animateTrackLayout,
    setSettingsModalTrackId,
  } = useWaveformRows('The track controls');
  if (use(WaveformPartPlaceContext) !== 'controls') {
    warnMisplacedPart(
      '<WaveformTrackControls> is drawn among the tracks, not in the controls column: the root ' +
        'recognises a part by its element type, so it must be a child of the root (a fragment ' +
        'is fine), not wrapped in another component.'
    );
  }
  const { selectedTrackId } = useSelectedTrackId();
  const { trackReorderEpoch } = useTrackReorderPreview();
  const spectrogram = use(SpectrogramIntegrationContext);
  const { trackStates } = usePlaylistMixer();

  // `null` and `undefined` both mean "not given".
  const template = useStableTemplate(children ?? DEFAULT_TEMPLATE);

  // The spectrogram integration's value changes with every per-track
  // override; the slots and the pieces get functions that read the latest
  // one, in a value that changes only when a menu comes or goes.
  const spectrogramRef = useRef(spectrogram);
  spectrogramRef.current = spectrogram;
  const menuAvailable = Boolean(spectrogram?.renderMenuItems);
  const shared = useMemo<TrackControlsShared>(
    () => ({
      menuAvailable,
      menuItems: (args) => spectrogramRef.current?.renderMenuItems?.(args) ?? [],
      setTrackRenderMode: (trackId, mode) =>
        spectrogramRef.current?.setTrackRenderMode(trackId, mode),
      openSpectrogramSettings: (trackId) => {
        if (spectrogramRef.current) setSettingsModalTrackId(trackId);
      },
    }),
    [menuAvailable, setSettingsModalTrackId]
  );

  return (
    <TrackControlsSharedContext value={shared}>
      <TracksLayout $height={trackLayout.totalHeight}>
        {tracks.map((track, trackIndex) => {
          // No mixer state yet means the provider is still loading this
          // track (deferEngineRebuild): the engine does not know it, so a
          // mute/solo/volume/pan change could not take effect.
          const state = trackStates[trackIndex];
          return (
            // key includes trackReorderEpoch: forces a remount after every
            // track-reorder drag, discarding @dnd-kit sortable-plugin DOM
            // corruption (see bumpTrackReorderEpoch's doc comment in
            // WaveformPlaylistContext). Stays at `-0` — a no-op suffix — for
            // consumers that never render a reorder handle.
            <TrackControlsSlot
              key={`${track.id}-${trackReorderEpoch}`}
              trackId={track.id}
              index={trackIndex}
              kind={track.kind}
              name={state?.name}
              muted={state?.muted ?? false}
              soloed={state?.soloed ?? false}
              volume={state?.volume ?? 1.0}
              pan={state?.pan ?? 0}
              isLoading={state === undefined}
              isSelected={track.id === selectedTrackId}
              isFirst={trackIndex === 0}
              isLast={trackIndex === tracks.length - 1}
              renderMode={renderModeById.get(track.id) ?? 'waveform'}
              hasSpectrogram={spectrogram !== null && track.kind !== 'midi'}
              height={trackHeightById.get(track.id) ?? 0}
              top={trackLayout.topById.get(track.id) ?? 0}
              animate={animateTrackLayout}
              template={template}
            />
          );
        })}
      </TracksLayout>
    </TrackControlsSharedContext>
  );
}

export const WaveformTrackControls = React.memo(WaveformTrackControlsImpl);
