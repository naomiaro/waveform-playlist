import React, { FunctionComponent } from 'react';
import styled from 'styled-components';
import { useDraggable } from '@dnd-kit/core';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

interface WrapperProps {
  readonly $left: number;
  readonly $width: number;
}

// Wrapper positions the annotation and contains both Box and ResizeHandles as siblings
const Wrapper = styled.div.attrs<WrapperProps>((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`,
  },
}))<WrapperProps>`
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none; /* Let events pass through to children */
`;

interface BoxProps {
  readonly $color: string;
  readonly $isActive?: boolean;
}

const Box = styled.div<BoxProps>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: ${(props) => props.$isActive
    ? (props.theme?.annotationBoxActiveBackground || 'rgba(255, 200, 100, 0.95)')
    : (props.theme?.annotationBoxBackground || 'rgba(255, 255, 255, 0.85)')};
  border: ${(props) => props.$isActive ? '3px' : '2px'} solid ${(props) => props.$isActive
    ? (props.theme?.annotationBoxActiveBorder || '#ff9800')
    : props.$color};
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: ${(props) => props.$isActive
    ? '0 2px 8px rgba(255, 152, 0, 0.4), inset 0 0 0 1px rgba(255, 152, 0, 0.2)'
    : '0 1px 3px rgba(0, 0, 0, 0.1)'};

  &:hover {
    background: ${(props) => props.theme?.annotationBoxHoverBackground || 'rgba(255, 255, 255, 0.98)'};
    border-color: ${(props) => props.theme?.annotationBoxActiveBorder || '#ff9800'};
    border-width: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
`;

const Label = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(props) => props.theme?.annotationLabelColor || '#2a2a2a'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px;
  letter-spacing: 0.3px;
  user-select: none;
`;

interface ResizeHandleStyledProps {
  $position: 'left' | 'right';
  $isDragging?: boolean;
}

// ResizeHandles are now siblings of Box, positioned relative to Wrapper
// Reduced from 30px/-15px to 16px/-8px to minimize overlap between adjacent annotations
const ResizeHandle = styled.div<ResizeHandleStyledProps>`
  position: absolute;
  top: 0;
  ${(props) => props.$position === 'left' ? 'left: -8px' : 'right: -8px'};
  width: 16px;
  height: 100%;
  cursor: ew-resize;
  z-index: 120; /* Above ClickOverlay (z-index: 100) and AnnotationBoxesWrapper (z-index: 110) */
  background: ${(props) => props.$isDragging
    ? (props.theme?.annotationResizeHandleColor || 'rgba(0, 0, 0, 0.2)')
    : 'transparent'};
  border-radius: 4px;
  touch-action: none; /* Important for @dnd-kit on touch devices */
  pointer-events: auto;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 60%;
    background: ${(props) => props.$isDragging
      ? (props.theme?.annotationResizeHandleActiveColor || 'rgba(0, 0, 0, 0.8)')
      : (props.theme?.annotationResizeHandleColor || 'rgba(0, 0, 0, 0.4)')};
    border-radius: 2px;
    opacity: ${(props) => props.$isDragging ? 1 : 0.6};
    transition: opacity 0.2s, background 0.2s;
  }

  &:hover {
    background: ${(props) => props.theme?.annotationResizeHandleColor || 'rgba(0, 0, 0, 0.1)'};
  }

  &:hover::before {
    opacity: 1;
    background: ${(props) => props.theme?.annotationResizeHandleActiveColor || 'rgba(0, 0, 0, 0.7)'};
  }
`;

export interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  isDragging: boolean;
}

export interface AnnotationBoxComponentProps {
  annotationId: string;
  annotationIndex: number;
  startPosition: number;
  endPosition: number;
  label?: string;
  color?: string;
  isActive?: boolean;
  onClick?: () => void;
  editable?: boolean; // Whether to show drag handles
}

export const AnnotationBox: FunctionComponent<AnnotationBoxComponentProps> = ({
  annotationId,
  annotationIndex,
  startPosition,
  endPosition,
  label,
  color = '#ff9800',
  isActive = false,
  onClick,
  editable = true,
}) => {
  const width = Math.max(0, endPosition - startPosition);

  // Left (start) boundary draggable
  const leftBoundaryId = `annotation-boundary-start-${annotationIndex}`;
  const {
    attributes: leftAttributes,
    listeners: leftListeners,
    setActivatorNodeRef: setLeftActivatorRef,
    isDragging: isLeftDragging,
  } = useDraggable({
    id: leftBoundaryId,
    data: { annotationId, annotationIndex, edge: 'start' as const },
    disabled: !editable,
  });

  // Right (end) boundary draggable
  const rightBoundaryId = `annotation-boundary-end-${annotationIndex}`;
  const {
    attributes: rightAttributes,
    listeners: rightListeners,
    setActivatorNodeRef: setRightActivatorRef,
    isDragging: isRightDragging,
  } = useDraggable({
    id: rightBoundaryId,
    data: { annotationId, annotationIndex, edge: 'end' as const },
    disabled: !editable,
  });

  if (width <= 0) {
    return null;
  }

  // Wrap @dnd-kit pointer handlers to also stop propagation
  // This prevents the ClickOverlay from capturing the event
  const createPointerDownHandler = (dndKitHandler?: (e: React.PointerEvent) => void) => {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      dndKitHandler?.(e);
    };
  };

  const handleHandleClick = (e: React.MouseEvent) => {
    // Prevent clicks on resize handles from bubbling to annotation box
    e.stopPropagation();
  };

  return (
    <Wrapper $left={startPosition} $width={width}>
      <Box
        $color={color}
        $isActive={isActive}
        onClick={onClick}
      >
        {label && <Label>{label}</Label>}
      </Box>
      {editable && (
        <ResizeHandle
          ref={setLeftActivatorRef}
          $position="left"
          $isDragging={isLeftDragging}
          onClick={handleHandleClick}
          {...leftListeners}
          onPointerDown={createPointerDownHandler(leftListeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined)}
          {...leftAttributes}
        />
      )}
      {editable && (
        <ResizeHandle
          ref={setRightActivatorRef}
          $position="right"
          $isDragging={isRightDragging}
          onClick={handleHandleClick}
          {...rightListeners}
          onPointerDown={createPointerDownHandler(rightListeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined)}
          {...rightAttributes}
        />
      )}
    </Wrapper>
  );
};
