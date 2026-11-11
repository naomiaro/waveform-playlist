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

**Find:** every function passed as a track's `effects` option (a `TrackEffectsFunction` from `@waveform-playlist/playout`) and every `OfflineTrackEffectsFunction` passed to WAV export (`@waveform-playlist/browser`).

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

| Removed                                               | Inside `WaveformPlaylistProvider`                                                       | Inside `MediaElementPlaylistProvider`                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `usePlayoutStatus().isPlaying`                        | `usePlaybackAnimation().isPlaying`                                                      | `useMediaElementAnimation().isPlaying`                        |
| `usePlayoutStatus().progress`                         | `usePlaybackAnimation().currentTime` (seconds), or `currentTimeRef` for per-frame reads | `useMediaElementAnimation().currentTime`, or `currentTimeRef` |
| `usePlayoutStatus().selectionStart` / `.selectionEnd` | `useSelection().selectionStart` / `.selectionEnd`                                       | no selection in this provider                                 |
| `usePlayoutStatusUpdate().setIsPlaying(true / false)` | `usePlaylistControls().play()` / `.pause()`                                             | `useMediaElementControls().play()` / `.pause()`               |
| `usePlayoutStatusUpdate().setProgress(t)`             | `usePlaylistControls().seekTo(t)`                                                       | `useMediaElementControls().seekTo(t)`                         |
| `usePlayoutStatusUpdate().setSelection(start, end)`   | `usePlaylistControls().setSelection(start, end)`                                        | no selection in this provider                                 |

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

| You had                                              | Use                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `<SegmentedVUMeter levels={…} peakLevels={…} />`     | `<SegmentedVUMeter meter={meter} />` (new prop; draws to the DOM, no re-render)                  |
| values read in render (labels, custom bars)          | `useMeterLevels(meter)` / `useRecordingProgress(progress)`: state, 10 updates a second by default |
| values that must be state at full rate               | `useSyncExternalStore(source.subscribe, source.getSnapshot)`                                     |
| an effect that depended on the value                 | `source.subscribe(callback)` inside the effect                                                   |

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
