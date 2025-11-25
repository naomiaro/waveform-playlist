import React, { FunctionComponent } from 'react';

interface Annotation$1 {
    id: string;
    start: number;
    end: number;
    lines: string[];
    lang?: string;
}
interface AnnotationFormat {
    name: string;
    parse: (data: unknown) => Annotation$1[];
    serialize: (annotations: Annotation$1[]) => unknown;
}
interface AnnotationListOptions {
    editable?: boolean;
    linkEndpoints?: boolean;
    isContinuousPlay?: boolean;
}
interface AnnotationEventMap {
    'annotation-select': (annotation: Annotation$1) => void;
    'annotation-update': (annotation: Annotation$1) => void;
    'annotation-delete': (id: string) => void;
    'annotation-create': (annotation: Annotation$1) => void;
}

interface AeneasFragment {
    begin: string;
    end: string;
    id: string;
    language: string;
    lines: string[];
}
declare function parseAeneas(data: AeneasFragment): Annotation$1;
declare function serializeAeneas(annotation: Annotation$1): AeneasFragment;

interface AnnotationAction {
    class?: string;
    text?: string;
    title: string;
    action: (annotation: AnnotationData, index: number, annotations: AnnotationData[], opts: any) => void;
}
interface AnnotationData {
    id: string;
    start: number;
    end: number;
    lines: string[];
    language?: string;
}
interface AnnotationProps {
    annotation: AnnotationData;
    index: number;
    allAnnotations: AnnotationData[];
    startPosition: number;
    endPosition: number;
    color?: string;
    editable?: boolean;
    controls?: AnnotationAction[];
    onAnnotationUpdate?: (updatedAnnotations: AnnotationData[]) => void;
    annotationListConfig?: any;
    onClick?: (annotation: AnnotationData) => void;
}
declare const Annotation: FunctionComponent<AnnotationProps>;

interface AnnotationBoxComponentProps {
    annotationId: string;
    annotationIndex: number;
    startPosition: number;
    endPosition: number;
    label?: string;
    color?: string;
    isActive?: boolean;
    onClick?: () => void;
    editable?: boolean;
}
declare const AnnotationBox: FunctionComponent<AnnotationBoxComponentProps>;

interface AnnotationBoxesWrapperProps {
    className?: string;
    children?: React.ReactNode;
    height?: number;
    offset?: number;
    width?: number;
}
declare const AnnotationBoxesWrapper: FunctionComponent<AnnotationBoxesWrapperProps>;

interface AnnotationsTrackProps {
    className?: string;
    children?: React.ReactNode;
    height?: number;
    offset?: number;
    width?: number;
}
declare const AnnotationsTrack: FunctionComponent<AnnotationsTrackProps>;

interface AnnotationTextProps {
    annotations: AnnotationData[];
    activeAnnotationId?: string;
    shouldScrollToActive?: boolean;
    editable?: boolean;
    controls?: AnnotationAction[];
    annotationListConfig?: any;
    height?: number;
    onAnnotationClick?: (annotation: AnnotationData) => void;
    onAnnotationUpdate?: (updatedAnnotations: AnnotationData[]) => void;
}
declare const AnnotationText: React.NamedExoticComponent<AnnotationTextProps>;

interface ContinuousPlayCheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}
/**
 * Checkbox control for enabling/disabling continuous play of annotations.
 * When enabled, playback continues from one annotation to the next without stopping.
 */
declare const ContinuousPlayCheckbox: React.FC<ContinuousPlayCheckboxProps>;

interface LinkEndpointsCheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}
/**
 * Checkbox control for enabling/disabling linked endpoints between annotations.
 * When enabled, the end time of one annotation is automatically linked to the start time of the next.
 */
declare const LinkEndpointsCheckbox: React.FC<LinkEndpointsCheckboxProps>;

interface EditableCheckboxProps {
    checked: boolean;
    onChange: (enabled: boolean) => void;
    className?: string;
}
declare const EditableCheckbox: React.FC<EditableCheckboxProps>;

interface DownloadAnnotationsButtonProps {
    annotations: Annotation$1[];
    filename?: string;
    disabled?: boolean;
    className?: string;
    children?: React.ReactNode;
}
declare const DownloadAnnotationsButton: React.FC<DownloadAnnotationsButtonProps>;

interface UseAnnotationControlsOptions {
    initialContinuousPlay?: boolean;
    initialLinkEndpoints?: boolean;
}
interface AnnotationUpdateParams {
    annotationIndex: number;
    newTime: number;
    isDraggingStart: boolean;
    annotations: Annotation$1[];
    duration: number;
    linkEndpoints: boolean;
}
interface UseAnnotationControlsReturn {
    continuousPlay: boolean;
    linkEndpoints: boolean;
    setContinuousPlay: (value: boolean) => void;
    setLinkEndpoints: (value: boolean) => void;
    updateAnnotationBoundaries: (params: AnnotationUpdateParams) => Annotation$1[];
}
/**
 * Hook for managing annotation control state and boundary logic.
 * Handles continuous play mode and linked endpoints behavior.
 */
declare const useAnnotationControls: (options?: UseAnnotationControlsOptions) => UseAnnotationControlsReturn;

export { type AeneasFragment, Annotation, type AnnotationAction, AnnotationBox, type AnnotationBoxComponentProps, AnnotationBoxesWrapper, type AnnotationBoxesWrapperProps, type AnnotationData, type AnnotationEventMap, type AnnotationFormat, type AnnotationListOptions, type AnnotationProps, AnnotationText, type AnnotationTextProps, type Annotation$1 as AnnotationType, type AnnotationUpdateParams, AnnotationsTrack, type AnnotationsTrackProps, ContinuousPlayCheckbox, type ContinuousPlayCheckboxProps, DownloadAnnotationsButton, type DownloadAnnotationsButtonProps, EditableCheckbox, type EditableCheckboxProps, LinkEndpointsCheckbox, type LinkEndpointsCheckboxProps, type UseAnnotationControlsOptions, type UseAnnotationControlsReturn, parseAeneas, serializeAeneas, useAnnotationControls };
