import { Annotation } from '../types';

export interface AeneasFragment {
  begin: string;
  end: string;
  id: string;
  language: string;
  lines: string[];
}

export function parseAeneas(data: AeneasFragment): Annotation {
  return {
    id: data.id,
    start: parseFloat(data.begin),
    end: parseFloat(data.end),
    lines: data.lines,
    lang: data.language,
  };
}

export function serializeAeneas(annotation: Annotation): AeneasFragment {
  return {
    id: annotation.id,
    begin: annotation.start.toFixed(3),
    end: annotation.end.toFixed(3),
    lines: annotation.lines,
    language: annotation.lang || 'en',
  };
}
