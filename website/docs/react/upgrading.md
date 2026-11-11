---
sidebar_position: 3
description: 'Upgrade guide for the next major release of the Waveform Playlist React packages: every breaking change with its before/after'
---

# Upgrading to the next major

This page lists every breaking change in the next major release of the React packages, in the order you should apply them. Each entry says what changed, how to find affected code, and what to replace it with.

It is written to be followed mechanically, by a person or by a coding agent: search for the pattern under **Find**, apply the change under **Replace with**.

Each package is versioned independently, so "the next major" is a different number per package. Upgrade all `@waveform-playlist/*` packages together.

## React 19 is required

**Packages:** `@waveform-playlist/browser`, `ui-components`, `annotations`, `spectrogram`, `recording`, `midi`.

The `react` (and, where declared, `react-dom`) peer dependency is now `^19.0.0` in every React package. Previously `browser` accepted `^18.2.0 || ^19.0.0`, `ui-components` accepted `>=17.0.0`, and the others accepted `^18.0.0` only, so the set could not be installed together on React 19 without peer warnings.

**Find:** `"react"` and `"react-dom"` in your `package.json`.

**Replace with:**

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

Then follow the [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) for your own code. Nothing in the Waveform Playlist API changes because of this requirement.

## styled-components 6 is required by `ui-components`

**Package:** `@waveform-playlist/ui-components`.

The `styled-components` peer is now `^6.0.0` (was `>=5.0.0`), matching every other package.

**Find:** `"styled-components"` in your `package.json` with a `5.x` range.

