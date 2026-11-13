import React from 'react';
import { AnnotationIntegrationProvider } from '@waveform-playlist/browser';
import type { AnnotationIntegration } from '@waveform-playlist/browser';
import { parseAeneas, serializeAeneas } from './parsers/aeneas';
import { AnnotationText } from './components/AnnotationText';
import { AnnotationBox } from './components/AnnotationBox';
import { AnnotationBoxesWrapper } from './components/AnnotationBoxesWrapper';

const annotationIntegration: AnnotationIntegration = {
  parseAeneas: parseAeneas as (data: unknown) => import('@waveform-playlist/core').AnnotationData,
  serializeAeneas: serializeAeneas as (
    annotation: import('@waveform-playlist/core').AnnotationData
  ) => unknown,
  AnnotationText,
  AnnotationBox,
  AnnotationBoxesWrapper,
};

export const AnnotationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AnnotationIntegrationProvider value={annotationIntegration}>
      {children}
    </AnnotationIntegrationProvider>
  );
};
