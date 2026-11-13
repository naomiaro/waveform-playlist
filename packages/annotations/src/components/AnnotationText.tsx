import React, { FunctionComponent, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type {
  AnnotationData,
  AnnotationAction,
  AnnotationActionOptions,
  RenderAnnotationItemProps,
} from '@waveform-playlist/core';

interface ContainerProps {
  $height?: number;
}

/** The colour of the active row and of the focus rings (theme: `annotationTextItemActiveColor`). */
const activeColor = (props: { theme?: { annotationTextItemActiveColor?: string } }) =>
  props.theme?.annotationTextItemActiveColor || '#ff9800';
/** That colour at an opacity, as the tints and glows of the active row use it. */
const activeTint = (percent: number) => (props: Parameters<typeof activeColor>[0]) =>
  `color-mix(in srgb, ${activeColor(props)} ${percent}%, transparent)`;

const Container = styled.div<ContainerProps>`
  background: ${(props) => props.theme?.backgroundColor || '#fff'};
  ${(props) => (props.$height ? `height: ${props.$height}px;` : 'max-height: 200px;')}
  overflow-y: auto;
  padding: 8px;
`;

const AnnotationItem = styled.div<{ $isActive?: boolean }>`
  padding: 12px;
  margin-bottom: 6px;
  border-left: 4px solid ${(props) => (props.$isActive ? activeColor(props) : 'transparent')};
  background: ${(props) => (props.$isActive ? activeTint(15)(props) : 'transparent')};
  border-radius: 4px;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: ${(props) =>
    props.$isActive
      ? `0 2px 8px ${activeTint(25)(props)}, inset 0 0 0 1px ${activeTint(30)(props)}`
      : 'none'};

  &:hover {
    background: ${(props) =>
      props.$isActive
        ? activeTint(20)(props)
        : props.theme?.annotationTextItemHoverBackground || 'rgba(0, 0, 0, 0.05)'};
    border-left-color: ${(props) =>
      props.$isActive ? activeColor(props) : props.theme?.borderColor || '#ddd'};
  }

  &:focus-visible {
    outline: 2px solid ${activeColor};
    outline-offset: 2px;
  }
`;

const AnnotationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const AnnotationInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AnnotationIdLabel = styled.span<{ $isEditable?: boolean }>`
  font-size: 11px;
  font-weight: 600;
  color: ${(props) => props.theme?.textColorMuted || '#666'};
  background: transparent;
  padding: 2px 6px;
  border-radius: 3px;
  min-width: 20px;
  outline: ${(props) =>
    props.$isEditable ? `1px dashed ${props.theme?.borderColor || '#ddd'}` : 'none'};

  &[contenteditable='true']:focus {
    outline: 2px solid ${activeColor};
    background: ${activeTint(10)};
  }
`;

const TimeRange = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${(props) => props.theme?.textColorMuted || '#555'};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  letter-spacing: 0.5px;
`;

const AnnotationControls = styled.div`
  display: flex;
  gap: 6px;
`;

const ControlButton = styled.button`
  background: ${(props) => props.theme?.surfaceColor || '#f5f5f5'};
  border: 1px solid ${(props) => props.theme?.borderColor || '#ccc'};
  color: ${(props) => props.theme?.textColor || '#333'};
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: ${(props) => props.theme?.inputBackground || '#3d3d3d'};
    border-color: ${(props) => props.theme?.textColorMuted || '#999'};
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const AnnotationTextContent = styled.div<{ $isEditable?: boolean }>`
  font-size: 14px;
  line-height: 1.6;
  color: ${(props) => props.theme?.textColor || '#2a2a2a'};
  white-space: pre-wrap;
  word-break: break-word;
  outline: ${(props) =>
    props.$isEditable ? `1px dashed ${props.theme?.borderColor || '#ddd'}` : 'none'};
  padding: ${(props) => (props.$isEditable ? '6px' : '0')};
  border-radius: 3px;
  min-height: 20px;

  &[contenteditable='true']:focus {
    outline: 2px solid ${activeColor};
    background: ${activeTint(10)};
  }
`;

export interface AnnotationTextProps {
  annotations: AnnotationData[];
  activeAnnotationId?: string;
  shouldScrollToActive?: boolean;
  /** Where to position the active annotation when scrolling: 'center', 'start', 'end', or 'nearest'. Defaults to 'center'. */
  scrollActivePosition?: ScrollLogicalPosition;
  /** Which scrollable containers to scroll: 'nearest' (only the annotation list) or 'all' (including viewport). Defaults to 'nearest'. */
  scrollActiveContainer?: 'nearest' | 'all';
  editable?: boolean;
  controls?: AnnotationAction[];
  annotationListConfig?: AnnotationActionOptions;
  height?: number;
  onAnnotationClick?: (annotation: AnnotationData) => void;
  onAnnotationUpdate?: (updatedAnnotations: AnnotationData[]) => void;
  /**
   * Custom render function for annotation items.
   * When provided, completely replaces the default annotation item rendering.
   * Use this to customize the appearance of each annotation in the list.
   */
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => React.ReactNode;
}

const NO_CONTROLS: AnnotationAction[] = [];

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) {
    return '0:00.000';
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
};

