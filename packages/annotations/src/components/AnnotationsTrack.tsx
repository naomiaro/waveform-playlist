import React, { FunctionComponent } from 'react';
import styled from 'styled-components';
import { usePlaylistInfo } from '@waveform-playlist/ui-components';

interface ContainerProps {
  readonly $height: number;
  readonly $controlWidth: number;
  readonly $width?: number;
}

const Container = styled.div.attrs<ContainerProps>((props) => ({
  style: {
    height: `${props.$height}px`,
  },
}))<ContainerProps>`
  position: relative;
  display: flex;
  ${(props) => props.$width !== undefined && `width: ${props.$width}px;`}
  background: transparent;
`;

const ControlsPlaceholder = styled.div<{ $controlWidth: number }>`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(props) => props.$controlWidth}px;
  flex-shrink: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: ${(props) => props.theme?.textColorMuted || '#666'};
  font-weight: bold;
`;

const AnnotationsContainer = styled.div<{ $offset?: number }>`
  position: relative;
  flex: 1;
  padding-left: ${(props) => props.$offset || 0}px;
`;

export interface AnnotationsTrackProps {
  className?: string;
  children?: React.ReactNode;
  height?: number;
  offset?: number;
  width?: number;
}

export const AnnotationsTrack: FunctionComponent<AnnotationsTrackProps> = ({
  children,
  className,
  height = 100,
  offset = 0,
  width,
}) => {
  const {
    controls: { show, width: controlWidth },
  } = usePlaylistInfo();

  return (
    <Container
      className={className}
      $height={height}
      $controlWidth={show ? controlWidth : 0}
      $width={width}
    >
      <ControlsPlaceholder $controlWidth={show ? controlWidth : 0}>
        Annotations
      </ControlsPlaceholder>
      <AnnotationsContainer $offset={offset}>
        {children}
      </AnnotationsContainer>
    </Container>
  );
};