**Replace with:** `"styled-components": "^6.0.0"`, then follow the [styled-components v6 migration notes](https://styled-components.com/docs/faqs#what-do-i-need-to-do-to-migrate-to-v6).

## Track effects are pre-fader inserts

**Packages:** `@waveform-playlist/playout`, `@waveform-playlist/browser`.

A track's effects now run before its volume, pan and mute: `clips → effects → volume → pan → mute → master`. Previously they ran last.

**What you will hear:** the volume fader no longer changes how hard a compressor, limiter or distortion on that track works. Mute and solo now silence effect tails too.

### Track effects functions

**Find:** every track effects function (a `TrackEffectsFunction` from `@waveform-playlist/playout`; how it reaches a track is covered [below](#track-effects-are-passed-to-the-provider-not-set-on-tracks)) and every `OfflineTrackEffectsFunction` passed to WAV export (`@waveform-playlist/browser`).

The arguments were `(graphEnd, masterGainNode, isOffline)`. They are now `(trackInput, faderInput, isOffline)`: the shape is the same, but the second argument is the input of the track's own fader, not the master bus.

**Replace with:** a chain that starts at the first argument and ends at the second.

```tsx
// Before: the chain ended at the master bus (or at the destination)
const effects: TrackEffectsFunction = (graphEnd, masterGainNode) => {
  const reverb = new Reverb(1.5);
  graphEnd.connect(reverb);
  reverb.connect(masterGainNode); // or reverb.toDestination()
  return () => reverb.dispose();
};

// After: the chain ends at the track's fader input
const effects: TrackEffectsFunction = (trackInput, faderInput) => {
  const reverb = new Reverb(1.5);
  trackInput.connect(reverb);
  reverb.connect(faderInput);
  return () => reverb.dispose();
};
```

A function that already connected its last node to the second argument needs no code change, only the rename. A function that called `toDestination()` or connected to the master output must be changed: that path now bypasses the track's volume, pan, mute and solo.

### Lower-level connection methods

**Find:** calls to `connectTrackOutput` / `disconnectTrackOutput` on a `TonePlayout` or on `adapter.transport` (from `createToneAdapter`), and calls to `connectEffects` on a `ToneTrack`. All are in `@waveform-playlist/playout`; `@waveform-playlist/browser` has no such methods.

**Replace with:**

- `connectTrackOutput(trackId, node)` → `connectTrackEffects(trackId, input, output)`, passing the first and last node of the chain. The track's output is returned into the track for you; do not connect the chain to the master yourself.
- `disconnectTrackOutput(trackId)` → `disconnectTrackEffects(trackId)`.
- `toneTrack.connectEffects(node)` → `toneTrack.connectEffects(input, output)`.

The [effects guide](./guides/effects.md#track-signal-chain-and-panning) describes the new signal chain.

## `PlayoutProvider`, `usePlayoutStatus` and `usePlayoutStatusUpdate` are removed

**Package:** `@waveform-playlist/ui-components`.

These three exports were a standalone playback-status context (`progress`, `isPlaying`, `selectionStart`, `selectionEnd` and their setters) left over from before the playlist providers existed. Nothing in Waveform Playlist read or wrote it, so it never reflected real playback.

**Find:** `PlayoutProvider`, `usePlayoutStatus` or `usePlayoutStatusUpdate` imported from `@waveform-playlist/ui-components`.

**Replace with:** the hooks of the provider you already render, from `@waveform-playlist/browser`. Delete the `<PlayoutProvider>` wrapper.

| Removed                                               | Inside `WaveformPlaylistProvider`                                                 | Inside `MediaElementPlaylistProvider`                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `usePlayoutStatus().isPlaying`                        | `usePlaybackAnimation().isPlaying`                                                | `useMediaElementAnimation().isPlaying`                        |
| `usePlayoutStatus().progress`                         | `useCurrentTime().currentTime` (seconds), or `currentTimeRef` for per-frame reads | `useMediaElementAnimation().currentTime`, or `currentTimeRef` |
| `usePlayoutStatus().selectionStart` / `.selectionEnd` | `useSelection().selectionStart` / `.selectionEnd`                                 | no selection in this provider                                 |
| `usePlayoutStatusUpdate().setIsPlaying(true / false)` | `usePlaylistControls().play()` / `.pause()`                                       | `useMediaElementControls().play()` / `.pause()`               |
| `usePlayoutStatusUpdate().setProgress(t)`             | `usePlaylistControls().seekTo(t)`                                                 | `useMediaElementControls().seekTo(t)`                         |
| `usePlayoutStatusUpdate().setSelection(start, end)`   | `usePlaylistControls().setSelection(start, end)`                                  | no selection in this provider                                 |

```tsx
// Before
import { PlayoutProvider, usePlayoutStatus } from '@waveform-playlist/ui-components';

function Status() {
  const { isPlaying, selectionStart, selectionEnd } = usePlayoutStatus();
  // ...
}

// After
import { usePlaybackAnimation, useSelection } from '@waveform-playlist/browser';

function Status() {
  const { isPlaying } = usePlaybackAnimation();
  const { selectionStart, selectionEnd } = useSelection();
  // ...
}
```

If you used the context on its own, without a playlist provider, to hold your own state, replace it with a React context of your own; there is no drop-in export.

## `TimeInput` reports a change only after an edit

**Packages:** `@waveform-playlist/ui-components` (`TimeInput`, `SelectionTimeInputs`), `@waveform-playlist/browser` (`SelectionTimeInputs`).

`TimeInput` used to call `onChange` on every blur, with the displayed text parsed back to a number. Moving focus through the input without typing therefore rounded the value to the display format (a selection start of `1.23456` became `1.235`). `onChange` now fires on blur only if the text was edited. `SelectionTimeInputs` calls `onSelectionChange` under the same condition.

**Find:** `onChange` handlers on `<TimeInput>` and `onSelectionChange` handlers on `<SelectionTimeInputs>` that rely on being called when the input merely loses focus.

**Replace with:** an `onBlur` listener on a wrapping element if you need to know that focus left. No change is needed if the handler only stores the value.

## `renderTimestamp` is removed from `<Waveform>`

**Package:** `@waveform-playlist/browser`.

The deprecated `renderTimestamp` prop was typed as `(timeMs, pixelPosition) => ReactNode`, but it never received a time in milliseconds: it was given `parseFloat` of the formatted tick label, which is the minutes part (`"0:30"` → `0`, `"1:00"` → `1`), or the bar and beat read as a decimal number in beats mode (`"2.3"` gave `2.3`). It is removed; `renderTick` is the only label callback.

**Find:** `renderTimestamp=` on `<Waveform>`.

**Replace with:** `renderTick`, which receives the formatted label and the same pixel position.

```tsx
// Before
<Waveform renderTimestamp={(timeMs, pixelPosition) => <MyLabel time={timeMs} />} />

// After: show the label as it is
<Waveform renderTick={(label, pixelPosition) => <MyLabel text={label} />} />
```

If the old callback really needs milliseconds, parse the label. In the temporal scale it is always `m:ss` on a whole second:

```tsx
function labelToMs(label: string): number {
  const [minutes, seconds] = label.split(':').map(Number);
  return (minutes * 60 + seconds) * 1000;
}

<Waveform renderTick={(label, pixelPosition) => <MyLabel time={labelToMs(label)} />} />;
```

Inside `BeatsAndBarsProvider` with `scaleMode="beats"` the label is bar and beat (`"2"`, `"2.3"`), not a time, and `labelToMs` does not apply.

## `audioBuffers` is removed from `usePlaylistData()`

**Package:** `@waveform-playlist/browser`.

`usePlaylistData().audioBuffers` was a flat list of every clip's `AudioBuffer`, filled in by an effect, so it lagged `tracks` by at least one render. Nothing in the library read it. The buffers are on the clips.

**Find:** `audioBuffers` read from `usePlaylistData()`.

**Replace with:** the clips of `tracks`, which is current in every render:

```tsx
// Before
const { audioBuffers } = usePlaylistData();

// After
const { tracks } = usePlaylistData();
const audioBuffers = tracks.flatMap((track) =>
  track.clips.flatMap((clip) => (clip.audioBuffer ? [clip.audioBuffer] : []))
);
```

Two related values on `usePlaylistData()` keep their names and types but are now derived from `tracks` during render instead of being set by an effect:

- `duration` and `peaksDataArray` already match `tracks` in the render that receives new tracks. Code that waited a render for them (for example an effect that compared `peaksDataArray.length` with `tracks.length`) no longer needs to.
- `peaksDataArray` keeps the identity of everything that did not change: a clip's `peaks`, its entry, and its track's array. It is safe to use them as memo or effect dependencies.
- `<Waveform>` no longer renders the text "Loading waveform..." before the first peaks; clips render at once and their waveforms fill in.
- `<Waveform className="…">` now sets the class on the playlist's outermost element (the one with `data-playlist-state`). Before, the class was only on the "Loading waveform..." placeholder and disappeared once the playlist rendered, so check that a class you pass there has the styles you want on the whole playlist.

## `selectionStart` and `selectionEnd` move from `usePlaylistState()` to `useSelection()`

**Package:** `@waveform-playlist/browser`.

The selection changes on every pointer move of a selection drag; nothing else in `usePlaylistState()` does. While it was part of that hook's value, every component that called `usePlaylistState()` for any field (an annotation list reading `annotations`, a loop button reading `isLoopEnabled`) re-rendered on every pointer move. It now has its own context and hook. `usePlaylistState()` no longer has `selectionStart` or `selectionEnd`; reading them from it gives `undefined` (a type error in TypeScript).

**Find:** `selectionStart` or `selectionEnd` destructured or read from `usePlaylistState()`.

**Replace with:** `useSelection()`, and keep `usePlaylistState()` for the other fields:

```tsx
// Before
import { usePlaylistState } from '@waveform-playlist/browser';

const { selectionStart, selectionEnd, isLoopEnabled } = usePlaylistState();

// After
import { usePlaylistState, useSelection } from '@waveform-playlist/browser';

const { selectionStart, selectionEnd } = useSelection();
const { isLoopEnabled } = usePlaylistState();
```

`setSelection(start, end)` stays on `usePlaylistControls()`. `useSelection()` must be called inside `WaveformPlaylistProvider`; `MediaElementPlaylistProvider` has no selection state and is unchanged.

A component that calls `useSelection()` re-renders on every pointer move of a drag, so call it in the smallest component that shows the selection, not in a component that also renders a long list.

Fixed along the way: dragging a selection from right to left now selects the whole dragged range. Before, the range collapsed to the last pointer movement.

## `currentTime` moves from `usePlaybackAnimation()` to `useCurrentTime()`

**Package:** `@waveform-playlist/browser`.

`currentTime` is where the cursor rests: it changes on a seek, a pause, a stop and a selection whose start moves, and it does not advance during playback. While it was part of `usePlaybackAnimation()`, every component that called that hook for `isPlaying` or for a ref (a transport button, the whole playlist visualization, an app component that only wanted `currentTimeRef`) re-rendered on every seek and on every pointer move of a selection drag to the left. It now has its own context and hook. `usePlaybackAnimation()` no longer has `currentTime`; reading it from there gives `undefined` (a type error in TypeScript).

**Find:** `currentTime` destructured or read from `usePlaybackAnimation()`.

**Replace with:** `useCurrentTime()`, and keep `usePlaybackAnimation()` for the other fields:

```tsx
// Before
import { usePlaybackAnimation } from '@waveform-playlist/browser';

const { currentTime, isPlaying } = usePlaybackAnimation();

// After
import { useCurrentTime, usePlaybackAnimation } from '@waveform-playlist/browser';

const { currentTime } = useCurrentTime();
const { isPlaying } = usePlaybackAnimation();
```

If the value is only needed inside an event handler or a callback, do not subscribe at all; read the ref when the handler runs:

```tsx
const { currentTimeRef } = usePlaybackAnimation();
const addMarker = () => createMarkerAt(currentTimeRef.current ?? 0);
```

**Also find (no type error, and a search for `currentTime` misses it):** every component that calls `usePlaybackAnimation()` and reads `currentTimeRef.current` (or `visualTimeRef.current`) while rendering, or in an effect without a dependency array, to show the position while stopped. Such a component never mentions `currentTime`, so it still compiles. It used to be re-rendered by `usePlaybackAnimation()` on every seek; it no longer is, so its display stays at the old position after a seek, a pause-and-seek or a selection change, until playback starts or stops. Search for `currentTimeRef.current` and `visualTimeRef.current` and check each use that is not inside an event handler or a frame callback.

**Replace with:** a `useCurrentTime()` call in that component, and use its value:

```tsx
// Before: re-rendered by usePlaybackAnimation() on a seek
const { isPlaying, currentTimeRef } = usePlaybackAnimation();
useEffect(() => {
  if (!isPlaying) label.current.textContent = format(currentTimeRef.current ?? 0);
});

// After
const { isPlaying } = usePlaybackAnimation();
const { currentTime } = useCurrentTime();
useEffect(() => {
  if (!isPlaying) label.current.textContent = format(currentTime);
}, [isPlaying, currentTime]);
```

A custom `renderPlayhead` function needs no change: it is called again with the new `position` after a seek. `setCurrentTime(t)` and `seekTo(t)` stay on `usePlaylistControls()`. `useCurrentTime()` must be called inside `WaveformPlaylistProvider`; `useMediaElementAnimation()` is unchanged and still returns `currentTime`.

## `activeAnnotationId` moves from `usePlaylistState()` to `useActiveAnnotation()`

**Package:** `@waveform-playlist/browser`.

The active annotation changes at every annotation boundary during playback; nothing else in `usePlaylistState()` does. While it was part of that hook's value, every component that called `usePlaylistState()` for any field re-rendered at each boundary. It now has its own context and hook. `usePlaylistState()` no longer has `activeAnnotationId`; reading it from there gives `undefined` (a type error in TypeScript).

**Find:** `activeAnnotationId` destructured or read from `usePlaylistState()`.

**Replace with:** `useActiveAnnotation()`, and keep `usePlaylistState()` for the other fields:

```tsx
// Before
import { usePlaylistState } from '@waveform-playlist/browser';

const { annotations, activeAnnotationId } = usePlaylistState();

// After
import { usePlaylistState, useActiveAnnotation } from '@waveform-playlist/browser';

const { annotations } = usePlaylistState();
const { activeAnnotationId } = useActiveAnnotation();
```

`setActiveAnnotationId(id)` stays on `usePlaylistControls()`. `useActiveAnnotation()` must be called inside `WaveformPlaylistProvider`; `useMediaElementState()` is unchanged and still returns `activeAnnotationId`.

A component that calls `useActiveAnnotation()` re-renders at every annotation boundary during playback, so call it in a small component that shows the active annotation, not in the component that renders the whole page.

## Dragging an annotation edge: one `onAnnotationsChange` per drag in the MediaElement player, and Escape restores everything

**Package:** `@waveform-playlist/browser`.

Two behaviour changes, neither of them a type error:

1. **`MediaElementWaveform` / `MediaElementPlaylist`:** while an annotation edge is dragged, `onAnnotationsChange` (and `onAnnotationUpdate`) used to be called on every pointer move. They are now called once, when the edge is released, with the final annotations. During the drag the boxes and the annotation list follow a preview that does not go through your state.
2. **Escape during the drag** (both players, `useAnnotationDragHandlers`) restores every annotation the drag moved. Before, only the dragged annotation was restored.

**Find:** code that relies on `onAnnotationsChange` firing during a drag in the MediaElement player (for example to show the dragged time somewhere of your own).

**Replace with:** read the preview. `annotationPreview` is on `useMediaElementControls()` and `usePlaylistControls()`:

```tsx
import {
  useMediaElementState,
  useMediaElementControls,
  useAnnotationsWithPreview,
} from '@waveform-playlist/browser';

function DraggedTimes() {
  const { annotations } = useMediaElementState();
  const { annotationPreview } = useMediaElementControls();
  // The previewed annotations while an edge is dragged, `annotations` otherwise.
  const shown = useAnnotationsWithPreview(annotations, annotationPreview);
  // ...
}
```

**Optional, for `WaveformPlaylistProvider`:** if you call `useAnnotationDragHandlers` yourself, nothing changes until you pass the preview; `onAnnotationsChange` is still called per move. To get one call per drag and stop re-rendering your component on every move:

```tsx
// Before
const { setAnnotations } = usePlaylistControls();
const handlers = useAnnotationDragHandlers({
  annotations,
  onAnnotationsChange: setAnnotations,
  samplesPerPixel,
  duration,
  linkEndpoints,
});

// After
const { setAnnotations, annotationPreview } = usePlaylistControls();
const { samplesPerPixel, sampleRate, duration } = usePlaylistData();
const handlers = useAnnotationDragHandlers({
  annotations,
  onAnnotationsChange: setAnnotations,
  preview: annotationPreview,
  samplesPerPixel,
  sampleRate,
  duration,
  linkEndpoints,
});
```

The built-in `<Waveform>` annotation boxes and `PlaylistAnnotationList` follow the preview by themselves. A custom annotation renderer needs `useAnnotationsWithPreview` to follow it.

## Keyboard shortcuts yield to the focused control

**Packages:** `@waveform-playlist/core` (`handleKeyboardEvent`), `@waveform-playlist/browser` (`useKeyboardShortcuts`, `usePlaybackShortcuts`, `<KeyboardShortcuts>`).

A shortcut no longer fires for a key that the focused control uses itself. This fixes controls that could not be operated from the keyboard, and it changes what `Space` does right after you click a control:

| Focus is on                                                             | Before                                                | Now                                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| a `<button>` you clicked or tabbed to (Mute, Zoom In, your own buttons) | `Space` toggled playback and did not press the button | `Space` and `Enter` press the button                                                 |
| a `<select>` dropdown                                                   | `Space`, `Escape`, `0` and other shortcuts fired      | every key goes to the dropdown                                                       |
| a slider, checkbox or text input                                        | no shortcut fired                                     | unchanged                                                                            |
| a link                                                                  | `Space` toggled playback                              | unchanged for `Space`; `Enter` follows the link and no longer runs an Enter shortcut |
| anything except a text field, while a modal dialog is open              | `Escape` stopped playback and the dialog stayed open  | `Escape` closes the dialog                                                           |

`Space` is play/pause whenever focus is not on a control.

**Find:** nothing to search for in most apps; this is a behaviour change. Check any flow or test of yours that clicks a button and then presses `Space` expecting play/pause, and any element given `role="button"` without being a real `<button>` (those are not covered and still let shortcuts through).

**Replace with:** if a button of yours should not keep focus after a click, release it in the click handler:

```tsx
<button
  onClick={(event) => {
    toggleSomething();
    event.currentTarget.blur(); // Space is play/pause again
  }}
>
  Toggle
</button>
```

Do this only where it helps pointer users and the button is still reachable with `Tab`; a keyboard user who pressed the button loses their place when it blurs. The built-in Play, Pause and Stop buttons need nothing: they are disabled while they do not apply, so focus leaves them on click.

If you call `handleKeyboardEvent` yourself, the rule is applied for you. For your own key listeners, `keyBelongsToFocusedControl(event)` from `@waveform-playlist/core` answers the same question.

## Meter levels and recording progress are sources, not state

**Packages:** `@waveform-playlist/browser` (`useOutputMeter`, `<Waveform recordingState>`), `@waveform-playlist/recording` (`useMicrophoneLevel`, `useRecording`, `useIntegratedRecording`). New types in `@waveform-playlist/core`; new hooks in `@waveform-playlist/ui-components` and `@waveform-playlist/recording`.

Meter levels change about 60 times a second, and a recording's elapsed time and preview peaks change every animation frame. The hooks used to return them as React state, so the component that called the hook re-rendered at that rate. They now return a **source**: an object with a stable identity, `subscribe(listener)` and `getSnapshot()`. The hook's component no longer re-renders when the value changes.

```typescript
// From @waveform-playlist/core
interface ValueSource<T> {
  subscribe(listener: (value: T) => void): () => void; // returns unsubscribe
  getSnapshot(): T;
}
type MeterSource = ValueSource<{ levels: number[]; peakLevels: number[]; rmsLevels: number[] }>;
type RecordingProgressSource = ValueSource<{ duration: number; peaks: (Int8Array | Int16Array)[] }>;
```

The five entries below each replace removed fields. They all use the same four ways to read a source:

| You had                                          | Use                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `<SegmentedVUMeter levels={…} peakLevels={…} />` | `<SegmentedVUMeter meter={meter} />` (new prop; draws to the DOM, no re-render)                   |
| values read in render (labels, custom bars)      | `useMeterLevels(meter)` / `useRecordingProgress(progress)`: state, 10 updates a second by default |
| values that must be state at full rate           | `useSyncExternalStore(source.subscribe, source.getSnapshot)`                                      |
| an effect that depended on the value             | `source.subscribe(callback)` inside the effect                                                    |

`useMeterLevels` and the generic `useThrottledValue` are exported from `@waveform-playlist/ui-components`; `useRecordingProgress` from `@waveform-playlist/recording`. All three take `{ updateRate }` (updates per second).

`SegmentedVUMeter`'s `levels` and `peakLevels` props still work. The `meter` prop is an addition, and needs no migration by itself.

### `useOutputMeter`

`levels`, `peakLevels` and `rmsLevels` are removed from the return value. It is now `{ meter, resetPeak, error }`.

**Find:** `useOutputMeter(`.

**Replace with:**

```tsx
// Before
const { levels, peakLevels } = useOutputMeter({ channelCount: 2, isPlaying });
<SegmentedVUMeter levels={levels} peakLevels={peakLevels} />;

// After
const { meter } = useOutputMeter({ channelCount: 2, isPlaying });
<SegmentedVUMeter meter={meter} />;
```

If you read the numbers in render:

```tsx
// Before
const { levels, peakLevels, rmsLevels } = useOutputMeter({ channelCount: 2 });

// After
import { useMeterLevels } from '@waveform-playlist/ui-components';

const { meter } = useOutputMeter({ channelCount: 2 });
const { levels, peakLevels, rmsLevels } = useMeterLevels(meter);
```

### `useMicrophoneLevel`

`levels`, `peakLevels`, `rmsLevels` and the scalars `level` and `peakLevel` are removed. The return value is now `{ meter, resetPeak, error }`.

**Find:** `useMicrophoneLevel(`.

**Replace with:**

```tsx
// Before
const { levels, peakLevels } = useMicrophoneLevel(stream, { channelCount: 2 });
<SegmentedVUMeter levels={levels} peakLevels={peakLevels} />;

// After
const { meter } = useMicrophoneLevel(stream, { channelCount: 2 });
<SegmentedVUMeter meter={meter} />;
```

The scalars have no direct replacement. Take the maximum across channels:

```tsx
// Before
const { level, peakLevel } = useMicrophoneLevel(stream);

// After
const { meter } = useMicrophoneLevel(stream);
const { levels, peakLevels } = useMeterLevels(meter);
const level = Math.max(...levels);
const peakLevel = Math.max(...peakLevels);
```

### `useRecording`

`duration` and `peaks` are removed and replaced by `progress`, a `RecordingProgressSource`. The deprecated `level` and `peakLevel` (always `0`) are removed with no replacement; use `useMicrophoneLevel`.

**Find:** `useRecording(`.

**Replace with:**

```tsx
// Before
const { isRecording, duration, peaks, audioBuffer } = useRecording(stream);

// After
import { useRecordingProgress } from '@waveform-playlist/recording';

const { isRecording, progress, audioBuffer } = useRecording(stream);
const { duration, peaks } = useRecordingProgress(progress);
```

`useRecordingProgress` re-renders its component 10 times a second by default. If you only passed the values to `<Waveform recordingState>`, do not call it; pass `progress` itself (see below). After a stop, `progress.getSnapshot().duration` is the length of the recorded buffer, the same as `audioBuffer.duration`.

### `useIntegratedRecording`

`duration`, `level`, `peakLevel`, `levels`, `peakLevels`, `rmsLevels` and `recordingPeaks` are removed. Two sources replace them: `meter` (the microphone levels) and `progress` (the take's elapsed time and preview peaks).

**Find:** `useIntegratedRecording(`.

**Replace with:**

```tsx
// Before
const { isRecording, duration, levels, peakLevels, recordingPeaks } = useIntegratedRecording(
  tracks,
  setTracks,
  selectedTrackId,
  { currentTime }
);

<SegmentedVUMeter levels={levels} peakLevels={peakLevels} />;
<span>{duration.toFixed(1)}s</span>;

// After
const { isRecording, meter, progress } = useIntegratedRecording(
  tracks,
  setTracks,
  selectedTrackId,
  { currentTime }
);

<SegmentedVUMeter meter={meter} />;
<ElapsedTime progress={progress} />;

// A small component of its own, so only the label re-renders.
function ElapsedTime({ progress }: { progress: RecordingProgressSource }) {
  const { duration } = useRecordingProgress(progress);
  return <span>{duration.toFixed(1)}s</span>;
}
```

An effect that depended on `duration` (auto-scrolling to follow the take, for example) becomes a subscription:

```tsx
// Before
useEffect(() => {
  if (isRecording) followTake(duration);
}, [isRecording, duration]);

// After
useEffect(() => {
  if (!isRecording) return;
  followTake(progress.getSnapshot().duration);
  return progress.subscribe(({ duration }) => followTake(duration));
}, [isRecording, progress]);
```

### `<Waveform recordingState>`

Applies to the `recordingState` prop of `<Waveform>` and `<PlaylistVisualization>`. `durationSamples` and `peaks` are removed; pass the `progress` source from `useRecording` or `useIntegratedRecording` instead. Only the live preview clip follows it frame by frame.

**Find:** `recordingState=`.

**Replace with:**

```tsx
// Before
<Waveform
  recordingState={
    isRecording
      ? {
          isRecording: true,
          trackId: selectedTrackId,
          startSample,
          durationSamples: Math.floor(duration * sampleRate),
          peaks: recordingPeaks,
          bits: 16,
          latencyOffset,
        }
      : undefined
  }
/>

// After
<Waveform
  recordingState={
    isRecording
      ? {
          isRecording: true,
          trackId: selectedTrackId,
          startSample,
          progress,
          bits: 16,
          latencyOffset,
        }
      : undefined
  }
/>
```

If you produce the take's data yourself instead of using the recording hooks, build a source with `createValueSource` from `@waveform-playlist/core` and publish a new `{ duration, peaks }` object for each update:

```tsx
import { createValueSource, type RecordingProgress } from '@waveform-playlist/core';

const { source: progress, publish } = createValueSource<RecordingProgress>({
  duration: 0,
  peaks: [new Int16Array(0)],
});

// On each update. Publish new objects and arrays; do not change the old ones in place.
publish({ duration: seconds, peaks: nextPeaks });
```

**Behaviour change:** while a take is recording, the displayed timeline used to end exactly 10 seconds after the take and grow on every frame. It now grows in 10-second steps and ends between 10 and 20 seconds after the take, so the track rows are not resized on every frame.

## `activeEffects` is replaced by `effects` and `useActiveEffects()`

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

`useDynamicEffects()` no longer returns `activeEffects`. The effect list is replaced on every parameter change, and while it was React state of the hook, the component that called `useDynamicEffects()` (usually the root of the page) re-rendered on every slider step. The hook now returns `effects`, a source (`ValueSource<ActiveEffect[]>` from `@waveform-playlist/core`), and does not re-render when the chain changes. Everything else it returns keeps its identity between renders. Reading `activeEffects` from it gives `undefined` (a type error in TypeScript).

**Find:** `activeEffects` destructured or read from `useDynamicEffects()`.

**Replace with:** `effects` from the hook, and the new `useActiveEffects(effects)` hook in the component that draws the rack:

```tsx
// Before
import { useDynamicEffects } from '@waveform-playlist/browser/tone';

const { activeEffects, removeEffect } = useDynamicEffects();

// After
import { useDynamicEffects, useActiveEffects } from '@waveform-playlist/browser/tone';

const { effects, removeEffect } = useDynamicEffects();
const activeEffects = useActiveEffects(effects);
```

Both versions are lines from the body of one component. That is the smallest change, and that component re-renders on every chain change as it did before. Keep a single `useDynamicEffects()` call per master chain, the one whose `masterEffects` is given to `<WaveformPlaylistProvider effects={…}>`: a second call creates a second, empty chain. To stop the page re-rendering, move the `useActiveEffects()` call into the rack component:

```tsx
import { WaveformPlaylistProvider, Waveform, type ClipTrack } from '@waveform-playlist/browser';
import {
  useDynamicEffects,
  useActiveEffects,
  type UseDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';

function App({ tracks }: { tracks: ClipTrack[] }) {
  const masterFx = useDynamicEffects();

  return (
    <WaveformPlaylistProvider tracks={tracks} effects={masterFx.masterEffects}>
      <MasterRack masterFx={masterFx} />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

function MasterRack({ masterFx }: { masterFx: UseDynamicEffectsReturn }) {
  const activeEffects = useActiveEffects(masterFx.effects);

  return (
    <ul>
      {activeEffects.map((effect) => (
        <li key={effect.instanceId}>
          {effect.definition.name}
          <button onClick={() => masterFx.removeEffect(effect.instanceId)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}
```

A component that calls `useActiveEffects()` re-renders when the chain changes (an effect added, removed, moved, bypassed, or a parameter set).

`ActiveEffect.kind` changed as well: see the next entry. `ActiveEffect` has a new optional `wetParam`.

**Behaviour change:** built-in effects with no wet control (compressor, limiter, gate, 3-band EQ) are now disconnected from the chain while bypassed. Before, `toggleBypass` did nothing audible for them during playback.

## `ActiveEffect.kind`: `'native'` is renamed `'tone'`, and `'custom'` is added

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

`ActiveEffect['kind']` (and `TrackActiveEffect['kind']`, the same type) was `'native' | 'wam'`. It is now `'tone' | 'wam' | 'custom'`:

- `'tone'` is a built-in Tone.js effect. This is the value that used to be `'native'`.
- `'wam'` is a hosted WAM plugin, unchanged.
- `'custom'` is new: a type registered with `registerEffect()` from `@waveform-playlist/core`.

The rename removes a clash. In `@waveform-playlist/core` and `@dawcore/components`, "native" means a registry effect built from native Web Audio nodes; in the React hooks it meant a Tone.js effect, which is the opposite. With registry effects now usable in React, the built-in entries are named for what they are.

**Find:** `kind === 'native'`, `kind !== 'native'`, `case 'native'` and `kind: 'native'` where the value is an `ActiveEffect` or `TrackActiveEffect` from `useDynamicEffects()` / `useTrackDynamicEffects()`.

**Replace with:** `'tone'`, and handle `'custom'` wherever the code branches on every kind:

```tsx
// Before
if (effect.kind === 'native') {
  // built-in Tone.js effect
} else {
  // WAM plugin
}

// After
if (effect.kind === 'tone') {
  // built-in Tone.js effect
} else if (effect.kind === 'wam') {
  // WAM plugin
} else {
  // 'custom': a type registered with registerEffect()
}
```

Do not change `kind: 'native'` in `<daw-editor>` code. `EffectState` and `SerializedEffectEntry` from `@dawcore/components` (`editor.getEffectsState()`, `editor.setEffectsState()`) still use `'native'` for a registry effect, and chains saved from `<daw-editor>` are unaffected.

## Effect chains survive a remount, and unmount no longer disposes them

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

`useDynamicEffects()` and `useTrackDynamicEffects()` used to dispose every effect instance when their component unmounted, and an `addWamEffect` that was still loading at that moment rejected. React runs the same cleanup for a real unmount, a StrictMode remount, Fast Refresh and a hidden `<Activity>`, and in the last three the chain has to be there afterwards. The hooks now have no cleanup: a chain keeps its list and its live instances across a remount, like any React state.

What changes for your code:

- **Releasing instances.** After a real unmount the instances are disposed when the chain is garbage-collected (a `FinalizationRegistry`). That is best effort: not prompt and not guaranteed. If an effect must stop at a known moment (an AudioWorklet that keeps processing, a WAM plugin), call `clearAllEffects()`, or `clearTrackEffects(trackId)` for each track, before the component goes away.
- **Adds in flight.** An unmount no longer aborts an add. `clearAllEffects()` / `clearTrackEffects(trackId)` do: an add that is still waiting (a custom effect's `prepare`, a WAM plugin loading) rejects with an "aborted: the effects chain was cleared" error and nothing is appended.
- **Default effects on mount.** The list survived a StrictMode remount before as well, so this is not new, but it is now the whole chain that survives: an unguarded mount effect adds its defaults twice in development, and both are live. Add defaults behind a ref guard.

**Find:** `useEffect` calls with an empty or stable dependency list that call `addEffect(`, `addEffectToTrack(`, `addWamEffect(` or `addWamEffectToTrack(`; and code that relied on unmounting a component to stop its effects.

**Replace with:**

```tsx
// Unguarded: two reverbs under StrictMode in development
useEffect(() => {
  addEffect('reverb');
}, [addEffect]);

// Guarded: one
const addedDefaults = useRef(false);
useEffect(() => {
  if (addedDefaults.current) return;
  addedDefaults.current = true;
  addEffect('reverb').catch(console.error);
}, [addEffect]);
```

```tsx
// To dispose the effects at a known moment, for example when a panel that
// owns the hooks is closed for good: call this from the handler that closes
// it. Do not call it from an effect cleanup, which also runs on a StrictMode
// remount and Fast Refresh.
masterFx.clearAllEffects();
tracks.forEach((track) => trackFx.clearTrackEffects(track.id));
```

## `trackEffectsState` is replaced by `getTrackEffects(trackId)`

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

`useTrackDynamicEffects()` no longer returns `trackEffectsState` (a `Map` of every track's effects), for the same reason as the entry above. It returns `getTrackEffects(trackId)`, which gives one track's chain as a source; the same source is returned for the same track id. The `TrackEffectsState` type is removed. New: `reorderTrackEffects(trackId, fromIndex, toIndex)`.

**Find:** `trackEffectsState`, and the type `TrackEffectsState`.

**Replace with:** `useActiveEffects(getTrackEffects(trackId))` in the component that draws that track's effects:

```tsx
// Before
import { useTrackDynamicEffects } from '@waveform-playlist/browser/tone';

const { trackEffectsState } = useTrackDynamicEffects();
const trackEffects = trackEffectsState.get(trackId) ?? [];

// After
import {
  useTrackDynamicEffects,
  useActiveEffects,
  type UseTrackDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';

// The component that called useTrackDynamicEffects() before still does, once,
// and passes the result to one component per track.
function TrackEffectsPanel({ trackIds }: { trackIds: string[] }) {
  const trackFx = useTrackDynamicEffects();

  return (
    <>
      {trackIds.map((trackId) => (
        <TrackEffects key={trackId} trackId={trackId} trackFx={trackFx} />
      ))}
    </>
  );
}

function TrackEffects({
  trackId,
  trackFx,
}: {
  trackId: string;
  trackFx: UseTrackDynamicEffectsReturn;
}) {
  const trackEffects = useActiveEffects(trackFx.getTrackEffects(trackId));

  return (
    <ul>
      {trackEffects.map((effect) => (
        <li key={effect.instanceId}>{effect.definition.name}</li>
      ))}
    </ul>
  );
}
```

The "Before" lines are from the body of the component that called the hook. Keep one `useTrackDynamicEffects()` call for the app, the one whose `getTrackEffectsFunction` is passed to the provider's `trackEffects` prop (see [the entry below](#track-effects-are-passed-to-the-provider-not-set-on-tracks)): a second call creates a second, empty set of chains.

`useActiveEffects()` is a hook, so it cannot be called in a loop over tracks: give each track its own component, as above. A track with no effects gives an empty array. `TrackActiveEffect` is now the same type as `ActiveEffect`.

`getTrackEffectsFunction(trackId)` now returns the same function for the same track id and never `undefined`.

## Track effects are passed to the provider, not set on tracks

**Packages:** `@waveform-playlist/core`, `@waveform-playlist/playout`, `@waveform-playlist/browser`.

A track no longer carries its effects function. `ClipTrack.effects` is removed, and so is `effects` in `AudioTrackConfig` (the configs of `useAudioTracks`). The provider has a `trackEffects` prop instead, and `createToneAdapter` a `trackEffects` option: a function from a track id to that track's effects function (or `undefined` for none).

Why: attaching the function meant copying every track object whenever `tracks` changed. The provider recognises a change it can apply to the running engine by the identity of the track objects, so with the copies every clip move, trim and split, and every added file, disposed the engine and built a new one.

An `effects` field left on a track object is ignored at runtime: the chain is silently not connected. TypeScript reports it only where the object is checked against `ClipTrack` directly.

**Find:** `effects:` inside a `tracks.map(` (usually a `tracksWithEffects` memo), `effects` in an `AudioTrackConfig`, and `.effects` read from a track.

**Replace with:** the `trackEffects` prop, and `tracks` passed through unchanged:

```tsx
// Before
const { getTrackEffectsFunction } = useTrackDynamicEffects();

const tracksWithEffects = useMemo(
  () => tracks.map((track) => ({ ...track, effects: getTrackEffectsFunction(track.id) })),
  [tracks, getTrackEffectsFunction]
);

<WaveformPlaylistProvider tracks={tracksWithEffects} onTracksChange={setTracks}>

// After
const { getTrackEffectsFunction } = useTrackDynamicEffects();

<WaveformPlaylistProvider
  tracks={tracks}
  trackEffects={getTrackEffectsFunction}
  onTracksChange={setTracks}
>
```

Delete the memo.

A fixed effects function per track, which used to be `effects` in the track config, is keyed by track id as well. `AudioTrackConfig` has a new optional `id` for this: the track built from the config gets that id (without it an id is generated, as before, and is on `tracks[i].id` once the track exists). Ids must be unique: `useAudioTracks` warns about duplicates but still builds the tracks with the ids as given. An empty string counts as no id. Tracks added with `useDynamicTracks` always get generated ids; read them from `tracks`.

```tsx
// Before
const { tracks } = useAudioTracks([
  { src: 'vocals.mp3', name: 'Vocals', effects: vocalReverb },
  { src: 'drums.mp3', name: 'Drums' },
]);

<WaveformPlaylistProvider tracks={tracks}>

// After
const { tracks } = useAudioTracks([
  { id: 'vocals', src: 'vocals.mp3', name: 'Vocals' },
  { id: 'drums', src: 'drums.mp3', name: 'Drums' },
]);

// Module level, or memoized: any stable object.
const effectsByTrackId: Record<string, TrackEffectsFunction | undefined> = {
  vocals: vocalReverb,
};

<WaveformPlaylistProvider tracks={tracks} trackEffects={(trackId) => effectsByTrackId[trackId]}>
```

**When the function is called:** each time a track's audio graph is built, with the `trackEffects` function from the latest render. Passing a new function identity rebuilds nothing, so an inline arrow is fine. Returning a different effects function for a track that is already built takes effect the next time that track is built, and a track with both audio and MIDI clips can have only its MIDI half rebuilt (a clip edit, a SoundFont arriving): if the answer has become `undefined` by then, the MIDI half plays without the chain the audio half still has. So return the same function for the same track id for as long as the track exists; to change what a track's chain does while it plays, change the chain behind a stable function, which is what `useTrackDynamicEffects()` does.

**With your own adapter:** the provider's `trackEffects` prop, like `effects`, reaches the default Tone.js adapter only. If you pass `createAdapter`, give the function to the adapter yourself:

```tsx
// Before
<WaveformPlaylistProvider tracks={tracksWithEffects} createAdapter={() => createToneAdapter()}>

// After
<WaveformPlaylistProvider
  tracks={tracks}
  createAdapter={() => createToneAdapter({ trackEffects: getTrackEffectsFunction })}
>
```

Also removed:

- The `TrackEffectsFunction` type exported from `@waveform-playlist/core` (it only typed the removed field). **Find:** `TrackEffectsFunction` imported from `@waveform-playlist/core`. **Replace with:** the same name from `@waveform-playlist/playout`.
- The deprecated `WaveformTrack` type from `@waveform-playlist/browser`. **Replace with:** `ClipTrack` from `@waveform-playlist/core`.

## `addEffect` and `addEffectToTrack` return a promise

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

`addEffect(effectId)` and `addEffectToTrack(trackId, effectId)` returned `void`. They now return `Promise<string>`, resolving with the new entry's `instanceId`. A built-in effect is still in the chain before the call returns, so code that does not use the return value keeps working. An id that is neither a built-in effect nor a type registered with `registerEffect()` now rejects; before, it logged a console error and did nothing.

**Find:** `addEffect(` and `addEffectToTrack(`.

**Replace with:** handle the rejection wherever the id is not a constant you know to be valid, and `await` the call if you need the id:

```tsx
// Before
addEffect(effectId);

// After
addEffect(effectId).catch((err) => showError(err));

// or, to use the new entry (inside an async function, such as an event handler)
const handleAddReverb = async () => {
  const instanceId = await addEffect('reverb');
  updateParameter(instanceId, 'decay', 3);
};
```

The promise also rejects when the chain could not be wired with the new effect (the previous chain is restored and nothing is added), and when `clearAllEffects()` / `clearTrackEffects(trackId)` ran while a custom effect was still preparing. For a custom effect, `updateParameter` ignores a value that is not a number.

`availableEffects` used to be the fixed list of built-ins. It now also lists registered custom types, only in native-context mode, and it is read when the component that called the hook renders: register custom effects before the component that shows the picker renders.

The promise exists because the same functions now add custom effects (types registered with `registerEffect()` from `@waveform-playlist/core`), whose `prepare` step is asynchronous. See [Custom Effects](./guides/effects.md#custom-effects).

## Offline effects functions are never `undefined`

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

`createOfflineEffectsFunction()` and `createOfflineTrackEffectsFunction(trackId)` returned `undefined` when the chain had no active effect, and a new function on every call that captured the chain as it was at that moment. They now always return a function: the same one on every call (per track id for the track variant), which reads the chain when the export runs. With no active effect it passes the audio straight through.

**Find:** `createOfflineEffectsFunction(` and `createOfflineTrackEffectsFunction(`, in particular an `undefined` check on the result, or code that calls them again to pick up a changed chain.

**Replace with:**

```tsx
// Before: undefined meant "no effects"
const offlineEffects = createOfflineEffectsFunction();
const hasEffects = offlineEffects !== undefined;

// After: ask the chain
const offlineEffects = createOfflineEffectsFunction();
const hasEffects = effects.getSnapshot().some((effect) => !effect.bypassed);
```

```tsx
// Before: called at export time so that it saw the current chain
<ExportWavButton effectsFunction={createOfflineEffectsFunction()} />

// After: unchanged code, but the value is stable and may be created once
const offlineEffects = createOfflineEffectsFunction();
<ExportWavButton effectsFunction={offlineEffects} />
```

Passing `undefined` as `effectsFunction` (to export without the master chain) still works; the hooks just no longer do it for you.

## `EffectInstance.effect` is replaced by `input` and `output`

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

An `EffectInstance` (returned by `createEffectInstance` and `createWamEffectInstance`) had one node, `effect`. It now has `input` (where the chain connects in) and `output` (where it continues from), because a registered custom effect can have two different nodes. For a Tone.js effect and a WAM plugin they are the same node.

**Find:** `.effect` read from an `EffectInstance` or `WamEffectInstance`.

**Replace with:**

```tsx
// Before
const instance = createEffectInstance(definition);
source.connect(instance.effect);
instance.effect.connect(destination);

// After
import { connect } from 'tone';

const instance = createEffectInstance(definition);
connect(source, instance.input);
connect(instance.output, destination);
```

The nodes are typed `ToneAudioNode | AudioNode`, so use Tone's `connect()` helper, which accepts both, or `instance.connect(destination)` for the outgoing side.

Also changed: `EffectDefinition['category']` is now `EffectCategory`, the known category names or any other string (a registered custom effect names its own). `BuiltInEffectCategory` is the closed union it used to be. An exhaustive `switch` over `category` needs a `default` case.

## Web components: the effect registry moves from `@dawcore/components` to `@waveform-playlist/core`

**Packages:** `@dawcore/components`, `@waveform-playlist/core`.

This entry is for code that uses `<daw-editor>`. It is listed here because the registry is now shared: one `registerEffect()` call makes a custom effect available to `<daw-editor>` and to the React effects hooks.

`@dawcore/components` no longer exports `registerEffect`, `getEffectDefinitions`, `prepareEffect`, `createEffectInstance`, or the types `EffectDefinition`, `EffectParamDef` and `EffectInstance`. They are exported from `@waveform-playlist/core`, where two of the types have new names. `@dawcore/components` still exports `EffectState` and `SerializedEffectEntry`, the element method `editor.prepareEffect(type)` is unchanged, and the `native-*` built-ins are still registered when `@dawcore/components` is imported (each only if that name is not already registered, so a type you registered under a `native-*` name first is kept).

**Find:** imports of any of these names from `@dawcore/components`.

**Replace with:** the same import from `@waveform-playlist/core`, added to your `package.json` as a direct dependency:

| From `@dawcore/components`      | From `@waveform-playlist/core`  |
| ------------------------------- | ------------------------------- |
| `registerEffect`                | `registerEffect`                |
| `getEffectDefinitions`          | `getEffectDefinitions`          |
| `prepareEffect`                 | `prepareEffect`                 |
| `createEffectInstance`          | `createEffectInstance`          |
| `EffectDefinition` (type)       | `NativeEffectDefinition` (type) |
| `EffectInstance` (type)         | `NativeEffectInstance` (type)   |
| `EffectParamDef` (type)         | `EffectParamDef` (type)         |

```typescript
// Before
import { registerEffect, type EffectDefinition } from '@dawcore/components';

const definition: EffectDefinition = { /* … */ };
registerEffect('my-effect', definition);

// After
import { registerEffect, type NativeEffectDefinition } from '@waveform-playlist/core';

const definition: NativeEffectDefinition = { /* … */ };
registerEffect('my-effect', definition);
```

The definition shape is unchanged apart from one addition: `EffectParamDef` has an optional `label`. New in core: `unregisterEffect(type)`. One rule of `NativeEffectInstance` is now stated and relied on by both hosts: the host owns every connection out of `output` and disconnects all of them when it rewires the chain, so do not connect `output` to anything inside the effect (take a feedback tap from a node before it).

Do not confuse core's `createEffectInstance(type, audioContext, params)` with the `createEffectInstance(definition, initialParams)` exported from `@waveform-playlist/browser/tone`; the second one builds a built-in Tone.js effect.
