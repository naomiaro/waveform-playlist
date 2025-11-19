import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';
import { usePlaylistInfo } from '../contexts/PlaylistInfo';
import { useTrackControls } from '../contexts/TrackControls';

interface ContainerProps {
  readonly $numChannels: number;
  readonly $waveHeight: number;
  readonly $controlWidth: number;
}

const Container = styled.div.attrs<ContainerProps>((props) => ({
  style: {
    height: `${props.$waveHeight * props.$numChannels}px`,
  },
}))<ContainerProps>`
  position: relative;
  display: flex;
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
}
const ControlsWrapper = styled.div.attrs<ControlsWrapperProps>((props) => ({
  style: {
    width: `${props.$controlWidth}px`,
  },
}))<ControlsWrapperProps>`
  position: sticky;
  z-index: 1;
  left: 0;
  height: 100%;
  flex-shrink: 0;
`;

export interface TrackProps {
  className?: string;
  children?: ReactNode;
  numChannels: number;
  backgroundColor?: string;
  offset?: number; // Offset in pixels to shift the waveform right
}

export const Track: FunctionComponent<TrackProps> = ({
  numChannels,
  children,
  className,
  backgroundColor,
  offset = 0,
}) => {
  const {
    waveHeight,
    controls: { show, width },
  } = usePlaylistInfo();
  const controls = useTrackControls();
  return (
    <Container
      $numChannels={numChannels}
      className={className}
      $waveHeight={waveHeight}
      $controlWidth={show ? width : 0}
    >
      <ControlsWrapper $controlWidth={show ? width : 0}>
        {controls}
      </ControlsWrapper>
      <ChannelContainer
        $controlWidth={show ? width : 0}
        $backgroundColor={backgroundColor}
        $offset={offset}
      >
        {children}
      </ChannelContainer>
    </Container>
  );
};
