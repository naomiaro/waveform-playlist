import React from 'react';
import styled from 'styled-components';

interface PlayheadLineProps {
  readonly $position: number;
  readonly $color: string;
}

const PlayheadLine = styled.div.attrs<PlayheadLineProps>((props) => ({
  style: {
    left: `${props.$position}px`,
  },
}))<PlayheadLineProps>`
  position: absolute;
  top: 0;
  width: 2px;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 10;
  pointer-events: none;
`;

export interface PlayheadProps {
  position: number; // Position in pixels
  color?: string;
}

export const Playhead: React.FC<PlayheadProps> = ({ position, color = '#ff0000' }) => {
  return <PlayheadLine $position={position} $color={color} />;
};
