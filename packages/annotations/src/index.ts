// Types
export type {
  Annotation as AnnotationType,
  AnnotationFormat,
  AnnotationListOptions,
  AnnotationEventMap
} from './types';

// Parsers
export { parseAeneas, serializeAeneas } from './parsers/aeneas';
export type { AeneasFragment } from './parsers/aeneas';

// Components
export { Annotation } from './components/Annotation';
export type { AnnotationProps, AnnotationData, AnnotationAction, AnnotationActionOptions } from './components/Annotation';

export { AnnotationBox } from './components/AnnotationBox';
export type { AnnotationBoxComponentProps } from './components/AnnotationBox';

export { AnnotationBoxesWrapper } from './components/AnnotationBoxesWrapper';
export type { AnnotationBoxesWrapperProps } from './components/AnnotationBoxesWrapper';

export { AnnotationsTrack } from './components/AnnotationsTrack';
export type { AnnotationsTrackProps } from './components/AnnotationsTrack';

export { AnnotationText } from './components/AnnotationText';
export type { AnnotationTextProps } from './components/AnnotationText';

export { ContinuousPlayCheckbox } from './components/ContinuousPlayCheckbox';
export type { ContinuousPlayCheckboxProps } from './components/ContinuousPlayCheckbox';

export { LinkEndpointsCheckbox } from './components/LinkEndpointsCheckbox';
export type { LinkEndpointsCheckboxProps } from './components/LinkEndpointsCheckbox';

export { EditableCheckbox } from './components/EditableCheckbox';
export type { EditableCheckboxProps } from './components/EditableCheckbox';

export { DownloadAnnotationsButton } from './components/DownloadAnnotationsButton';
export type { DownloadAnnotationsButtonProps } from './components/DownloadAnnotationsButton';

// Hooks
export { useAnnotationControls } from './hooks/useAnnotationControls';
export type {
  UseAnnotationControlsOptions,
  UseAnnotationControlsReturn,
  AnnotationUpdateParams,
} from './hooks/useAnnotationControls';