const getIconClass = (classString: string) => {
  return classString.replace(/\./g, ' ');
};

const blurOnEnter = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.currentTarget.blur();
  }
};

interface AnnotationListItemProps {
  annotation: AnnotationData;
  index: number;
  isActive: boolean;
  /** Set on the active item only, so the list can scroll to it. */
  itemRef?: React.Ref<HTMLDivElement>;
  editable: boolean;
  controls: AnnotationAction[];
  onAnnotationClick?: (annotation: AnnotationData) => void;
  onTextEdit: (index: number, newText: string) => void;
  onIdEdit: (index: number, newId: string) => void;
  onControlClick: (control: AnnotationAction, index: number) => void;
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => React.ReactNode;
}

/**
 * One row of the list. Memoized: the active annotation changes at every
 * annotation boundary during playback, and only the row that stops being
 * active and the row that becomes active have a changed prop (#740). Every
 * function handed to it must therefore keep its identity across a render of
 * the list that did not change it.
 */
const AnnotationListItem = React.memo(function AnnotationListItem({
  annotation,
  index,
  isActive,
  itemRef,
  editable,
  controls,
  onAnnotationClick,
  onTextEdit,
  onIdEdit,
  onControlClick,
  renderAnnotationItem,
}: AnnotationListItemProps) {
  const handleClick = () => onAnnotationClick?.(annotation);
  // The default row: a click in a field that is being edited places the
  // caret, it does not choose the annotation. (The action buttons stop their
  // own clicks.)
  const handleRowClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as Element | null;
    if (target?.closest?.('[contenteditable="true"]')) return;
    handleClick();
  };

  // Use custom render function if provided
  if (renderAnnotationItem) {
    return (
      <div ref={itemRef}>
        {renderAnnotationItem({
          annotation,
          index,
          isActive,
          onClick: handleClick,
          formatTime,
        })}
      </div>
    );
  }

  // Default rendering
  return (
    <AnnotationItem ref={itemRef} $isActive={isActive} onClick={handleRowClick}>
      <AnnotationHeader>
        <AnnotationInfo>
          <AnnotationIdLabel
            $isEditable={editable}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={(e) => onIdEdit(index, e.currentTarget.textContent || '')}
            onKeyDown={blurOnEnter}
          >
            {annotation.id}
          </AnnotationIdLabel>
          <TimeRange>
            {formatTime(annotation.start)} - {formatTime(annotation.end)}
          </TimeRange>
        </AnnotationInfo>
        {controls.length > 0 && (
          <AnnotationControls onClick={(e) => e.stopPropagation()}>
            {controls.map((control, idx) => (
              <ControlButton
                key={idx}
                title={control.title}
                onClick={() => onControlClick(control, index)}
              >
                {control.text ? control.text : <i className={getIconClass(control.class || '')} />}
              </ControlButton>
            ))}
          </AnnotationControls>
        )}
      </AnnotationHeader>
      <AnnotationTextContent
        $isEditable={editable}
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={(e) => onTextEdit(index, e.currentTarget.textContent || '')}
        onKeyDown={blurOnEnter}
      >
        {annotation.lines.join('\n')}
      </AnnotationTextContent>
    </AnnotationItem>
  );
});

