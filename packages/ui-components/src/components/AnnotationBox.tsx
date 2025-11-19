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
  user-select: none;
`;

const ResizeHandle = styled.div<{ $position: 'left' | 'right' }>`
  position: absolute;
  top: 0;
  ${(props) => props.$position}: -15px;
  width: 30px;
  height: 100%;
  cursor: ew-resize;
  z-index: 2;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 70%;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 3px;
    opacity: 0.7;
    transition: opacity 0.2s, background 0.2s;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.15);
  }

  &:hover::before {
    opacity: 1;
    background: rgba(0, 0, 0, 0.8);
  }
`;

export interface AnnotationBoxComponentProps {
  startPosition: number;
  endPosition: number;
  label?: string;
  color?: string;
  isActive?: boolean;
  onClick?: () => void;
  onDragStart?: (edge: 'start' | 'end', e: React.DragEvent) => void;
  onDrag?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export const AnnotationBox: FunctionComponent<AnnotationBoxComponentProps> = ({
  startPosition,
  endPosition,
  label,
  color = '#ff9800',
  isActive = false,
  onClick,
  onDragStart,
  onDrag,
  onDragEnd,
}) => {
  const width = Math.max(0, endPosition - startPosition);

  if (width <= 0) {
    return null;
  }

  const handleDragStart = (edge: 'start' | 'end') => (e: React.DragEvent) => {
    // Create a transparent div element to use as drag image
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-9999px';
    dragImage.style.width = '1px';
    dragImage.style.height = '1px';
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);

    e.dataTransfer.setDragImage(dragImage, 0, 0);
    e.dataTransfer.effectAllowed = 'move';

    // Clean up the drag image element after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);

    if (onDragStart) {
      onDragStart(edge, e);
    }
  };

  const handleHandleClick = (e: React.MouseEvent) => {
    // Prevent clicks on resize handles from bubbling to annotation box
    e.stopPropagation();
  };

  return (
    <Box
      $left={startPosition}
      $width={width}
      $color={color}
      $isActive={isActive}
      onClick={onClick}
    >
      <ResizeHandle
        $position="left"
        draggable="true"
        onDragStart={handleDragStart('start')}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClick={handleHandleClick}
      />
      {label && <Label>{label}</Label>}
      <ResizeHandle
        $position="right"
        draggable="true"
        onDragStart={handleDragStart('end')}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClick={handleHandleClick}
      />
    </Box>
  );
};
