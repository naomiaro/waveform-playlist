import React from 'react';
import styled from 'styled-components';

interface SelectionOverlayProps {
  readonly $left: number;
  readonly $width: number;
  readonly $color: string;
}

const SelectionOverlay = styled.div.attrs<SelectionOverlayProps>((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`,
  },
}))<SelectionOverlayProps>`
  position: absolute;
  top: 0;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 5;
  pointer-events: none;
  opacity: 0.3;
`;

export interface SelectionProps {
  startPosition: number; // Start position in pixels
  endPosition: number;   // End position in pixels
  color?: string;
}

export const Selection: React.FC<SelectionProps> = ({
  startPosition,
  endPosition,
  color = '#00ff00'
}) => {
  const width = Math.max(0, endPosition - startPosition);

  if (width <= 0) {
    return null;
  }

  return <SelectionOverlay $left={startPosition} $width={width} $color={color} />;
};
