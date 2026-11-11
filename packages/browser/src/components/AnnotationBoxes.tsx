import React, { useContext } from 'react';
import {
  AnnotationIntegrationContext,
  type AnnotationBoxIntegrationProps,
} from '../AnnotationIntegrationContext';
import type { AnnotationData, GetAnnotationBoxLabelFn } from '../types/annotations';

const BOX_ROW_HEIGHT = 30;
const BOX_COLOR = '#ff9800';

interface AnnotationBoxItemProps {
  AnnotationBox: React.ComponentType<AnnotationBoxIntegrationProps>;
  annotation: AnnotationData;
  index: number;
  startPosition: number;
  endPosition: number;
  label: string;
  isActive: boolean;
  editable: boolean;
  onSelect: (annotation: AnnotationData) => void;
}

/**
 * One annotation box. Memoized: the active annotation changes at every
 * annotation boundary during playback, and only the box that stops being
 * active and the box that becomes active have a changed prop (#740).
 */
const AnnotationBoxItem = React.memo(function AnnotationBoxItem({
  AnnotationBox,
  annotation,
  index,
  startPosition,
  endPosition,
  label,
  isActive,
  editable,
  onSelect,
}: AnnotationBoxItemProps) {
  return (
    <AnnotationBox
      annotationId={annotation.id}
      annotationIndex={index}
      startPosition={startPosition}
      endPosition={endPosition}
      label={label}
      color={BOX_COLOR}
      isActive={isActive}
      onClick={() => onSelect(annotation)}
      editable={editable}
    />
  );
});

export interface AnnotationBoxesProps {
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  /** Whether the box edges can be dragged. */
  editable: boolean;
  /** Width of the row in pixels (the full timeline width). */
  width: number;
  sampleRate: number;
  samplesPerPixel: number;
  /** Label for a box. Default: the annotation's id. */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  /**
   * Called with the annotation of a clicked box. It is a prop of every
   * memoized box, so it must keep its identity across renders in which only
   * the active annotation changed.
   */
  onSelect: (annotation: AnnotationData) => void;
}

/**
 * The row of annotation boxes under the waveform, for both players (#744).
 * The caller reads its provider and passes the values in; drag-and-drop
 * (`DragDropProvider`) is the caller's too. Renders nothing without the
 * annotation integration or without annotations.
 */
export const AnnotationBoxes: React.FC<AnnotationBoxesProps> = ({
  annotations,
  activeAnnotationId,
  editable,
  width,
  sampleRate,
  samplesPerPixel,
  getAnnotationBoxLabel,
  onSelect,
}) => {
  const annotationIntegration = useContext(AnnotationIntegrationContext);

  if (annotations.length === 0 || !annotationIntegration) return null;

  const { AnnotationBox, AnnotationBoxesWrapper } = annotationIntegration;

  return (
    <AnnotationBoxesWrapper height={BOX_ROW_HEIGHT} width={width}>
      {annotations.map((annotation, index) => (
        <AnnotationBoxItem
          key={annotation.id}
          AnnotationBox={AnnotationBox}
          annotation={annotation}
          index={index}
          startPosition={(annotation.start * sampleRate) / samplesPerPixel}
          endPosition={(annotation.end * sampleRate) / samplesPerPixel}
          label={getAnnotationBoxLabel ? getAnnotationBoxLabel(annotation, index) : annotation.id}
          isActive={annotation.id === activeAnnotationId}
          editable={editable}
          onSelect={onSelect}
        />
      ))}
    </AnnotationBoxesWrapper>
  );
};
