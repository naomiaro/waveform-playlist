import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';
import { usePlaylistInfo } from '../contexts/PlaylistInfo';
import { useTrackControls } from '../contexts/TrackControls';

interface ContainerProps {
  readonly numChannels: number;
  readonly waveHeight: number;
  readonly controlWidth: number;
}

const Container = styled.div<ContainerProps>`
  height: ${(props) => props.waveHeight * props.numChannels}px;
  margin-left: ${(props) => props.controlWidth}px;
`;

const ChannelContainer = styled.div`
  position: relative;
`;

export interface ControlsWrapperProps {
  readonly controlWidth: number;
}
const ControlsWrapper = styled.div<ControlsWrapperProps>`
  width: ${(props) => props.controlWidth}px;
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
      numChannels={numChannels}
      className={className}
      waveHeight={waveHeight}
      controlWidth={show ? width : 0}
    >
      <ControlsWrapper controlWidth={show ? width : 0}>
        {controls}
      </ControlsWrapper>
      <ChannelContainer>{children}</ChannelContainer>
    </Container>
  );
};
