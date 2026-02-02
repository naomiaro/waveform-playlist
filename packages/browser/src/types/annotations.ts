/**
 * Shared annotation types used across Waveform components
 */
import type { AnnotationData } from '@waveform-playlist/core';
export type { AnnotationData } from '@waveform-playlist/core';

/**
 * Custom function to generate the label shown on annotation boxes in the waveform.
 * Receives the annotation data and its index in the list, returns a string label.
 * Default behavior: displays annotation.id
 */
export type GetAnnotationBoxLabelFn = (annotation: AnnotationData, index: number) => string;

/**
 * Callback when annotations are updated (e.g., boundaries dragged).
 * Called with the full updated annotations array.
 */
export type OnAnnotationUpdateFn = (annotations: AnnotationData[]) => void;
