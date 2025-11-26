import React, { FunctionComponent, useState } from 'react';
import styled from 'styled-components';

interface AnnotationOverlayProps {
  readonly $left: number;
  readonly $width: number;
  readonly $color: string;
}

const AnnotationOverlay = styled.div.attrs<AnnotationOverlayProps>((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`,
  },
}))<AnnotationOverlayProps>`
  position: absolute;
  top: 0;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 10;
  pointer-events: auto;
  opacity: 0.3;
  border: 2px solid ${(props) => props.$color};
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    opacity: 0.5;
    border-color: ${(props) => props.$color};
  }
`;

const AnnotationText = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.3;
  max-height: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  white-space: pre-wrap;
  word-break: break-word;
`;

const EditableText = styled.textarea`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.3;
  max-height: 60%;
  overflow: auto;
  border: 1px solid #fff;
  resize: none;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #4CAF50;
  }
`;

const ControlsBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  gap: 4px;
  padding: 4px;
  justify-content: flex-start;
  align-items: center;
`;

const ControlButton = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: white;
  }

  &:active {
    background: rgba(255, 255, 255, 0.3);
  }
`;

/**
 * Configuration options passed to annotation action handlers
 */
export interface AnnotationActionOptions {
  /** Whether annotation endpoints are linked (moving one endpoint moves the other) */
  linkEndpoints?: boolean;
  /** Whether to continue playing after an annotation ends */
  continuousPlay?: boolean;
  /** Additional custom properties */
  [key: string]: unknown;
}

export interface AnnotationAction {
  class?: string;
  text?: string;
  title: string;
  action: (annotation: AnnotationData, index: number, annotations: AnnotationData[], opts: AnnotationActionOptions) => void;
}

export interface AnnotationData {
  id: string;
  start: number;
  end: number;
  lines: string[];
  language?: string;
}

export interface AnnotationProps {
  annotation: AnnotationData;
  index: number;
  allAnnotations: AnnotationData[];
  startPosition: number; // Start position in pixels
  endPosition: number;   // End position in pixels
  color?: string;
  editable?: boolean;
  controls?: AnnotationAction[];
  onAnnotationUpdate?: (updatedAnnotations: AnnotationData[]) => void;
  annotationListConfig?: AnnotationActionOptions;
  onClick?: (annotation: AnnotationData) => void;
}

export const Annotation: FunctionComponent<AnnotationProps> = ({
  annotation,
  index,
  allAnnotations,
  startPosition,
  endPosition,
  color = '#ff9800',
  editable = false,
  controls = [],
  onAnnotationUpdate,
  annotationListConfig,
  onClick,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(annotation.lines.join('\n'));
  const width = Math.max(0, endPosition - startPosition);

  if (width <= 0) {
    return null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick(annotation);
    }
  };

  const handleDoubleClick = () => {
    if (editable) {
      setIsEditing(true);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedText(e.target.value);
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    const newLines = editedText.split('\n');
    if (newLines.join('\n') !== annotation.lines.join('\n')) {
      const updatedAnnotations = [...allAnnotations];
      updatedAnnotations[index] = { ...annotation, lines: newLines };
      if (onAnnotationUpdate) {
        onAnnotationUpdate(updatedAnnotations);
      }
    }
  };

  const handleControlClick = (control: AnnotationAction) => {
    const annotationsCopy = [...allAnnotations];
    control.action(annotationsCopy[index], index, annotationsCopy, annotationListConfig || {});
    if (onAnnotationUpdate) {
      onAnnotationUpdate(annotationsCopy);
    }
  };

  const getIconClass = (classString: string) => {
    // Convert "fas.fa-minus" to "fas fa-minus"
    return classString.replace(/\./g, ' ');
  };

  return (
    <AnnotationOverlay
      $left={startPosition}
      $width={width}
      $color={color}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {controls.length > 0 && (
        <ControlsBar>
          {controls.map((control, idx) => (
            <ControlButton
              key={idx}
              title={control.title}
              onClick={(e) => {
                e.stopPropagation();
                handleControlClick(control);
              }}
            >
              {control.text ? control.text : <i className={getIconClass(control.class || '')} />}
            </ControlButton>
          ))}
        </ControlsBar>
      )}
      {isEditing ? (
        <EditableText
          value={editedText}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <AnnotationText>
          {annotation.lines.join('\n')}
        </AnnotationText>
      )}
    </AnnotationOverlay>
  );
};
