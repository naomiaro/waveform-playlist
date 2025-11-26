---
sidebar_position: 6
---

# Annotations

Add time-synchronized text annotations to your audio timeline with drag-to-edit functionality.

## Installation

Install the annotations package:

```bash npm2yarn
npm install @waveform-playlist/annotations
```

## Basic Usage

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  useAudioTracks,
} from '@waveform-playlist/browser';
import { AnnotationBox, AnnotationsProvider } from '@waveform-playlist/annotations';

function AnnotatedPlaylist() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/podcast.mp3', name: 'Podcast' },
  ]);

  const [annotations, setAnnotations] = useState([
    { id: '1', begin: 0, end: 5, text: 'Introduction', language: 'en' },
    { id: '2', begin: 5, end: 15, text: 'Topic Overview', language: 'en' },
    { id: '3', begin: 15, end: 30, text: 'Main Discussion', language: 'en' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks} timescale>
      <AnnotationsProvider
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
      >
        <Waveform />
        <AnnotationBox />
      </AnnotationsProvider>
    </WaveformPlaylistProvider>
  );
}
```

## Annotation Structure

Each annotation has the following properties:

```typescript
interface Annotation {
  id: string;        // Unique identifier
  begin: number;     // Start time in seconds
  end: number;       // End time in seconds
  text: string;      // Annotation text content
  language: string;  // Language code (e.g., 'en', 'es')
}
```

## AnnotationsProvider

The `AnnotationsProvider` wraps your playlist and provides annotation context:

```tsx
<AnnotationsProvider
  annotations={annotations}           // Array of annotations
  onAnnotationsChange={setAnnotations} // Callback when annotations change
>
  {/* Children */}
</AnnotationsProvider>
```

## AnnotationBox Component

The `AnnotationBox` component displays annotations synchronized with the timeline:

```tsx
<AnnotationBox />
```

Features:
- Click to select an annotation
- Drag to move annotation position
- Drag edges to adjust start/end times
- Double-click to edit text

## Annotation Controls

### useAnnotationControls Hook

Access annotation manipulation functions:

```tsx
import { useAnnotationControls } from '@waveform-playlist/annotations';

function AnnotationToolbar() {
  const {
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectedAnnotationId,
    selectAnnotation,
  } = useAnnotationControls();

  const handleAdd = () => {
    addAnnotation({
      id: Date.now().toString(),
      begin: 0,
      end: 5,
      text: 'New Annotation',
      language: 'en',
    });
  };

  const handleDelete = () => {
    if (selectedAnnotationId) {
      deleteAnnotation(selectedAnnotationId);
    }
  };

  return (
    <div>
      <button onClick={handleAdd}>Add Annotation</button>
      <button onClick={handleDelete} disabled={!selectedAnnotationId}>
        Delete Selected
      </button>
    </div>
  );
}
```

### Creating Annotations from Selection

Create annotations based on the current selection:

```tsx
import { usePlaylistState } from '@waveform-playlist/browser';
import { useAnnotationControls } from '@waveform-playlist/annotations';

function CreateFromSelection() {
  const { selection } = usePlaylistState();
  const { addAnnotation } = useAnnotationControls();

  const createAnnotation = () => {
    if (selection.start !== selection.end) {
      addAnnotation({
        id: Date.now().toString(),
        begin: selection.start,
        end: selection.end,
        text: 'New Annotation',
        language: 'en',
      });
    }
  };

  return (
    <button
      onClick={createAnnotation}
      disabled={selection.start === selection.end}
    >
      Create Annotation from Selection
    </button>
  );
}
```

## Editing Annotations

### Inline Text Editing

Double-click an annotation to edit its text inline:

```tsx
import { useAnnotationControls } from '@waveform-playlist/annotations';

function AnnotationEditor() {
  const { selectedAnnotationId, updateAnnotation, annotations } = useAnnotationControls();
  const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId);

  if (!selectedAnnotation) return null;

  return (
    <textarea
      value={selectedAnnotation.text}
      onChange={(e) =>
        updateAnnotation(selectedAnnotationId, { text: e.target.value })
      }
    />
  );
}
```

### Adjusting Timing

Update annotation timing programmatically:

```tsx
const { updateAnnotation } = useAnnotationControls();

// Move annotation to new time range
updateAnnotation(annotationId, {
  begin: 10,
  end: 20,
});

