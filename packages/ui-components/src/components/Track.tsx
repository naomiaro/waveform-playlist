import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';
import { usePlaylistInfo } from '../contexts/PlaylistInfo';
import { useTrackControls } from '../contexts/TrackControls';
import { CLIP_HEADER_HEIGHT } from './ClipHeader';

interface ContainerProps {
  readonly $numChannels: number;
  readonly $waveHeight: number;
  readonly $controlWidth: number;
  readonly $width?: number;
  readonly $isSelected?: boolean;
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
  display: flex;
  ${(props) => props.$width !== undefined && `width: ${props.$width}px;`}
`;

interface ChannelContainerProps {
  readonly $controlWidth: number;
  readonly $backgroundColor?: string;
  readonly $offset?: number;
}
const ChannelContainer = styled.div.attrs<ChannelContainerProps>((props) => ({
  style: {
    paddingLeft: `${props.$offset || 0}px`,
  },
}))<ChannelContainerProps>`
  position: relative;
  background: ${(props) => props.$backgroundColor || 'transparent'};
  flex: 1;
`;

export interface ControlsWrapperProps {
  readonly $controlWidth: number;
  readonly $isSelected?: boolean;
}
const ControlsWrapper = styled.div.attrs<ControlsWrapperProps>((props) => ({
  style: {
    width: `${props.$controlWidth}px`,
  },
}))<ControlsWrapperProps>`
  position: sticky;
  z-index: 101; /* Above waveform content, below Docusaurus navbar (z-index: 200) */
  left: 0;
  height: 100%;
  flex-shrink: 0;
  pointer-events: auto;
  background: ${(props) => props.theme.surfaceColor};
  transition: background 0.15s ease-in-out;

  /* Selected track: highlighted background */
  ${(props) => props.$isSelected && `
    background: ${props.theme.selectedTrackControlsBackground};
  `}
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
  const {
    waveHeight,
    controls: { show, width: controlWidth },
  } = usePlaylistInfo();
  const controls = useTrackControls();
  return (
    <Container
      $numChannels={numChannels}
      className={className}
      $waveHeight={waveHeight}
      $controlWidth={show ? controlWidth : 0}
      $width={width}
      $hasClipHeaders={hasClipHeaders}
      $isSelected={isSelected}
    >
      <ControlsWrapper
        $controlWidth={show ? controlWidth : 0}
        $isSelected={isSelected}
      >
        {controls}
      </ControlsWrapper>
      <ChannelContainer
        $controlWidth={show ? controlWidth : 0}
        $backgroundColor={backgroundColor}
        $offset={offset}
        onClick={onClick}
        data-track-id={trackId}
      >
        {children}
      </ChannelContainer>
    </Container>
  );
};
