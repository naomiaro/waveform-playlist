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
    marginLeft: `${props.$controlWidth}px`,
  },
}))<ContainerProps>``;

const ChannelContainer = styled.div`
  position: relative;
`;

export interface ControlsWrapperProps {
  readonly $controlWidth: number;
}
const ControlsWrapper = styled.div.attrs<ControlsWrapperProps>((props) => ({
  style: {
    width: `${props.$controlWidth}px`,
  },
}))<ControlsWrapperProps>`
  position: absolute;
  z-index: 1;
  left: 0;
  height: 100%;
`;

export interface TrackProps {
  className?: string;
  children?: ReactNode;
  numChannels: number;
}

export const Track: FunctionComponent<TrackProps> = ({
  numChannels,
  children,
  className,
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
      <ChannelContainer>{children}</ChannelContainer>
    </Container>
  );
};
