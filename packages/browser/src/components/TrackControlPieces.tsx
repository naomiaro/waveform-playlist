/**
 * The pieces of a track's control panel (#687). Each is bound to the track
 * whose panel it is rendered in (`useTrack()`), takes no prop for the track,
 * and is drawn by being rendered among the children of
 * `<WaveformTrackControls>`.
 */
import React, { use, useEffect, useRef, useState } from 'react';
import { createMixerGesture } from '@waveform-playlist/core';
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

/**
 * Mutes and unmutes the track. Disabled while a take is recorded onto the
 * track (`useTrack().isRecording`): the take plays the track muted and
 * the button shows it pressed, so a click would set the track's own mute
 * from the take's mute (#812, #843).
 */
export const TrackMuteButton: React.FC = () => {
  const { muted, setMuted, isRecording } = useTrack();
  return (
    <Button
      $variant={muted ? 'danger' : 'outline'}
      aria-pressed={muted}
      disabled={isRecording}
      onClick={() => setMuted(!muted)}
    >
      Mute
    </Button>
  );
};

/** Solos and unsolos the track. */
export const TrackSoloButton: React.FC = () => {
  const { soloed, setSoloed } = useTrack();
  return (
    <Button
      $variant={soloed ? 'info' : 'outline'}
      aria-pressed={soloed}
      onClick={() => setSoloed(!soloed)}
    >
      Solo
    </Button>
  );
};

/**
 * One gesture helper for a slider, made once per mount and attached to the
 * input: a drag or a held key is one undo step (#843). Effect cleanup detaches,
 * so StrictMode's second run attaches again.
 */
function useSliderGesture() {
  const [gesture] = useState(createMixerGesture);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    return input ? gesture.attach(input) : undefined;
  }, [gesture]);
  return { gesture, ref };
}

/** The track's volume, 0 to 1. */
export const TrackVolumeSlider: React.FC = () => {
  const { volume, setVolume } = useTrack();
  const { gesture, ref } = useSliderGesture();
  return (
    <SliderWrapper>
      <VolumeDownIcon />
      <Slider
        min="0"
        max="1"
        step="0.01"
        ref={ref}
        value={volume}
        aria-label="Volume"
        onChange={(e) => setVolume(parseFloat(e.target.value), { gesture: gesture.id })}
      />
      <VolumeUpIcon />
    </SliderWrapper>
  );
};

/** The track's pan, -1 (left) to 1 (right). */
export const TrackPanSlider: React.FC = () => {
  const { pan, setPan } = useTrack();
  const { gesture, ref } = useSliderGesture();
  return (
    <SliderWrapper>
      <span>L</span>
      <Slider
        min="-1"
        max="1"
        step="0.01"
        ref={ref}
        value={pan}
        aria-label="Pan"
        onChange={(e) => setPan(parseFloat(e.target.value), { gesture: gesture.id })}
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
  const { isFirst, isLast, moveUp, moveDown } = useTrack();
  const { handleRef } = useTrackReorderHandle();
  return (
    <span data-track-reorder-grip="" style={GRIP_ANCHOR_STYLE}>
      <ReorderRail
        gripRef={handleRef as React.Ref<HTMLButtonElement>}
        onGripClick={(e) => e.stopPropagation()}
        upDisabled={isFirst}
        downDisabled={isLast}
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
