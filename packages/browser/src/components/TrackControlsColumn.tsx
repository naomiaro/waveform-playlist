import React, { useContext, type ReactNode } from 'react';
import { useTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import {
  usePlaylistMixer,
  useEditorControls,
  useSelectedTrackId,
  useTrackReorderPreview,
} from '../contexts/playlistContexts';
import { SpectrogramIntegrationContext } from '../SpectrogramIntegrationContext';
import { useWaveformRows } from './waveformLayoutContext';
import { SortableTrackControls } from './SortableTrackControls';
import { DefaultTrackControls, type DefaultTrackControlsProps } from './DefaultTrackControls';
import { ControlSlot, TracksLayout } from './visualizationLayout';

/** Drop-shadow for the floating (fully opaque) drag-source controls row. */
const DRAG_SOURCE_SHADOW = '0 4px 12px rgba(0, 0, 0, 0.35)';

export interface TrackControlsPartProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  /** The close button is drawn only when this is given. */
  onRemoveTrack?: (trackIndex: number) => void;
  /** A drag grip and move up/down buttons on each default panel. */
  trackReordering?: boolean;
}

/**
 * The control panels of all tracks, one height-synced slot per track, for the
 * ControlsColumn outside the scroll area: the track-controls part of the view
 * (#685).
 *
 * Memoized (#693), with only its own three options as props: it takes the
 * tracks and the layout from the root's rows value, reads the selected track
 * itself, and no time selection,
 * cursor or annotation state, so a selection drag or an active-annotation
 * change during playback does not re-render the panels. It reads the mixer
 * state itself (#768), so a volume or pan step renders this column and not the
 * root above it.
 */
function TrackControlsPartImpl({
  renderTrackControls,
  onRemoveTrack,
  trackReordering = false,
}: TrackControlsPartProps) {
  const theme = useTheme() as WaveformPlaylistTheme;
  const {
    rows: tracks,
    renderModeById,
    trackLayout,
    trackHeightById,
    animateTrackLayout,
    selectTrack,
    setSettingsModalTrackId,
  } = useWaveformRows('The track controls');
  const { selectedTrackId } = useSelectedTrackId();
  const { trackReorderEpoch } = useTrackReorderPreview();
  const spectrogram = useContext(SpectrogramIntegrationContext);
  const { trackStates } = usePlaylistMixer();
  const { setTrackMute, setTrackSolo, setTrackVolume, setTrackPan, reorderTrack } =
    useEditorControls();

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
          kind: track.kind,
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

export const TrackControlsPart = React.memo(TrackControlsPartImpl);
