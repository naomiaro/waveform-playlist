import React from 'react';
import styled from 'styled-components';
import { MoveUpIcon } from './MoveUpIcon';
import { GripIcon } from './GripIcon';
import { MoveDownIcon } from './MoveDownIcon';

/**
 * Vertical flex column. Position-agnostic — the consumer places it via the
 * `style` prop (e.g. absolute positioning within a track control panel).
 */
const Rail = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: ${(props) => props.theme.textColor};
  opacity: 0.55;
  transition: opacity 0.15s ease-in-out;

  &:hover,
  &:focus-within {
    opacity: 1;
  }
`;

const RailButton = styled.button.attrs({ type: 'button' })`
  border: none;
  background: transparent;
  color: inherit;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${(props) => props.theme.borderRadius};

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 0.2rem ${(props) => props.theme.inputFocusBorder}33;
  }
`;

const ChevronButton = styled(RailButton)`
  width: 16px;
  height: 14px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${(props) => props.theme.borderColor};
  }

  &:disabled {
    opacity: 0.15;
    cursor: default;
  }
`;

const GripButton = styled(RailButton)`
  width: 16px;
  height: 20px;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`;

export interface ReorderRailProps {
  onMoveUp: (e: React.MouseEvent) => void;
  onMoveDown: (e: React.MouseEvent) => void;
  upDisabled?: boolean;
  downDisabled?: boolean;
  /** Attach to the grip element (drag activation surface). */
  gripRef?: React.Ref<HTMLButtonElement>;
  onGripClick?: (e: React.MouseEvent) => void;
  /** Positioning within the parent panel is the consumer's responsibility. */
  style?: React.CSSProperties;
}

/**
 * Channel-strip reorder rail: chevron-up / drag-grip / chevron-down stacked
 * vertically. Fades to 55% opacity at rest, full opacity on hover/focus.
 */
export const ReorderRail: React.FC<ReorderRailProps> = ({
  onMoveUp,
  onMoveDown,
  upDisabled = false,
  downDisabled = false,
  gripRef,
  onGripClick,
  style,
}) => (
  <Rail style={style}>
    <ChevronButton aria-label="Move track up" disabled={upDisabled} onClick={onMoveUp}>
      <MoveUpIcon size={12} />
    </ChevronButton>
    <GripButton
      ref={gripRef}
      aria-label="Drag to reorder track"
      title="Drag to reorder track"
      onClick={onGripClick}
    >
      <GripIcon size={14} />
    </GripButton>
    <ChevronButton aria-label="Move track down" disabled={downDisabled} onClick={onMoveDown}>
      <MoveDownIcon size={12} />
    </ChevronButton>
  </Rail>
);
