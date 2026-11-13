---
sidebar_position: 6
description: "Create time-synced audio annotations with drag editing, keyboard navigation, and JSON export"
---

# Annotations

Annotations are time ranges with text: a transcript, chapters, markers. The provider holds them; a row of boxes under the waveform and a text list draw them. The same components work under `WaveformPlaylistProvider` and `MediaElementPlaylistProvider`.

## Installation

The components that draw annotations are in a package of their own:

```bash npm2yarn
npm install @waveform-playlist/annotations
```

## Quick Start

Pass the annotations to the provider's `annotationList` prop and render `AnnotationProvider` above the view. `<Waveform />` then draws the row of annotation boxes and, below the view, the annotation text list.

```tsx
import { useState } from 'react';
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';
import { AnnotationProvider } from '@waveform-playlist/annotations';
import type { AnnotationData } from '@waveform-playlist/browser';

function AnnotatedPlaylist() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/podcast.mp3', name: 'Podcast' },
  ]);

  const [annotations, setAnnotations] = useState<AnnotationData[]>([
    { id: '1', start: 0, end: 5, lines: ['Introduction'] },
    { id: '2', start: 5, end: 15, lines: ['Topic Overview'] },
    { id: '3', start: 15, end: 30, lines: ['Main Discussion'] },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      annotationList={{ annotations, editable: true }}
      onAnnotationsChange={setAnnotations}
    >
      <AnnotationProvider>
        <Waveform />
      </AnnotationProvider>
    </WaveformPlaylistProvider>
  );
}
```

`AnnotationProvider` hands the components of `@waveform-playlist/annotations` to the browser package. It can be above or below the playlist provider. Without it:

- the row of boxes draws nothing, without a warning;
- the text list draws nothing and, in a development build, writes one warning to the console;
- the three checkboxes and the download button (below) throw.

The annotations are still held by the provider and `useAnnotations()` still returns them.

