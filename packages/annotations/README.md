# @waveform-playlist/annotations

Time-synchronized text annotations for waveform-playlist — mark up an audio timeline with draggable, editable regions for transcripts, podcast chapters, cue points, or music markers.

Used with [`@waveform-playlist/browser`](https://www.npmjs.com/package/@waveform-playlist/browser): wrap your playlist in `AnnotationProvider` and pass `annotationList` to `WaveformPlaylistProvider` — `<Waveform />` then renders annotation boxes and text automatically.

## Features

- **Timeline annotation boxes** — draggable regions overlaid on the waveform, with boundary resize handles
- **Editable text list** — a scrollable, auto-scrolling list of annotation text synced to playback
- **Drag-to-edit boundaries** — resize annotation start/end by dragging, with optional linked endpoints so adjacent segments stay contiguous
- **Continuous play mode** — automatically advance to the next annotation during playback
- **Aeneas import/export** — `parseAeneas` / `serializeAeneas` for the Aeneas forced-alignment JSON format
- **Prebuilt controls** — checkboxes for continuous play, linked endpoints, editable mode, and a JSON download button
- **Composable building blocks** — use `AnnotationsTrack`, `AnnotationBox`, `AnnotationBoxesWrapper`, and `AnnotationText` directly for custom annotation UIs

## Installation

```bash
npm install @waveform-playlist/annotations
```

Peer dependencies: `react` (^18.0.0), `styled-components` (^6.0.0), `@dnd-kit/react` (^0.3.0), and `@waveform-playlist/browser` (matching major version).

## Usage

```tsx
import { useState } from 'react';
import { WaveformPlaylistProvider, Waveform, useAudioTracks } from '@waveform-playlist/browser';
import { AnnotationProvider } from '@waveform-playlist/annotations';

function AnnotatedPlaylist() {
  const { tracks, loading } = useAudioTracks([{ src: '/audio/podcast.mp3', name: 'Podcast' }]);

  const [annotations, setAnnotations] = useState([
    { id: '1', start: 0, end: 5, lines: ['Introduction'] },
    { id: '2', start: 5, end: 15, lines: ['Topic Overview'] },
    { id: '3', start: 15, end: 30, lines: ['Main Discussion'] },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      timescale
      annotationList={{
        annotations,
        editable: true,
        linkEndpoints: false,
      }}
      onAnnotationsChange={setAnnotations} // required for edits to persist
    >
      <AnnotationProvider>
        <Waveform />
      </AnnotationProvider>
    </WaveformPlaylistProvider>
  );
}
```

Each annotation is a plain object:

```typescript
interface AnnotationData {
  id: string; // Unique identifier
  start: number; // Start time in seconds
  end: number; // End time in seconds
  lines: string[]; // Text content as array of lines
  language?: string; // Optional language code (e.g., 'en', 'es')
}
```

For building a custom UI outside the integrated `<Waveform />` pattern, use `useAnnotationControls` plus the standalone components directly:

```tsx
import {
  useAnnotationControls,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/annotations';

const { continuousPlay, linkEndpoints, setContinuousPlay, setLinkEndpoints } =
  useAnnotationControls();
```

## Examples & Documentation

- [Annotations guide](https://naomiaro.github.io/waveform-playlist/docs/react/guides/annotations) — full provider configuration, keyboard controls, styling, and Aeneas import/export
- [Live Annotations example](https://naomiaro.github.io/waveform-playlist/examples/annotations)
- [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/) — full documentation

## License

MIT