// Extend annotation end time
updateAnnotation(annotationId, {
  end: annotation.end + 5,
});
```

## Styling Annotations

Customize annotation appearance via theme:

```tsx
const theme = {
  annotationBoxBackground: '#f0f0f0',
  annotationSelectedBackground: '#cce5ff',
  annotationBorderColor: '#0066cc',
  annotationTextColor: '#333333',
};

<WaveformPlaylistProvider tracks={tracks} theme={theme}>
  <AnnotationsProvider annotations={annotations}>
    <AnnotationBox />
  </AnnotationsProvider>
</WaveformPlaylistProvider>
```

## Import/Export

### Export to JSON

```tsx
function ExportAnnotations() {
  const { annotations } = useAnnotationControls();

  const handleExport = () => {
    const json = JSON.stringify(annotations, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.json';
    a.click();

    URL.revokeObjectURL(url);
  };

  return <button onClick={handleExport}>Export Annotations</button>;
}
```

### Import from JSON

```tsx
function ImportAnnotations() {
  const { setAnnotations } = useAnnotationControls();

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      const imported = JSON.parse(json);
      setAnnotations(imported);
    };
    reader.readAsText(file);
  };

  return <input type="file" accept=".json" onChange={handleImport} />;
}
```

## Complete Example

```tsx
import { useState, useCallback } from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  useAudioTracks,
} from '@waveform-playlist/browser';
import {
  AnnotationBox,
  AnnotationsProvider,
  useAnnotationControls,
} from '@waveform-playlist/annotations';

function AnnotationToolbar() {
  const { addAnnotation, deleteAnnotation, selectedAnnotationId } =
    useAnnotationControls();

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
      <button
        onClick={() =>
          addAnnotation({
            id: Date.now().toString(),
            begin: 0,
            end: 5,
            text: 'New Annotation',
            language: 'en',
          })
        }
      >
        Add Annotation
      </button>
      <button
        onClick={() => selectedAnnotationId && deleteAnnotation(selectedAnnotationId)}
        disabled={!selectedAnnotationId}
      >
        Delete Selected
      </button>
    </div>
  );
}

function AnnotationsExample() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/podcast.mp3', name: 'Podcast Episode' },
  ]);

  const [annotations, setAnnotations] = useState([
    { id: '1', begin: 0, end: 10, text: 'Introduction', language: 'en' },
    { id: '2', begin: 10, end: 30, text: 'Main Topic', language: 'en' },
    { id: '3', begin: 30, end: 45, text: 'Conclusion', language: 'en' },
  ]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      timescale
    >
      <AnnotationsProvider
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
      >
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </div>
        <AnnotationToolbar />
        <Waveform />
        <AnnotationBox />
      </AnnotationsProvider>
    </WaveformPlaylistProvider>
  );
}

export default AnnotationsExample;
```

## Use Cases

### Podcast Chapters

Mark sections of a podcast for easy navigation:

```tsx
const chapters = [
  { id: '1', begin: 0, end: 120, text: 'Intro & Sponsors', language: 'en' },
  { id: '2', begin: 120, end: 600, text: 'Guest Interview', language: 'en' },
  { id: '3', begin: 600, end: 900, text: 'Q&A Session', language: 'en' },
  { id: '4', begin: 900, end: 960, text: 'Outro', language: 'en' },
];
```

### Transcription Segments

Break down audio into transcribed segments:

```tsx
const transcription = [
  { id: '1', begin: 0, end: 3.5, text: 'Welcome to the show.', language: 'en' },
  { id: '2', begin: 3.5, end: 7, text: "Today we're discussing...", language: 'en' },
  // ...
];
```

### Music Markers

Mark sections in music:

```tsx
const musicSections = [
  { id: '1', begin: 0, end: 16, text: 'Verse 1', language: 'en' },
  { id: '2', begin: 16, end: 32, text: 'Chorus', language: 'en' },
  { id: '3', begin: 32, end: 48, text: 'Verse 2', language: 'en' },
  { id: '4', begin: 48, end: 64, text: 'Chorus', language: 'en' },
  { id: '5', begin: 64, end: 80, text: 'Bridge', language: 'en' },
  { id: '6', begin: 80, end: 96, text: 'Final Chorus', language: 'en' },
];
```

## Next Steps

- [Recording](/docs/guides/recording) - Record audio with annotations
- [Theming](/docs/guides/theming) - Customize annotation appearance