`start` and `end` must be numbers (seconds). In a development build, annotations whose first entry has a `start` or `end` that is not a number are rejected with a console error and the provider holds none. Convert Aeneas fragments with [`parseAeneas`](#aeneas-format) first.

## Annotation Structure

```typescript
interface AnnotationData {
  id: string;         // Unique identifier
  start: number;      // Start time in seconds
  end: number;        // End time in seconds
  lines: string[];    // Text content as array of lines
  language?: string;  // Optional language code (e.g., 'en', 'es')
  startTick?: number; // Optional musical position (ticks)
  endTick?: number;
}
```

## Provider Configuration

### `annotationList` Prop

Both providers take the same prop (type `AnnotationListProp`):

```typescript
interface AnnotationListProp {
  annotations?: AnnotationData[];
  editable?: boolean;         // Annotations can be edited (text, ids, edges). Default: false
  linkEndpoints?: boolean;    // A dragged edge takes the edge it touches along. Default: false
  isContinuousPlay?: boolean; // Playback runs on past the end of an annotation. Default: false
}
```

The annotations are yours: the provider shows what the prop holds and keeps no copy of its own.

The three options are provider state that follows the prop. Each starts from its field (a field left out is `false`). When the value of a field changes, the option takes the new value. Between two changes of the prop, a setter or one of the checkboxes changes the option; the prop is not told, and its next change wins for the field that changed. So you can do either of these:

- keep the options in your own state and pass them in `annotationList`;
- pass starting values (or nothing) and let the user change the options with the [checkboxes](#option-checkboxes).

### `onAnnotationsChange` Callback

Every change to the annotations is reported here with the full new array: the release of an edge drag, an edit of a text or an id in the list, an action button, a keyboard shortcut. Put the array in your state and pass it back:

```tsx
<WaveformPlaylistProvider
  tracks={tracks}
  annotationList={{ annotations, editable: true }}
  onAnnotationsChange={setAnnotations}
>
  <AnnotationProvider>
    <Waveform />
  </AnnotationProvider>
</WaveformPlaylistProvider>
```

Without `onAnnotationsChange` an edit is dropped, and a development build warns in the console.

### Reading and Setting the Options

```tsx
import { useAnnotationOptions, usePlaybackControls } from '@waveform-playlist/browser';

const { editable, linkEndpoints, continuousPlay } = useAnnotationOptions();
const { setAnnotationsEditable, setLinkEndpoints, setContinuousPlay } = usePlaybackControls();
```

Both hooks work under both providers. `useAnnotations()` returns `{ annotations }` and `useActiveAnnotation()` returns `{ activeAnnotationId }`.

What each option does:

| Option | On |
|--------|----|
| `editable` | The boxes show a handle on each edge, and an edge can be dragged. In the list, the text and the id of a row can be edited in place, and the `actions` buttons are shown. |
| `linkEndpoints` | See [Linked Endpoints](#linked-endpoints) for the edge drag. The boundary shortcuts read it too: with it on, a nudged edge moves the touching edge of the neighbour by the same step. It is also handed to list actions. |
| `continuousPlay` | A clicked annotation plays from its start and playback runs on. Off: playback ends where the annotation ends. |

## The Two Components

The ready-made views (`<Waveform />`, `<WaveformEditor />`, `<MediaElementWaveform />`) take `className` only. They draw the boxes and the list with their defaults: a box is labelled with the annotation's id, the row is 30 px high, the list is at most 200 px high and has no action buttons. To give either one an option, compose the view from its parts:

```tsx
import {
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
  AnnotationList,
} from '@waveform-playlist/browser';
import type { AnnotationData } from '@waveform-playlist/browser';

// Defined outside the component: a new function renders every box.
const boxLabel = (annotation: AnnotationData, index: number) => String(index + 1);

<WaveformRoot>
  <WaveformTimescale />
  <WaveformLoopRegion />
  <WaveformTrackControls />
  <WaveformTracks />
  <WaveformAnnotationBoxes getLabel={boxLabel} height={30} />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
<AnnotationList height={300} actions={annotationActions} />
```

Under `MediaElementPlaylistProvider` the root is `<MediaElementWaveformRoot>` and its parts are `<WaveformTimescale />`, `<WaveformTracks />`, `<WaveformAnnotationBoxes />`, `<WaveformSelection />` and `<WaveformPlayhead />`. See [Composing the View](/docs/react/guides/composing-the-view).

### WaveformAnnotationBoxes

The row of annotation boxes. It is a part of the view: a child of `WaveformRoot` or `MediaElementWaveformRoot`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `getLabel` | `(annotation: AnnotationData, index: number) => string` | the annotation's id | The label of a box. Pass a function that keeps its identity (defined outside the component, or memoized): a new one renders every box. |
| `height` | `number` | `30` | Height of the row in pixels. |

A click on a box makes its annotation the active one and plays it from its start.

The part wires the drag of the edges itself: it has its own `DragDropProvider` around the row. While the `editable` option is on, an edge can be dragged. The boxes and the list follow the drag as it moves, and `onAnnotationsChange` is called once, on release. Escape cancels the drag and puts back every annotation it moved. An edge can be dragged as far as the timeline is drawn, which can be past the end of the audio (an empty timeline is drawn 60 seconds long; a recording and a view that fills its container draw past the audio too), so annotations can mark what is not recorded yet. You do not call `useAnnotationDragHandlers` for it, and a `DragDropProvider` of your own around the view does not receive the drag of an annotation edge.

By default the drag starts after the pointer has moved 1 px. With `<ClipInteractionOptions touchOptimized>` (or `<ClipInteractionProvider touchOptimized>`) above the view, a touch must be held 250 ms first, so a swipe can scroll the page:

```tsx
import { ClipInteractionOptions } from '@waveform-playlist/browser';

<ClipInteractionOptions touchOptimized>
  <Waveform />
</ClipInteractionOptions>
```

The keyboard does not move an edge handle. Under `WaveformPlaylistProvider`, the [keyboard shortcuts](#keyboard-shortcuts) move the edges of the active annotation.

### AnnotationList

The annotation text list. Render it anywhere under the provider: below the view, in a sidebar, more than once. It is not a part of the root.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | `number` | - | Height of the list in pixels. Without it the list is at most 200 px high. |
| `actions` | `AnnotationAction[]` | - | Buttons shown on each row while the `editable` option is on. Pass an array that keeps its identity: a new one renders every row. |
| `scrollActivePosition` | `'center' \| 'start' \| 'end' \| 'nearest' \| 'none'` | `'center'` | Where the active annotation is put when the list scrolls to it. `'none'`: the list does not follow. |
| `scrollActiveContainer` | `'nearest' \| 'all'` | `'nearest'` | Which containers scroll: only the list, or the page too. |
| `children` | `(item: RenderAnnotationItemProps) => ReactNode` | - | Draws a row, in place of the default one. |

The list draws nothing while there are no annotations.

A click on a row makes the annotation the active one and plays it from its start, as a click on its box does. In the default row, a click in a field that is being edited places the caret, and a click on an action button runs the action; neither plays the annotation.

While `editable` is on, the text and the id of a default row can be edited in place. The edit is reported through `onAnnotationsChange` when the field loses focus; Enter leaves the field. An empty id is not accepted.

#### Action Buttons

An action is called with the annotation, its index, a copy of the annotations array, and the provider's `{ linkEndpoints, continuousPlay }`. It changes the copy in place; the list then reports the copy through `onAnnotationsChange`.

```tsx
import type { AnnotationAction } from '@waveform-playlist/core';

// Outside the component, so the array keeps its identity.
const annotationActions: AnnotationAction[] = [
  {
    text: '+',
    title: 'Move the end 10 ms later',
    action: (annotation, index, annotations, opts) => {
      annotation.end += 0.01;
      const next = annotations[index + 1];
      if (opts.linkEndpoints && next) next.start += 0.01;
    },
  },
  {
    text: '🗑',
    title: 'Delete annotation',
    action: (annotation, index, annotations) => {
      annotations.splice(index, 1);
    },
  },
];

<AnnotationList actions={annotationActions} />
```

An action has a `title` and either a `text` or a `class` (the class names of an icon, written with dots: `'fas.fa-trash'`). The types `AnnotationAction` and `RenderAnnotationItemProps` are exported by `@waveform-playlist/core`, which the browser package depends on.

#### Custom Rows

Pass a function as the child to draw the rows yourself. It is called with `{ annotation, index, isActive, onClick, formatTime }`. `onClick` plays the annotation. Define the function outside the component (or memoize it): one written inline is a new function on every render of your component and renders every row.

```tsx
import type { RenderAnnotationItemProps } from '@waveform-playlist/core';

const renderRow = ({ annotation, isActive, onClick, formatTime }: RenderAnnotationItemProps) => (
  <div onClick={onClick} style={{ background: isActive ? '#ffe0b2' : 'transparent' }}>
    <strong>
      {formatTime(annotation.start)} - {formatTime(annotation.end)}
    </strong>
    <p>{annotation.lines.join(' ')}</p>
  </div>
);

<AnnotationList height={200}>{renderRow}</AnnotationList>
```

A custom row has no editable fields and no action buttons: those belong to the default row.

### Option Checkboxes

Three checkboxes show and set the provider's options, and a button downloads the annotations. Import them from `@waveform-playlist/browser`; they need `AnnotationProvider` above them and throw without it. They work under both providers.

```tsx
import {
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/browser';

<ContinuousPlayCheckbox />
<LinkEndpointsCheckbox />
<EditableCheckbox />
<DownloadAnnotationsButton filename="annotations.json" />
```

Their labels are "Continuous Play", "Link Endpoints" and "Editable Annotations". Each takes a `className`. The download button writes the annotations as Aeneas JSON and is disabled while there are none.

### Linked Endpoints

With `linkEndpoints` on:

- An edge that is within 10 ms of its neighbour's edge moves that edge with it, so the two annotations stay joined.
- An edge that is further from its neighbour stops when it reaches the neighbour. From there the two edges touch, and a drag that goes on carries the neighbour's edge along.

With `linkEndpoints` off:

- An edge dragged past its neighbour's edge moves the neighbour's edge to where it is.
- Gaps between annotations stay.

In both cases an annotation cannot be made shorter than 0.1 s by dragging one of its own edges.

## Keyboard Shortcuts

`WaveformPlaylistProvider` only. `<KeyboardShortcuts annotations />` turns on the annotation shortcuts; it reads the annotations and the options from the provider.

```tsx
import { KeyboardShortcuts } from '@waveform-playlist/browser';

<KeyboardShortcuts playback annotations />
```

| Key | Action |
|-----|--------|
| `↑` / `←` | Select the previous annotation |
| `↓` / `→` | Select the next annotation |
| `Home` / `End` | Select the first / last annotation |
| `Escape` | Deselect the annotation |
| `Enter` | Play the selected annotation |
| `[` / `]` | Move the start of the selected annotation 10 ms earlier / later |
| `Shift+[` / `Shift+]` | Move the end of the selected annotation 10 ms earlier / later |

The selection wraps around at both ends of the list. The last three rows need a selected annotation. The boundary keys work whether or not `editable` is on.

### useAnnotationKeyboardControls

The hook behind `<KeyboardShortcuts annotations />`, for a component of your own. Calling it installs the shortcuts above.

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
  onActiveAnnotationChange,   // (id: string | null) => void (optional; without it the selection keys are off)
  duration,                   // number
  linkEndpoints,              // boolean
  continuousPlay,             // boolean (optional, default false)
  enabled,                    // boolean (optional, default true)
  scrollContainerRef,         // RefObject<HTMLDivElement | null> (optional)
  onPlay,                     // (startTime, duration?) => void (optional)
  samplesPerPixel,            // number (optional; default: the provider's)
  sampleRate,                 // number (optional; default: the provider's)
});
```

## A Row of Boxes of Your Own

`<WaveformAnnotationBoxes>` needs none of this. To draw the boxes yourself and keep the edge drag, use the two hooks the part uses.

```tsx
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import {
  useAnnotations,
  useAnnotationOptions,
  usePlaybackControls,
  usePlaylistView,
  usePlaylistZoom,
  useAnnotationDragHandlers,
  useAnnotationsWithPreview,
} from '@waveform-playlist/browser';

const HORIZONTAL_ONLY = [RestrictToHorizontalAxis];

function MyAnnotationBoxes({ duration }: { duration: number }) {
  const { annotations } = useAnnotations();
  const { linkEndpoints } = useAnnotationOptions();
  const { setAnnotations, annotationPreview } = usePlaybackControls();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

  const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
    annotations,
    onAnnotationsChange: setAnnotations, // called once, on release, when `preview` is passed
    preview: annotationPreview,          // shows the drag without changing your state per move
    samplesPerPixel,
    sampleRate,                          // default 48000; pass the provider's
    duration,                            // seconds; an edge does not go past it
    linkEndpoints,
  });

  // The annotations as the drag in progress would leave them.
  const shown = useAnnotationsWithPreview(annotations, annotationPreview);

  return (
    <DragDropProvider
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={HORIZONTAL_ONLY}
    >
      {/* your boxes, drawn from `shown` */}
    </DragDropProvider>
  );
}
```

Without `preview`, `onAnnotationsChange` is called on every pointer move. Escape cancels the drag and restores every annotation it moved.

The handlers act on a draggable whose data is `{ annotationId, annotationIndex, edge: 'start' | 'end' }`; a drag with other data is ignored. The `AnnotationBox` of the annotations package registers its two edge handles that way.

For the click on one of your boxes, call `playAnnotation(annotation)` from `usePlaybackControls()`. It is what the built-in boxes and list rows call: the annotation becomes the active one and plays from its start, and with continuous play off playback ends where the annotation ends. The function never changes, so it can be a prop of memoized boxes.

## Annotation Package Components

`@waveform-playlist/annotations` exports the components the two browser components are built from. Use them for an annotation UI that does not go through the provider. They take everything as props and read no playlist context.

### AnnotationText

The scrollable list that `<AnnotationList>` renders.

```tsx
import { AnnotationText } from '@waveform-playlist/annotations';

