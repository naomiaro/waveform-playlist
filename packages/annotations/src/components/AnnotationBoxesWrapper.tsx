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
  z-index: 110;
`;

const BoxesContainer = styled.div`
  position: relative;
  height: 100%;
`;

export interface AnnotationBoxesWrapperProps {
  className?: string;
  children?: React.ReactNode;
  height?: number;
  width?: number;
}

export const AnnotationBoxesWrapper: FunctionComponent<AnnotationBoxesWrapperProps> = ({
  children,
  className,
  height = 30,
  width,
}) => {
  return (
    <Container className={className} $height={height} $width={width}>
      <BoxesContainer>{children}</BoxesContainer>
    </Container>
  );
};
