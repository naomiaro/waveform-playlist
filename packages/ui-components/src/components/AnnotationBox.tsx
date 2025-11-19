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
  background: ${(props) => props.$isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.85)'};
  border: 2px solid ${(props) => props.$isActive ? '#d67600' : props.$color};
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    background: rgba(255, 255, 255, 0.98);
    border-color: #d67600;
    border-width: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
`;

const Label = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #2a2a2a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px;
  letter-spacing: 0.3px;
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
