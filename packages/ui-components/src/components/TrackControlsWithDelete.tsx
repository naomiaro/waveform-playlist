/**
 * Track Controls with Delete Button
 *
 * Reusable track controls component that includes standard controls
 * (mute, solo, volume, pan) plus a delete button
 */

import React from 'react';
import styled from 'styled-components';
import {
  Controls,
  Header,
  ButtonGroup,
  Button,
  SliderWrapper,
  Slider,
  VolumeDownIcon,
  VolumeUpIcon,
} from './TrackControls';

export interface TrackControlsWithDeleteProps {
  trackIndex: number;
  trackName: string;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
  onMuteChange: (muted: boolean) => void;
  onSoloChange: (soloed: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
  onDelete: () => void;
}

const DeleteButton = styled(Button)`
  margin-top: 0.5rem;
`;

/**
 * Track controls with delete button
 *
 * @example
 * ```tsx
 * <TrackControlsWithDelete
 *   trackIndex={0}
 *   trackName="Track 1"
 *   muted={false}
 *   soloed={false}
 *   volume={1.0}
 *   pan={0}
 *   onMuteChange={(muted) => console.log('mute:', muted)}
 *   onSoloChange={(soloed) => console.log('solo:', soloed)}
 *   onVolumeChange={(volume) => console.log('volume:', volume)}
 *   onPanChange={(pan) => console.log('pan:', pan)}
 *   onDelete={() => console.log('delete')}
 * />
 * ```
 */
export const TrackControlsWithDelete: React.FC<TrackControlsWithDeleteProps> = ({
  trackName,
  muted,
  soloed,
  volume,
  pan,
  onMuteChange,
  onSoloChange,
  onVolumeChange,
  onPanChange,
  onDelete,
}) => {
  return (
    <Controls>
      <Header style={{ justifyContent: 'center' }}>{trackName}</Header>
      <ButtonGroup>
        <Button
          $variant={muted ? 'danger' : 'outline'}
          onClick={() => onMuteChange(!muted)}
        >
          Mute
        </Button>
        <Button
          $variant={soloed ? 'info' : 'outline'}
          onClick={() => onSoloChange(!soloed)}
        >
          Solo
        </Button>
      </ButtonGroup>
      <SliderWrapper>
        {/* @ts-expect-error - VolumeDownIcon has icon prop set via attrs */}
        <VolumeDownIcon />
        <Slider
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        />
        {/* @ts-expect-error - VolumeUpIcon has icon prop set via attrs */}
        <VolumeUpIcon />
      </SliderWrapper>
      <SliderWrapper>
        <span>L</span>
        <Slider
          min="-1"
          max="1"
          step="0.01"
          value={pan}
          onChange={(e) => onPanChange(parseFloat(e.target.value))}
        />
        <span>R</span>
      </SliderWrapper>
      <DeleteButton $variant="danger" onClick={onDelete}>
        Delete
      </DeleteButton>
    </Controls>
  );
};
