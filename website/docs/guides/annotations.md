---
sidebar_position: 6
description: "Create time-synced audio annotations with drag editing, keyboard navigation, and JSON export"
---

# Annotations

Add time-synchronized text annotations to your audio timeline with drag-to-edit functionality. The annotations system provides two approaches: an **integrated pattern** (recommended) where annotations are managed by the provider, and **composable building blocks** for custom UIs.

## Installation

Install the annotations package:

```bash npm2yarn
npm install @waveform-playlist/annotations
```

## Quick Start

The simplest way to add annotations is through the provider's `annotationList` prop. Wrap your playlist with `AnnotationProvider` to enable annotation rendering — the `<Waveform />` component then renders annotation boxes and text automatically.

```tsx
import { useState } from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  useAudioTracks,
} from '@waveform-playlist/browser';
import { AnnotationProvider } from '@waveform-playlist/annotations';

function AnnotatedPlaylist() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/podcast.mp3', name: 'Podcast' },
  ]);

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
      onAnnotationsChange={setAnnotations}
    >
      <AnnotationProvider>
        <Waveform />
      </AnnotationProvider>
    </WaveformPlaylistProvider>
  );
}
```

With this pattern, `<Waveform />` internally renders `AnnotationBoxesWrapper`, `AnnotationBox` components, and `AnnotationText` — no manual composition needed. Without `AnnotationProvider`, annotation data is stored but not rendered.

## Annotation Structure

Each annotation has the following properties:

```typescript
interface AnnotationData {
  id: string;         // Unique identifier
  start: number;      // Start time in seconds
  end: number;        // End time in seconds
  lines: string[];    // Text content as array of lines
  language?: string;  // Optional language code (e.g., 'en', 'es')
}
```

## Provider Configuration

### `annotationList` Prop

Pass annotation data and editing options to the provider:

```typescript
interface AnnotationList {
  annotations?: AnnotationData[];   // Array of annotations
  editable?: boolean;               // Enable drag editing
  isContinuousPlay?: boolean;       // Auto-play next annotation
  linkEndpoints?: boolean;          // Link adjacent boundaries (default: false)
  controls?: AnnotationAction[];    // Custom action buttons per annotation
}
```

### `onAnnotationsChange` Callback

Called whenever annotations are modified (drag, text edit, boundary change):

```tsx
<WaveformPlaylistProvider
  tracks={tracks}
  annotationList={{ annotations, editable: true }}
  onAnnotationsChange={(updatedAnnotations) => {
    setAnnotations(updatedAnnotations);
  }}
>
  <Waveform />
</WaveformPlaylistProvider>
```

:::note Naming Convention
The **provider** uses `onAnnotationsChange` (browser package). The **`AnnotationText` component** uses `onAnnotationUpdate` (annotations package). Both receive the full updated annotations array.
:::

## Waveform Annotation Props

When using the integrated pattern, `<Waveform />` accepts these annotation-related props:

| Prop | Type | Description |
|------|------|-------------|
| `annotationControls` | `AnnotationAction[]` | Custom action buttons for each annotation item |
| `annotationTextHeight` | `number` | Height in pixels for the annotation text list |
| `renderAnnotationItem` | `(props: RenderAnnotationItemProps) => ReactNode` | Custom render function for annotation list items |
| `getAnnotationBoxLabel` | `(annotation, index) => string` | Custom label for annotation boxes on the timeline |

```tsx
<Waveform
  annotationTextHeight={200}
  getAnnotationBoxLabel={(annotation, index) => `${index + 1}. ${annotation.lines[0]}`}
  renderAnnotationItem={({ annotation, index, isActive, onClick, formatTime }) => (
    <div onClick={onClick} style={{ background: isActive ? '#ffe0b2' : 'transparent' }}>
      <strong>{formatTime(annotation.start)} - {formatTime(annotation.end)}</strong>
      <p>{annotation.lines.join(' ')}</p>
    </div>
  )}
/>
```

## Browser Hooks

The browser package provides hooks for annotation interactions. These are used internally by `<Waveform />` but can also be used directly for custom UIs.

### useAnnotationDragHandlers

Provides @dnd-kit drag handlers for annotation boundary editing.

