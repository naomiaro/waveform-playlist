import React, { FunctionComponent, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type { AnnotationData, AnnotationAction } from './Annotation';

const Container = styled.div`
  background: #fff;
  border-top: 2px solid #ddd;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
`;

const AnnotationItem = styled.div<{ $isActive?: boolean }>`
  padding: 8px;
  margin-bottom: 4px;
  border-left: 4px solid ${(props) => (props.$isActive ? '#ff9800' : '#ccc')};
  background: ${(props) => (props.$isActive ? '#fff3e0' : '#f9f9f9')};
  transition: all 0.2s;
`;

const AnnotationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
`;

const TimeRange = styled.span`
  font-size: 11px;
  color: #666;
  font-family: monospace;
`;

const AnnotationControls = styled.div`
  display: flex;
  gap: 4px;
`;

const ControlButton = styled.button`
  background: transparent;
  border: 1px solid #ccc;
  padding: 2px 6px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 3px;

  &:hover {
    background: #e0e0e0;
    border-color: #999;
  }
`;

const AnnotationTextContent = styled.div<{ $isEditable?: boolean }>`
  font-size: 13px;
  line-height: 1.4;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
  outline: ${(props) => (props.$isEditable ? '1px dashed #ccc' : 'none')};
  padding: ${(props) => (props.$isEditable ? '4px' : '0')};

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: #fffef7;
  }
`;

export interface AnnotationTextProps {
  annotations: AnnotationData[];
  activeAnnotationId?: string;
  shouldScrollToActive?: boolean;
  editable?: boolean;
  controls?: AnnotationAction[];
  annotationListConfig?: any;
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
  onAnnotationClick,
  onAnnotationUpdate,
}) => {
  const activeAnnotationRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevActiveIdRef = useRef<string | undefined>(undefined);

  // Track component renders and scroll position
  useEffect(() => {
    console.log('[AnnotationText] Render - activeAnnotationId:', activeAnnotationId, 'prev:', prevActiveIdRef.current, 'scrollTop:', containerRef.current?.scrollTop);
  });

  // Track scroll changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      console.log('[AnnotationText] Scroll event - scrollTop:', container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to active annotation when it changes
  useEffect(() => {
    console.log('[AnnotationText] useEffect triggered - activeAnnotationId:', activeAnnotationId, 'shouldScrollToActive:', shouldScrollToActive, 'will scroll:', !!(activeAnnotationId && activeAnnotationRef.current && shouldScrollToActive));

    // Only scroll if parent says we should (prevents scrolling on remount after pause)
    if (activeAnnotationId && activeAnnotationRef.current && shouldScrollToActive) {
      console.log('[AnnotationText] Calling scrollIntoView for:', activeAnnotationId);
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
    <Container ref={containerRef}>
      {annotations.map((annotation, index) => {
        const isActive = annotation.id === activeAnnotationId;
        return (
        <AnnotationItem
          key={annotation.id}
          ref={isActive ? activeAnnotationRef : null}
          $isActive={isActive}
        >
          <AnnotationHeader>
            <TimeRange>
              {formatTime(annotation.start)} - {formatTime(annotation.end)}
            </TimeRange>
            {controls.length > 0 && (
              <AnnotationControls onClick={(e) => e.stopPropagation()}>
                {controls.map((control, idx) => (
                  <ControlButton
                    key={idx}
                    title={control.title}
                    onClick={() => handleControlClick(control, annotation, index)}
                  >
                    <i className={getIconClass(control.class)} />
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