<AnnotationText
  annotations={annotations}
  activeAnnotationId={activeId}
  shouldScrollToActive
  editable
  height={200}
  onAnnotationClick={(annotation) => seekTo(annotation.start)}
  onAnnotationUpdate={setAnnotations}
/>
```

`onAnnotationClick` is called for a click on a row. `onAnnotationUpdate` is called with the full array after a text edit, an id edit or an action button. Its other props are `controls` (the action buttons; shown whenever given), `annotationListConfig` (the fourth argument of an action), `scrollActivePosition`, `scrollActiveContainer` and `renderAnnotationItem` (the function that draws a row).

### AnnotationBox

One annotation box with a handle on each edge.

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
  editable
  onClick={() => selectAnnotation(annotation)}
/>
```

`color` is the border of a box that is not active. `editable` defaults to `true` here and decides whether the two handles are drawn. The handles are dnd-kit draggables: to move an edge, render the boxes inside a `DragDropProvider` with the handlers of `useAnnotationDragHandlers` (above).

### AnnotationBoxesWrapper

The positioned container for a row of boxes. Props: `height` (default 30), `width`, `offset` (left padding in pixels, default 0), `className`.

```tsx
import { AnnotationBoxesWrapper, AnnotationBox } from '@waveform-playlist/annotations';

<AnnotationBoxesWrapper height={30} width={timelineWidth}>
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

### AnnotationsTrack

A layout container with the same props as `AnnotationBoxesWrapper` and a default height of 100. It takes no annotations and draws none.

### Checkboxes and Download Button

The package's own `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` and `DownloadAnnotationsButton` are the controlled forms of the ones above: the checkboxes take `checked` and `onChange`, the button takes `annotations` and `filename`. Use the ones from `@waveform-playlist/browser` under a provider.

### useAnnotationControls

A hook for a UI that has no playlist provider. It holds two booleans as state and wraps the boundary function of `@waveform-playlist/core`. Nothing in the browser package calls it, and it is not connected to the provider's options: under a provider use `useAnnotationOptions()`.

```typescript
import { useAnnotationControls } from '@waveform-playlist/annotations';