```typescript
import { useAnnotationDragHandlers } from '@waveform-playlist/browser';

const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
  annotations,           // AnnotationData[]
  onAnnotationsChange,   // (annotations) => void
  samplesPerPixel,       // number
  sampleRate,            // number
  duration,              // number (total duration in seconds)
  linkEndpoints,         // boolean
});
```

Use with `@dnd-kit`'s `DndContext`:

```tsx
import { DndContext } from '@dnd-kit/core';

<DndContext onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}>
  {/* annotation boxes */}
</DndContext>
```

### useAnnotationKeyboardControls

Keyboard navigation and editing for annotations.

```typescript
import { useAnnotationKeyboardControls } from '@waveform-playlist/browser';

const {
  moveStartBoundary,    // (delta: number) => void
  moveEndBoundary,      // (delta: number) => void
  selectPrevious,       // () => void
  selectNext,           // () => void
  selectFirst,          // () => void
  selectLast,           // () => void
  clearSelection,       // () => void
  scrollToAnnotation,   // (annotationId: string) => void
  playActiveAnnotation, // () => void
} = useAnnotationKeyboardControls({
  annotations,                // AnnotationData[]
  activeAnnotationId,         // string | null
  onAnnotationsChange,        // (annotations) => void
  onActiveAnnotationChange,   // (id: string | null) => void
  duration,                   // number
  linkEndpoints,              // boolean
  continuousPlay,             // boolean (optional)
  enabled,                    // boolean (optional)
  scrollContainerRef,         // RefObject<HTMLDivElement> (optional)
  onPlay,                     // (startTime, duration?) => void (optional)
});
```

**Default Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `←` / `→` | Move start boundary |
| `Shift+←` / `Shift+→` | Move end boundary |
| `↑` / `↓` | Select previous / next annotation |
| `Home` / `End` | Select first / last annotation |
| `Escape` | Clear selection |
| `Enter` | Play active annotation |

## Annotation Package Components

The `@waveform-playlist/annotations` package exports composable building blocks for custom annotation UIs.

### AnnotationsTrack

A layout wrapper for annotation content. Use this when building a custom annotation UI outside the integrated `<Waveform />` pattern.

```typescript
interface AnnotationsTrackProps {
  className?: string;
  children?: React.ReactNode;
  height?: number;
  offset?: number;
  width?: number;
}
```

```tsx
import { AnnotationsTrack } from '@waveform-playlist/annotations';

<AnnotationsTrack height={30}>
  {/* Custom annotation content */}
</AnnotationsTrack>
```

:::tip
`AnnotationsTrack` is a simple layout container — it does **not** accept `annotations`, `onAnnotationsChange`, or `editable` props. For the common case, use the integrated pattern (pass `annotationList` to the provider and use `<Waveform />`).
:::

### AnnotationText

A scrollable list view of annotations with automatic scrolling to the active annotation during playback.

```tsx
import { AnnotationText } from '@waveform-playlist/annotations';

<AnnotationText
  annotations={annotations}
  activeAnnotationId={currentAnnotation?.id}
  shouldScrollToActive={isPlaying}
  editable={true}
  height={200}
  onAnnotationClick={(annotation) => seekTo(annotation.start)}
  onAnnotationUpdate={setAnnotations}
/>
```

#### Custom Annotation Rendering

Use `renderAnnotationItem` for complete control over how each annotation appears in the list:

```tsx
<AnnotationText
  annotations={annotations}
  activeAnnotationId={activeId}
  renderAnnotationItem={({ annotation, index, isActive, onClick, formatTime }) => (
    <div
      onClick={onClick}
      style={{
        padding: '12px',
        background: isActive ? '#ffe0b2' : 'transparent',
        borderLeft: isActive ? '4px solid #ff9800' : '4px solid transparent',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 'bold' }}>{annotation.id}</div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        {formatTime(annotation.start)} - {formatTime(annotation.end)}
      </div>
      <div>{annotation.lines.join('\n')}</div>
    </div>
  )}
/>
```

### AnnotationBox

Individual draggable annotation box for the timeline. Supports boundary resizing with @dnd-kit.

