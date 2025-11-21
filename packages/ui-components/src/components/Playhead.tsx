import React from 'react';
import styled from 'styled-components';

interface PlayheadLineProps {
  readonly $position: number;
  readonly $color: string;
}

const PlayheadLine = styled.div.attrs<PlayheadLineProps>((props) => ({
  style: {
    transform: `translate3d(${props.$position}px, 0, 0)`,
  },
}))<PlayheadLineProps>`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 150;
  pointer-events: none;
  will-change: transform;
`;

export interface PlayheadProps {
  position: number; // Position in pixels
  color?: string;
}

export const Playhead: React.FC<PlayheadProps> = ({ position, color = '#ff0000' }) => {
  return <PlayheadLine $position={position} $color={color} />;
};
