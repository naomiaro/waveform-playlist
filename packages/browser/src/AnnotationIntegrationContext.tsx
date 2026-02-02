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

  // Visualization components
  AnnotationText: React.ComponentType<any>;
  AnnotationBox: React.ComponentType<any>;
  AnnotationBoxesWrapper: React.ComponentType<any>;

  // Control components
  ContinuousPlayCheckbox: React.ComponentType<any>;
  LinkEndpointsCheckbox: React.ComponentType<any>;
  EditableCheckbox: React.ComponentType<any>;
  DownloadAnnotationsButton: React.ComponentType<any>;
}

const AnnotationIntegrationContext = createContext<AnnotationIntegration | null>(null);

export const AnnotationIntegrationProvider = AnnotationIntegrationContext.Provider;

export function useAnnotationIntegration(): AnnotationIntegration | null {
  return useContext(AnnotationIntegrationContext);
}
