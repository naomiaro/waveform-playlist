import React from 'react';
import {
  CloseButton,
  Controls,
  Header,
  Button,
  ButtonGroup,
  Slider,
  SliderWrapper,
  VolumeDownIcon,
  VolumeUpIcon,
  TrackMenu,
  ReorderRail,
} from '@waveform-playlist/ui-components';
import type { RenderMode } from '@waveform-playlist/core';
import type { TrackState } from '../WaveformPlaylistContext';
import type { SpectrogramIntegration } from '../SpectrogramIntegrationContext';

export interface DefaultTrackControlsProps {
  trackIndex: number;
  trackId: string;
  trackState: TrackState;
  effectiveRenderMode: RenderMode;
  selectTrack: (trackIndex: number) => void;
  onRemoveTrack?: (trackIndex: number) => void;
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;
  spectrogram: SpectrogramIntegration | null;
  setSettingsModalTrackId: (id: string | null) => void;
  trackReordering: boolean;
  reorderTrack: (trackId: string, toIndex: number) => void;
  trackCount: number;
  /** Attach to the drag grip element (the `handleRef` from SortableTrackControls). */
  gripRef?: (element: Element | null) => void;
  /** True while the track has no mixer state yet (still loading): the mixer
   *  and reorder controls cannot take effect, so they render disabled. */
  disabled: boolean;
}

/**
 * Default track control panel: name/close header, mute/solo, volume/pan sliders,
 * plus an optional drag grip and move up/down buttons when `trackReordering` is
 * enabled. Extracted into its own component (used both directly and wrapped in
 * SortableTrackControls) so the trackReordering branch doesn't change the hook
 * count of the shared JSX.
 *
 * Memoized (#693): every prop is a primitive, a stable callback or this
 * track's own `trackState` object, so a mixer change on one track re-renders
 * that track's panel only.
 */
function DefaultTrackControlsImpl({
  trackIndex,
  trackId,
  trackState,
  effectiveRenderMode,
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
  trackCount,
  gripRef,
  disabled,
}: DefaultTrackControlsProps) {
  return (
    <Controls
      onClick={() => selectTrack(trackIndex)}
      style={
        trackReordering ? { position: 'relative', paddingLeft: 18, paddingRight: 18 } : undefined
      }
    >
      <Header style={{ justifyContent: 'center', position: 'relative' }}>
        {onRemoveTrack && (
          <CloseButton
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTrack(trackIndex);
            }}
          />
        )}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 24px',
            display: 'block',
          }}
        >
          {trackState.name || `Track ${trackIndex + 1}`}
        </span>
        {spectrogram?.renderMenuItems && (
          <span style={{ position: 'absolute', right: 0, top: 0 }}>
            <TrackMenu
              items={(onClose) =>
                spectrogram.renderMenuItems!({
                  renderMode: effectiveRenderMode,
                  onRenderModeChange: (mode) => spectrogram.setTrackRenderMode(trackId, mode),
                  onOpenSettings: () => setSettingsModalTrackId(trackId),
                  onClose,
                })
              }
            />
          </span>
        )}
      </Header>
      <ButtonGroup>
        <Button
          $variant={trackState.muted ? 'danger' : 'outline'}
          aria-pressed={trackState.muted}
          disabled={disabled}
          onClick={() => setTrackMute(trackIndex, !trackState.muted)}
        >
          Mute
        </Button>
        <Button
          $variant={trackState.soloed ? 'info' : 'outline'}
          aria-pressed={trackState.soloed}
          disabled={disabled}
          onClick={() => setTrackSolo(trackIndex, !trackState.soloed)}
        >
          Solo
        </Button>
      </ButtonGroup>
      <SliderWrapper>
        <VolumeDownIcon />
        <Slider
          min="0"
          max="1"
          step="0.01"
          value={trackState.volume}
          aria-label="Volume"
          disabled={disabled}
          onChange={(e) => setTrackVolume(trackIndex, parseFloat(e.target.value))}
        />
        <VolumeUpIcon />
      </SliderWrapper>
      <SliderWrapper>
        <span>L</span>
        <Slider
          min="-1"
          max="1"
          step="0.01"
          value={trackState.pan}
          aria-label="Pan"
          disabled={disabled}
          onChange={(e) => setTrackPan(trackIndex, parseFloat(e.target.value))}
        />
        <span>R</span>
      </SliderWrapper>
      {trackReordering && (
        <ReorderRail
          style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)' }}
          gripRef={gripRef as React.Ref<HTMLButtonElement>}
          onGripClick={(e) => e.stopPropagation()}
          upDisabled={disabled || trackIndex === 0}
          downDisabled={disabled || trackIndex === trackCount - 1}
          onMoveUp={(e) => {
            e.stopPropagation();
            reorderTrack(trackId, trackIndex - 1);
          }}
          onMoveDown={(e) => {
            e.stopPropagation();
            reorderTrack(trackId, trackIndex + 1);
          }}
        />
      )}
    </Controls>
  );
}

export const DefaultTrackControls = React.memo(DefaultTrackControlsImpl);
