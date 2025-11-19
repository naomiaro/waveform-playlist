import React, { FunctionComponent } from 'react';
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
  editable?: boolean;
  controls?: AnnotationAction[];
  annotationListConfig?: any;
  onAnnotationClick?: (annotation: AnnotationData) => void;
  onAnnotationUpdate?: (updatedAnnotations: AnnotationData[]) => void;
}

export const AnnotationText: FunctionComponent<AnnotationTextProps> = ({
  annotations,
  activeAnnotationId,
  editable = false,
  controls = [],
  annotationListConfig,
  onAnnotationClick,
  onAnnotationUpdate,
}) => {
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
    <Container>
      {annotations.map((annotation, index) => (
        <AnnotationItem
          key={annotation.id}
          $isActive={annotation.id === activeAnnotationId}
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
      ))}
    </Container>
  );
};
