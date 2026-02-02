import { createContext, useContext } from 'react';
import type { AnnotationData } from '@waveform-playlist/core';

/**
 * Interface for annotation integration provided by @waveform-playlist/annotations.
 *
 * The browser package defines what it needs, and the optional annotations package
 * provides it via <AnnotationProvider>.
 */
export interface AnnotationIntegration {
  // Parser functions
  parseAeneas: (data: unknown) => AnnotationData;
  serializeAeneas: (annotation: AnnotationData) => unknown;

  // Visualization components (typed loosely since browser controls invocation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnnotationText: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnnotationBox: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnnotationBoxesWrapper: React.ComponentType<any>;

  // Control components
  ContinuousPlayCheckbox: React.ComponentType<{ checked: boolean; onChange: (checked: boolean) => void; className?: string }>;
  LinkEndpointsCheckbox: React.ComponentType<{ checked: boolean; onChange: (checked: boolean) => void; className?: string }>;
  EditableCheckbox: React.ComponentType<{ checked: boolean; onChange: (checked: boolean) => void; className?: string }>;
  DownloadAnnotationsButton: React.ComponentType<{ annotations: AnnotationData[]; filename?: string; className?: string }>;
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
  const context = useContext(AnnotationIntegrationContext);
  if (!context) {
    throw new Error(
      'useAnnotationIntegration must be used within <AnnotationProvider>. ' +
      'Install @waveform-playlist/annotations and wrap your app with <AnnotationProvider>. ' +
      'See: https://waveform-playlist.naomiaro.com/docs/guides/annotations'
    );
  }
  return context;
}
