import React from 'react';
import { createRoot } from 'react-dom/client';
import { WaveformPlaylistComponent } from './WaveformPlaylistComponent';

// Annotation actions for the UI
const annotationActions = [
  {
    class: 'bi bi-dash',
    title: 'Reduce annotation end by 0.010s',
    action: (annotation: any, i: number, annotations: any[], opts: any) => {
      const delta = 0.010;
      annotation.end -= delta;

      if (opts.linkEndpoints) {
        const next = annotations[i + 1];
        if (next) {
          next.start -= delta;
          if (next.begin !== undefined) {
            next.begin = next.start.toString();
          }
        }
      }
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    class: 'bi bi-plus',
    title: 'Increase annotation end by 0.010s',
    action: (annotation: any, i: number, annotations: any[], opts: any) => {
      const delta = 0.010;
      annotation.end += delta;

      if (opts.linkEndpoints) {
        const next = annotations[i + 1];
        if (next) {
          next.start += delta;
          if (next.begin !== undefined) {
            next.begin = next.start.toString();
          }
        }
      }
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    class: 'bi bi-scissors',
    title: 'Split annotation in half',
    action: (annotation: any, i: number, annotations: any[]) => {
      const halfDuration = (annotation.end - annotation.start) / 2;

      annotations.splice(i + 1, 0, {
        id: 'annotation_' + Date.now(),
        start: annotation.end - halfDuration,
        end: annotation.end,
        begin: (annotation.end - halfDuration).toString(),
        lines: ['----'],
        language: 'en',
      });

      annotation.end = annotation.start + halfDuration;
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    class: 'bi bi-trash',
    title: 'Delete annotation',
    action: (annotation: any, i: number, annotations: any[]) => {
      annotations.splice(i, 1);
    }
  }
];

// Load annotation data
declare const notes: any[];

// Theme for waveform colors
const theme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff0000',
  timeColor: '#000',
};

// Initialize the app
export function initAnnotationsApp() {
  const container = document.getElementById('playlist');
  if (!container) {
    console.error('Playlist container not found');
    return;
  }

  const root = createRoot(container);
  root.render(
    <WaveformPlaylistComponent
      tracks={[{ src: 'media/audio/sonnet.mp3', name: 'Sonnet' }]}
      timescale={true}
      mono={true}
      waveHeight={80}
      samplesPerPixel={1024}
      theme={theme}
      annotationList={{
        annotations: notes,
        editable: true,
        isContinuousPlay: false,
        linkEndpoints: true,
        controls: annotationActions,
      }}
      onReady={() => console.log('Waveform playlist ready')}
      onAnnotationUpdate={(annotations) => console.log('Annotations updated:', annotations)}
    />
  );
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnnotationsApp);
} else {
  initAnnotationsApp();
}
