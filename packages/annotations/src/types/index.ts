export interface Annotation {
  id: string;
  start: number;
  end: number;
  lines: string[];
  lang?: string;
}

export interface AnnotationFormat {
  name: string;
  parse: (data: unknown) => Annotation[];
  serialize: (annotations: Annotation[]) => unknown;
}

export interface AnnotationListOptions {
  editable?: boolean;
  linkEndpoints?: boolean;
  isContinuousPlay?: boolean;
}

export interface AnnotationEventMap {
  'annotation-select': (annotation: Annotation) => void;
  'annotation-update': (annotation: Annotation) => void;
  'annotation-delete': (id: string) => void;
  'annotation-create': (annotation: Annotation) => void;
}
