import type { AnnotationData } from '@waveform-playlist/core';

export interface AeneasFragment {
  begin: string;
  end: string;
  id: string;
  language: string;
  lines: string[];
}

export function parseAeneas(data: AeneasFragment): AnnotationData {
  return {
    id: data.id,
    start: parseFloat(data.begin),
    end: parseFloat(data.end),
    lines: data.lines,
    language: data.language,
  };
}

export function serializeAeneas(annotation: AnnotationData): AeneasFragment {
  return {
    id: annotation.id,
    begin: annotation.start.toFixed(3),
    end: annotation.end.toFixed(3),
    lines: annotation.lines,
    language: annotation.language || 'en',
  };
}
