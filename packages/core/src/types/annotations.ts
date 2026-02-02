/**
 * Shared annotation types used across waveform-playlist packages
 */

/**
 * Base annotation data structure
 */
export interface AnnotationData {
  id: string;
  start: number;
  end: number;
  lines: string[];
  language?: string;
}

/**
 * Annotation format definition for parsing/serializing
 */
export interface AnnotationFormat {
  name: string;
  parse: (data: unknown) => AnnotationData[];
  serialize: (annotations: AnnotationData[]) => unknown;
}

/**
 * Options for annotation list behavior
 */
export interface AnnotationListOptions {
  editable?: boolean;
  linkEndpoints?: boolean;
  isContinuousPlay?: boolean;
}

/**
 * Event handlers for annotation operations
 */
export interface AnnotationEventMap {
  'annotation-select': (annotation: AnnotationData) => void;
  'annotation-update': (annotation: AnnotationData) => void;
  'annotation-delete': (id: string) => void;
  'annotation-create': (annotation: AnnotationData) => void;
}
