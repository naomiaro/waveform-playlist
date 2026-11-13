# @waveform-playlist/annotations

Time-synchronized text annotations for waveform-playlist — mark up an audio timeline with editable regions for transcripts, podcast chapters, cue points, or music markers.

Used with [`@waveform-playlist/browser`](https://www.npmjs.com/package/@waveform-playlist/browser): render `AnnotationProvider` above the view and pass `annotationList` to `WaveformPlaylistProvider` or `MediaElementPlaylistProvider`. `<Waveform />` and `<MediaElementWaveform />` then render the annotation boxes and the annotation text list. To give either one an option, compose the view with `<WaveformAnnotationBoxes>` and `<AnnotationList>` from `@waveform-playlist/browser`.

## Features

- **Timeline annotation boxes** — a row of boxes under the waveform, with a drag handle on each edge while annotations are editable. A click on a box plays its annotation
- **Editable text list** — a scrollable list of annotation text that follows playback. A click on a row plays its annotation
- **Drag-to-edit boundaries** — move an annotation's start or end by dragging the edge of its box, with optional linked endpoints so adjacent segments stay contiguous. `<WaveformAnnotationBoxes>` wires the drag itself
- **Continuous play mode** — off: playing an annotation stops at its end; on: playback runs on through the following annotations
- **Aeneas import/export** — `parseAeneas` / `serializeAeneas` for the Aeneas forced-alignment JSON format
- **Prebuilt controls** — `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` and `DownloadAnnotationsButton`, bound to the playlist provider above them (either one)
- **Composable building blocks** — use `AnnotationBox`, `AnnotationBoxesWrapper`, and `AnnotationText` directly for custom annotation UIs

## Installation

```bash
npm install @waveform-playlist/annotations
```

Peer dependencies: `react` (^19.0.0), `styled-components` (^6.0.0), `@dnd-kit/react` and `@dnd-kit/dom` (^0.5.0), and `@waveform-playlist/browser` (matching major version).

## Usage

```tsx
import { useState } from 'react';
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';
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
      annotationList={{ annotations, editable: true }}
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

`annotationList` also takes `linkEndpoints` and `isContinuousPlay`. The three options (`editable`, `linkEndpoints`, `isContinuousPlay`) are provider state that follows the prop. Read them with `useAnnotationOptions()` and change them with `setAnnotationsEditable`, `setLinkEndpoints` and `setContinuousPlay` from `usePlaybackControls()`, or render this package's checkboxes:

```tsx
import {
  WaveformRoot,
  WaveformTimescale,
  WaveformTracks,
  WaveformAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
  AnnotationList,
} from '@waveform-playlist/browser';
import {
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/annotations';

// Under either playlist provider:
<ContinuousPlayCheckbox />
<LinkEndpointsCheckbox />
<EditableCheckbox>Allow editing</EditableCheckbox>
<DownloadAnnotationsButton filename="chapters.json">Save chapters</DownloadAnnotationsButton>

<WaveformRoot>
  <WaveformTimescale />
  <WaveformTracks />
  <WaveformAnnotationBoxes height={30} />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
<AnnotationList height={300} />
```

Without `AnnotationProvider` the boxes and the list draw nothing. The checkboxes and the download button do not need it: they read the playlist provider (`useAnnotationOptions()`, `usePlaybackControls()`, `useAnnotations()` of `@waveform-playlist/browser`) and throw without one.

The checkboxes take `disabled`, `children` (the label; default "Continuous Play", "Link Endpoints", "Editable Annotations") and `className`. The download button takes `filename` (default `annotations.json`), `children` (the label; default "Download JSON"), `title` (the tooltip; default one of two English sentences), `disabled` and `className`, and is also disabled while there are no annotations. Every string the four controls draw can be supplied by your app. None of the four has a controlled form: `checked`, `onChange` and `annotations` props are not read.

`AnnotationText`, `AnnotationBox` and `AnnotationBoxesWrapper` are driven by props, for an annotation UI that does not go through a playlist provider. For a checkbox with a state of your own there, build one from `BaseCheckboxWrapper`, `BaseCheckbox` and `BaseCheckboxLabel` of `@waveform-playlist/ui-components`; move an edge with `updateAnnotationBoundaries` of `@waveform-playlist/core`; save with `annotations.map(serializeAeneas)`.

`parseAeneas(fragment)` converts one Aeneas fragment to one annotation, and `serializeAeneas(annotation)` converts one back: `fragments.map(parseAeneas)`.

## Examples & Documentation

- [Annotations guide](https://naomiaro.github.io/waveform-playlist/docs/react/guides/annotations) — full provider configuration, keyboard controls, styling, and Aeneas import/export
- [Live Annotations example](https://naomiaro.github.io/waveform-playlist/examples/annotations)
- [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/) — full documentation

## License

MIT