const AnnotationTextComponent: FunctionComponent<AnnotationTextProps> = ({
  annotations,
  activeAnnotationId,
  shouldScrollToActive = false,
  scrollActivePosition = 'center',
  scrollActiveContainer = 'nearest',
  editable = false,
  controls = NO_CONTROLS,
  annotationListConfig,
  height,
  onAnnotationClick,
  onAnnotationUpdate,
  renderAnnotationItem,
}) => {
  const activeAnnotationRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active annotation when it changes
  useEffect(() => {
    // Only scroll if parent says we should (prevents scrolling on remount after pause)
    if (activeAnnotationId && activeAnnotationRef.current && shouldScrollToActive) {
      activeAnnotationRef.current.scrollIntoView({
        behavior: 'smooth',
        block: scrollActivePosition,
        container: scrollActiveContainer,
      } as ScrollIntoViewOptions);
    }
  }, [activeAnnotationId, shouldScrollToActive, scrollActivePosition, scrollActiveContainer]);

  // The three handlers below are props of every memoized row. Their
  // dependencies do not change when only the active annotation does.
  // The handlers below are props of every memoized row. They read the list
  // through a ref so that a change to one annotation (each move of an edge
  // drag) re-renders that annotation's row and not all of them.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  // The options an action is called with are only needed when its button is
  // pressed. Read through a ref, a change of them (a link-endpoints or
  // continuous-play toggle) does not give every row a new handler.
  const annotationListConfigRef = useRef(annotationListConfig);
  annotationListConfigRef.current = annotationListConfig;

  const handleTextEdit = useCallback(
    (index: number, newText: string) => {
      if (!editable || !onAnnotationUpdate) return;

      const updatedAnnotations = [...annotationsRef.current];
      updatedAnnotations[index] = {
        ...updatedAnnotations[index],
        lines: newText.split('\n'),
      };
      onAnnotationUpdate(updatedAnnotations);
    },
    [editable, onAnnotationUpdate]
  );

  const handleIdEdit = useCallback(
    (index: number, newId: string) => {
      if (!editable || !onAnnotationUpdate) return;

      const trimmedId = newId.trim();
      if (!trimmedId) return; // Don't allow empty IDs

      const updatedAnnotations = [...annotationsRef.current];
      updatedAnnotations[index] = {
        ...updatedAnnotations[index],
        id: trimmedId,
      };
      onAnnotationUpdate(updatedAnnotations);
    },
    [editable, onAnnotationUpdate]
  );

  const handleControlClick = useCallback(
    (control: AnnotationAction, index: number) => {
      if (!onAnnotationUpdate) return;

      const annotationsCopy = [...annotationsRef.current];
      control.action(
        annotationsCopy[index],
        index,
        annotationsCopy,
        annotationListConfigRef.current || {}
      );
      onAnnotationUpdate(annotationsCopy);
    },
    [onAnnotationUpdate]
  );

  return (
    <Container $height={height}>
      {annotations.map((annotation, index) => {
        const isActive = annotation.id === activeAnnotationId;
        return (
          <AnnotationListItem
            key={annotation.id}
            annotation={annotation}
            index={index}
            isActive={isActive}
            itemRef={isActive ? activeAnnotationRef : undefined}
            editable={editable}
            controls={controls}
            onAnnotationClick={onAnnotationClick}
            onTextEdit={handleTextEdit}
            onIdEdit={handleIdEdit}
            onControlClick={handleControlClick}
            renderAnnotationItem={renderAnnotationItem}
          />
        );
      })}
    </Container>
  );
};

// Memoize to prevent unnecessary remounting when parent re-renders
export const AnnotationText = React.memo(AnnotationTextComponent);
