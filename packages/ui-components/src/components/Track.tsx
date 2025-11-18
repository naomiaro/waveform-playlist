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
`;

interface ChannelContainerProps {
  readonly $controlWidth: number;
  readonly $backgroundColor?: string;
}
const ChannelContainer = styled.div.attrs<ChannelContainerProps>((props) => ({
  style: {
    marginLeft: `${props.$controlWidth}px`,
  },
}))<ChannelContainerProps>`
  position: relative;
  background: ${(props) => props.$backgroundColor || 'transparent'};
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
  float: left;
`;

export interface TrackProps {
  className?: string;
  children?: ReactNode;
  numChannels: number;
  backgroundColor?: string;
}

export const Track: FunctionComponent<TrackProps> = ({
  numChannels,
  children,
  className,
  backgroundColor,
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
      >
        {children}
      </ChannelContainer>
    </Container>
  );
};
