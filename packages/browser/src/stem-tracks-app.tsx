import React from 'react';
import { createRoot } from 'react-dom/client';
import { WaveformPlaylistComponent } from './WaveformPlaylistComponent';

// Theme for waveform colors
const theme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff0000',
  timeColor: '#000',
};

// Stem tracks configuration
const tracks = [
  {
    src: 'media/audio/Vocals30.mp3',
    name: 'Vocals',
  },
  {
    src: 'media/audio/Guitar30.mp3',
    name: 'Guitar',
  },
  {
    src: 'media/audio/PianoSynth30.mp3',
    name: 'Pianos & Synth',
  },
  {
    src: 'media/audio/BassDrums30.mp3',
    name: 'Drums',
  },
];

// Initialize the app
export function initStemTracksApp() {
  const container = document.getElementById('playlist');
  if (!container) {
    console.error('Playlist container not found');
    return;
  }

  const root = createRoot(container);
  root.render(
    <WaveformPlaylistComponent
      tracks={tracks}
      timescale={true}
      mono={true}
      waveHeight={100}
      samplesPerPixel={1024}
      theme={theme}
      controls={{
        show: true,
        width: 200,
      }}
      onReady={() => console.log('Stem tracks loaded!')}
    />
  );
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStemTracksApp);
} else {
  initStemTracksApp();
}