const {
  continuousPlay,             // boolean
  linkEndpoints,              // boolean
  setContinuousPlay,          // (value: boolean) => void
  setLinkEndpoints,           // (value: boolean) => void
  updateAnnotationBoundaries, // (params) => AnnotationData[]
} = useAnnotationControls({
  initialContinuousPlay: false, // default false
  initialLinkEndpoints: true,   // default true
});

const updated = updateAnnotationBoundaries({
  annotationIndex,
  newTime,          // seconds
  isDraggingStart,  // true: the start edge; false: the end edge
  annotations,
  duration,
  linkEndpoints,
});
```

`updateAnnotationBoundaries` returns a new array and does not change the one it is given.

## Styling Annotations

The annotation colours are theme keys. Pass the ones you want to change in the provider's `theme`:

```tsx
const theme = {
  // Annotation boxes
  annotationBoxBackground: 'rgba(255, 255, 255, 0.85)',
  annotationBoxActiveBackground: 'rgba(255, 255, 255, 0.95)',
  annotationBoxHoverBackground: 'rgba(255, 255, 255, 0.98)',
  annotationBoxBorder: '#ff9800',        // border of a box that is not active, glow of the active one
  annotationBoxActiveBorder: '#d67600',  // border of the active box, and of a hovered one
  annotationLabelColor: '#2a2a2a',

  // Edge handles
  annotationResizeHandleColor: 'rgba(0, 0, 0, 0.4)',
  annotationResizeHandleActiveColor: 'rgba(0, 0, 0, 0.8)',

  // Text list
  annotationTextItemHoverBackground: 'rgba(0, 0, 0, 0.03)',
  annotationTextItemActiveColor: '#ff9800', // the active row (edge, tint, glow) and the list's focus rings
};

