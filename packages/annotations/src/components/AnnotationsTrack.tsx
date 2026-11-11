import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

interface ContainerProps {
  readonly $height: number;
  readonly $width?: number;
}

const Container = styled.div.attrs<ContainerProps>((props) => ({
  style: {
    height: `${props.$height}px`,
    width: props.$width !== undefined ? `${props.$width}px` : undefined,
  },
}))<ContainerProps>`
  position: relative;
  background: transparent;
`;

const AnnotationsContainer = styled.div<{ $offset?: number }>`
  position: relative;
  height: 100%;
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
  return (
    <Container className={className} $height={height} $width={width}>
      <AnnotationsContainer $offset={offset}>{children}</AnnotationsContainer>
    </Container>
  );
};
