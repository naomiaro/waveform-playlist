// Simple initialization for annotations example using the main WaveformPlaylist class
document.addEventListener('DOMContentLoaded', () => {
  const playlist = WaveformPlaylist({
    container: document.getElementById('playlist'),
    timescale: true,
    mono: true,
    waveHeight: 80,
    samplesPerPixel: 1024,
    annotationList: {
      annotations: notes, // notes is loaded from annotations.js
      editable: true,
      isContinuousPlay: false,
      linkEndpoints: true,
      controls: [
        {
          class: 'bi bi-dash',
          title: 'Reduce annotation end by 0.010s',
          action: (annotation, i, annotations, opts) => {
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
          action: (annotation, i, annotations, opts) => {
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
          action: (annotation, i, annotations) => {
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
          action: (annotation, i, annotations) => {
            annotations.splice(i, 1);
          }
        }
      ]
    }
  });

  // Load the audio track
  playlist.loadTracks([
    {
      src: 'media/audio/sonnet.mp3',
      name: 'Sonnet',
    }
  ]);

  // Wire up the download button
  const downloadBtn = document.querySelector('.btn-annotations-download');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const annotations = playlist.getAnnotations();
      const dataStr = JSON.stringify(annotations, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = 'annotations.json';
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    });
  }
});
