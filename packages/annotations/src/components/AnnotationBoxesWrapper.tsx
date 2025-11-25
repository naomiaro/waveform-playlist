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
  z-index: 110;
`;

const ControlsPlaceholder = styled.div<{ $controlWidth: number }>`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(props) => props.$controlWidth}px;
  flex-shrink: 0;
  background: transparent;
`;

const BoxesContainer = styled.div<{ $offset?: number }>`
  position: relative;
  flex: 1;
  padding-left: ${(props) => props.$offset || 0}px;
`;

export interface AnnotationBoxesWrapperProps {
  className?: string;
  children?: React.ReactNode;
  height?: number;
  offset?: number;
  width?: number;
}

export const AnnotationBoxesWrapper: FunctionComponent<AnnotationBoxesWrapperProps> = ({
  children,
  className,
  height = 30,
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
      <ControlsPlaceholder $controlWidth={show ? controlWidth : 0} />
      <BoxesContainer $offset={offset}>
        {children}
      </BoxesContainer>
    </Container>
  );
};
