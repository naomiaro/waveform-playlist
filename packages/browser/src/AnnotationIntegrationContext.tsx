import { createContext, use } from 'react';
import type {
  AnnotationData,
  AnnotationAction,
  AnnotationActionOptions,
  RenderAnnotationItemProps,
} from '@waveform-playlist/core';

/**
 * Props the browser package passes to the AnnotationText component.
 * Mirrors what `AnnotationList` actually uses.
 */
export interface AnnotationTextIntegrationProps {
  annotations: AnnotationData[];
  activeAnnotationId?: string;
  shouldScrollToActive?: boolean;
  scrollActivePosition?: ScrollLogicalPosition;
  scrollActiveContainer?: 'nearest' | 'all';
  editable?: boolean;
  controls?: AnnotationAction[];
  annotationListConfig?: AnnotationActionOptions;
  height?: number;
  /** A click on a row (not in a field being edited, not on an action button). */
  onAnnotationClick?: (annotation: AnnotationData) => void;
  onAnnotationUpdate?: (updatedAnnotations: AnnotationData[]) => void;
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => React.ReactNode;
}

/**
 * Props the browser package passes to the AnnotationBox component.
 * Mirrors what `WaveformAnnotationBoxes` actually uses.
 */
export interface AnnotationBoxIntegrationProps {
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

/**
 * Props the browser package passes to the AnnotationBoxesWrapper component.
 * Mirrors what `WaveformAnnotationBoxes` actually uses.
 */
export interface AnnotationBoxesWrapperIntegrationProps {
  children?: React.ReactNode;
  height?: number;
  width?: number;
}

/**
 * Interface for annotation integration provided by @waveform-playlist/annotations.
 *
 * The browser package defines what its views need, and the optional annotations
 * package provides it via <AnnotationProvider>.
 */
export interface AnnotationIntegration {
  // Parser functions
  parseAeneas: (data: unknown) => AnnotationData;
  serializeAeneas: (annotation: AnnotationData) => unknown;

  // The components browser's own views draw (typed with the props it passes).
  // The checkboxes and the download button are not here: the app renders
  // those itself, from @waveform-playlist/annotations.
  AnnotationText: React.ComponentType<AnnotationTextIntegrationProps>;
  AnnotationBox: React.ComponentType<AnnotationBoxIntegrationProps>;
  AnnotationBoxesWrapper: React.ComponentType<AnnotationBoxesWrapperIntegrationProps>;
}

export const AnnotationIntegrationContext = createContext<AnnotationIntegration | null>(null);

export const AnnotationIntegrationProvider = AnnotationIntegrationContext.Provider;

/**
 * Hook to access annotation integration provided by @waveform-playlist/annotations.
 * Throws if used without <AnnotationProvider> wrapping the component tree.
 *
 * Follows the Kent C. Dodds pattern:
 * https://kentcdodds.com/blog/how-to-use-react-context-effectively
 */
export function useAnnotationIntegration(): AnnotationIntegration {
  const context = use(AnnotationIntegrationContext);
  if (!context) {
    throw new Error(
      'useAnnotationIntegration must be used within <AnnotationProvider>. ' +
        'Install @waveform-playlist/annotations and wrap your app with <AnnotationProvider>. ' +
        'See: https://naomiaro.github.io/waveform-playlist/docs/react/guides/annotations'
    );
  }
  return context;
}
