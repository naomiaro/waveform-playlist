---
sidebar_position: 6
description: "Create time-synced audio annotations with drag editing, keyboard navigation, and JSON export"
---

# Annotations

Annotations are time ranges with text: a transcript, chapters, markers. An annotation store owns them: your app makes it and gives it to the provider, which shows what the store holds; a row of boxes under the waveform and a text list draw them. The same store and the same components work under `WaveformPlaylistProvider` and `MediaElementPlaylistProvider`.

## Installation

The components that draw annotations are in a package of their own:

```bash npm2yarn
npm install @waveform-playlist/annotations
```

## Quick Start

Make an annotation store with `useCreateAnnotationStore`, pass it to the provider's `annotationStore` prop, and render `AnnotationProvider` above the view. `<Waveform />` then draws the row of annotation boxes and, below the view, the annotation text list.

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  useCreateArrangement,
  useCreateAnnotationStore,
} from '@waveform-playlist/browser';
import { AnnotationProvider } from '@waveform-playlist/annotations';
import { audioTrack } from '@waveform-playlist/core';

function AnnotatedPlaylist() {
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/podcast.mp3', name: 'Podcast' }),
  ]);

  const annotationStore = useCreateAnnotationStore(() => [
    { id: '1', start: 0, end: 5, lines: ['Introduction'] },
    { id: '2', start: 5, end: 15, lines: ['Topic Overview'] },
    { id: '3', start: 15, end: 30, lines: ['Main Discussion'] },
  ]);

  return (
    <WaveformPlaylistProvider
      arrangement={arrangement}
      annotationStore={annotationStore}
      annotationList={{ editable: true }}
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
- the three checkboxes and the download button (below) still work: they read the playlist provider, not `AnnotationProvider`.

The store still holds the annotations and `useAnnotations()` still returns them.

`start` and `end` must be finite numbers (seconds), and no two annotations may have the same `id`. The store checks every annotation it is given, in every build, and throws a `TypeError` for a list that breaks either rule (see [What the store refuses](#what-the-store-refuses)). Convert Aeneas fragments with [`parseAeneas`](#aeneas-format) first.

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

## The Annotation Store

The store is the one place the annotations are kept. The provider, the boxes, the list, the keyboard shortcuts and your own components all read it, and every change, yours or the library's, is a call to one of its methods. Nothing keeps a copy that it writes back, so two changes made in the same tick both land, whoever makes them.

```typescript
interface AnnotationStore {
  /** The current annotations. The same array until a change. Never write to it. */
  getAnnotations(): readonly AnnotationData[];
  /** Be told after every change. Returns the function that unsubscribes. */
  subscribe(listener: () => void): () => void;
  /** Replace the annotations. */
  set(annotations: readonly AnnotationData[]): void;
  /** Change the annotations: `fn` gets the current array and returns the next. */
  update(fn: (current: readonly AnnotationData[]) => readonly AnnotationData[]): void;
}
```

The type is exported by `@waveform-playlist/core`.

### Making One

In a React component, `useCreateAnnotationStore(init?, options?)` from `@waveform-playlist/browser` makes one store per component instance and returns the same store on every render. `init` is read once, on the first render; a list it returns that the store refuses throws out of the render, to the nearest error boundary above the component. The store holds what `init` returns, or nothing when there is no `init`.

Outside React, or for a store that lives in a module of your own, `createAnnotationStore(initial?, options?)` from `@waveform-playlist/core` does the same; it throws a `TypeError` for an initial list it refuses.

### Reading It

`useStoredAnnotations(store)` returns the store's list and re-renders the component when it changes. It takes the store as its argument, so it works above the provider as well as below it. Below the provider, `useAnnotations().annotations` is the same list.

```tsx
import { useStoredAnnotations } from '@waveform-playlist/browser';
import type { AnnotationStore } from '@waveform-playlist/core';

function AnnotationCount({ store }: { store: AnnotationStore }) {
  const annotations = useStoredAnnotations(store);
  return <span>{annotations.length} annotations</span>;
}
```

The list is the same array until the annotations change. Never write to it: it is typed `readonly AnnotationData[]`, and in a development build the array, each annotation and each annotation's `lines` are frozen. A development build here is one where `process.env.NODE_ENV` is set and is not `'production'` (what a bundler's dev server gives); a page that loads the module with no bundler and no `process` freezes nothing. On a frozen list `annotations.sort(…)` or `.push(…)` throws a `TypeError` in any code, and an assignment (`annotation.end = 4`) throws in strict code, which includes every module (in sloppy-mode script it is silently ignored). In a production build nothing is frozen, and such a write changes the list every reader shares. Copy first: `[...annotations].sort((a, b) => a.start - b.start)`.

### Changing It

`set(list)` replaces the annotations; `update(fn)` calls `fn` with the current list and stores what it returns. Both apply before they return: the next `getAnnotations()`, and the `current` of the next `update`, already hold the change. An `update` whose `fn` returns `current` itself changes nothing and tells nobody.

```tsx
// Load a file
annotationStore.set(fragments.map(parseAeneas));

// Add one at the end
annotationStore.update((current) => [
  ...current,
  { id: crypto.randomUUID(), start: 12, end: 14, lines: ['New annotation'] },
]);

// Remove one
annotationStore.update((current) => current.filter((a) => a.id !== id));
```

Below the provider, `usePlaybackControls().annotationStore` is the store passed to the provider (`undefined` without one), for a component deep in the tree:

```tsx
import { usePlaybackControls, usePlaybackRefs } from '@waveform-playlist/browser';

function AddAtCursorButton() {
  const { annotationStore } = usePlaybackControls();
  const { currentTimeRef } = usePlaybackRefs();
  return (
    <button
      type="button"
      disabled={!annotationStore}
      onClick={() => {
        const start = currentTimeRef.current ?? 0;
        annotationStore?.update((current) => [
          ...current,
          { id: crypto.randomUUID(), start, end: start + 2, lines: [''] },
        ]);
      }}
    >
      Add annotation
    </button>
  );
}
```

### Saving the Annotations

The store tells its subscribers after every change. To save the annotations, subscribe to it, or read it with `useStoredAnnotations` and save from an effect:

```tsx
const annotations = useStoredAnnotations(annotationStore);
useEffect(() => {
  localStorage.setItem('annotations', JSON.stringify(annotations));
}, [annotations]);

// or, outside a component
const unsubscribe = annotationStore.subscribe(() => {
  save(annotationStore.getAnnotations());
});
```

A subscriber that throws is reported with a console warning; the other subscribers are still told.

### Your Rules for Every Change: `beforeChange`

`beforeChange(next, current)` is called for every `set` and `update`, the library's included (an edge release, a boundary key, a text, id or action-button edit in the list). It gets the proposed list and the current one, and returns the list to store:

- `next` stores the change;
- `current` refuses it: nothing changes and no subscriber is told;
- another list adjusts it: that list is stored (and checked as any other list).

It is not called for the initial list, nor when the proposed list is the current array itself (an `update` that returns `current`). Nor is it called for a list that fails the store's checks: those run first and throw (see [What the Store Refuses](#what-the-store-refuses)), so a rule cannot repair an invalid list.

```tsx
// Refuse an edit that leaves an annotation without text
const annotationStore = useCreateAnnotationStore(() => initialAnnotations, {
  beforeChange: (next, current) =>
    next.some((a) => a.lines.join('').trim() === '') ? current : next,
});
```

```tsx
// Keep every annotation inside the first 60 seconds
const LIMIT = 60;

const annotationStore = useCreateAnnotationStore(() => initialAnnotations, {
  beforeChange: (next) =>
    next.some((a) => a.end > LIMIT)
      ? next.map((a) =>
          a.end > LIMIT ? { ...a, start: Math.min(a.start, LIMIT - 0.1), end: LIMIT } : a
        )
      : next,
});
```

What the user sees when a change is refused or adjusted: an edge released where the rule refuses it goes back to where the store has it, a refused boundary key does nothing, and a text or id field whose edit was not stored shows the stored value again. With the built-in boxes (which use the provider's preview) the boxes show a dragged edge where the pointer is, and the rule applies once, on release. A row of boxes of your own that calls `useAnnotationDragHandlers` without `preview` writes every move with `update`, so the rule applies to each move.

`useCreateAnnotationStore` follows `beforeChange`: the store calls the function passed on the most recent committed render, so a rule that reads your component's state sees its current value. `createAnnotationStore` keeps the function it was given.

Return `current` to refuse; do not throw. A throw from `beforeChange` reaches the caller of `set` or `update`, and the store keeps its value.

### What the Store Refuses

Every list the store is given (the initial list, `set`, what `update`'s function returns, what `beforeChange` returns) is checked: each annotation has a finite numeric `start` and `end`, and no two annotations have the same `id`. A list that fails either check throws a `TypeError` from the call, and the store keeps its value:

```text
[waveform-playlist] Invalid annotations: annotation "f001" needs numeric start and end (got string and string). Parse text formats first, e.g. parseAeneas() from @waveform-playlist/annotations.
[waveform-playlist] Invalid annotations: two annotations have the id "3".
```

The id field of the annotation list writes nothing for a duplicate id and shows the stored id again (see [AnnotationList](#annotationlist)).

### Changes During an Edge Drag

While an edge is dragged, the boxes and the list show the store's current list with the drag's moves on top. A change made elsewhere during the drag (a live feed that adds annotations, a text edit, a `set`) is drawn at once, and each move of the pointer is worked out over that current list: a neighbour your app moved during the drag is collided with where it is now, and an edge dragged into a neighbour still carries it along (see [Linked Endpoints](#linked-endpoints)).

The drag keeps the `start` and `end` of every annotation it has touched, the dragged one and each neighbour it moved, also one moved back to where it was. On release it writes those bounds, found by id in the store's list as it is then; nothing else is written, so an annotation added during the drag stays, and so does any other edit made elsewhere, except to the `start` and `end` of an annotation the drag has touched: those are the drag's.

The drag ends and writes nothing more, its preview cleared, when the dragged annotation is removed from the store (a "clear all" included), when the provider is given another store, or when the component that drags unmounts. Without `preview` the moves already written stay.

## Provider Configuration

### `annotationStore` Prop

Both providers take the same prop, an `AnnotationStore`. The provider publishes what the store holds (`useAnnotations()`) and writes nothing back. Without it there are no annotations: `useAnnotations().annotations` is `[]`, the boxes and the list draw nothing, and the drag, the boundary keys and the list's edits have nothing to write to.

### `annotationList` Prop

Both providers take the same prop (type `AnnotationListProp`), which holds the three annotation options. The annotations are not here: they are the store's.

```typescript
interface AnnotationListProp {
  editable?: boolean;         // Annotations can be edited (text, ids, edges). Default: false
  linkEndpoints?: boolean;    // A dragged edge takes the edge it touches along. Default: false
  isContinuousPlay?: boolean; // Playback runs on past the end of an annotation. Default: false
}
```

The three options are provider state that follows the prop. Each starts from its field (a field left out is `false`). When the value of a field changes, the option takes the new value. Between two changes of the prop, a setter or one of the checkboxes changes the option; the prop is not told, and its next change wins for the field that changed. So you can do either of these:

- keep the options in your own state and pass them in `annotationList`;
- pass starting values (or nothing) and let the user change the options with the [checkboxes](#option-checkboxes).

### Reading and Setting the Options

```tsx
import { useAnnotationOptions, usePlaybackControls } from '@waveform-playlist/browser';

const { editable, linkEndpoints, continuousPlay } = useAnnotationOptions();
const { setAnnotationsEditable, setLinkEndpoints, setContinuousPlay } = usePlaybackControls();
```

Both hooks work under both providers. `useAnnotations()` returns `{ annotations }`, the store's list (read-only), and `useActiveAnnotation()` returns `{ activeAnnotationId }`.

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
import type { AnnotationData } from '@waveform-playlist/core';

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

The part wires the drag of the edges itself: it has its own `DragDropProvider` around the row. While the `editable` option is on, an edge can be dragged. The boxes and the list follow the drag as it moves, and the store is written once, on release (see [Changes During an Edge Drag](#changes-during-an-edge-drag)). Escape cancels the drag and puts back every annotation it moved. An edge can be dragged as far as the timeline is drawn, which can be past the end of the audio (an empty timeline is drawn 60 seconds long; a recording and a view that fills its container draw past the audio too), so annotations can mark what is not recorded yet. You do not call `useAnnotationDragHandlers` for it, and a `DragDropProvider` of your own around the view does not receive the drag of an annotation edge.

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

While `editable` is on, the text and the id of a default row can be edited in place. The edit is written to the store when the field loses focus; Enter leaves the field. A field that loses focus with its text unchanged writes nothing, and no subscriber is told. The row's annotation is found by its id in the store's list as it is then, so an annotation added or removed elsewhere in the meantime does not send the edit to another row. An empty id, and an id another annotation already has, are not accepted: nothing is written and the field shows the stored id again. A field whose edit the store did not keep (refused by [`beforeChange`](#your-rules-for-every-change-beforechange)) shows the stored value again.

#### Action Buttons

An action is called with the annotation, its index, the annotations, and the provider's `{ linkEndpoints, continuousPlay }`. The array and the annotations it holds (with their `lines`) are copies of the store's list as it is when the button is pressed, so the action changes them in place; the list then writes the result to the store. `index` is the annotation's position in that list. Annotations the action did not change keep their objects.

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

Three checkboxes show and set the provider's options, and a button downloads the annotations. Import them from `@waveform-playlist/annotations`. They work under both providers and need only the playlist provider above them, not `AnnotationProvider`; without a playlist provider they throw.

```tsx
import {
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/annotations';

<ContinuousPlayCheckbox />
<LinkEndpointsCheckbox />
<EditableCheckbox />
<DownloadAnnotationsButton filename="annotations.json" />
```

The checkboxes take `disabled` and two more props: `children`, the label (default "Continuous Play", "Link Endpoints" and "Editable Annotations"), and `className`, on the element that wraps the input and its label. Their props type is `AnnotationCheckboxProps`.

The download button writes the provider's annotations as Aeneas JSON. Its props: `filename` (default `annotations.json`), `children`, the label (default "Download JSON"), `title`, `disabled` and `className`. It is also disabled while there are no annotations. `title` is the tooltip: left out, it is "No annotations to download" while there are none and "Download the annotations as JSON" otherwise; given, it is used in both cases. Every string the four controls draw can so be supplied by your app: `children` on all four, `title` on the button.

```tsx
<EditableCheckbox>Allow editing</EditableCheckbox>
<DownloadAnnotationsButton filename="chapters.json" disabled={saving}>
  Save chapters
</DownloadAnnotationsButton>
```

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

The selection wraps around at both ends of the list. The last three rows need a selected annotation. The boundary keys work whether or not `editable` is on. A boundary key that cannot move the edge (a start at 0, an end at the end of the audio, an annotation already at its shortest) changes nothing and tells no subscriber.

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
  store,                      // AnnotationStore | undefined (usePlaybackControls().annotationStore)
  activeAnnotationId,         // string | null
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

The hook reads the annotations from `store`. A boundary key finds the active annotation by its id in the store's list when the key is pressed and changes it there. Without a store there is nothing to select or move.

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
  const { annotationStore, annotationPreview } = usePlaybackControls();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

  const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
    store: annotationStore,              // written once, on release, when `preview` is passed
    preview: annotationPreview,          // shows the drag without writing to the store per move
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

With `preview`, the release writes the bounds of every annotation the drag touched, by id (see [Changes During an Edge Drag](#changes-during-an-edge-drag)). Without `preview`, every pointer move writes all the touched bounds to the store. Escape cancels the drag and restores every annotation it touched: with `preview` nothing was written; without it each touched annotation's bounds from the start of the drag are written back. A drag that ends because its annotation was removed, the store changed or the component unmounted writes nothing more (without `preview`, the moves already written stay). Without a store the handlers do nothing.

The handlers act on a draggable whose data is `{ annotationId, annotationIndex, edge: 'start' | 'end' }`; a drag with other data is ignored. The `AnnotationBox` of the annotations package registers its two edge handles that way.

For the click on one of your boxes, call `playAnnotation(annotation)` from `usePlaybackControls()`. It is what the built-in boxes and list rows call: the annotation becomes the active one and plays from its start, and with continuous play off playback ends where the annotation ends. The function never changes, so it can be a prop of memoized boxes.

## Annotation Package Components

`@waveform-playlist/annotations` exports the components the two browser components are built from. Use them for an annotation UI that does not go through the provider. They take everything as props and read no playlist context (the checkboxes and the download button, below, are the exception).

### AnnotationText

The scrollable list that `<AnnotationList>` renders.

```tsx
import { useCreateAnnotationStore, useStoredAnnotations } from '@waveform-playlist/browser';
import { AnnotationText } from '@waveform-playlist/annotations';
import type { AnnotationData } from '@waveform-playlist/core';

function Transcript({
  initialAnnotations,
  activeId,
  seekTo,
}: {
  initialAnnotations: AnnotationData[];
  activeId?: string;
  seekTo: (time: number) => void;
}) {
  const store = useCreateAnnotationStore(() => initialAnnotations);
  const annotations = useStoredAnnotations(store);

  return (
    <AnnotationText
      annotations={annotations}
      store={store}
      activeAnnotationId={activeId}
      shouldScrollToActive
      editable
      height={200}
      onAnnotationClick={(annotation) => seekTo(annotation.start)}
    />
  );
}
```

`annotations` is what the list draws; `store` is where its edits are written. A text edit, an id edit and an action button call `store.update` and find their annotation by id in the store's list as it is then, as under the provider. Without `store` the list is read-only: no field can be edited and no action button is drawn, whatever `editable` says. Without React state of your own, `createAnnotationStore` from `@waveform-playlist/core` makes the store.

`onAnnotationClick` is called for a click on a row. Its other props are `controls` (the action buttons; drawn whenever given, with a `store`), `annotationListConfig` (the fourth argument of an action), `scrollActivePosition`, `scrollActiveContainer` and `renderAnnotationItem` (the function that draws a row).

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

`color` is the border of a box that is not active. `editable` defaults to `false` and decides whether the two handles are drawn. The handles are dnd-kit draggables: to move an edge, render the boxes inside a `DragDropProvider` with the handlers of `useAnnotationDragHandlers` (above).

### AnnotationBoxesWrapper

The positioned container for a row of boxes. Props: `height` (default 30), `width`, `className`.

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

### Checkboxes and Download Button

`ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` and `DownloadAnnotationsButton` are described under [Option Checkboxes](#option-checkboxes). They read the playlist provider and have no controlled form (no `checked`, `onChange` or `annotations` props). For a checkbox with a state of your own, build one from `BaseCheckboxWrapper`, `BaseCheckbox` and `BaseCheckboxLabel` of `@waveform-playlist/ui-components`. To save annotations without a provider, serialize them yourself: `annotations.map(serializeAeneas)` ([Aeneas Format](#aeneas-format)).

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

<WaveformPlaylistProvider arrangement={arrangement} theme={theme}>
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

`<DownloadAnnotationsButton filename="annotations.json" />` from `@waveform-playlist/annotations` downloads the provider's annotations as an array of Aeneas fragments.

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

A file written by the download button holds Aeneas fragments: pass `imported.map(parseAeneas)` to `onImport`, and store them with `annotationStore.set(…)`. A list with an annotation whose `start` or `end` is not a number, or with two annotations of one id, makes `set` throw: catch it to tell the user the file was not loaded.

## Complete Example

The options start from `annotationList` and are changed with the checkboxes. The annotations are the store's.

```tsx
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
  WaveformViewOptions,
  AnnotationList,
  PlayButton,
  PauseButton,
  StopButton,
  KeyboardShortcuts,
  useCreateArrangement,
  useCreateAnnotationStore,
} from '@waveform-playlist/browser';
import {
  AnnotationProvider,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/annotations';
import { audioTrack, type AnnotationData, type AnnotationAction } from '@waveform-playlist/core';

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
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/podcast.mp3', name: 'Podcast Episode' }),
  ]);

  const annotationStore = useCreateAnnotationStore(() => [
    { id: '1', start: 0, end: 10, lines: ['Introduction'] },
    { id: '2', start: 10, end: 30, lines: ['Main Topic'] },
    { id: '3', start: 30, end: 45, lines: ['Conclusion'] },
  ]);

  return (
    <WaveformPlaylistProvider
      arrangement={arrangement}
      samplesPerPixel={1024}
      annotationStore={annotationStore}
      annotationList={{ editable: true, linkEndpoints: true }}
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

        <WaveformViewOptions waveHeight={100}>
          <WaveformRoot>
            <WaveformTimescale />
            <WaveformLoopRegion />
            <WaveformTrackControls />
            <WaveformTracks />
            <WaveformAnnotationBoxes getLabel={boxLabel} />
            <WaveformSelection />
            <WaveformPlayhead />
          </WaveformRoot>
        </WaveformViewOptions>
        <AnnotationList height={200} actions={annotationActions} />
      </AnnotationProvider>
    </WaveformPlaylistProvider>
  );
}

export default AnnotationsExample;
```

To drive an option from your own state instead, put it in the prop: `annotationList={{ editable, linkEndpoints, isContinuousPlay }}`. The provider's option takes each new value.

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
