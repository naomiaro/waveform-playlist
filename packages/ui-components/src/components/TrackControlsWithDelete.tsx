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
  SliderWrapper,
  Slider,
  VolumeDownIcon,
  VolumeUpIcon,
  Button,
  ButtonGroup,
  TrashIcon,
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

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.5rem 0.25rem 0.5rem;
`;

const TrackNameSpan = styled.span`
  flex: 1;
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0.25rem;
`;

const DeleteIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  border-radius: 3px;
  transition: all 0.2s ease-in-out;
  flex-shrink: 0;

  &:hover {
    background: #dc3545;
    color: white;
  }

  &:active {
    transform: scale(0.9);
  }
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
      <HeaderContainer>
        <DeleteIconButton onClick={onDelete} title="Delete track">
          <TrashIcon />
        </DeleteIconButton>
        <TrackNameSpan>{trackName}</TrackNameSpan>
      </HeaderContainer>
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
        <VolumeDownIcon />
        <Slider
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onVolumeChange(parseFloat(e.target.value))}
        />
        <VolumeUpIcon />
      </SliderWrapper>
      <SliderWrapper>
        <span>L</span>
        <Slider
          min="-1"
          max="1"
          step="0.01"
          value={pan}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPanChange(parseFloat(e.target.value))}
        />
        <span>R</span>
      </SliderWrapper>
    </Controls>
  );
};
