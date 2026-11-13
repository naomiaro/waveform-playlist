import React from 'react';
import styled from 'styled-components';
import { ButtonGroup, Controls, Header } from '@waveform-playlist/ui-components';
import {
  TrackMenuButton,
  TrackMuteButton,
  TrackName,
  TrackPanSlider,
  TrackSoloButton,
  TrackVolumeSlider,
} from './TrackControlPieces';

/**
 * The frame of the default panel. It makes room on both sides when a
 * `<TrackReorderGrip />` is rendered beside it (the grip sits at the right
 * edge of the slot, over the panel).
 */
const Frame = styled(Controls)`
  *:has(> [data-track-reorder-grip]) > & {
    padding-left: 18px;
    padding-right: 18px;
  }
`;

const HEADER_STYLE = { justifyContent: 'center', position: 'relative' } as const;
const MENU_ANCHOR_STYLE = { position: 'absolute', right: 0, top: 0 } as const;

/**
 * The default control panel of a track: its name, the track menu (under a
 * `<SpectrogramProvider>`, for an audio track), mute, solo, volume and pan.
 * It is what `<WaveformTrackControls />` renders when it has no children
 * (#687). It has no remove button and no reorder grip: render
 * `<TrackRemoveButton />` or `<TrackReorderGrip />` beside it for those, or
 * your own control, or compose a panel from the pieces.
 *
 * It takes no props and reads no context itself: the pieces read the track.
 */
function DefaultTrackControlsImpl() {
  return (
    <Frame>
      <Header style={HEADER_STYLE}>
        <TrackName />
        <span style={MENU_ANCHOR_STYLE}>
          <TrackMenuButton />
        </span>
      </Header>
      <ButtonGroup>
        <TrackMuteButton />
        <TrackSoloButton />
      </ButtonGroup>
      <TrackVolumeSlider />
      <TrackPanSlider />
    </Frame>
  );
}

export const DefaultTrackControls = React.memo(DefaultTrackControlsImpl);
