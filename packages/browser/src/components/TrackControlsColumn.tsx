import React, { type ReactNode } from 'react';
import { useTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import type { ClipTrack, RenderMode } from '@waveform-playlist/core';
import { usePlaylistControls, type TrackState } from '../WaveformPlaylistContext';
import type { SpectrogramIntegration } from '../SpectrogramIntegrationContext';
import type { TrackLayout } from '../utils/trackOrderPreview';
import { SortableTrackControls } from './SortableTrackControls';
import { DefaultTrackControls, type DefaultTrackControlsProps } from './DefaultTrackControls';
import { ControlSlot, TracksLayout } from './visualizationLayout';

/** Drop-shadow for the floating (fully opaque) drag-source controls row. */
const DRAG_SOURCE_SHADOW = '0 4px 12px rgba(0, 0, 0, 0.35)';

export interface TrackControlsColumnProps {
  tracks: ClipTrack[];
  trackStates: TrackState[];
  /** Render mode per track id, as resolved by the visualization. */
  renderModeById: ReadonlyMap<string, RenderMode>;
  trackLayout: TrackLayout;
  trackHeightById: ReadonlyMap<string, number>;
  animateTrackLayout: boolean;
  selectedTrackId: string | null;
  trackReorderEpoch: number;
  trackReordering: boolean;
  renderTrackControls?: (trackIndex: number) => ReactNode;
  onRemoveTrack?: (trackIndex: number) => void;
  selectTrack: (trackIndex: number) => void;
  spectrogram: SpectrogramIntegration | null;
  setSettingsModalTrackId: (id: string | null) => void;
}

/**
 * The control panels of all tracks, one height-synced slot per track, for the
 * ControlsColumn outside the scroll area.
 *
 * Memoized (#693): it takes no selection, cursor or annotation state, so a
 * selection drag or an active-annotation change during playback does not
 * re-render the panels.
 */
function TrackControlsColumnImpl({
  tracks,
  trackStates,
  renderModeById,
  trackLayout,
  trackHeightById,
  animateTrackLayout,
  selectedTrackId,
  trackReorderEpoch,
  trackReordering,
  renderTrackControls,
  onRemoveTrack,
  selectTrack,
  spectrogram,
  setSettingsModalTrackId,
}: TrackControlsColumnProps) {
  const theme = useTheme() as WaveformPlaylistTheme;
  const { setTrackMute, setTrackSolo, setTrackVolume, setTrackPan, reorderTrack } =
    usePlaylistControls();

  return (
    <TracksLayout $height={trackLayout.totalHeight}>
      {tracks.map((track, trackIndex) => {
        const defaultControlProps: Omit<DefaultTrackControlsProps, 'gripRef'> = {
          trackIndex,
          trackId: track.id,
          trackState: trackStates[trackIndex] || {
            name: `Track ${trackIndex + 1}`,
            muted: false,
            soloed: false,
            volume: 1.0,
            pan: 0,
          },
          effectiveRenderMode: renderModeById.get(track.id) ?? 'waveform',
          selectTrack,
          onRemoveTrack,
          setTrackMute,
          setTrackSolo,
          setTrackVolume,
          setTrackPan,
          spectrogram,
          setSettingsModalTrackId,
          trackReordering,
          reorderTrack,
          trackCount: tracks.length,
          // No mixer state yet means the provider is still loading this
          // track (deferEngineRebuild): the engine does not know it, so a
          // mute/solo/volume/pan change could not take effect.
          disabled: trackStates[trackIndex] === undefined,
        };

        const trackControlContent = renderTrackControls ? (
          renderTrackControls(trackIndex)
        ) : trackReordering ? (
          <SortableTrackControls trackId={track.id} index={trackIndex}>
            {({ ref, handleRef, isDragSource }) => (
              <div
                ref={ref as React.Ref<HTMLDivElement>}
                style={{
                  height: '100%',
                  boxShadow: isDragSource ? DRAG_SOURCE_SHADOW : undefined,
                  // Opaque background for the floating (top-layer, popover-based)
                  // drag-source row — without it the row underneath shows through.
                  // onDragStart selects the dragged track, so its slot always shows
                  // the selected-track background while lifted.
                  background: isDragSource ? theme.selectedTrackControlsBackground : undefined,
                }}
              >
                <DefaultTrackControls {...defaultControlProps} gripRef={handleRef} />
              </div>
            )}
          </SortableTrackControls>
        ) : (
          <DefaultTrackControls {...defaultControlProps} />
        );

        return (
          // key includes trackReorderEpoch: forces a remount after every
          // track-reorder drag, discarding @dnd-kit sortable-plugin DOM
          // corruption (see bumpTrackReorderEpoch's doc comment in
          // WaveformPlaylistContext). Stays at `-0` — a no-op suffix — for
          // consumers that never enable trackReordering.
          <ControlSlot
            key={`${track.id}-${trackReorderEpoch}`}
            $height={trackHeightById.get(track.id) ?? 0}
            $top={trackLayout.topById.get(track.id) ?? 0}
            $animate={animateTrackLayout}
            $isSelected={track.id === selectedTrackId}
          >
            {trackControlContent}
          </ControlSlot>
        );
      })}
    </TracksLayout>
  );
}

export const TrackControlsColumn = React.memo(TrackControlsColumnImpl);