```tsx
import { AnnotationBox } from '@waveform-playlist/annotations';

<AnnotationBox
  annotationId={annotation.id}
  annotationIndex={index}
  startPosition={startPixels}
  endPosition={endPixels}
  label={annotation.id}
  color="#ff9800"
  isActive={annotation.id === activeId}
  editable={true}
  onClick={() => selectAnnotation(annotation)}
/>
```

### AnnotationBoxesWrapper

Container that aligns annotation boxes with the waveform, accounting for track controls width.

```tsx
import { AnnotationBoxesWrapper, AnnotationBox } from '@waveform-playlist/annotations';

<AnnotationBoxesWrapper height={30}>
  {annotations.map((annotation, index) => (
    <AnnotationBox
      key={annotation.id}
      annotationId={annotation.id}
      annotationIndex={index}
      startPosition={annotation.start * pixelsPerSecond}
      endPosition={annotation.end * pixelsPerSecond}
      label={annotation.id}
    />
  ))}
</AnnotationBoxesWrapper>
```

## useAnnotationControls Hook

Manages annotation editing state including continuous play mode and linked endpoints.

```tsx
import { useAnnotationControls } from '@waveform-playlist/annotations';

function AnnotationEditor() {
  const {
    continuousPlay,
    linkEndpoints,
    setContinuousPlay,
    setLinkEndpoints,
    updateAnnotationBoundaries,
  } = useAnnotationControls({
    initialContinuousPlay: false,
    initialLinkEndpoints: false,
  });

  // Handle drag updates
  const handleDragEnd = (annotationIndex: number, newTime: number, isDraggingStart: boolean) => {
    const updated = updateAnnotationBoundaries({
      annotationIndex,
      newTime,
      isDraggingStart,
      annotations,
      duration,
      linkEndpoints,
    });
    setAnnotations(updated);
  };

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={continuousPlay}
          onChange={(e) => setContinuousPlay(e.target.checked)}
        />
        Continuous Play
      </label>
      <label>
        <input
          type="checkbox"
          checked={linkEndpoints}
          onChange={(e) => setLinkEndpoints(e.target.checked)}
        />
        Link Endpoints
      </label>
    </div>
  );
}
```

### Linked Endpoints Behavior

When `linkEndpoints` is enabled:
- Dragging the end of annotation A moves the start of annotation B if they're adjacent
- Annotations "snap" together when boundaries meet
- Useful for transcription where segments should be contiguous

When disabled:
- Annotations can overlap or have gaps
- Boundary collisions push adjacent annotations

## Control Components

Pre-built checkbox and button components for common annotation controls:

```tsx
import {
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/annotations';

function AnnotationControls({ annotations }) {
  const [continuousPlay, setContinuousPlay] = useState(false);
  const [linkEndpoints, setLinkEndpoints] = useState(false);
  const [editable, setEditable] = useState(true);

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <ContinuousPlayCheckbox
        checked={continuousPlay}
        onChange={setContinuousPlay}
      />
      <LinkEndpointsCheckbox
        checked={linkEndpoints}
        onChange={setLinkEndpoints}
      />
      <EditableCheckbox
        checked={editable}
        onChange={setEditable}
      />
      <DownloadAnnotationsButton
        annotations={annotations}
        filename="my-annotations.json"
      />
    </div>
  );
}
```

## Styling Annotations

Customize annotation appearance via theme:

```tsx
const theme = {
  // Annotation boxes on timeline
  annotationBoxBackground: 'rgba(255, 255, 255, 0.85)',
  annotationBoxActiveBackground: 'rgba(255, 200, 100, 0.95)',
  annotationBoxHoverBackground: 'rgba(255, 255, 255, 0.98)',
  annotationBoxActiveBorder: '#ff9800',
  annotationLabelColor: '#2a2a2a',

  // Resize handles
  annotationResizeHandleColor: 'rgba(0, 0, 0, 0.4)',
  annotationResizeHandleActiveColor: 'rgba(0, 0, 0, 0.8)',

  // Text list items
  annotationTextItemHoverBackground: 'rgba(0, 0, 0, 0.05)',
};

<WaveformPlaylistProvider tracks={tracks} theme={theme}>
  <Waveform />
</WaveformPlaylistProvider>
```

