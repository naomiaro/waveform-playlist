// Parsers
export { parseAeneas, serializeAeneas } from './parsers/aeneas';
export type { AeneasFragment } from './parsers/aeneas';

// Components
export { AnnotationBox } from './components/AnnotationBox';
export type { AnnotationBoxComponentProps } from './components/AnnotationBox';

export { AnnotationBoxesWrapper } from './components/AnnotationBoxesWrapper';
export type { AnnotationBoxesWrapperProps } from './components/AnnotationBoxesWrapper';

export { AnnotationText } from './components/AnnotationText';
export type { AnnotationTextProps } from './components/AnnotationText';

// Controls, bound to the playlist provider above them
export {
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
} from './components/AnnotationCheckboxes';
export type { AnnotationCheckboxProps } from './components/AnnotationCheckboxes';

export { DownloadAnnotationsButton } from './components/DownloadAnnotationsButton';
export type { DownloadAnnotationsButtonProps } from './components/DownloadAnnotationsButton';

// Provider (hands the box and list components to the browser package's views)
export { AnnotationProvider } from './AnnotationProvider';
