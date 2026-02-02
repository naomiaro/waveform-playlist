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

/**
 * Configuration options passed to annotation action handlers.
 * Used by both browser and annotations packages.
 */
export interface AnnotationActionOptions {
  /** Whether annotation endpoints are linked (moving one endpoint moves the other) */
  linkEndpoints?: boolean;
  /** Whether to continue playing after an annotation ends */
  continuousPlay?: boolean;
  /** Additional custom properties */
  [key: string]: unknown;
}

/**
 * An action control shown on annotation items (e.g., delete, split).
 */
export interface AnnotationAction {
  class?: string;
  text?: string;
  title: string;
  action: (annotation: AnnotationData, index: number, annotations: AnnotationData[], opts: AnnotationActionOptions) => void;
}

/**
 * Props passed to the renderAnnotationItem function for custom rendering.
 */
export interface RenderAnnotationItemProps {
  annotation: AnnotationData;
  index: number;
  isActive: boolean;
  onClick: () => void;
  formatTime: (seconds: number) => string;
}
