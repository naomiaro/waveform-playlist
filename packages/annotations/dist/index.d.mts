interface Annotation {
    id: string;
    start: number;
    end: number;
    lines: string[];
    lang?: string;
}
interface AnnotationFormat {
    name: string;
    parse: (data: unknown) => Annotation[];
    serialize: (annotations: Annotation[]) => unknown;
}
interface AnnotationListOptions {
    editable?: boolean;
    linkEndpoints?: boolean;
    isContinuousPlay?: boolean;
}
interface AnnotationEventMap {
    'annotation-select': (annotation: Annotation) => void;
    'annotation-update': (annotation: Annotation) => void;
    'annotation-delete': (id: string) => void;
    'annotation-create': (annotation: Annotation) => void;
}

interface AeneasFragment {
    begin: string;
    end: string;
    id: string;
    language: string;
    lines: string[];
}
declare function parseAeneas(data: AeneasFragment): Annotation;
declare function serializeAeneas(annotation: Annotation): AeneasFragment;

export { type AeneasFragment, type Annotation, type AnnotationEventMap, type AnnotationFormat, type AnnotationListOptions, parseAeneas, serializeAeneas };
