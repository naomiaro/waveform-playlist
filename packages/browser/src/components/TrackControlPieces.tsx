/**
 * The pieces of a track's control panel (#687). Each is bound to the track
 * whose panel it is rendered in (`useTrack()`), takes no prop for the track,
 * and is drawn by being rendered among the children of
 * `<WaveformTrackControls>`.
 */
import React, { use } from 'react';
import {
  Button,
  CloseButton,
  ReorderRail,
  Slider,
  SliderWrapper,
  TrackMenu,
  VolumeDownIcon,
  VolumeUpIcon,
} from '@waveform-playlist/ui-components';
import { TrackControlsSharedContext, useTrack } from './trackContext';
import { useTrackReorderHandle } from '../hooks/useTrackReorderHandle';

const NAME_STYLE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  // Room for a remove button on the left and the track menu on the right.
  padding: '0 24px',
  display: 'block',
} as const;

/** The track's name, on one line, cut off with an ellipsis. */
export const TrackName: React.FC = () => {
  const { name } = useTrack();
  return (
    <span data-track-name="" style={NAME_STYLE}>
      {name}
    </span>
  );
};

/** Mutes and unmutes the track. Disabled while the track is loading. */
export const TrackMuteButton: React.FC = () => {
  const { muted, isLoading, setMuted } = useTrack();
  return (
    <Button
      $variant={muted ? 'danger' : 'outline'}
      aria-pressed={muted}
      disabled={isLoading}
      onClick={() => setMuted(!muted)}
    >
      Mute
    </Button>
  );
};

/** Solos and unsolos the track. Disabled while the track is loading. */
export const TrackSoloButton: React.FC = () => {
  const { soloed, isLoading, setSoloed } = useTrack();
  return (
    <Button
      $variant={soloed ? 'info' : 'outline'}
      aria-pressed={soloed}
      disabled={isLoading}
      onClick={() => setSoloed(!soloed)}
    >
      Solo
    </Button>
  );
};

/** The track's volume, 0 to 1. Disabled while the track is loading. */
export const TrackVolumeSlider: React.FC = () => {
  const { volume, isLoading, setVolume } = useTrack();
  return (
    <SliderWrapper>
      <VolumeDownIcon />
      <Slider
        min="0"
        max="1"
        step="0.01"
        value={volume}
        aria-label="Volume"
        disabled={isLoading}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
      />
      <VolumeUpIcon />
    </SliderWrapper>
  );
};

/** The track's pan, -1 (left) to 1 (right). Disabled while the track is loading. */
export const TrackPanSlider: React.FC = () => {
  const { pan, isLoading, setPan } = useTrack();
  return (
    <SliderWrapper>
      <span>L</span>
      <Slider
        min="-1"
        max="1"
        step="0.01"
        value={pan}
        aria-label="Pan"
        disabled={isLoading}
        onChange={(e) => setPan(parseFloat(e.target.value))}
      />
      <span>R</span>
    </SliderWrapper>
  );
};

/**
 * The track's menu: how the track is drawn (waveform, spectrogram, both) and
 * its spectrogram settings. Draws nothing without a `<SpectrogramProvider>`
 * and nothing for a MIDI track, which is always a piano roll.
 */
export const TrackMenuButton: React.FC = () => {
  const { renderMode, hasSpectrogram, setRenderMode, openSpectrogramSettings } = useTrack();
  const shared = use(TrackControlsSharedContext);
  if (!shared || !shared.menuAvailable || !hasSpectrogram) return null;
  return (
    <TrackMenu
      items={(onClose) =>
        shared.menuItems({
          renderMode,
          onRenderModeChange: setRenderMode,
          onOpenSettings: openSpectrogramSettings,
          onClose,
        })
      }
    />
  );
};

export interface TrackRemoveButtonProps {
  /** Called with the track's id. Removing the track from your `tracks` is yours to do. */
  onRemove: (trackId: string) => void;
}

// The primitive is absolutely positioned at its container's top left corner.
// One pixel in, where it sat inside the bordered default panel.
const REMOVE_ANCHOR_STYLE = { position: 'absolute', left: 1, top: 1 } as const;

/**
 * A close button at the top left corner of the track's slot. A click calls
 * `onRemove` with the track's id and does not select the track.
 */
export const TrackRemoveButton: React.FC<TrackRemoveButtonProps> = ({ onRemove }) => {
  const { id } = useTrack();
  return (
    <span style={REMOVE_ANCHOR_STYLE}>
      <CloseButton
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
      />
    </span>
  );
};

const GRIP_ANCHOR_STYLE = {
  position: 'absolute',
  right: 3,
  top: '50%',
  transform: 'translateY(-50%)',
} as const;

/**
 * A drag grip with a move-up and a move-down button, at the right edge of the
 * track's slot. The buttons work with no other setup; dragging needs a
 * `ClipInteractionProvider` above the view. The default panel makes room for
 * it. Neither the grip nor the buttons select the track.
 */
export const TrackReorderGrip: React.FC = () => {
  const { isFirst, isLast, isLoading, moveUp, moveDown } = useTrack();
  const { handleRef } = useTrackReorderHandle();
  return (
    <span data-track-reorder-grip="" style={GRIP_ANCHOR_STYLE}>
      <ReorderRail
        gripRef={handleRef as React.Ref<HTMLButtonElement>}
        onGripClick={(e) => e.stopPropagation()}
        upDisabled={isLoading || isFirst}
        downDisabled={isLoading || isLast}
        onMoveUp={(e) => {
          e.stopPropagation();
          moveUp();
        }}
        onMoveDown={(e) => {
          e.stopPropagation();
          moveDown();
        }}
      />
    </span>
  );
};