<WaveformPlaylistProvider tracks={tracks} theme={theme}>
  <AnnotationProvider>
    <Waveform />
  </AnnotationProvider>
</WaveformPlaylistProvider>
```

The values shown are the defaults of the light theme. See [Theming](/docs/react/guides/theming).

## Import/Export

### Aeneas Format

`parseAeneas` converts one Aeneas fragment (`begin` and `end` are strings) to one annotation; `serializeAeneas` converts one annotation back. Map over an array:

```tsx
import { parseAeneas, serializeAeneas } from '@waveform-playlist/annotations';

const fragments = [
  { id: 'f000001', begin: '0.000', end: '2.680', lines: ['First line'], language: 'en' },
  { id: 'f000002', begin: '2.680', end: '5.880', lines: ['Second line'], language: 'en' },
];

const annotations = fragments.map(parseAeneas);
// [{ id: 'f000001', start: 0, end: 2.68, lines: ['First line'], language: 'en' }, …]

const exported = annotations.map(serializeAeneas);
// begin and end as strings with three decimals; language 'en' when the annotation has none
```

### Download Button

`<DownloadAnnotationsButton filename="annotations.json" />` from `@waveform-playlist/browser` downloads the provider's annotations as an array of Aeneas fragments.

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

A file written by the download button holds Aeneas fragments: pass `imported.map(parseAeneas)` to `onImport`.

## Complete Example

The options start from `annotationList` and are changed with the checkboxes. The annotations are kept in state and come back through `onAnnotationsChange`.

```tsx
import { useState } from 'react';
import {
  WaveformPlaylistProvider,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
  AnnotationList,
  PlayButton,
  PauseButton,
  StopButton,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
  KeyboardShortcuts,
} from '@waveform-playlist/browser';
import type { AnnotationData } from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';
import { AnnotationProvider } from '@waveform-playlist/annotations';
import type { AnnotationAction } from '@waveform-playlist/core';

