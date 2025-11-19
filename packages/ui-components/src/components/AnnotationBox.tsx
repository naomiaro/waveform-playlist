import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

interface AnnotationBoxProps {
  readonly $left: number;
  readonly $width: number;
  readonly $color: string;
  readonly $isActive?: boolean;
}

const Box = styled.div.attrs<AnnotationBoxProps>((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`,
  },
}))<AnnotationBoxProps>`
  position: absolute;
  top: 0;
  height: 100%;
  background: ${(props) => props.$color};
  border: 2px solid ${(props) => props.$color};
  border-radius: 4px;
  opacity: ${(props) => (props.$isActive ? 0.5 : 0.3)};
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  &:hover {
    opacity: 0.6;
  }
`;

const Label = styled.span`
  font-size: 10px;
  font-weight: bold;
  color: #333;
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
`;

export interface AnnotationBoxComponentProps {
  startPosition: number;
  endPosition: number;
  label?: string;
  color?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export const AnnotationBox: FunctionComponent<AnnotationBoxComponentProps> = ({
  startPosition,
  endPosition,
  label,
  color = '#ff9800',
  isActive = false,
  onClick,
}) => {
  const width = Math.max(0, endPosition - startPosition);

  if (width <= 0) {
    return null;
  }

  return (
    <Box
      $left={startPosition}
      $width={width}
      $color={color}
      $isActive={isActive}
      onClick={onClick}
    >
      {label && <Label>{label}</Label>}
    </Box>
  );
};
