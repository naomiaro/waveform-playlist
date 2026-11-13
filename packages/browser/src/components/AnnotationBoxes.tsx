import React, { use } from 'react';
import {
  AnnotationIntegrationContext,
  type AnnotationBoxIntegrationProps,
} from '../AnnotationIntegrationContext';
import type { AnnotationData } from '@waveform-playlist/core';
import type { GetAnnotationBoxLabelFn } from '../types/annotations';

interface AnnotationBoxItemProps {
  AnnotationBox: React.ComponentType<AnnotationBoxIntegrationProps>;
  annotation: AnnotationData;
  index: number;
  startPosition: number;
  endPosition: number;
  label: string;
  color: string | undefined;
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
  color,
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
      color={color}
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
  /** Height of the row in pixels. */
  height: number;
  /** Border colour of a box that is not active. Without it, the box's own default. */
  color: string | undefined;
  sampleRate: number;
  samplesPerPixel: number;
  /** Label for a box. Default: the annotation's id. */
  getLabel?: GetAnnotationBoxLabelFn;
  /**
   * Called with the annotation of a clicked box. It is a prop of every
   * memoized box, so it must keep its identity across renders in which only
   * the active annotation changed.
   */
  onSelect: (annotation: AnnotationData) => void;
}

/**
 * The row of annotation boxes under the waveform (#744). The caller
 * (`WaveformAnnotationBoxes`) reads the provider and passes the values in;
 * drag-and-drop (`DragDropProvider`) is the caller's too. Renders nothing without the
 * annotation integration or without annotations.
 */
export const AnnotationBoxes: React.FC<AnnotationBoxesProps> = ({
  annotations,
  activeAnnotationId,
  editable,
  width,
  height,
  color,
  sampleRate,
  samplesPerPixel,
  getLabel,
  onSelect,
}) => {
  const annotationIntegration = use(AnnotationIntegrationContext);

  if (annotations.length === 0 || !annotationIntegration) return null;

  const { AnnotationBox, AnnotationBoxesWrapper } = annotationIntegration;

  return (
    <AnnotationBoxesWrapper height={height} width={width}>
      {annotations.map((annotation, index) => (
        <AnnotationBoxItem
          key={annotation.id}
          AnnotationBox={AnnotationBox}
          annotation={annotation}
          index={index}
          startPosition={(annotation.start * sampleRate) / samplesPerPixel}
          endPosition={(annotation.end * sampleRate) / samplesPerPixel}
          label={getLabel ? getLabel(annotation, index) : annotation.id}
          color={color}
          isActive={annotation.id === activeAnnotationId}
          editable={editable}
          onSelect={onSelect}
        />
      ))}
    </AnnotationBoxesWrapper>
  );
};