const annotationActions: AnnotationAction[] = [
  {
    text: '🗑',
    title: 'Delete annotation',
    action: (annotation, index, annotations) => {
      annotations.splice(index, 1);
    },
  },
];

const boxLabel = (annotation: AnnotationData, index: number) => String(index + 1);

function AnnotationsExample() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/podcast.mp3', name: 'Podcast Episode' },
  ]);

  const [annotations, setAnnotations] = useState<AnnotationData[]>([
    { id: '1', start: 0, end: 10, lines: ['Introduction'] },
    { id: '2', start: 10, end: 30, lines: ['Main Topic'] },
    { id: '3', start: 30, end: 45, lines: ['Conclusion'] },
  ]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      annotationList={{ annotations, editable: true, linkEndpoints: true }}
      onAnnotationsChange={setAnnotations}
    >
      <AnnotationProvider>
        <KeyboardShortcuts playback annotations />

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <ContinuousPlayCheckbox />
          <LinkEndpointsCheckbox />
          <EditableCheckbox />
          <DownloadAnnotationsButton />
        </div>

        <WaveformRoot>
          <WaveformTimescale />
          <WaveformLoopRegion />
          <WaveformTrackControls />
          <WaveformTracks />
          <WaveformAnnotationBoxes getLabel={boxLabel} />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
        <AnnotationList height={200} actions={annotationActions} />
      </AnnotationProvider>
    </WaveformPlaylistProvider>
  );
}

export default AnnotationsExample;
```

To drive an option from your own state instead, put it in the prop: `annotationList={{ annotations, editable, linkEndpoints, isContinuousPlay }}`. The provider's option takes each new value.

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

- [Recording](/docs/react/guides/recording) - Record audio with annotations
- [Theming](/docs/react/guides/theming) - Customize annotation appearance