## Import/Export

### Aeneas Format

Parse and serialize the Aeneas synchronization format:

```tsx
import { parseAeneas, serializeAeneas } from '@waveform-playlist/annotations';

// Parse Aeneas JSON
const aeneasData = { fragments: [...] };
const annotations = parseAeneas(aeneasData);

// Serialize back to Aeneas format
const exported = serializeAeneas(annotations);
```

### Download Button

Use the built-in download button:

```tsx
<DownloadAnnotationsButton
  annotations={annotations}
  filename="annotations.json"
/>
```

### Custom Export

```tsx
function ExportAnnotations({ annotations }) {
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
function ImportAnnotations({ onImport }) {
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      const imported = JSON.parse(json);
      onImport(imported);
    };
    reader.readAsText(file);
  };

  return <input type="file" accept=".json" onChange={handleImport} />;
}
```

## Complete Example

```tsx
import { useState } from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  useAudioTracks,
} from '@waveform-playlist/browser';
import {
  useAnnotationControls,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/annotations';

function AnnotationsExample() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/podcast.mp3', name: 'Podcast Episode' },
  ], { progressive: true });

  const [annotations, setAnnotations] = useState([
    { id: '1', start: 0, end: 10, lines: ['Introduction'] },
    { id: '2', start: 10, end: 30, lines: ['Main Topic'] },
    { id: '3', start: 30, end: 45, lines: ['Conclusion'] },
  ]);

  const [editable, setEditable] = useState(true);

  const {
    continuousPlay,
    linkEndpoints,
    setContinuousPlay,
    setLinkEndpoints,
  } = useAnnotationControls();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      timescale
      annotationList={{
        annotations,
        editable,
        isContinuousPlay: continuousPlay,
        linkEndpoints,
      }}
      onAnnotationsChange={setAnnotations}
    >
      {/* Playback controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>

      {/* Annotation controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <ContinuousPlayCheckbox checked={continuousPlay} onChange={setContinuousPlay} />
        <LinkEndpointsCheckbox checked={linkEndpoints} onChange={setLinkEndpoints} />
        <EditableCheckbox checked={editable} onChange={setEditable} />
        <DownloadAnnotationsButton annotations={annotations} />
      </div>

      {/* Waveform with integrated annotation boxes and text */}
      <Waveform annotationTextHeight={200} />
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
  { id: '1', start: 0, end: 120, lines: ['Intro & Sponsors'] },
  { id: '2', start: 120, end: 600, lines: ['Guest Interview'] },
  { id: '3', start: 600, end: 900, lines: ['Q&A Session'] },
  { id: '4', start: 900, end: 960, lines: ['Outro'] },
];
```

### Transcription Segments

Break down audio into transcribed segments:

```tsx
const transcription = [
  { id: '1', start: 0, end: 3.5, lines: ['Welcome to the show.'] },
  { id: '2', start: 3.5, end: 7, lines: ["Today we're discussing..."] },
  // ...
];
```

### Music Markers

Mark sections in music:

```tsx
const musicSections = [
  { id: 'v1', start: 0, end: 16, lines: ['Verse 1'] },
  { id: 'c1', start: 16, end: 32, lines: ['Chorus'] },
  { id: 'v2', start: 32, end: 48, lines: ['Verse 2'] },
  { id: 'c2', start: 48, end: 64, lines: ['Chorus'] },
  { id: 'br', start: 64, end: 80, lines: ['Bridge'] },
  { id: 'c3', start: 80, end: 96, lines: ['Final Chorus'] },
];
```

### Multi-line Annotations

Annotations support multiple lines of text:

```tsx
const detailedAnnotations = [
  {
    id: '1',
    start: 0,
    end: 30,
    lines: [
      'Speaker: John Smith',
      'Topic: Introduction to the project',
      'Key points: overview, timeline, goals',
    ],
  },
];
```

## Live Example

See the [Annotations Example](/examples/annotations) for a full working demo.

## Next Steps

- [Recording](/docs/guides/recording) - Record audio with annotations
- [Theming](/docs/guides/theming) - Customize annotation appearance
