import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';
import { usePlaylistInfo } from '../contexts/PlaylistInfo';
import { CLIP_HEADER_HEIGHT } from './ClipHeader';

interface ContainerProps {
  readonly $numChannels: number;
  readonly $waveHeight: number;
  readonly $width?: number;
}

interface ContainerWithHeaderProps extends ContainerProps {
  readonly $hasClipHeaders: boolean;
}

const Container = styled.div.attrs<ContainerWithHeaderProps>((props) => ({
  style: {
    height: `${props.$waveHeight * props.$numChannels + (props.$hasClipHeaders ? CLIP_HEADER_HEIGHT : 0)}px`,
  },
}))<ContainerWithHeaderProps>`
  position: relative;
  ${(props) => props.$width !== undefined && `width: ${props.$width}px;`}
`;

interface ChannelContainerProps {
  readonly $backgroundColor?: string;
  readonly $offset?: number;
  readonly $isSelected?: boolean;
}
const ChannelContainer = styled.div.attrs<ChannelContainerProps>((props) => ({
  style: {
    paddingLeft: `${props.$offset || 0}px`,
  },
}))<ChannelContainerProps>`
  position: relative;
  background: ${(props) => {
    if (props.$isSelected) {
      return props.theme.selectedTrackBackground || props.$backgroundColor || 'transparent';
    }
    return props.$backgroundColor || 'transparent';
  }};
  height: 100%;
`;

export interface TrackProps {
  className?: string;
  children?: ReactNode;
  numChannels: number;
  backgroundColor?: string;
  offset?: number; // Offset in pixels to shift the waveform right
  width?: number; // Total width of the track (for consistent backgrounds across tracks)
  hasClipHeaders?: boolean; // Whether clips have headers (for multi-clip editing)
  onClick?: () => void; // Called when track is clicked (for track selection)
  trackId?: string; // Track ID for identifying which track was clicked
  isSelected?: boolean; // Whether this track is currently selected (for visual feedback)
}

export const Track: FunctionComponent<TrackProps> = ({
  numChannels,
  children,
  className,
  backgroundColor,
  offset = 0,
  width,
  hasClipHeaders = false,
  onClick,
  trackId,
  isSelected = false,
}) => {
  const { waveHeight } = usePlaylistInfo();
  return (
    <Container
      $numChannels={numChannels}
      className={className}
      $waveHeight={waveHeight}
      $width={width}
      $hasClipHeaders={hasClipHeaders}
    >
      <ChannelContainer
        $backgroundColor={backgroundColor}
        $offset={offset}
        $isSelected={isSelected}
        onClick={onClick}
        data-track-id={trackId}
      >
        {children}
      </ChannelContainer>
    </Container>
  );
};
