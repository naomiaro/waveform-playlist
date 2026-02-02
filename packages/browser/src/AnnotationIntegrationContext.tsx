import { createContext, useContext } from 'react';
import type { AnnotationData } from '@waveform-playlist/core';

/**
 * Interface for annotation integration provided by @waveform-playlist/annotations.
 *
 * Follows the same pattern as SpectrogramIntegrationContext: the browser package
 * defines what it needs, and the optional annotations package provides it.
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

const AnnotationIntegrationContext = createContext<AnnotationIntegration | null>(null);

export const AnnotationIntegrationProvider = AnnotationIntegrationContext.Provider;

export function useAnnotationIntegration(): AnnotationIntegration | null {
  return useContext(AnnotationIntegrationContext);
}

/**
 * Hook that throws if annotations data is provided but AnnotationProvider is missing.
 * Follows the Kent C. Dodds pattern: https://kentcdodds.com/blog/how-to-use-react-context-effectively
 *
 * Use this in components that render annotation data (e.g., annotation lists, boxes).
 * Use the non-throwing `useAnnotationIntegration()` for optional UI controls that
 * simply return null when annotations aren't available.
 */
export function useRequireAnnotationIntegration(annotations: unknown[]): AnnotationIntegration | null {
  const integration = useContext(AnnotationIntegrationContext);
  if (!integration && annotations.length > 0) {
    throw new Error(
      'Annotation data was provided but <AnnotationProvider> is missing. ' +
      'Wrap your app with <AnnotationProvider> from @waveform-playlist/annotations. ' +
      'See: https://waveform-playlist.naomiaro.com/docs/guides/annotations'
    );
  }
  return integration;
}
