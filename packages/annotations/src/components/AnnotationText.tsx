import React, { FunctionComponent, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type { AnnotationData, AnnotationAction, AnnotationActionOptions } from './Annotation';

interface ContainerProps {
  $height?: number;
}

const Container = styled.div<ContainerProps>`
  background: ${(props) => props.theme?.backgroundColor || '#fff'};
  ${(props) => props.$height ? `height: ${props.$height}px;` : 'max-height: 200px;'}
  overflow-y: auto;
  padding: 8px;
`;

const AnnotationItem = styled.div<{ $isActive?: boolean }>`
  padding: 12px;
  margin-bottom: 6px;
  border-left: 4px solid ${(props) => (props.$isActive ? '#ff9800' : 'transparent')};
  background: ${(props) => (props.$isActive ? 'rgba(255, 152, 0, 0.15)' : 'transparent')};
  border-radius: 4px;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: ${(props) => (props.$isActive ? '0 2px 8px rgba(255, 152, 0, 0.25), inset 0 0 0 1px rgba(255, 152, 0, 0.3)' : 'none')};

  &:hover {
    background: ${(props) => (props.$isActive ? 'rgba(255, 152, 0, 0.2)' : props.theme?.annotationTextItemHoverBackground || 'rgba(0, 0, 0, 0.05)')};
    border-left-color: ${(props) => (props.$isActive ? '#ff9800' : props.theme?.borderColor || '#ddd')};
  }

  &:focus-visible {
    outline: 2px solid #ff9800;
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
  outline: ${(props) => (props.$isEditable ? `1px dashed ${props.theme?.borderColor || '#ddd'}` : 'none')};

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: rgba(255, 152, 0, 0.1);
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
  outline: ${(props) => (props.$isEditable ? `1px dashed ${props.theme?.borderColor || '#ddd'}` : 'none')};
  padding: ${(props) => (props.$isEditable ? '6px' : '0')};
  border-radius: 3px;
  min-height: 20px;

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: rgba(255, 152, 0, 0.1);
  }
`;

export interface AnnotationTextProps {
  annotations: AnnotationData[];
  activeAnnotationId?: string;
  shouldScrollToActive?: boolean;
  editable?: boolean;
  controls?: AnnotationAction[];
  annotationListConfig?: AnnotationActionOptions;
  height?: number;
  onAnnotationClick?: (annotation: AnnotationData) => void;
  onAnnotationUpdate?: (updatedAnnotations: AnnotationData[]) => void;
}

const AnnotationTextComponent: FunctionComponent<AnnotationTextProps> = ({
  annotations,
  activeAnnotationId,
  shouldScrollToActive = false,
  editable = false,
  controls = [],
  annotationListConfig,
  height,
  onAnnotationClick,
  onAnnotationUpdate,
}) => {
  const activeAnnotationRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevActiveIdRef = useRef<string | undefined>(undefined);

  // Track component renders and scroll position
  useEffect(() => {
    // Render tracking removed
  });

  // Track scroll changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Scroll tracking removed
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to active annotation when it changes
  useEffect(() => {
    // Only scroll if parent says we should (prevents scrolling on remount after pause)
    if (activeAnnotationId && activeAnnotationRef.current && shouldScrollToActive) {
      activeAnnotationRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }

    prevActiveIdRef.current = activeAnnotationId;
  }, [activeAnnotationId, shouldScrollToActive]);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '0:00.000';
    }
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  const handleTextEdit = (index: number, newText: string) => {
    if (!editable || !onAnnotationUpdate) return;

    const updatedAnnotations = [...annotations];
    updatedAnnotations[index] = {
      ...updatedAnnotations[index],
      lines: newText.split('\n'),
    };
    onAnnotationUpdate(updatedAnnotations);
  };

  const handleIdEdit = (index: number, newId: string) => {
    if (!editable || !onAnnotationUpdate) return;

    const trimmedId = newId.trim();
    if (!trimmedId) return; // Don't allow empty IDs

    const updatedAnnotations = [...annotations];
    updatedAnnotations[index] = {
      ...updatedAnnotations[index],
      id: trimmedId,
    };
    onAnnotationUpdate(updatedAnnotations);
  };

  const handleControlClick = (control: AnnotationAction, annotation: AnnotationData, index: number) => {
    if (!onAnnotationUpdate) return;

    const annotationsCopy = [...annotations];
    control.action(annotationsCopy[index], index, annotationsCopy, annotationListConfig || {});
    onAnnotationUpdate(annotationsCopy);
  };

  const getIconClass = (classString: string) => {
    return classString.replace(/\./g, ' ');
  };

  return (
    <Container ref={containerRef} $height={height}>
      {annotations.map((annotation, index) => {
        const isActive = annotation.id === activeAnnotationId;
        return (
        <AnnotationItem
          key={annotation.id}
          ref={isActive ? activeAnnotationRef : null}
          $isActive={isActive}
          onClick={() => onAnnotationClick?.(annotation)}
        >
          <AnnotationHeader>
            <AnnotationInfo>
              <AnnotationIdLabel
                $isEditable={editable}
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => handleIdEdit(index, e.currentTarget.textContent || '')}
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
                    onClick={() => handleControlClick(control, annotation, index)}
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
            onBlur={(e) => handleTextEdit(index, e.currentTarget.textContent || '')}
          >
            {annotation.lines.join('\n')}
          </AnnotationTextContent>
        </AnnotationItem>
        );
      })}
    </Container>
  );
};

// Memoize to prevent unnecessary remounting when parent re-renders
export const AnnotationText = React.memo(AnnotationTextComponent);
