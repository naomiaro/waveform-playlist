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

**Note:** `usePlaybackAnimation()` is removed later in this major. `isPlaying` is now on `useIsPlaying()`. See [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields).

**Note:** `usePlaylistControls()`, `useMediaElementAnimation()` and `useMediaElementControls()`, named in the table above, are also removed later in this major, and `MediaElementPlaylistProvider` now has a selection. Under either provider use `useIsPlaying().isPlaying`, `useCurrentTime().currentTime` (or `currentTimeRef` from `usePlaybackRefs()`), `useSelection()`, and `play`, `pause`, `seekTo` and `setSelection` from `usePlaybackControls()`. See [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

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

**Note:** `usePlaylistData()` is removed later in this major. `tracks` is now on `usePlaylistTimeline()`. See [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields).

Two related values on `usePlaylistData()` keep their names and types but are now derived from `tracks` during render instead of being set by an effect:

- `duration` and `peaksDataArray` already match `tracks` in the render that receives new tracks. Code that waited a render for them (for example an effect that compared `peaksDataArray.length` with `tracks.length`) no longer needs to.
- `peaksDataArray` keeps the identity of everything that did not change: a clip's `peaks`, its entry, and its track's array. It is safe to use them as memo or effect dependencies.
- `<Waveform>` no longer renders the text "Loading waveform..." before the first peaks; clips render at once and their waveforms fill in.
- `<Waveform className="…">` now sets the class on the playlist's outermost element (the one with `data-playlist-state`). Before, the class was only on the "Loading waveform..." placeholder and disappeared once the playlist rendered, so check that a class you pass there has the styles you want on the whole playlist.

## `formatTime` is removed from `usePlaylistControls()`, and `minimumPlaylistHeight` from `usePlaylistData()`

**Package:** `@waveform-playlist/browser`.

Nothing in the library read either field.

`usePlaylistControls().formatTime` formatted a time in the playlist's current time format. It was a new function after every `setTimeFormat`, which made the whole controls value change, so every component that calls `usePlaylistControls()` rendered again. The value returned by `usePlaylistControls()` no longer changes with the time format, or with `duration`. The value returned by `useMediaElementControls()` no longer changes when the track's duration arrives.

**Find:** `formatTime` read from `usePlaylistControls()`.

**Replace with:** `formatTime` from `@waveform-playlist/ui-components` and the `timeFormat` from `usePlaylistData()`:

```tsx
// Before
const { formatTime } = usePlaylistControls();
const label = formatTime(seconds);

// After
import { formatTime } from '@waveform-playlist/ui-components';

const { timeFormat } = usePlaylistData();
const label = formatTime(seconds, timeFormat);
```

`useTimeFormat()` is unchanged: it is a separate hook with its own state, and it still returns `formatTime`.

**Find:** `minimumPlaylistHeight` read from `usePlaylistData()`.

**Replace with:** the same sum, from values that are still there:

```tsx
// Before
const { minimumPlaylistHeight } = usePlaylistData();

// After
const { tracks, waveHeight, timeScaleHeight } = usePlaylistData();
const minimumPlaylistHeight = tracks.length * waveHeight + timeScaleHeight;
```

**Note:** `usePlaylistData()` is removed later in this major. `timeFormat` went to `usePlaylistSettings()` and `tracks` to `usePlaylistTimeline()`. `waveHeight` and `timeScaleHeight` went to `usePlaylistView()` and were removed from it again by later entries: `timeScaleHeight` in [the view is composed from parts](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed), `waveHeight` in [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers) (a prop of `<WaveformViewOptions>`; inside a root, `usePlaylistInfo().waveHeight`). See [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields). `usePlaylistControls()` and `useMediaElementControls()` are removed later too: see [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

## `interactiveClips` and `touchOptimized` are removed from `<Waveform>`; use `ClipInteractionOptions`

**Package:** `@waveform-playlist/browser`.

Whether clips can be dragged and trimmed, and whether their trim handles are widened for touch, now has one source: a context that each clip reads. `<Waveform>` and `<PlaylistVisualization>` no longer take `interactiveClips` or `touchOptimized`. Before, `ClipInteractionProvider` turned `interactiveClips` on but not the wide handles, so touch support needed the same flag in two places.

**If you use `ClipInteractionProvider`:**

**Find:** `interactiveClips` or `touchOptimized` on a `<Waveform>` or `<PlaylistVisualization>` inside a `ClipInteractionProvider`.

**Replace with:** it depends on where `touchOptimized` was. Check the provider before deleting anything:

- `interactiveClips` on the waveform: delete it.
- `touchOptimized` on the waveform AND on the provider: delete it from the waveform. The provider's flag now does both jobs (first example).
- `touchOptimized` on the waveform but NOT on the provider: do not just delete it, or the trim handles shrink from 24px to 8px. Use the second example.

```tsx
// Before
<ClipInteractionProvider touchOptimized>
  <Waveform showClipHeaders interactiveClips touchOptimized />
</ClipInteractionProvider>

// After
<ClipInteractionProvider touchOptimized>
  <Waveform showClipHeaders />
</ClipInteractionProvider>
```

**If `touchOptimized` was on the `<Waveform>` but not on the provider**, you had wide handles with the normal mouse-tuned sensors. Moving the flag to the provider would also add the 250ms touch-hold delay. To keep exactly what you had, set only the handle width:

```tsx
// Before
<ClipInteractionProvider>
  <Waveform showClipHeaders touchOptimized />
</ClipInteractionProvider>

// After
import { ClipInteractionOptions } from '@waveform-playlist/browser';

<ClipInteractionProvider>
  <ClipInteractionOptions touchOptimized>
    <Waveform showClipHeaders />
  </ClipInteractionOptions>
</ClipInteractionProvider>
```

**If you use your own `DragDropProvider`:**

**Find:** `interactiveClips` or `touchOptimized` on a `<Waveform>` or `<PlaylistVisualization>` that is not inside a `ClipInteractionProvider`.

**Replace with:** `ClipInteractionOptions` around it.

```tsx
// Before
<DragDropProvider sensors={sensors} /* … */>
  <Waveform showClipHeaders interactiveClips touchOptimized />
</DragDropProvider>

// After
import { ClipInteractionOptions } from '@waveform-playlist/browser';

<DragDropProvider sensors={sensors} /* … */>
  <ClipInteractionOptions enabled touchOptimized>
    <Waveform showClipHeaders />
  </ClipInteractionOptions>
</DragDropProvider>
```

Use `enabled` alone where you had `interactiveClips` alone.

**In plain JavaScript nothing reports a leftover prop.** `<Waveform interactiveClips>` and `<Waveform touchOptimized>` are ignored without a warning (TypeScript reports them). With your own `DragDropProvider` the visible result is clips that no longer drag and have no trim handles, so search for both names before you run the app.

**Behaviour that changes without a code change:**

- `<ClipInteractionProvider touchOptimized>` now also widens the trim handles, from 8px to 24px. If you set the flag on the provider only and want to keep the narrow handles, nest `<ClipInteractionOptions touchOptimized={false}>` inside the provider.
- `<PlaylistVisualization>` used directly inside a `ClipInteractionProvider` now has interactive clips. Before, only `<Waveform>` picked that up from the provider. To keep them static, nest `<ClipInteractionOptions enabled={false}>`.
- `<Waveform interactiveClips={false}>` inside a `ClipInteractionProvider` never switched interaction off (the provider's value won). `<ClipInteractionOptions enabled={false}>` does.
- A `ClipInteractionProvider` without `touchOptimized` now inherits it from a `ClipInteractionProvider` or `ClipInteractionOptions` above it. If you nest a plain provider inside `<ClipInteractionProvider touchOptimized>`, the inner one used to have mouse-tuned sensors and 8px handles; it now has the 250ms touch-hold sensors and 24px handles. Set `touchOptimized={false}` on the inner provider to keep what you had.
- A `ClipInteractionProvider` always makes the clips below it interactive, also inside `<ClipInteractionOptions enabled={false}>`. Put `<ClipInteractionOptions enabled={false}>` inside the provider to switch interaction off.
- `useClipInteractionEnabled()` used to mean "inside a `ClipInteractionProvider`". It now means "clips here can be dragged and trimmed": also true inside `<ClipInteractionOptions enabled>` with no provider, and false under `<ClipInteractionOptions enabled={false}>` inside one. Do not use it to detect the provider.

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

**Note:** `usePlaylistState()` is removed later in this major. "Keep `usePlaylistState()` for the other fields" then means: read them from the hook that has them, for example `isLoopEnabled` from `useLoop()`. See [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields).

`setSelection(start, end)` stays on `usePlaylistControls()`. `useSelection()` must be called inside `WaveformPlaylistProvider`; `MediaElementPlaylistProvider` exposes no selection and its hooks are unchanged.

**Note:** both statements are replaced later in this major. `setSelection` is now on `usePlaybackControls()`, and `useSelection()` works under either provider. See [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

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

**Note:** `usePlaybackAnimation()` is removed later in this major. `isPlaying` is now on `useIsPlaying()` and the refs (`currentTimeRef`, `visualTimeRef`) on `usePlaybackRefs()`, which never re-renders the component that calls it; the advice above about `useCurrentTime()` applies unchanged. See [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields).

A custom `renderPlayhead` function needs no change: it is called again with the new `position` after a seek. `setCurrentTime(t)` and `seekTo(t)` stay on `usePlaylistControls()`. `useCurrentTime()` must be called inside `WaveformPlaylistProvider`; `useMediaElementAnimation()` is unchanged and still returns `currentTime`.

**Note:** this paragraph is replaced later in this major. `seekTo(t)` is now on `usePlaybackControls()` and `setCurrentTime(t)` on `useEditorControls()`; `useMediaElementAnimation()` is removed and `useCurrentTime()` works under either provider. See [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

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

**Note:** `usePlaylistState()` is removed later in this major. `annotations` is now on `usePlaylistAnnotations()`. See [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields).

`setActiveAnnotationId(id)` stays on `usePlaylistControls()`. `useActiveAnnotation()` must be called inside `WaveformPlaylistProvider`; `useMediaElementState()` is unchanged and still returns `activeAnnotationId`.

**Note:** this paragraph is replaced later in this major. `setActiveAnnotationId(id)` is now on `usePlaybackControls()`; `useMediaElementState()` is removed and `useActiveAnnotation()` works under either provider. The `annotations` field named in the note above is on `useAnnotations()`. See [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

A component that calls `useActiveAnnotation()` re-renders at every annotation boundary during playback, so call it in a small component that shows the active annotation, not in the component that renders the whole page.

## `usePlaylistData()`, `usePlaylistState()` and `usePlaybackAnimation()` are replaced by one hook per group of fields

**Packages:** `@waveform-playlist/browser`, `@waveform-playlist/ui-components`, `@waveform-playlist/spectrogram`.

Four hooks are removed from `@waveform-playlist/browser`: `usePlaylistData()`, `usePlaylistState()`, `usePlaybackAnimation()` and `usePlaylistDataOptional()`. A context subscription is to the whole value, so a component that called `usePlaylistData()` for `sampleRate` also re-rendered on every step of a volume slider and on every pointer move of a trim, and one that called `usePlaybackAnimation()` for a ref re-rendered on play and stop. Each removed hook is replaced by hooks that return one group of fields that change together, so a component re-renders only for the group it reads.

`usePlaylistControls()`, `useSelection()`, `useCurrentTime()` and `useActiveAnnotation()` are unchanged. The MediaElement hooks (`useMediaElementAnimation()`, `useMediaElementState()`, `useMediaElementControls()`, `useMediaElementData()`) are unchanged.

This entry replaces the hook named in the earlier entries on this page: where an entry above says to read a field from, or to keep, `usePlaylistData()`, `usePlaylistState()` or `usePlaybackAnimation()`, use the hook from the tables below.

**Note:** three hooks named in this entry are changed again later in this major, and the four MediaElement hooks are removed. `usePlaylistControls()` is replaced by `usePlaybackControls()` and `useEditorControls()`; `usePlaylistAnnotations()` by `useAnnotations()` and `useAnnotationEditing()`; `usePlaybackRefs()` keeps `currentTimeRef`, `visualTimeRef`, `registerFrameCallback` and `unregisterFrameCallback`, and its other eight fields (`playoutRef` and `isDraggingRef` among them) are on `useEngineRefs()`. When migrating in one go, apply the tables below and then [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers), or go straight to the hook that entry names for each field.

### The new hooks

All of them are exported from `@waveform-playlist/browser` and must be called inside `WaveformPlaylistProvider`; outside it they throw `<hook name> must be used within WaveformPlaylistProvider`.

| Hook                       | Returns                                                                                                                                                                                                                                             | The component re-renders on                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `usePlaylistView()`        | `sampleRate`, `waveHeight`, `timeScaleHeight`, `controls` (both removed again [further down](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed)), `barWidth`, `barGap`, `roundedBars`, `progressBarWidth`, `mono`, `indefinitePlayback`, `fillViewport` (`waveHeight`, the four bar and playhead fields and `fillViewport` moved again in [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers))                                                                                    | a provider prop change (and once when the real sample rate is known)|
| `usePlaylistSettings()`    | `timeFormat`, `isAutomaticScroll`                                                                                                                                                                                                                   | the user changing either setting                                    |
| `usePlaylistZoom()`        | `samplesPerPixel`, `canZoomIn`, `canZoomOut`                                                                                                                                                                                                        | a zoom                                             |
| `usePlaylistTimeline()`    | `tracks`, `peaksDataArray`, `duration`, `isReady`, `onTracksChange`                                                                                                                                                                                 | every clip operation, every pointer move of a trim, a zoom (`peaksDataArray` is computed per zoom level), loading finishing (`isReady`), peaks arriving|
| `usePlaylistMixer()`       | `trackStates`, `masterVolume`                                                                                                                                                                                                                       | every mute, solo, volume or pan change (each step of a slider drag); tracks added, removed or reordered|
| `useTrackReorderPreview()` | `trackDragPreview`, `trackReorderEpoch`                                                                                                                                                                                                             | every drag-over of a track reorder                 |
| `usePlaylistAnnotations()` | `annotations`, `annotationsEditable`, `linkEndpoints`, `continuousPlay`                                                                                                                                                                             | an annotation edit, an annotation settings toggle  |
| `useLoop()`                | `isLoopEnabled`, `loopStart`, `loopEnd`                                                                                                                                                                                                             | a loop change                                      |
| `useSelectedTrackId()`     | `selectedTrackId`                                                                                                                                                                                                                                   | another track being selected                       |
| `useUndoRedo()`            | `canUndo`, `canRedo`                                                                                                                                                                                                                                | after an edit                                      |
| `useIsPlaying()`           | `isPlaying`                                                                                                                                                                                                                                         | play, pause, stop                                  |
| `usePlaybackRefs()`        | `currentTimeRef`, `visualTimeRef`, `playbackStartTimeRef`, `audioStartPositionRef`, `getPlaybackTime`, `getAudioContextTime`, `getLookAhead`, `getOutputLatency`, `registerFrameCallback`, `unregisterFrameCallback`, `playoutRef`, `isDraggingRef` | never (the value keeps its identity)               |

**Note:** "must be called inside `WaveformPlaylistProvider`" is changed later in this major. `usePlaylistView()`, `usePlaylistSettings()`, `usePlaylistZoom()`, `useIsPlaying()` and `usePlaybackRefs()` can also be called inside `MediaElementPlaylistProvider`, and the message a hook throws names the provider or providers that serve it. See [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

The value types are exported too: `PlaylistViewContextValue`, `PlaylistSettingsContextValue`, `PlaylistZoomContextValue`, `PlaylistTimelineContextValue`, `PlaylistMixerContextValue`, `TrackReorderPreviewContextValue`, `PlaylistAnnotationsContextValue`, `LoopContextValue`, `SelectedTrackIdContextValue`, `UndoRedoContextValue`, `IsPlayingContextValue`, `PlaybackRefsContextValue`, and, for the unchanged hooks, `PlaylistControlsContextValue`, `SelectionContextValue`, `CurrentTimeContextValue` and `ActiveAnnotationContextValue`. `ClipPeaks`, `TrackClipPeaks` and `TrackDragPreview` are exported as well, so every field of these values can be named.

`timeFormat` and `isAutomaticScroll`, the two settings a user toggles, have their own hook and are not part of `usePlaylistView()`: every clip's progress overlay and the visualization read the view value, so a toggle there would re-render all of them.

### Where each field went

**Find:** `usePlaylistData`, `usePlaylistState`, `usePlaybackAnimation` and `usePlaylistDataOptional` (imports and calls).

**Replace with:** for each field the component reads, the hook in the right-hand column. Call each hook once per component and destructure only the fields that component uses. (`waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` and `fillViewport` moved again in [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers).)

From `usePlaylistData()`:

| Field               | Now from                   |
| ------------------- | -------------------------- |
| `sampleRate`        | `usePlaylistView()`        |
| `waveHeight`        | `usePlaylistView()`        |
| `timeScaleHeight`   | `usePlaylistView()`        |
| `controls`          | `usePlaylistView()`        |
| `barWidth`          | `usePlaylistView()`        |
| `barGap`            | `usePlaylistView()`        |
| `roundedBars`       | `usePlaylistView()`        |
| `progressBarWidth`  | `usePlaylistView()`        |
| `mono`              | `usePlaylistView()`        |
| `timeFormat`        | `usePlaylistSettings()`    |
| `samplesPerPixel`   | `usePlaylistZoom()`        |
| `canZoomIn`         | `usePlaylistZoom()`        |
| `canZoomOut`        | `usePlaylistZoom()`        |
| `tracks`            | `usePlaylistTimeline()`    |
| `peaksDataArray`    | `usePlaylistTimeline()`    |
| `duration`          | `usePlaylistTimeline()`    |
| `isReady`           | `usePlaylistTimeline()`    |
| `onTracksChange`    | `usePlaylistTimeline()`    |
| `trackStates`       | `usePlaylistMixer()`       |
| `masterVolume`      | `usePlaylistMixer()`       |
| `trackDragPreview`  | `useTrackReorderPreview()` |
| `trackReorderEpoch` | `useTrackReorderPreview()` |
| `playoutRef`        | `usePlaybackRefs()`        |
| `isDraggingRef`     | `usePlaybackRefs()`        |

From `usePlaylistState()`:

| Field                 | Now from                   |
| --------------------- | -------------------------- |
| `annotations`         | `usePlaylistAnnotations()` |
| `annotationsEditable` | `usePlaylistAnnotations()` |
| `linkEndpoints`       | `usePlaylistAnnotations()` |
| `continuousPlay`      | `usePlaylistAnnotations()` |
| `isLoopEnabled`       | `useLoop()`                |
| `loopStart`           | `useLoop()`                |
| `loopEnd`             | `useLoop()`                |
| `selectedTrackId`     | `useSelectedTrackId()`     |
| `canUndo`             | `useUndoRedo()`            |
| `canRedo`             | `useUndoRedo()`            |
| `isAutomaticScroll`   | `usePlaylistSettings()`    |
| `indefinitePlayback`  | `usePlaylistView()`        |
| `fillViewport`        | `usePlaylistView()`        |

From `usePlaybackAnimation()`:

| Field                     | Now from            |
| ------------------------- | ------------------- |
| `isPlaying`               | `useIsPlaying()`    |
| `currentTimeRef`          | `usePlaybackRefs()` |
| `visualTimeRef`           | `usePlaybackRefs()` |
| `playbackStartTimeRef`    | `usePlaybackRefs()` |
| `audioStartPositionRef`   | `usePlaybackRefs()` |
| `getPlaybackTime`         | `usePlaybackRefs()` |
| `getAudioContextTime`     | `usePlaybackRefs()` |
| `getLookAhead`            | `usePlaybackRefs()` |
| `getOutputLatency`        | `usePlaybackRefs()` |
| `registerFrameCallback`   | `usePlaybackRefs()` |
| `unregisterFrameCallback` | `usePlaybackRefs()` |

The fields that left these hooks in earlier entries stay where those entries put them: `selectionStart` and `selectionEnd` on `useSelection()`, `currentTime` on `useCurrentTime()`, `activeAnnotationId` on `useActiveAnnotation()`. The setters (`setSelectedTrackId`, `setLoopEnabled`, `setMasterVolume`, `zoomIn`, `undo` and the rest) stay on `usePlaylistControls()`.

`usePlaylistDataOptional()` has no public replacement. It existed so that `useAnnotationKeyboardControls` could run under either provider. Under `WaveformPlaylistProvider` that hook still reads `samplesPerPixel` and `sampleRate` itself; under `MediaElementPlaylistProvider` pass them as options, as before. (Later in this major the hook reads them from `MediaElementPlaylistProvider` too; options that are passed still win. See the Behaviour list of [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).) If your own component called `usePlaylistDataOptional()` to work with or without a provider, take the values it needs as props.

```tsx
// Before
import {
  usePlaylistData,
  usePlaylistState,
  usePlaybackAnimation,
  usePlaylistControls,
} from '@waveform-playlist/browser';

function Toolbar() {
  const { tracks, trackStates, sampleRate, samplesPerPixel, duration, masterVolume, playoutRef } =
    usePlaylistData();
  const { isLoopEnabled, selectedTrackId, canUndo, canRedo, annotations, isAutomaticScroll } =
    usePlaylistState();
  const { isPlaying, currentTimeRef, registerFrameCallback, unregisterFrameCallback } =
    usePlaybackAnimation();
  const { play, pause } = usePlaylistControls();
  // ...
}

// After
import {
  usePlaylistView,
  usePlaylistSettings,
  usePlaylistZoom,
  usePlaylistTimeline,
  usePlaylistMixer,
  usePlaylistAnnotations,
  useLoop,
  useSelectedTrackId,
  useUndoRedo,
  useIsPlaying,
  usePlaybackRefs,
  usePlaylistControls,
} from '@waveform-playlist/browser';

function Toolbar() {
  const { sampleRate } = usePlaylistView();
  const { isAutomaticScroll } = usePlaylistSettings();
  const { samplesPerPixel } = usePlaylistZoom();
  const { tracks, duration } = usePlaylistTimeline();
  const { trackStates, masterVolume } = usePlaylistMixer();
  const { annotations } = usePlaylistAnnotations();
  const { isLoopEnabled } = useLoop();
  const { selectedTrackId } = useSelectedTrackId();
  const { canUndo, canRedo } = useUndoRedo();
  const { isPlaying } = useIsPlaying();
  const { currentTimeRef, registerFrameCallback, unregisterFrameCallback, playoutRef } =
    usePlaybackRefs();
  const { play, pause } = usePlaylistControls();
  // ...
}
```

The "After" above is the mechanical translation, and it re-renders as often as the "Before" did. To get the benefit, move each group into the component that shows it: a loop button calls `useLoop()`, a master volume slider calls `usePlaylistMixer()`, and the toolbar that contains them calls neither.

### What to check after the replacement

1. **A component re-renders only for the group it reads.** Code that relied on being re-rendered by an unrelated change stops updating, with no type error. The two usual cases: an effect without a dependency array that reads a ref (`currentTimeRef.current`, `visualTimeRef.current`), and `playoutRef.current` read while rendering. `usePlaybackRefs()` never causes a re-render (the component still renders when its parent does or when its own state changes). Search for `.current` reads from these refs that are not inside an event handler, an effect with dependencies or a frame callback, and add a call to the hook that carries the value the code needs: `useCurrentTime()` for the resting cursor position, `useIsPlaying()` for play, pause and stop, `usePlaylistTimeline()` for `tracks`, `duration` and `isReady`.

   ```tsx
   // Before: usePlaybackAnimation() re-rendered this on play and stop
   const { currentTimeRef } = usePlaybackAnimation();
   useEffect(() => {
     label.current.textContent = format(currentTimeRef.current ?? 0);
   });

   // After: subscribe to what the label shows
   const { currentTime } = useCurrentTime();
   useEffect(() => {
     label.current.textContent = format(currentTime);
   }, [currentTime]);
   ```

   The same applies to render props. `renderPlayhead` is no longer called on a mixer, loop, undo, annotation, time-format or automatic-scroll change. It is still called when playback starts or stops, on a seek, a selection change, a view change, a zoom, a track selection and every timeline change (a clip operation, a pointer move of a trim, peaks arriving); the last two only while the component that renders `<Waveform>` re-renders with them, see "One playhead and one progress overlay for both providers", under "On screen", below. A custom playhead that positioned itself from refs on each call must not rely on the calls that are gone.

   `playoutRef.current` is `null` until the engine is first built and during a rebuild. Read it in an event handler, or in an effect that depends on `isReady` from `usePlaylistTimeline()`.

2. **In plain JavaScript a call to a removed hook fails loudly.** Under webpack or Rspack the missing import is `undefined` and the call throws at the first render. In native ES modules and the Vite dev server a missing named export fails earlier, when the module is linked ("does not provide an export named …"). Either way nothing fails silently, and TypeScript reports the import.

3. **Call `usePlaylistTimeline()` and `usePlaylistMixer()` in the smallest component that needs them.** The timeline value changes on every clip operation, on every pointer move of a trim and on a zoom (`peaksDataArray` is computed per zoom level), and also when loading finishes (`isReady`) and when peaks arrive. The mixer value changes on every mute, solo, volume or pan change (each step of a slider drag), and when tracks are added, removed or reordered. A page-level component that calls either re-renders its whole subtree that often. `useTrackReorderPreview()` changes on every drag-over of a track reorder, and the same advice applies.

4. **`trackReorderEpoch` and `trackDragPreview`** are in `useTrackReorderPreview()`, not in `usePlaylistData()`. A custom track panel does not need either: `renderTrackControls` and `SortableTrackControls` are removed later in this major, and the slot around a panel is keyed by the part (see [track controls are composed from pieces](#track-controls-are-composed-from-pieces-bound-to-a-track-the-mixer-setters-take-a-track-id)).

5. **A small timing difference, nothing to migrate.** A `play()` called while the engine is being rebuilt (the tracks just changed) is queued. The playhead, the clip progress overlays and `AudioPosition` now move to the queued start position when playback actually starts. Before, they jumped there when the rebuild finished, slightly earlier. If the queued play never starts (the rebuild fails), they now stay where they were until the next seek or stop.

### `PlaylistInfoContext` has no `duration`; `SmartScale` takes `durationMs`

**Package:** `@waveform-playlist/ui-components`.

This affects you only if you render `PlaylistInfoContext.Provider` or `<SmartScale>` yourself. `<Waveform>`, `<PlaylistVisualization>` and the MediaElement components do it for you and need no change.

The context value no longer has a `duration` field. Every channel and track reads `PlaylistInfoContext`, and the timeline length changes on every pointer move of a trim at the end of the timeline. `<SmartScale>` now takes the length as a required prop, `durationMs`, in milliseconds (the unit the removed field had).

**Find:** `duration` in a value passed to `PlaylistInfoContext.Provider`; `duration` read from `usePlaylistInfo()` or `useContext(PlaylistInfoContext)`; every `<SmartScale`.

**Replace with:** remove the field from the context value and pass the length to `SmartScale`:

```tsx
// Before
<PlaylistInfoContext.Provider value={{ ...info, duration: durationSeconds * 1000 }}>
  <SmartScale />
</PlaylistInfoContext.Provider>

// After
<PlaylistInfoContext value={info}>
  <SmartScale durationMs={durationSeconds * 1000} />
</PlaylistInfoContext>
```

In TypeScript both are compile errors (an unknown `duration` property, a missing `durationMs` prop). In plain JavaScript a `<SmartScale>` without `durationMs` renders the timescale with no ticks and no labels and throws nothing, so check every `<SmartScale` by hand. A component of your own that read `duration` from the context takes it as a prop instead.

### `SpectrogramProvider` needs the new `@waveform-playlist/browser`

**Package:** `@waveform-playlist/spectrogram`.

`SpectrogramProvider` reads the new hooks, so the new major of `@waveform-playlist/spectrogram` requires the new major of `@waveform-playlist/browser`. Its own API is unchanged. The pairing fails in both directions: an older `@waveform-playlist/spectrogram` calls `usePlaylistData()`, which the new `@waveform-playlist/browser` does not have. Upgrade the two together.

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
const { sampleRate } = usePlaylistView();
const { samplesPerPixel } = usePlaylistZoom();
const { duration } = usePlaylistTimeline();
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

**Note:** the hooks in the two examples above are replaced later in this major. `annotationPreview` and `setAnnotations` are on `usePlaybackControls()` under either provider, and `annotations` is on `useAnnotations()`. See [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

The built-in `<Waveform>` annotation boxes and `PlaylistAnnotationList` follow the preview by themselves. A custom annotation renderer needs `useAnnotationsWithPreview` to follow it.

## MediaElement player: the provider owns the selection and runs the one animation loop

**Package:** `@waveform-playlist/browser`.

No API changes and no type errors. `MediaElementPlaylistProvider` now keeps the time selection that `MediaElementPlaylist` used to keep in its own state, and its animation loop draws the playhead and the progress overlay, which used to run a `requestAnimationFrame` loop each. Seven things behave differently:

1. **The selection survives a remount of `MediaElementPlaylist`** (or `MediaElementWaveform`). Before, unmounting the component dropped the highlighted range. It is now kept for as long as the provider is mounted.
2. **Two `MediaElementPlaylist` under one provider show the same selection.** Before, each had its own. A press on either one while stopped (a click to seek, or the start of a drag) therefore clears the range highlighted in both; during playback the release does.
3. **A custom `renderPlayhead` is not called on each pointer move of a selection drag.** A move re-renders the highlighted range only; the rest of `MediaElementPlaylist` (timescale, waveform, annotation boxes, your playhead) renders on the press and on the release, not in between. Once the waveform is shown, the function is still called each time `MediaElementPlaylist` renders for another reason, among them: playback starting, pausing, stopping or ending, a seek, the press and the release of a click or drag, and the track's data arriving.
4. **Automatic scroll positions are whole pixels**, as under `WaveformPlaylistProvider`.
5. **When the provider replaces its player during playback, `isPlaying` becomes `false`.** The player is replaced when the track's `source`, `waveformData`, `name`, `fadeIn` or `fadeOut` changes, when the `audioContext`, `playbackRate` or `preservesPitch` prop changes, and when `onReady`, `onError` or `createPlayout` gets a new identity. The audio always stopped at that moment; `isPlaying` used to stay `true`, so a Play button stayed disabled and nothing played. Playback does not resume by itself.
6. **New audio starts at 0.** When the track's `source` or `waveformData` changes, playing or not, the cursor goes to 0 and the active annotation is cleared; before, both were kept, so the old position was applied to the new audio. When the player is replaced for the same audio (any other reason in item 5), both are kept, `currentTime` is brought up to the position playback had reached, and the next `play()` continues from there. `waveformData` is compared by identity, so pass the same object while the audio is the same. The selection is kept either way. To start new audio somewhere else (a saved position per file), call `seekTo` or `setActiveAnnotationId` from a `useEffect` keyed on the source in a component under the provider, or from `onReady`: both run after the reset. A `useLayoutEffect` runs before it and is overwritten.
7. **`seekTo` clamps to the length of the current track (`track.waveformData.duration`), not to the `duration` value.** `duration` is 0 until the first player is ready and stays at the previous file's length while the next one loads, so a `seekTo` made before the player was ready went to 0, and a position restored for a longer file was cut off at the old file's length. Both now go where they were asked to: the position is shown at once, the player is moved to it when it is ready, and `play()` starts there. (At the time of that change `duration` still went from 0 to the length when the player was ready; it is the track's length from the first render since the next entry.)

What a click, a drag and Play do was not changed by this step; the next entry changes it (the cursor follows the start of a dragged range, and a range can be played).

**Find:** `onReady`, `onError` or `createPlayout` passed to `MediaElementPlaylistProvider` as inline functions (`onReady={() => …}`), or a `track` built with inline `fadeIn` / `fadeOut` objects (`fadeIn: { duration: 1 }`), by a component that re-renders during playback: each render replaces the player, and playback now visibly stops. Also a `renderPlayhead` passed to `MediaElementWaveform` or `MediaElementPlaylist` that reads something of your own during a selection drag and relied on being called per pointer move; code that unmounts and remounts `MediaElementPlaylist` to clear the highlighted range.

**Replace with:** for the callbacks, a stable function (`useCallback`, or one defined outside the component); for the track, a `useMemo` or a constant, so the fade objects keep their identity. For the playhead, position from `currentTimeRef` (since a later step `visualTimeRef`, the same ref under this provider) in your own effect or animation frame, as `PlayheadWithMarker` does; it does not need the call. To clear the range, remount the provider (a `key` on `MediaElementPlaylistProvider`); that creates a new player, so playback stops, the audio is loaded again, `onReady` is called again, and playback position, playback rate, continuous play, automatic scroll and the active annotation go back to their initial values. The selection is not yet readable or settable from outside the built-in components.

**Note:** it is since a later entry: `useSelection()` reads it and `usePlaybackControls().setSelection` sets it. See [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

## MediaElement player: Stop, the ends of playback, seeking and the selection follow the multitrack player's rules

**Package:** `@waveform-playlist/browser`.

`MediaElementPlaylistProvider` now plays, stops, seeks and selects the way `WaveformPlaylistProvider` does, so that one set of controls can mean the same thing under both. The hooks keep their names in this step. One signature changes (`play`), one field is added (`isReady`), and the meaning of `duration`, `onReady` and `onError` changes.

**Note:** the hook names used in this entry (`useMediaElementControls()`, `useMediaElementData()`) are those of this step. The next entry removes them: the actions are on `usePlaybackControls()`, and `duration`, `isReady` and `playoutRef` on `useMediaElementTrack()`. The behaviour described here is unchanged by that. See [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

| What | Before | Now |
| --- | --- | --- |
| `stop()` | cursor to 0 | cursor back to where playback started |
| The audio plays to its end | cursor to 0 | cursor back to where playback started; the active annotation is cleared |
| An annotation plays to its end with continuous play off | the provider wrote no position: the playhead showed what the media element reported after rewinding (0 was observed) while `currentTime` kept its old value | cursor back to where playback started (the annotation's start when it was clicked), and `currentTime` agrees |
| `play` | `(startTime?) => void` | `(startTime?, playDuration?) => Promise<void>`; with `playDuration` it stops by itself and leaves the cursor at the end of the range (two exceptions below). The promise resolves as soon as the play has been handed to the player or queued, not when sound starts |
| `play()` before the player exists | did nothing | queued: starts when the player arrives, also when it was called from a mount effect. `stop()`, `pause()`, new audio and a player that fails to arrive cancel it; a replacement of the player for the same audio keeps it. `isPlaying` stays `false` until the player has arrived and been started. The cursor ref (`currentTimeRef`) is at the queued start position from the moment of the call; the `currentTime` state follows when the play is cancelled or a seek is made (not when it starts: during playback only the ref advances), and the cursor stays there if the play is cancelled |
| `seekTo(t)` during playback | moved the media element | restarts playback at `t`, so the track's fades are scheduled again; a range that was playing becomes an open-ended play |
| A drag on the waveform while stopped | highlighted a range, the cursor stayed | highlights a range and moves the cursor to its start |
| A press on the waveform during playback | playback moved on release | still on the release; a drag made meanwhile can now select a range when automatic scroll is off (see "During playback, a press on the waveform waits for the release, and a drag selects a range", below) |
| `duration` from `useMediaElementData()` | 0 until the player was created | the length from `track.waveformData`, from the first render |
| The waveform | "Loading waveform…" until the peaks effect ran | drawn on the first render |
| `onReady` | called when the player object was created | called when the media element has loaded its metadata (it knows its length and can be played and seeked) |
| A source that cannot be loaded or decoded | nothing | `onError` is called with an `Error` ("Media failed to load (code …)"; the provider does not add the URL to the message, because it may carry a token. The text after the code is the browser's own), and the player never becomes ready |
| A media error during playback (the network drops) | `isPlaying` stayed `true` with no sound | playback ends where it was (`isPlaying` `false`, cursor kept) and `onError` is called |
| The browser refuses to start playback (no user gesture, typically for a play from a mount effect or a queued play) | `isPlaying` stayed `true` with no sound | `isPlaying` goes back to `false`, cursor kept. Needs `@waveform-playlist/media-element-playout` from the same release (its new `playrejected` event). Not yet in one case with the `audioContext` prop: while that context is suspended the engine waits for it to resume, a browser may leave that pending when there was no user gesture, and `isPlaying` then stays `true` as before (#783) |
| `stop()` while already stopped | cursor to 0 | the cursor does not move, unless playback is paused (then it returns to where playback started; a pause followed by a replacement of the player for the same audio counts as stopped) |
| `createPlayout` | any object with the playout's methods | must also implement `on()` and emit `loadedmetadata`; without `on()` the provider calls `onError` |

**Where playback started** is the `startTime` of the last `play()`, or the cursor when it was called without one; for selection playback it is the start of the selection. A `seekTo` or a click on the waveform replaces it with the new position, during playback as well as while stopped. Wherever playback comes to rest by itself (the end of a range, of an annotation or of the audio, an error) is the new starting point too, so a `stop()` while stopped does not move the cursor. A `stop()` while a play is queued cancels it and leaves the cursor at that play's starting point (the start of the selection for a queued selection playback). To go back to the beginning, call `seekTo(0)`.

**Ranges.** A range rests at its own end, with two exceptions. (1) When an annotation is active and continuous play is off, playback stops at that annotation's end if it comes first, and the cursor returns to where playback started. The annotation keyboard controls (`useAnnotationKeyboardControls` with `onPlay: play`) now play a real range for this reason: their duration argument used to be ignored. (2) Selection playback: a `play(start, duration)` that starts inside the highlighted range and ends at its end stops there and returns the cursor to the START of the selection, also when it was resumed part-way after a pause, and continuous play has no effect on it. The selection cannot be read from outside the built-in components yet, and no built-in control passes a duration, so in this step selection playback is reached only by code that knows the range it highlighted; the shared Play button of the next step uses it. `play()` without a duration is open-ended from the cursor, selection or not.

**In a hidden tab** animation frames stop while the audio goes on. A range and an annotation are still ended there, from the media element's `timeupdate` event. Browsers fire it about four times a second of real time, so the stop can be late by that much (more audio at a higher playback rate). This path is covered by unit tests that fire the event with no animation frame; it has not been checked in a really hidden tab.

**`isReady` is not a condition for Play.** Some browsers do not load metadata before the first play (iOS on a cellular connection or in low-data mode may ignore `preload`; not verified here). There `isReady` and `onReady` come only after playback has been asked for. Do not disable a Play button on `isReady`: `play()` works before the player is ready. Other things to know: `onReady` is called again if your code calls `playoutRef.current.setSource()`; an effect keyed on `isReady` runs again each time the player is replaced; and an exception thrown inside `onReady` is caught and logged by the engine's event emitter (it used to reach `onError`).

**Find:**

- `stop()` from `useMediaElementControls()` used as "rewind": code that reads `currentTime` or `currentTimeRef` after a stop and expects 0.
- An effect that lists `duration` (from `useMediaElementData()`) as a dependency in order to run again "when the player is ready", or a guard such as `duration === 0` / `duration > 0` used as "is it loaded".
- `onReady` used as "the player object exists" (for example to read `playoutRef.current` early). It is now later, and it is not called at all for a source that fails to load.
- A custom `createPlayout`.
- Code that awaits or ignores the return value of `play()`: it is a promise now, and a `try { play() } catch` no longer catches anything (use `.catch`).
- A Play button disabled on "not loaded yet".
- An `onError` handler that assumes the player could not be created (a message such as "init failed", or unmounting the player): it is now also called for media that fails to load, possibly in the middle of playback.

**Replace with:**

```tsx
// Before: Stop also rewound
<button onClick={() => stop()}>Stop</button>

// After: Stop returns to where playback started; rewinding is its own action
<button onClick={() => stop()}>Stop</button>
<button onClick={() => seekTo(0)}>Rewind</button>
```

```tsx
// Before: `duration` went from 0 to the length when the player was created
const { playoutRef, duration } = useMediaElementData();
useEffect(() => {
  const outputNode = playoutRef.current?.outputNode;
  if (!outputNode) return;
  // …wire it up
}, [playoutRef, duration]);

// After: `isReady` is the signal
const { playoutRef, isReady } = useMediaElementData();
useEffect(() => {
  const outputNode = playoutRef.current?.outputNode;
  if (!outputNode) return;
  // …wire it up
}, [playoutRef, isReady]);
```

```tsx
// Before: nothing told you that the file was missing
<MediaElementPlaylistProvider track={track}>

// After: pass a stable onError to show it
const handleError = useCallback((error: Error) => setProblem(error.message), []);
<MediaElementPlaylistProvider track={track} onError={handleError}>
```

A custom playout created from the package's own `MediaElementPlayout` class needs no change. One written from scratch needs `on(event, listener)`. The provider subscribes to four events: `loadedmetadata` must be emitted (without it the player is never ready); `timeupdate` (the position, used as the hidden-tab fallback), `error` and `playrejected` are optional to emit. `getTrack()` is no longer called.

## One set of hooks and controls for both providers

**Package:** `@waveform-playlist/browser` (and a new base component, `PlaybackRateSelect`, in `@waveform-playlist/ui-components`).

`WaveformPlaylistProvider` and `MediaElementPlaylistProvider` now publish what they share through the same hooks, so a component written against `useIsPlaying()` or `usePlaybackControls()` works under either. The library's transport buttons, position display, time-format select, selection inputs and automatic-scroll checkbox are such components, and now work under `MediaElementPlaylistProvider` too.

Six hooks are removed: `usePlaylistControls()`, `usePlaylistAnnotations()`, `useMediaElementAnimation()`, `useMediaElementState()`, `useMediaElementControls()` and `useMediaElementData()`. A leftover call to a removed hook fails at import (the export is missing), not silently: under webpack or Rspack the import is `undefined` and the call throws at the first render; in native ES modules and the Vite dev server the module fails to link ("does not provide an export named …"). TypeScript reports the import.

`usePlaybackRefs()` keeps its name and loses eight fields: `playbackStartTimeRef`, `audioStartPositionRef`, `getPlaybackTime`, `getAudioContextTime`, `getLookAhead`, `getOutputLatency`, `playoutRef` and `isDraggingRef` are on `useEngineRefs()`. The value is a plain object with the four fields that remain, so a leftover read of one of the eight is `undefined`, with no error at the read. In plain JavaScript a `const { playoutRef } = usePlaybackRefs()` gives `undefined` and the code fails where it next uses the name ("Cannot read properties of undefined (reading 'current')", or "getPlaybackTime is not a function"). A TypeScript build fails earlier: the property is not on `PlaybackRefsContextValue`. Search for the eight names next to `usePlaybackRefs` before running the app. Under `MediaElementPlaylistProvider` the player is `useMediaElementTrack().playoutRef`.

| Removed | Replace with |
| --- | --- |
| `usePlaylistControls()` | `usePlaybackControls()` (the actions both providers have) and `useEditorControls()` (the rest) |
| `usePlaylistAnnotations()` | `useAnnotations()` and `useAnnotationEditing()` |
| eight fields of `usePlaybackRefs()` | `useEngineRefs()`. `usePlaybackRefs()` stays, with four fields |
| `useMediaElementAnimation()` | `useIsPlaying()`, `useCurrentTime()`, `usePlaybackRefs()` |
| `useMediaElementState()` | `useAnnotations()`, `useActiveAnnotation()`, `usePlaybackRate()`, `usePlaylistSettings()` |
| `useMediaElementControls()` | `usePlaybackControls()`, and `usePlaybackRate()` for `setPlaybackRate` |
| `useMediaElementData()` | `useMediaElementTrack()`, `usePlaylistView()`, `usePlaylistZoom()` |

This entry replaces the hook named in the earlier entries on this page: where an entry above says to read a field from, or to keep, one of the removed hooks, use the hook from the tables below.

### The hooks after this change

All are exported from `@waveform-playlist/browser`.

Under either provider:

| Hook | Returns |
| --- | --- |
| `useIsPlaying()` | `isPlaying` |
| `useCurrentTime()` | `currentTime` (where the cursor rests; it does not advance during playback) |
| `useSelection()` | `selectionStart`, `selectionEnd` |
| `useActiveAnnotation()` | `activeAnnotationId` |
| `useAnnotations()` | `annotations`, `continuousPlay` |
| `usePlaybackControls()` | `play`, `pause`, `stop`, `seekTo`, `setSelection`, `setTimeFormat`, `setAutomaticScroll`, `setScrollContainer`, `scrollContainerRef`, `setContinuousPlay`, `setAnnotations`, `annotationPreview`, `setActiveAnnotationId` |
| `usePlaybackRefs()` | `currentTimeRef`, `visualTimeRef`, `registerFrameCallback`, `unregisterFrameCallback` |
| `usePlaylistView()` | `sampleRate`, `waveHeight`, `timeScaleHeight`, `controls` (both removed again [further down](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed)), `barWidth`, `barGap`, `roundedBars`, `progressBarWidth`, `mono`, `indefinitePlayback`, `fillViewport` (`waveHeight`, the four bar and playhead fields and `fillViewport` moved again in [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers)) (the last three are always `false` under `MediaElementPlaylistProvider`) |
| `usePlaylistSettings()` | `timeFormat`, `isAutomaticScroll` |
| `usePlaylistZoom()` | `samplesPerPixel`, `canZoomIn`, `canZoomOut` (the last two are always `false` under `MediaElementPlaylistProvider`) |

`WaveformPlaylistProvider` only:

| Hook | Returns |
| --- | --- |
| `useEditorControls()` | `setCurrentTime`, `setTrackMute`, `setTrackSolo`, `setTrackVolume`, `setTrackPan`, `reorderTrack`, `bumpTrackReorderEpoch`, `setTrackDragPreview`, `setSelectedTrackId`, `zoomIn`, `zoomOut`, `setMasterVolume`, `setLinkEndpoints`, `setAnnotationsEditable`, `setLoopEnabled`, `setLoopRegion`, `setLoopRegionFromSelection`, `clearLoopRegion`, `undo`, `redo`, `setRecordingActive` |
| `useEngineRefs()` | `playbackStartTimeRef`, `audioStartPositionRef`, `getPlaybackTime`, `getAudioContextTime`, `getLookAhead`, `getOutputLatency`, `playoutRef`, `isDraggingRef` |
| `useAnnotationEditing()` | `annotationsEditable`, `linkEndpoints` |
| `usePlaylistTimeline()`, `usePlaylistMixer()`, `useTrackReorderPreview()`, `useLoop()`, `useSelectedTrackId()`, `useUndoRedo()` | unchanged |

`MediaElementPlaylistProvider` only:

| Hook | Returns |
| --- | --- |
| `usePlaybackRate()` | `playbackRate`, `setPlaybackRate` |
| `useMediaElementTrack()` | `duration`, `isReady`, `peaksDataArray`, `fadeIn`, `fadeOut`, `playoutRef` |

The values of `usePlaybackControls()`, `useEditorControls()`, `usePlaybackRefs()` and `useEngineRefs()` never change, so calling them never re-renders the component.

Type names: `PlaylistControlsContextValue`, `PlaylistAnnotationsContextValue`, `MediaElementAnimationContextValue`, `MediaElementStateContextValue`, `MediaElementControlsContextValue` and `MediaElementDataContextValue` are removed. The new value types are `PlaybackControlsContextValue`, `EditorControlsContextValue`, `AnnotationsContextValue`, `AnnotationEditingContextValue`, `EngineRefsContextValue`, `PlaybackRateContextValue` and `MediaElementTrackContextValue`. `PlaybackRefsContextValue` keeps its name and has the four fields above.

### Where each field of the removed hooks went

**Find** (imports and calls; run each as a regular expression over your source):

- `\busePlaylistControls\b`
- `\busePlaylistAnnotations\b`
- `\busePlaybackRefs\b` (the hook stays; check which fields each call reads)
- `\buseMediaElement(Animation|State|Controls|Data)\b`
- `\b(PlaylistControls|PlaylistAnnotations|MediaElement(Animation|State|Controls|Data))ContextValue\b`

**Replace with:** for each field the component reads, the hook in the right-hand column. Call each hook once per component and destructure only the fields that component uses. (`waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` and `fillViewport` moved again in [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers).)

From `usePlaylistControls()`:

| Field | Now from |
| --- | --- |
| `play` | `usePlaybackControls()` |
| `pause` | `usePlaybackControls()` |
| `stop` | `usePlaybackControls()` |
| `seekTo` | `usePlaybackControls()` |
| `setSelection` | `usePlaybackControls()` |
| `setTimeFormat` | `usePlaybackControls()` |
| `setAutomaticScroll` | `usePlaybackControls()` |
| `setScrollContainer` | `usePlaybackControls()` |
| `scrollContainerRef` | `usePlaybackControls()` |
| `setContinuousPlay` | `usePlaybackControls()` |
| `setAnnotations` | `usePlaybackControls()` |
| `annotationPreview` | `usePlaybackControls()` |
| `setActiveAnnotationId` | `usePlaybackControls()` |
| `setCurrentTime` | `useEditorControls()` |
| `setTrackMute` | `useEditorControls()` |
| `setTrackSolo` | `useEditorControls()` |
| `setTrackVolume` | `useEditorControls()` |
| `setTrackPan` | `useEditorControls()` |
| `reorderTrack` | `useEditorControls()` |
| `bumpTrackReorderEpoch` | `useEditorControls()` |
| `setTrackDragPreview` | `useEditorControls()` |
| `setSelectedTrackId` | `useEditorControls()` |
| `zoomIn` | `useEditorControls()` |
| `zoomOut` | `useEditorControls()` |
| `setMasterVolume` | `useEditorControls()` |
| `setLinkEndpoints` | `useEditorControls()` |
| `setAnnotationsEditable` | `useEditorControls()` |
| `setLoopEnabled` | `useEditorControls()` |
| `setLoopRegion` | `useEditorControls()` |
| `setLoopRegionFromSelection` | `useEditorControls()` |
| `clearLoopRegion` | `useEditorControls()` |
| `undo` | `useEditorControls()` |
| `redo` | `useEditorControls()` |
| `setRecordingActive` | `useEditorControls()` |

From `usePlaylistAnnotations()`:

| Field | Now from |
| --- | --- |
| `annotations` | `useAnnotations()` |
| `continuousPlay` | `useAnnotations()` |
| `annotationsEditable` | `useAnnotationEditing()` |
| `linkEndpoints` | `useAnnotationEditing()` |

From `usePlaybackRefs()`:

| Field | Now from |
| --- | --- |
| `currentTimeRef` | `usePlaybackRefs()` (unchanged) |
| `visualTimeRef` | `usePlaybackRefs()` (unchanged) |
| `registerFrameCallback` | `usePlaybackRefs()` (unchanged) |
| `unregisterFrameCallback` | `usePlaybackRefs()` (unchanged) |
| `playbackStartTimeRef` | `useEngineRefs()` |
| `audioStartPositionRef` | `useEngineRefs()` |
| `getPlaybackTime` | `useEngineRefs()` |
| `getAudioContextTime` | `useEngineRefs()` |
| `getLookAhead` | `useEngineRefs()` |
| `getOutputLatency` | `useEngineRefs()` |
| `playoutRef` | `useEngineRefs()` |
| `isDraggingRef` | `useEngineRefs()` |

From `useMediaElementAnimation()`:

| Field | Now from |
| --- | --- |
| `isPlaying` | `useIsPlaying()` |
| `currentTime` | `useCurrentTime()` |
| `currentTimeRef` | `usePlaybackRefs()` |

From `useMediaElementState()`:

| Field | Now from |
| --- | --- |
| `annotations` | `useAnnotations()` |
| `continuousPlay` | `useAnnotations()` |
| `activeAnnotationId` | `useActiveAnnotation()` |
| `playbackRate` | `usePlaybackRate()` |
| `isAutomaticScroll` | `usePlaylistSettings()` |

From `useMediaElementControls()`:

| Field | Now from |
| --- | --- |
| `play` | `usePlaybackControls()` |
| `pause` | `usePlaybackControls()` |
| `stop` | `usePlaybackControls()` |
| `seekTo` | `usePlaybackControls()` |
| `setContinuousPlay` | `usePlaybackControls()` |
| `setAnnotations` | `usePlaybackControls()` |
| `annotationPreview` | `usePlaybackControls()` |
| `setActiveAnnotationId` | `usePlaybackControls()` |
| `setAutomaticScroll` | `usePlaybackControls()` |
| `setScrollContainer` | `usePlaybackControls()` |
| `scrollContainerRef` | `usePlaybackControls()` |
| `setPlaybackRate` | `usePlaybackRate()` |

From `useMediaElementData()`:

| Field | Now from |
| --- | --- |
| `duration` | `useMediaElementTrack()` |
| `isReady` | `useMediaElementTrack()` |
| `peaksDataArray` | `useMediaElementTrack()` |
| `fadeIn` | `useMediaElementTrack()` |
| `fadeOut` | `useMediaElementTrack()` |
| `playoutRef` | `useMediaElementTrack()` |
| `sampleRate` | `usePlaylistView()` |
| `waveHeight` | `usePlaylistView()` |
| `timeScaleHeight` | `usePlaylistView()` |
| `controls` | `usePlaylistView()` |
| `barWidth` | `usePlaylistView()` |
| `barGap` | `usePlaylistView()` |
| `roundedBars` | `usePlaylistView()` |
| `progressBarWidth` | `usePlaylistView()` |
| `samplesPerPixel` | `usePlaylistZoom()` |

New under `MediaElementPlaylistProvider`, with no earlier equivalent: `useSelection()`, `usePlaybackControls().setSelection`, `usePlaybackControls().setTimeFormat`, `usePlaylistSettings().timeFormat`, and `visualTimeRef`, `registerFrameCallback` and `unregisterFrameCallback` on `usePlaybackRefs()`. There, `visualTimeRef` is the same ref as `currentTimeRef`.

**A toolbar under `WaveformPlaylistProvider`:**

```tsx
// Before
import { usePlaylistControls, useIsPlaying } from '@waveform-playlist/browser';

function Toolbar() {
  const { isPlaying } = useIsPlaying();
  const { play, pause, stop, zoomIn, zoomOut, undo, redo } = usePlaylistControls();
  // ...
}

// After
import { usePlaybackControls, useEditorControls, useIsPlaying } from '@waveform-playlist/browser';

function Toolbar() {
  const { isPlaying } = useIsPlaying();
  const { play, pause, stop } = usePlaybackControls();
  const { zoomIn, zoomOut, undo, redo } = useEditorControls();
  // ...
}
```

**A component that reads the engine through `usePlaybackRefs()`:**

```tsx
// Before
import { usePlaybackRefs } from '@waveform-playlist/browser';

function LatencyReadout() {
  const { currentTimeRef, playoutRef, getLookAhead, getOutputLatency } = usePlaybackRefs();
  // ...
}

// After
import { usePlaybackRefs, useEngineRefs } from '@waveform-playlist/browser';

function LatencyReadout() {
  const { currentTimeRef } = usePlaybackRefs();
  const { playoutRef, getLookAhead, getOutputLatency } = useEngineRefs();
  // ...
}
```

`useClipDragHandlers({ engineRef, isDraggingRef, … })` takes both of its refs from `useEngineRefs()` now (`engineRef: playoutRef`).

**A hand-built transport under `MediaElementPlaylistProvider`:** the library's buttons replace it. `AudioPosition` shows the position in the provider's time format and follows playback through the provider's animation loop, so the `requestAnimationFrame` loop goes too.

```tsx
// Before
import { useEffect, useRef } from 'react';
import {
  useMediaElementAnimation,
  useMediaElementState,
  useMediaElementControls,
} from '@waveform-playlist/browser';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function Controls() {
  const { isPlaying, currentTimeRef } = useMediaElementAnimation();
  const { playbackRate } = useMediaElementState();
  const { play, pause, stop, setPlaybackRate } = useMediaElementControls();

  const timeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (timeRef.current) timeRef.current.textContent = format(currentTimeRef.current ?? 0);
      if (isPlaying) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, currentTimeRef]);

  return (
    <div>
      <button onClick={() => play()} disabled={isPlaying}>Play</button>
      <button onClick={() => pause()} disabled={!isPlaying}>Pause</button>
      <button onClick={() => stop()}>Stop</button>
      <span ref={timeRef} />
      {SPEEDS.map((rate) => (
        <button key={rate} disabled={playbackRate === rate} onClick={() => setPlaybackRate(rate)}>
          {rate}×
        </button>
      ))}
    </div>
  );
}

// After
import {
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  PlaybackRateSelect,
} from '@waveform-playlist/browser';

function Controls() {
  return (
    <div>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <AudioPosition />
      <PlaybackRateSelect />
    </div>
  );
}
```

`PlaybackRateSelect` is new and works under `MediaElementPlaylistProvider` only. It is a native `<select>` labelled "Playback speed"; `rates` (optional) lists the speeds to offer, by default 0.5, 0.75, 1, 1.25, 1.5 and 2. To keep your own buttons instead, read `usePlaybackRate()`:

```tsx
const { playbackRate, setPlaybackRate } = usePlaybackRate();
```

**A component that reads `useMediaElementData()`:**

```tsx
// Before
import { useMediaElementData } from '@waveform-playlist/browser';

function Info() {
  const { duration, isReady, playoutRef, sampleRate, samplesPerPixel } = useMediaElementData();
  // ...
}

// After
import { useMediaElementTrack, usePlaylistView, usePlaylistZoom } from '@waveform-playlist/browser';

function Info() {
  const { duration, isReady, playoutRef } = useMediaElementTrack();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  // ...
}
```

### Which controls work where

Under either provider: `PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`, `ClearAllButton`, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs`, `AutomaticScrollCheckbox`, and, inside `<AnnotationProvider>`, `ContinuousPlayCheckbox` and `DownloadAnnotationsButton`. (Later entries change the annotation controls: all four work under either provider, are imported from `@waveform-playlist/annotations` and do not need `<AnnotationProvider>`; see [One owner per exported name](#one-owner-per-exported-name-the-annotation-controls-move-to-the-annotations-package-re-exports-and-unused-exports-are-removed).)

`MediaElementPlaylistProvider` only: `PlaybackRateSelect`.

`WaveformPlaylistProvider` only (they throw under `MediaElementPlaylistProvider`): `LoopButton`, `SetLoopRegionButton`, `ZoomInButton`, `ZoomOutButton`, `MasterVolumeControl`, `LinkEndpointsCheckbox`, `EditableCheckbox`, `KeyboardShortcuts`, and `ExportWavButton` from `@waveform-playlist/browser/tone`.

`MediaElementWaveform`, `MediaElementPlaylist` and `MediaElementAnnotationList` keep their names.

### Behaviour

- **`StopButton` is disabled unless playback is running, under both providers.** Before: no library Stop button worked under `MediaElementPlaylistProvider`, and the hand-built Stop on the MediaElement example pages was always enabled. Now: after Pause, `StopButton` is disabled and the cursor stays at the pause point. `stop()` called from code after a pause still returns the cursor to where playback started.
- **`RewindButton`, `FastForwardButton`, `SkipBackwardButton` and `SkipForwardButton` call only `seekTo`.** Before: each called `setCurrentTime(t)` and then, when playing, `play(t)`; Fast Forward and Skip Forward read `duration` from `usePlaylistTimeline()` to clamp. Now: `seekTo(0)`, `seekTo(Infinity)` and `seekTo(currentTimeRef.current ± skipAmount)`. `seekTo` clamps (see the next item for `WaveformPlaylistProvider`) and, during playback, restarts playback at the new position.
- **The `0` shortcut is `seekTo(0)`.** Before: `rewindToStart` of `usePlaybackShortcuts()` (the `0` key of the hook and of `<KeyboardShortcuts playback>`) called `setCurrentTime(0)` and then, when playing, `play(0)`. Now: it calls `seekTo(0)`, as `RewindButton` does.
- **`seekTo` under `WaveformPlaylistProvider` accepts a position past the end of the audio in two modes.** Before: `seekTo(t)` always clamped `t` to 0…the length of the timeline. `SkipBackwardButton` did not go through it: it called `setCurrentTime(Math.max(0, currentTimeRef.current - skipAmount))`, and `setCurrentTime` does not clamp. Now: with the `indefinitePlayback` prop, or during a recording session (after `setRecordingActive(true)`, until `setRecordingActive(false)`), a finite `t` past the end of the audio is kept as it is. `seekTo(Infinity)` still means the end of the audio, in every mode. The result is never below 0. Otherwise `seekTo` clamps to the audio as before. So `seekTo` called from your code in those two modes can now put the cursor past the end, and Skip Backward from a position past the end lands where it did before this change (from 30 s over 10 s of audio, at 25 s). `SkipForwardButton` changes in those two modes: before, it stopped at the end of the audio (`Math.min(duration, …)`); now each press moves the cursor on by `skipAmount`, past the end, because there the transport has no end. `FastForwardButton` is disabled under a provider with `indefinitePlayback` (before: enabled, and it jumped to the end of the audio); it is not disabled by a recording session.
- **`seekTo` under `WaveformPlaylistProvider` during playback, while the engine is being rebuilt.** Before: the cursor moved, and `play` was not called because there was no engine. Now: `seekTo` calls `play(t)` whenever playback is running, and `play` re-points the play that is waiting for the rebuilt engine to the new position. The re-pointed play is open-ended: if the waiting play was a selection or another range, its end is dropped, as for any `seekTo` during playback.
- **`PlayButton` under `MediaElementPlaylistProvider` plays a highlighted selection as a range.** Before: no library Play button worked there, and a hand-built one calling `play()` played open-ended from the cursor. Now: as under `WaveformPlaylistProvider`, with a selection highlighted the button plays it and stops at its end (resuming from the cursor when the cursor is inside the selection), and plays from the cursor otherwise. There is no loop under `MediaElementPlaylistProvider`.
- **`setSelection` under `MediaElementPlaylistProvider` orders and clamps its two times.** Before: `setSelection` was not public under this provider, and the provider stored the two times as it was given them (the drag on the waveform passed them ordered). Now: `usePlaybackControls().setSelection(a, b)` works there; the smaller time is the start, and both are clamped to 0…the length of the audio (the `duration` of the track's waveform data). `SelectionTimeInputs` works under this provider now, and a typed time can be past the end or after the other one; after the call the highlight, the cursor and what Play plays are one range. Two consequences: `setSelection(5, 100)` on 30 s of audio stores 5 to 30, so a following `play(5, 95)` is not recognised as playing the selection (it plays to the end of the audio and rests there; `play(5, 25)` is the selection); and a selection that is kept while the track changes to shorter audio is not clamped again until the next call.
- **A replaced `MediaElementPlaylistProvider` player keeps the speed the user chose.** The provider replaces its player when the track or certain props change. Before: every new player ran at the speed of the `playbackRate` prop, while `playbackRate` in the provider's state (what a speed select shows) kept the speed chosen with `setPlaybackRate`. Now the latest instruction wins, for the audio and for the state alike: a new player is set to the speed last chosen with `setPlaybackRate` (which `PlaybackRateSelect` calls), and a `playbackRate` prop that changes after mount replaces that choice (the state takes the prop's value) until the user chooses again. Before, a changed prop changed the audio's speed and left the state at the old value. The bundled engine is created at the prop's speed, as before, and is told a speed with `setPlaybackRate` only when the current one differs from that prop (after a choice of the user). **A custom `createPlayout` is now told the current speed on every new player** (before: the provider told a custom player a speed only after the user had chosen one, and the prop never reached it): a speed set inside your factory is replaced by the prop's (default 1), so pass the speed as the prop. The provider's `setPlaybackRate` clamps to 0.5–2; the provider does not clamp the prop (the bundled engine's own setter clamps to 0.25–4, its constructor does not; a custom `createPlayout` that returns the package's `MediaElementPlayout` is told the speed through that setter, so there a prop outside 0.25–4 plays clamped while `usePlaybackRate()` shows the prop). Two orderings to know: a prop change and a `setPlaybackRate` call in the same event handler leave the prop's speed, whichever came first; and a child that answers a prop change by setting a speed must do so in a `useEffect`, not a `useLayoutEffect` (a child's layout effect runs before the provider records the new prop, so its speed shows in the select but the new player gets the prop's).
- **Nested providers.** Before: the hooks of the two providers were different functions, so a `usePlaylist*` hook inside a `MediaElementPlaylistProvider` that was itself inside a `WaveformPlaylistProvider` read the outer provider. Now: a shared hook reads the nearest provider, and a hook the nearest provider does not serve throws, for example: "useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it". The same holds the other way round for `usePlaybackRate()` and `useMediaElementTrack()`.
- **A shared hook outside any provider.** Before: "useIsPlaying must be used within WaveformPlaylistProvider". Now: "useIsPlaying must be used within WaveformPlaylistProvider or MediaElementPlaylistProvider". A hook that only one provider serves names that provider.
- **`MediaElementPlaylistProvider` has a time format.** Before: none. Now: `usePlaylistSettings().timeFormat` and `usePlaybackControls().setTimeFormat`, default `'hh:mm:ss.uuu'`, read by `AudioPosition` and `TimeFormatSelect`.
- **`KeyboardShortcuts` and `usePlaybackShortcuts()` are `WaveformPlaylistProvider` only**, before and now: both throw under `MediaElementPlaylistProvider`, also when that provider is nested inside a `WaveformPlaylistProvider` (before, the hook then drove the outer playlist) (now with "usePlaybackShortcuts needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it"). `usePlaybackShortcuts()` listens on the window, and what keys do for the single-track player is not decided ([#723](https://github.com/naomiaro/waveform-playlist/issues/723), [#730](https://github.com/naomiaro/waveform-playlist/issues/730)). `useKeyboardShortcuts()` reads no context, and `useAnnotationKeyboardControls()` does not throw there, so your own component can call either under `MediaElementPlaylistProvider`.
- **`useAnnotationKeyboardControls()` under `MediaElementPlaylistProvider` reads `samplesPerPixel` and `sampleRate` from the provider.** Before: under that provider the hook scrolled to the active annotation only when `scrollContainerRef`, `samplesPerPixel` and `sampleRate` were all passed as options. Now: with a `scrollContainerRef` and without the other two it reads them from the provider and scrolls the active annotation into view. An option that is passed still wins. Inside nested providers it reads the nearest one.
- **Some hooks and components that read only shared hooks no longer throw under the other provider**: `useClipDragHandlers()` under `MediaElementPlaylistProvider`, and `MediaElementAnnotationList` under `WaveformPlaylistProvider`. That is a consequence of the shared hooks, not a supported use.

### What to check after the replacement of the MediaElement hooks

A component re-renders only for the hooks it calls. The four removed hooks carried several groups of fields each, so a component moved to the new hooks can stop updating, with no type error. For the WebAudio hooks see [What to check after the replacement](#what-to-check-after-the-replacement) above.

1. **`currentTimeRef.current` read while rendering.** A component that read `{ isPlaying, currentTimeRef }` from `useMediaElementAnimation()` and printed `currentTimeRef.current` during render was re-rendered by every seek, every pause and every move of a leftward selection drag, because `currentTime` was in the same value. After moving to `useIsPlaying()` and `usePlaybackRefs()` it re-renders on play, pause and stop only. Add `useCurrentTime()` and show its `currentTime`, or use `<AudioPosition />`.

   ```tsx
   // Before: re-rendered on every seek, because currentTime was in the same value
   const { isPlaying, currentTimeRef } = useMediaElementAnimation();
   return <span>{format(currentTimeRef.current ?? 0)}</span>;

   // After: subscribe to what the label shows
   const { currentTime } = useCurrentTime();
   return <span>{format(currentTime)}</span>;
   ```

2. **A `useMediaElementState()` reader** no longer re-renders when the active annotation changes, unless it calls `useActiveAnnotation()`.
3. **A `useMediaElementData()` reader of the view fields** (`sampleRate`, `waveHeight`, `samplesPerPixel` and the rest, now on `usePlaylistView()` and `usePlaylistZoom()`; `waveHeight` and the bar fields moved again in [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers)) no longer re-renders when `isReady` or the peaks change. `useMediaElementTrack()` does.
4. **Under `WaveformPlaylistProvider`, a `usePlaylistAnnotations()` reader moved to `useAnnotations()`** no longer re-renders on the Editable and Link-endpoints toggles, unless it calls `useAnnotationEditing()`.
5. **A custom `renderPlayhead` under `MediaElementPlaylistProvider`** is still called on play, pause, stop and every seek. (At this step it was also called on every move of a leftward selection drag; since the next section it is not called while a range is highlighted and playback is stopped or paused, so with a range highlighted only play and a seek during playback call it.)

## One playhead and one progress overlay for both providers; `PlayheadProps` has seven props

The playhead, the played-portion overlay of a channel, the selection highlight and the wrapper that calls a custom `renderPlayhead` exist once and are rendered by both `<Waveform>` / `<PlaylistVisualization>` and `<MediaElementWaveform>` / `<MediaElementPlaylist>`. None of these parts was a public export; what changes for an app is the props a `renderPlayhead` function receives and the things listed under "On screen".

### `PlayheadProps`

A `renderPlayhead` function (and `Playhead`, `PlayheadWithMarker` from `@waveform-playlist/ui-components`) receives the same seven props under either provider:

| Prop | |
| --- | --- |
| `position` | pixels from the left edge, valid while not playing |
| `color` | the theme's `playheadColor` |
| `isPlaying` | |
| `currentTimeRef` | the raw playback position, in seconds |
| `visualTimeRef` | the time to draw the playhead at, in seconds. Always passed now (it was optional, and `MediaElementPlaylistProvider` did not pass it). Under `MediaElementPlaylistProvider` it is the same ref as `currentTimeRef` |
| `samplesPerPixel` | |
| `sampleRate` | |

Five props are removed:

| Removed prop | Replace with |
| --- | --- |
| `getPlaybackTime` | place the playhead from `visualTimeRef.current`; for the raw engine time, `useEngineRefs().getPlaybackTime` (`WaveformPlaylistProvider` only) |
| `getAudioContextTime` | `useEngineRefs().getAudioContextTime` (`WaveformPlaylistProvider` only) |
| `playbackStartTimeRef` | `useEngineRefs().playbackStartTimeRef` (`WaveformPlaylistProvider` only) |
| `audioStartPositionRef` | `useEngineRefs().audioStartPositionRef` (`WaveformPlaylistProvider` only) |
| `controlsOffset` | delete it: it was always `0` |

Under `MediaElementPlaylistProvider` the two refs were placeholders that always held `0`, and the two functions were never passed.

**Find:** in every function or component passed as `renderPlayhead`, the names `getPlaybackTime`, `getAudioContextTime`, `playbackStartTimeRef`, `audioStartPositionRef` and `controlsOffset`.

**Replace with:**

```tsx
// Before
function MyPlayhead({
  isPlaying,
  currentTimeRef,
  getPlaybackTime,
  samplesPerPixel,
  sampleRate,
  controlsOffset = 0,
}) {
  // …in an animation frame while playing:
  const time = isPlaying && getPlaybackTime ? getPlaybackTime() : (currentTimeRef.current ?? 0);
  const x = (time * sampleRate) / samplesPerPixel + controlsOffset;
}

// After
function MyPlayhead({ isPlaying, visualTimeRef, samplesPerPixel, sampleRate }) {
  // …in an animation frame while isPlaying, and after each render while not:
  const x = ((visualTimeRef.current ?? 0) * sampleRate) / samplesPerPixel;
}
```

The props object is a plain object: reading a removed prop gives `undefined`, with no error.

- **A playhead copied from the old `PlayheadWithMarker`** destructures all five removed props: it uses four of them only as a fallback for a missing `visualTimeRef`, and adds `controlsOffset`, which it defaults to `0`. `visualTimeRef` is now always passed, so in plain JavaScript such a copy keeps drawing at the right place; delete the dead branches. TypeScript reports each removed name.
- **A playhead that computes its position from `getPlaybackTime()` or from `getAudioContextTime()` and the two start refs** calls `undefined` ("getPlaybackTime is not a function"), reads a ref that is not there ("Cannot read properties of undefined (reading 'current')"), or, where it adds a `controlsOffset` without a default or uses `?.current` in arithmetic, draws at `NaN` pixels. Use `visualTimeRef`, which under `WaveformPlaylistProvider` is also what keeps the playhead in step with the progress fill (the raw engine time runs ahead of what is heard, by the output latency and the engine's look-ahead).
- A playhead that needs an engine value calls `useEngineRefs()` itself. The function passed as `renderPlayhead` is called inside a component of its own, so it may call hooks, as long as it calls the same hooks on every render; the simplest form is to return your own component, `(props) => <MyPlayhead {...props} />`. State held by a custom playhead is reset each time the playhead is hidden and shown again (see "On screen").
- **`PlayheadWithMarker` rendered by your own code** (not through `renderPlayhead`) must be given `visualTimeRef`. It used to fall back to the other props when it was missing; now it fails with "Cannot read properties of undefined (reading 'current')". `Playhead` reads only `position` and `color` and works without it. TypeScript reports the missing prop on both, and each removed one.

`PlayheadWithMarker` places itself from `visualTimeRef`. `<Waveform renderPlayhead={PlayheadWithMarker} />` and `<MediaElementWaveform renderPlayhead={PlayheadWithMarker} />` need no change.

### On screen

- **`MediaElementPlaylistProvider`: the resting playhead is hidden while a range is highlighted.** Before: the playhead line stayed visible on the left edge of the highlight. Now: with a range selected and playback stopped or paused there is no playhead (default or custom: `renderPlayhead` is not called); it is shown during playback, and again at rest once the selection is collapsed (a click). `WaveformPlaylistProvider` already did this. A custom playhead is unmounted while hidden, so its own state and effects start again when it returns. The default playhead's element, `[data-playhead]`, is absent in that state (your CSS or tests may look for it).
- **`MediaElementPlaylistProvider`: the progress overlay is as wide as the clip.** Before: as wide as the waveform's peak data, which on the example pages was one pixel wider than the clip. Now: the clip's width, as under `WaveformPlaylistProvider`.
- **`WaveformPlaylistProvider`: two visualizations under one provider each animate their playhead.** Before: the default playheads of two `<Waveform>` / `<PlaylistVisualization>` under the same provider registered under one id, so only one of them moved during playback. Now: each has its own.
- **The library's playhead no longer uses the frame-callback id `'playhead'`.** Before: under `WaveformPlaylistProvider` a callback of your own registered as `registerFrameCallback('playhead', …)` and the default playhead replaced each other, because the registry keeps one callback per id. Now: the default playhead registers under a generated id, and yours is left alone.
- **`AudioPosition` no longer uses the frame-callback id `'audio-position'`** (either provider). Before: two `<AudioPosition />` under one provider replaced each other's callback, so one stood still during playback, and a callback of your own registered as `registerFrameCallback('audio-position', …)` and the readout replaced or removed each other. Now: each readout registers under a generated id.
- **`WaveformPlaylistProvider`: `getAnnotationBoxLabel` is called less often.** Before: for every annotation on every render of the view. Now: when the row of boxes itself renders, which is when the annotations change (also on each move of an edge drag), the active annotation, the editable, link-endpoints or continuous-play setting, the zoom, the view settings or the width of the timeline change, or when the function itself is a new one. It matters only for a label function that reads something else that changes; pass a new function when the labels should change.
- **`WaveformPlaylistProvider`: a custom `renderPlayhead` is called less often.** Before: on every render of the view, so also on every timeline change (a clip operation, each pointer move of a trim), track selection and reorder drag-over. Now: on play, pause and stop, a seek, a selection change, a zoom, a view-setting or theme change, and when the component that renders `<Waveform>` re-renders (and, as before, not while a range is highlighted at rest). Also gone: the extra call on the release of a click on the tracks (the press still moves the cursor, so it still calls it once), the calls on a spectrogram setting, a container resize with `fillViewport` and a step of the recording layout. If that component holds the tracks in its state (as in the examples), it re-renders with them and you will see no difference. A playhead that must follow something else should read it with the hook for it.
- **`WaveformPlaylistProvider`: the background of a selected track falls back to the unselected colour** when the theme's `selectedWaveFillColor` (or, in `'normal'` draw mode, `selectedWaveOutlineColor`) is explicitly `undefined` or empty. Before: no background colour. The bars drawn on the canvas do not fall back. Under `MediaElementPlaylistProvider` this was already so. A theme that leaves the key out gets the default theme's value and is not affected.

### What renders when

- Under `MediaElementPlaylistProvider`, a custom `renderPlayhead` is not called at all while a range is highlighted at rest, and one small extra component (the playhead overlay) renders per pointer move of a rightward selection drag and whenever the waveform shell renders (play, pause, stop, a click).
- Under `WaveformPlaylistProvider` the selection highlight no longer renders when the visualization around it does (play, pause); it renders when the selection, the zoom, the theme or a view setting (`usePlaylistView()`) changes.

## During playback, a press on the waveform waits for the release, and a drag selects a range

**Packages:** `@waveform-playlist/browser`. Both providers.

Nothing is committed while the mouse button is down during playback. In the last release a press under `WaveformPlaylistProvider` moved playback at once and the release moved it there a second time, a press under `MediaElementPlaylistProvider` moved it on the release, and under both a drag made while playing selected nothing.

What the release does now depends on automatic scroll (the provider's `automaticScroll` prop, `setAutomaticScroll`, `<AutomaticScrollCheckbox />`):

| During playback | Automatic scroll off | Automatic scroll on |
| --- | --- | --- |
| Press | nothing changes; under `WaveformPlaylistProvider` the track under the pointer is still selected | the same |
| Drag | once it is at least 0.1 s long, the range is highlighted as it is drawn, in place of the current selection's highlight (only in the view being dragged, when two views share a provider); playback carries on undisturbed | nothing is drawn |
| Release after a drag | the range becomes the selection and is played from its start to its end; playback stops there and the cursor returns to the start of the range. Under `WaveformPlaylistProvider` with looping on, playback carries on open-ended from the range's start instead (`MediaElementPlaylistProvider` has no loop) | playback moves to where the press landed and carries on: the same as a click |
| Release after a click (a range shorter than 0.1 s) | playback moves to where the press landed and carries on | the same |
| The window loses focus before the release | the drawn range is dropped; the selection and playback are untouched | nothing happens |

With automatic scroll on, the waveform scrolls to keep the playhead in sight, so the audio moves under a still pointer and the position under it at the release is not the one that was pressed. That is why no range can be drawn there.

While playback is stopped nothing changes: the selection follows the pointer on every move.

**Find:** nothing in code. Check anything that relies on the old timing:

- A test or a script that presses on the waveform during playback and expects playback to have moved before the release.
- `useSelection()` readers (`SelectionTimeInputs`, your own): during a drag made while playing, `selectionStart` / `selectionEnd` keep the OLD selection until the release. Only the highlight shows the range being drawn. `SetLoopRegionButton` (`WaveformPlaylistProvider`) acts on the old selection until then.
- A press during playback no longer changes `currentTime` or restarts playback. The release does both, once, through `setSelection`: the engine or the player is restarted, and the `play()` of `usePlaybackControls()` is not called.

Four things that follow from it:

- **A press made while playing whose release comes after playback has stopped** (it reached its end, or Stop was pressed) follows the stopped rules at the release. With the pointer less than 0.1 s from where it was pressed, it is a click at the pressed position: the cursor moves there and the selection collapses. Further away, the range from the press to the release becomes the selection and is not played.
- **Playback started (with the keyboard) under a drag that began while stopped** follows the playing rules at the release: the range is played, or, with automatic scroll on, playback moves to where the press landed and the range drawn so far is given up.
- **Automatic scroll switched on under a drag that has already drawn a range** withdraws the drawing at the next move; the release moves playback to where the press landed.
- **`useEngineRefs()`: `playbackStartTimeRef` and `audioStartPositionRef` are now also written by the restart `setSelection` does during playback.** `play()`, the resume after an engine rebuild and the continuous-play reschedule already wrote them (a loop wrap is not a restart and does not). Before, after `setSelection(start, end)` during playback (from `SelectionTimeInputs`, or your own code) they still described the play that had been replaced, and a readout computed from them kept counting from the old start. Nothing to change in your code.

**To let listeners select a range while a recording plays,** leave automatic scroll off, or give them `<AutomaticScrollCheckbox />` to switch it off.

## MediaElement player: the waveform is built from the parts of the multitrack view

**Packages:** `@waveform-playlist/browser`. `MediaElementPlaylistProvider` only; nothing changes under `WaveformPlaylistProvider`.

`<MediaElementWaveform>` and `<MediaElementPlaylist>` keep their props. Inside, the waveform is now drawn by the same components as `<Waveform>` (one row of tracks, the timescale, the selection highlight, the playhead), so its markup and a few details follow the multitrack view. No export is added or removed.

| | Before | Now |
| --- | --- | --- |
| `className` | reached an element only when the peak data could not be read (see that row below) | is on the playlist's outermost element, as for `<Waveform>` |
| `theme.playlistBackgroundColor` | ignored; the background was always `waveOutlineColor` | used when set; `waveOutlineColor` otherwise |
| `data-playlist-state` | absent | on the outermost element, and always `"ready"`: the waveform is drawn from the first render and does not wait for the player. Whether the player has loaded its media is `useMediaElementTrack().isReady`, as before |
| The track's row | the track's element was a direct child of the tracks container | one `[data-track-row]` element with `data-track-id="media-element-track-0"`, `data-track-kind="audio"` and `data-selected="true"` (the one track is always drawn in the selected colours, as before), inside a positioning container: two more `div`s around the track. The row is positioned absolutely inside that container, which has the row's height |
| Fades (`showFades`) | the fade-out curve was placed from the length of the peak data | placed from the clip's width, so it ends where the clip ends: up to one pixel further left |
| `useMediaElementTrack().peaksDataArray` | the one clip had no fades | the one clip carries the track's `fadeIn` / `fadeOut` (`peaksDataArray[0][0].fadeIn`). The array is a new one when the fades or the name change; the peaks inside (`peaksDataArray[0][0].peaks`) keep their identity then. The fades are compared by value (`duration`, `type`), so a fade written inline (`fadeIn: { duration: 1 }` in a `track` object that is built on every render) changes nothing while its values are the same |
| The provider's `controls` prop with `show: true` | an empty column of that width to the left of the waveform | no column: there are no track controls for this player. (The prop itself is removed in [the next entry](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed).) |
| Peak data that cannot be read (the provider logs a warning) | the text "Loading waveform..." in a `div`, for good | the track's row, empty: as long as the audio and one `waveHeight` tall, under the timescale when there is one. `useMediaElementTrack().peaksDataArray` is still `[]` |
| A custom `renderPlayhead` | also called on every press and release on the waveform and when the player became ready | called on play, pause and stop, a seek, a selection change, a view-setting, zoom or theme change, and when the component that renders `<MediaElementWaveform>` re-renders (and, as before, not while a range is highlighted at rest) |
| `getAnnotationBoxLabel` | also called for every annotation on every press and release on the waveform, on play, pause and stop, and when the player became ready | called when the row of boxes itself renders: when the annotations (also each move of an edge drag), the active annotation, the view settings, the zoom or the length of the timeline change, or when one of `getAnnotationBoxLabel`, `editable`, `linkEndpoints`, `onAnnotationUpdate` is a new value |

**Find:** nothing in code. Check:

- CSS or tests that reach the waveform by its position in the markup (a child or sibling selector from the scroll container down to the clip). Use the attributes: `[data-playlist-state]`, `[data-scroll-container]`, `[data-track-row]`, `[data-clip-container]`.
- A test can wait for `[data-playlist-state="ready"]` to know the view is mounted (when the peak data cannot be read it is `"ready"` over an empty row). It does not mean the player has loaded: use `useMediaElementTrack().isReady` or the provider's `onReady` for that. CSS for `[data-playlist-state="loading"]` never applies to this player.
- CSS or tests written for the multitrack view now match this player too. `[data-track-row]`, `[data-track-kind]` and `[data-selected="true"]` match its one row, always (a rule that highlights the selected row highlights it permanently); `[data-playlist-state]` and `[data-playlist-state="ready"]` match its root from the first render (never `"loading"`), so a count of playlists on a page with both kinds of player goes up; `[data-track-id="media-element-track-0"]` matches three elements (the row, the track, the clip), was two (the row and the track when the peak data cannot be read).
- When the peak data cannot be read, everything but the waveform is still there and works over the empty row: the annotation boxes, the selection highlight, the playhead, and a click or a drag on the row.
- A layout that relied on the empty controls column for a left margin: give the element around the waveform that margin.
- A `renderPlayhead` or `getAnnotationBoxLabel` that reads something that changes without any of the things listed: read it with the hook for it (the playhead function may call hooks), or pass a new function when it changes.

**What renders when:** inside another provider, the track's row now follows an outer `SpectrogramProvider` (it renders when that provider's value changes; nothing drawn differs). A press, a release, play, pause, stop and the player becoming ready no longer render the track, its clip and its channels. The frame around them renders, and the parts that follow that state themselves: the playhead and the progress overlay on play, pause and stop. Per pointer move of a selection drag nothing changes.

## The view is composed from parts; the show and render props and the providers' `timescale` and `controls` are removed

**Packages:** `@waveform-playlist/browser`. Both providers.

What the view draws is no longer switched by props on `<Waveform>` and on the provider. Each thing that is drawn is a component, a **part**, and it is drawn because you render it inside a **root**:

```tsx
import {
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformClipHeaders,
  WaveformFades,
  WaveformAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
  PlaylistAnnotationList,
} from '@waveform-playlist/browser';

<WaveformRoot className="my-playlist">
  <WaveformTimescale renderTick={renderTick} />
  <WaveformLoopRegion />
  <WaveformTrackControls width={180} />
  <WaveformTracks gainScaled>
    <WaveformClipHeaders />
    <WaveformFades />
  </WaveformTracks>
  <WaveformAnnotationBoxes />
  <WaveformSelection />
  <WaveformPlayhead renderPlayhead={renderPlayhead} />
</WaveformRoot>
<PlaylistAnnotationList />
```

| Part | Draws | Options | Provider |
| --- | --- | --- | --- |
| `WaveformRoot` | the frame: the scrolling area, and the places the parts go to | `className` | `WaveformPlaylistProvider` |
| `MediaElementWaveformRoot` | the same for the MediaElement player | `className` | `MediaElementPlaylistProvider` |
| `WaveformTimescale` | the time ruler, in a strip above the tracks | `renderTick` | either |
| `WaveformLoopRegion` | the draggable loop region, in the same strip | none | `WaveformPlaylistProvider` |
| `WaveformTrackControls` | the column of track controls, left of the scrolling area | `width` (pixels, default 200); children: the panel of one track (see [track controls are composed from pieces](#track-controls-are-composed-from-pieces-bound-to-a-track-the-mixer-setters-take-a-track-id), which removed the `renderTrackControls`, `onRemoveTrack` and `trackReordering` options this part had at first) | `WaveformPlaylistProvider` |
| `WaveformTracks` | the track rows with their clips | `gainScaled`; children: the three below | either |
| `WaveformClipHeaders` | a header on every clip; inside a `ClipInteractionProvider` it is what a clip is dragged by, and the trim handles come with it | none | either (under the MediaElement provider the header shows the track's `name`, or "Track" without one; nothing there supports dragging the clip, so leave clip interaction off above that provider) |
| `WaveformFades` | each clip's fade-in and fade-out curves | none | either |
| `WaveformRecordingPreview` | the take being recorded, in its track | `recordingState` | `WaveformPlaylistProvider` |
| `WaveformAnnotationBoxes` | the row of annotation boxes | `getAnnotationBoxLabel` | `WaveformPlaylistProvider` |
| `MediaElementAnnotationBoxes` | the same for the MediaElement player, with its edge drag | `getAnnotationBoxLabel`, `editable`, `linkEndpoints`, `onAnnotationUpdate` | `MediaElementPlaylistProvider` |
| `WaveformSelection` | the highlighted selection | none | either |
| `WaveformPlayhead` | the playhead | `renderPlayhead` | either |

Three compositions are ready-made. They take `className` and the annotation options they took before, and nothing else:

| Component | Is |
| --- | --- |
| `<Waveform />` | timescale, loop region, track controls (200 px), tracks, annotation boxes, selection, playhead; the annotation text list below when there are annotations |
| `<WaveformEditor />` | `<Waveform />` with `<WaveformClipHeaders />` and `<WaveformFades />` in its tracks |
| `<MediaElementWaveform />` | timescale, the track, annotation boxes, selection, playhead; the annotation text list below when there are annotations |

For anything else (a part left out, an option on a part, a narrower column, your own element among the parts) write the composition yourself. The children of a root that are not parts are drawn in the scrolling tracks area, in the order you wrote them.

### Removed

| Removed | Was on |
| --- | --- |
| `showClipHeaders`, `showFades`, `gainScaledWaveforms`, `trackReordering`, `onRemoveTrack`, `recordingState`, `renderTrackControls`, `renderTick`, `renderPlayhead` | `<Waveform>` |
| `renderPlayhead`, `showFades` | `<MediaElementWaveform>` |
| `timescale`, `controls` | `<WaveformPlaylistProvider>`, `<MediaElementPlaylistProvider>` |
| `timeScaleHeight`, `controls` | the value of `usePlaylistView()` |
| `PlaylistVisualization`, `PlaylistVisualizationProps` | exports |
| `MediaElementPlaylist`, `MediaElementPlaylistProps` | exports |

A removed prop that is still passed is ignored (TypeScript reports it; plain JavaScript does not): no headers and so no drag handles for a leftover `showClipHeaders`, no close button for `onRemoveTrack`, the default panel for `renderTrackControls`, no grip for `trackReordering`, no preview for `recordingState`, the default playhead for `renderPlayhead`. A leftover read of `usePlaylistView().controls` is `undefined`, so `usePlaylistView().controls.show` throws a `TypeError`.

### Find and replace

Decide per `<Waveform>` (or `<MediaElementWaveform>`) from the props it has and from the two props of the provider above it.

**1. The provider.** Delete `timescale` and `controls` from `<WaveformPlaylistProvider>` and `<MediaElementPlaylistProvider>`, and remember what they were.

**2. `<Waveform>` with none of the removed props**, under a provider that had `timescale` and `controls={{ show: true, width: 200 }}`: keep `<Waveform />`.

**3. `<Waveform showClipHeaders />` and nothing else removed**, under the same provider: `<WaveformEditor />`. It also draws fade curves for clips that have a `fadeIn` or `fadeOut`, which `<Waveform showClipHeaders />` did not (`showFades` was off). To keep them undrawn, use step 4 with `<WaveformClipHeaders />` alone.

**4. Every other `<Waveform>`:** write the composition. Start from this, which is what `<Waveform />` renders:

```tsx
<WaveformRoot className={className}>
  <WaveformTimescale />
  <WaveformLoopRegion />
  <WaveformTrackControls />
  <WaveformTracks />
  <WaveformAnnotationBoxes getAnnotationBoxLabel={getAnnotationBoxLabel} />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
<PlaylistAnnotationList
  height={annotationTextHeight}
  controls={annotationControls}
  annotationListConfig={annotationListConfig}
  renderAnnotationItem={renderAnnotationItem}
  scrollActivePosition={scrollActivePosition}
  scrollActiveContainer={scrollActiveContainer}
/>
```

then apply each row that matches. The two annotation elements belong to a playlist with annotations: `<PlaylistAnnotationList>` throws without the `AnnotationProvider` of `@waveform-playlist/annotations`, and it renders its (empty) list when there are no annotations, where `<Waveform />` leaves the list out. Without annotations delete both elements; to keep the list conditional, render it when `useAnnotations().annotations.length > 0`.

| Was | Becomes |
| --- | --- |
| the provider had no `timescale` | delete `<WaveformTimescale />` and `<WaveformLoopRegion />` |
| the provider had no `controls`, or `controls.show` was `false` | delete `<WaveformTrackControls />` |
| `controls={{ show: true, width: N }}`, N not 200 | `<WaveformTrackControls width={N} />` |
| `renderTick={f}` | `<WaveformTimescale renderTick={f} />` |
| `renderTrackControls={f}` | the panel as children of `<WaveformTrackControls>`: step 3 of [the next entry](#track-controls-are-composed-from-pieces-bound-to-a-track-the-mixer-setters-take-a-track-id) |
| `onRemoveTrack={f}` | `<WaveformTrackControls><DefaultTrackControls /><TrackRemoveButton onRemove={f} /></WaveformTrackControls>`; `f` gets the track id (step 2 of the next entry) |
| `trackReordering` | `<WaveformTrackControls><DefaultTrackControls /><TrackReorderGrip /></WaveformTrackControls>` (step 1 of the next entry) |
| `gainScaledWaveforms` | `<WaveformTracks gainScaled>` |
| `showClipHeaders` | `<WaveformClipHeaders />` as a child of `<WaveformTracks>` |
| `showFades` | `<WaveformFades />` as a child of `<WaveformTracks>` |
| `showClipHeaders={flag}` (a variable) | `<WaveformTracks>{flag ? <WaveformClipHeaders /> : null}</WaveformTracks>` |
| `renderPlayhead={f}` | `<WaveformPlayhead renderPlayhead={f} />` |
| `recordingState={state}` | `<WaveformTracks>{state ? <WaveformRecordingPreview recordingState={state} /> : null}</WaveformTracks>`, **and** `useRecordingSession` (below) |
| `<PlaylistVisualization …props />` | the same composition without `<PlaylistAnnotationList>` |

**5. `<MediaElementWaveform>`** with neither removed prop, under a provider that had `timescale`: keep it. Otherwise write the composition, which is what `<MediaElementWaveform />` renders:

```tsx
<MediaElementWaveformRoot className={className}>
  <WaveformTimescale />
  <WaveformTracks />
  <MediaElementAnnotationBoxes
    getAnnotationBoxLabel={getAnnotationBoxLabel}
    editable={editable}
    linkEndpoints={linkEndpoints}
    onAnnotationUpdate={onAnnotationUpdate}
  />
  <WaveformSelection />
  <WaveformPlayhead />
</MediaElementWaveformRoot>
<MediaElementAnnotationList
  height={annotationTextHeight}
  renderAnnotationItem={renderAnnotationItem}
  editable={editable}
  onAnnotationUpdate={onAnnotationUpdate}
  annotationListConfig={{ linkEndpoints, continuousPlay: false }}
  scrollActivePosition={scrollActivePosition}
  scrollActiveContainer={scrollActiveContainer}
/>
```

| Was | Becomes |
| --- | --- |
| the provider had no `timescale` | delete `<WaveformTimescale />` |
| `showFades` | `<WaveformTracks><WaveformFades /></WaveformTracks>` |
| `renderPlayhead={f}` | `<WaveformPlayhead renderPlayhead={f} />` |
| `<MediaElementPlaylist …props />` | the same composition without `<MediaElementAnnotationList>` |

The same holds for the two annotation elements here: without annotations delete both, or render `<MediaElementAnnotationList>` when `useAnnotations().annotations.length > 0`, as `<MediaElementWaveform />` does.

**6. A recording.** The view used to tell the provider that a take was running: for as long as `recordingState.isRecording` was true, the provider kept playback running past the end of the audio and muted what the armed track already held. `<WaveformRecordingPreview>` only draws the take. Call the hook in the component that calls `useIntegratedRecording` (it must be under `WaveformPlaylistProvider`):

```tsx
import { useRecordingSession } from '@waveform-playlist/browser';

const { isRecording, recordingTrackId } = useIntegratedRecording(/* … */);
useRecordingSession({ isRecording, trackId: recordingTrackId });
```

Without it a punch-in plays the armed track's old audio under the take, and a take on an empty timeline stops playback at once. The type of the `recordingState` prop is exported as `WaveformRecordingState`.

**7. `usePlaylistView()`.** Search for `controls` and `timeScaleHeight` next to `usePlaylistView()` (also a destructuring: `const { sampleRate, controls } = usePlaylistView()`), and replace each read. The fields are `undefined` now, so `controls.show` throws at the moment the code runs, which may be inside an effect or a handler and not on first render.

- The width of the controls column is the `width` you gave `<WaveformTrackControls>` (200 without one). Code that needs the number (scroll arithmetic, a layout beside the playlist) keeps it in a constant and passes the same constant to the part:

  ```tsx
  const TRACK_CONTROLS_WIDTH = 200;

  <WaveformTrackControls width={TRACK_CONTROLS_WIDTH} />;
  // was: const controlWidth = controls.show ? controls.width : 0;
  const controlWidth = TRACK_CONTROLS_WIDTH;
  ```

- The ruler's strip is 30 px tall when a root has a `<WaveformTimescale>` or a `<WaveformLoopRegion>`, and absent otherwise.

### Where a part must be

The root recognises a part by the type of the element, and so does `<WaveformTracks>` for its three children. Therefore:

- A part must be a child of its root, or of a fragment in it. A part **wrapped in your own component** is not recognised: a wrapped `<WaveformTimescale>` or `<WaveformTrackControls>` is drawn in the tracks area, a wrapped `<WaveformClipHeaders>` does nothing. Wrap the whole root in your component, not a part.
- `<WaveformClipHeaders>`, `<WaveformFades>` and `<WaveformRecordingPreview>` are children of `<WaveformTracks>` and draw nothing anywhere else. `<WaveformTracks>` renders no other child.
- One `<WaveformTracks>` per root, and it must be the root's own child (not wrapped): the root reads the clip headers from it for the row heights, and the recording preview for the length of the timeline during a take. Text among its children is dropped without a warning.
- `<WaveformTrackControls width>` must be a positive number: with `0`, a negative number or `NaN` no column is drawn. One `<WaveformTrackControls>` per root: a second one draws a second panel for every track in the same column.
- Each root throws under the other provider (`useEditorControls needs WaveformPlaylistProvider, …` for `<WaveformRoot>`, `useMediaElementTrack needs MediaElementPlaylistProvider, …` for `<MediaElementWaveformRoot>`).
- `<WaveformLoopRegion>`, `<WaveformTrackControls>`, `<WaveformRecordingPreview>` and `<WaveformAnnotationBoxes>` need `WaveformPlaylistProvider`. Under `MediaElementPlaylistProvider` the loop region throws (`useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it`) and so do the annotation boxes (the same message for `useAnnotationEditing`); the track controls draw nothing as a child of the root, and throw the same kind of message when they are wrapped in a component and so rendered among the tracks; the recording preview throws once a take runs into the player's track.
- `<MediaElementAnnotationBoxes>` is for `MediaElementPlaylistProvider`. Under `WaveformPlaylistProvider` it draws, but an edge can be dragged past the end of the audio to the end of the drawn timeline: use `<WaveformAnnotationBoxes>` there.
- `<WaveformTimescale>`, `<WaveformTracks>`, `<WaveformLoopRegion>`, `<WaveformTrackControls>` and both annotation rows throw outside a root (`The timescale must be rendered inside the waveform root`). `<WaveformSelection>` and `<WaveformPlayhead>` draw wherever they are rendered under a provider; they are positioned for the tracks area.
- Switching a part on and off: write `{flag ? <Part /> : null}` (or `flag && <Part />`). The parts after it then keep their state. A list whose length changes (`parts.filter(Boolean)`) remounts the parts after the one that went, unless they have keys.
- Two roots under one provider both draw the playlist, each with its own playhead and selection drag; automatic scroll follows the root that mounted last.

In development a part that is not where it can work says so once in the console (`[waveform-playlist] <WaveformTimescale> is drawn among the tracks…`). It does not throw.

### What changes on screen

| | Before | Now |
| --- | --- | --- |
| `<Waveform />` under a provider without `timescale` | no ruler | a ruler (and the loop region in its strip while looping is on) |
| `<Waveform />` under a provider without `controls`, or with `show: false` | no controls column | a 200 px controls column |
| `<Waveform />` under a provider with `controls.width` other than 200 | a column of that width | 200 px |
| `<MediaElementWaveform />` under a provider without `timescale` | no ruler | a ruler |
| `<WaveformEditor />` where `<Waveform showClipHeaders />` was, with clips that have fades | no fade curves | the fade curves are drawn |
| `usePlaylistInfo()` of `@waveform-playlist/ui-components`, read inside a root: `controls` (removed in [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers)), `timeScaleHeight` | what the provider's `controls` and `timescale` props said | worked out from the parts: `{ show: true, width }` of the controls part, or `{ show: false, width: 0 }` without one or with a width that is not positive (always under the MediaElement provider), and 30 or 0 |
| `useMediaElementTrack().fadeIn` / `.fadeOut` | the object of the latest `track` prop | the first object seen while `duration` and `type` are the same, so the hook's value no longer changes on every render of a parent that writes the fade inline |
| A composition with `<WaveformLoopRegion />` and no `<WaveformTimescale />` | (not possible) | the 30 px strip is there for the loop region alone |
| `<WaveformTimescale>` switched off and on beside a `<WaveformLoopRegion>` | (not possible) | the loop region stays mounted |
| A take being recorded, without `useRecordingSession` | the armed track was muted for the take, and playback ran past the end of the audio | neither |
| A fade written inline on a MediaElement `track` that is built on every render | the player was disposed and created again on every render of the provider's parent (playback stopped, the media loaded again) | compared by value: nothing happens while `duration` and `type` are the same |
| A render of the component that renders `<Waveform />`, `<WaveformEditor />` or `<MediaElementWaveform />` | rendered the tracks part (not its rows) | does not: the composition hands the root the same elements each time |

### What to check after the replacement

- Every page that had no ruler or no controls column and still renders `<Waveform />` or `<MediaElementWaveform />`: it has them now.
- A recording: mute state of the armed track during a take, and that playback continues on an empty timeline.
- Code that wrapped `<Waveform>` to add its own props for the removed ones: it can render the composition directly.

## Track controls are composed from pieces bound to a track; the mixer setters take a track id

**Packages:** `@waveform-playlist/browser`. `WaveformPlaylistProvider` only.

Apply this entry after the one above: it replaces the three options that entry put on `<WaveformTrackControls>` (#687).

The control panel of a track is no longer described by props of `<WaveformTrackControls>`. The **children** of the part are the panel of ONE track. The part renders them once per track, each copy inside that track's context, and a component in the panel reads its track with `useTrack()`. The built-in pieces do that already and take no prop for the track:

```tsx
import {
  WaveformTrackControls,
  DefaultTrackControls,
  TrackRemoveButton,
  TrackReorderGrip,
} from '@waveform-playlist/browser';

// The default panel, with a remove button and a reorder grip
<WaveformTrackControls width={200}>
  <DefaultTrackControls />
  <TrackRemoveButton onRemove={removeTrack} />
  <TrackReorderGrip />
</WaveformTrackControls>
```

`<WaveformTrackControls />` without children draws `<DefaultTrackControls />`, as before. Its props are now `width` and `children`.

At the same time the four mixer setters of `useEditorControls()` take a track **id** where they took an index, and the provider keeps mixer state (mute, solo, volume, pan) by track id.

### New exports

| Export | Is |
| --- | --- |
| `useTrack()` | the track whose panel the calling component is part of: `id`, `kind`, `index`, `name`, `muted`, `soloed`, `volume`, `pan`, `renderMode`, `isLoading`, `isSelected`, `isFirst`, `isLast`, `hasSpectrogram`, and the actions `setMuted`, `setSoloed`, `setVolume`, `setPan`, `select`, `moveUp`, `moveDown`, `setRenderMode`, `openSpectrogramSettings`. Type: `TrackContextValue` |
| `<DefaultTrackControls>` | the default panel: name, track menu, mute, solo, volume, pan. Its `children` are drawn inside the panel, below the pan slider. Type: `DefaultTrackControlsProps` |
| `<TrackName />` | the track's name on one line |
| `<TrackMuteButton />`, `<TrackSoloButton />` | the two toggle buttons |
| `<TrackVolumeSlider />`, `<TrackPanSlider />` | the two sliders (0 to 1, and -1 to 1) |
| `<TrackMenuButton />` | the track menu (render mode, spectrogram settings); draws nothing without a `SpectrogramProvider` and nothing for a MIDI track |
| `<TrackRemoveButton onRemove>` | a close button at the top left of the track's slot. Type: `TrackRemoveButtonProps` |
| `<TrackReorderGrip />` | a drag grip with move-up and move-down buttons at the right edge of the slot |
| `useTrackReorderHandle()` | `{ handleRef, isDragSource }` for a drag grip of your own. Type: `TrackReorderHandle` |

All of them work only among the children of `<WaveformTrackControls>`.

### Removed

| Removed | Replacement |
| --- | --- |
| `renderTrackControls` prop of `<WaveformTrackControls>` | the panel as children; a component in it calls `useTrack()` |
| `onRemoveTrack` prop | `<TrackRemoveButton onRemove={f} />` among the children. `f` gets the track **id**, not the index |
| `trackReordering` prop | `<TrackReorderGrip />` among the children |
| `SortableTrackControls`, `SortableTrackControlsProps`, `SortableTrackControlsRenderProps` | `<TrackReorderGrip />`, or `useTrackReorderHandle()` for your own grip element |
| `setTrackMute(trackIndex, muted)`, `setTrackSolo(trackIndex, soloed)`, `setTrackVolume(trackIndex, volume)`, `setTrackPan(trackIndex, pan)` | the same names with a track id: `setTrackMute(trackId, muted)` and so on; inside a panel, `useTrack().setMuted(muted)` and so on |

Nothing throws for a removed name. A removed prop that is still passed in plain JavaScript is ignored: the part draws the default panel, with no remove button and no grip. A setter called with an index does nothing (see the behaviour table). An import of `SortableTrackControls` is `undefined` (or fails when the module is linked, in native ES modules). TypeScript reports all of them.

### Find and replace

**Find:** `renderTrackControls`, `onRemoveTrack`, `trackReordering`, `SortableTrackControls`, `setTrackMute(`, `setTrackSolo(`, `setTrackVolume(`, `setTrackPan(`, `trackStates`, `trackReorderEpoch`.

**1. `trackReordering`**

```tsx
// Before
<WaveformTrackControls trackReordering />

// After
<WaveformTrackControls>
  <DefaultTrackControls />
  <TrackReorderGrip />
</WaveformTrackControls>
```

The move buttons work with no other setup. Dragging by the grip needs a `ClipInteractionProvider` above the view, as before.

**2. `onRemoveTrack`**

```tsx
// Before: the callback got the index
const removeTrack = useCallback((trackIndex: number) => {
  setTracks((prev) => prev.filter((_, i) => i !== trackIndex));
}, []);

<WaveformTrackControls onRemoveTrack={removeTrack} />

// After: the callback gets the id
const removeTrack = useCallback((trackId: string) => {
  setTracks((prev) => prev.filter((track) => track.id !== trackId));
}, []);

<WaveformTrackControls>
  <DefaultTrackControls />
  <TrackRemoveButton onRemove={removeTrack} />
</WaveformTrackControls>
```

**3. A `renderTrackControls` panel**

```tsx
// Before
import { Button, ButtonGroup, Controls, Header } from '@waveform-playlist/ui-components';

function MyTrackPanel({ trackIndex }: { trackIndex: number }) {
  const { trackStates } = usePlaylistMixer();
  const { setTrackMute, setTrackVolume } = useEditorControls();
  const state = trackStates[trackIndex];
  if (!state) return null;
  return (
    <Controls>
      <Header>{state.name || `Track ${trackIndex + 1}`}</Header>
      <ButtonGroup>
        <Button onClick={() => setTrackMute(trackIndex, !state.muted)}>
          {state.muted ? 'Unmute' : 'Mute'}
        </Button>
      </ButtonGroup>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={state.volume}
        onChange={(e) => setTrackVolume(trackIndex, parseFloat(e.target.value))}
      />
    </Controls>
  );
}

<WaveformTrackControls
  width={180}
  renderTrackControls={(trackIndex) => <MyTrackPanel trackIndex={trackIndex} />}
/>
```

```tsx
// After
import { WaveformTrackControls, useTrack } from '@waveform-playlist/browser';
import { Button, ButtonGroup, Controls, Header } from '@waveform-playlist/ui-components';

function MyTrackPanel() {
  const { name, muted, volume, isLoading, setMuted, setVolume } = useTrack();
  return (
    <Controls>
      <Header>{name}</Header>
      <ButtonGroup>
        <Button disabled={isLoading} onClick={() => setMuted(!muted)}>
          {muted ? 'Unmute' : 'Mute'}
        </Button>
      </ButtonGroup>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        disabled={isLoading}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
      />
    </Controls>
  );
}

<WaveformTrackControls width={180}>
  <MyTrackPanel />
</WaveformTrackControls>
```

`useTrack()` always returns a value: `name` is "Track N" (N is the position, from 1) for a track without a name, and while the track is loading `isLoading` is true and `muted`, `soloed`, `volume` and `pan` are `false`, `false`, `1` and `0`. A panel that returned `null` for a missing `trackStates[trackIndex]` can return `null` for `isLoading`. The props a panel took from the closure of `renderTrackControls` (a callback, a manager object) are props of the element among the children now; keep them stable (see the behaviour table).

Where the panel was the default one rebuilt by hand with one change, compose it from the pieces:

```tsx
import {
  WaveformTrackControls,
  TrackName,
  TrackMuteButton,
  TrackSoloButton,
  TrackVolumeSlider,
} from '@waveform-playlist/browser';
import { ButtonGroup, Controls, Header } from '@waveform-playlist/ui-components';

// The default panel without the pan slider
<WaveformTrackControls>
  <Controls>
    <Header style={{ justifyContent: 'center' }}>
      <TrackName />
    </Header>
    <ButtonGroup>
      <TrackMuteButton />
      <TrackSoloButton />
    </ButtonGroup>
    <TrackVolumeSlider />
  </Controls>
</WaveformTrackControls>
```

**4. The default panel plus one control of your own**

```tsx
// Before: the whole default panel copied into renderTrackControls, with one more element

// After
function TrackColorDot() {
  const { id } = useTrack();
  return <span className="track-dot" data-track={id} />;
}

<WaveformTrackControls>
  <DefaultTrackControls>
    <TrackColorDot />
  </DefaultTrackControls>
</WaveformTrackControls>
```

The children of `<DefaultTrackControls>` are drawn inside the panel, below the pan slider. An element written BESIDE `<DefaultTrackControls />` is outside the panel, and the panel fills the slot, so that element is below the visible area unless it positions itself (`position: absolute`), as `<TrackRemoveButton>` and `<TrackReorderGrip>` do.

**5. A mixer setter called outside a panel**

```tsx
// Before
const { setTrackMute, setTrackVolume } = useEditorControls();
setTrackMute(0, true);
tracks.forEach((_, i) => setTrackVolume(i, 0.8));

// After
const { tracks } = usePlaylistTimeline();
const { setTrackMute, setTrackVolume } = useEditorControls();
setTrackMute(tracks[0].id, true);
tracks.forEach((track) => setTrackVolume(track.id, 0.8));
```

Replace every `setTrackMute(i, v)`, `setTrackSolo(i, v)`, `setTrackVolume(i, v)` and `setTrackPan(i, v)` with the id of that track, `tracks[i].id`. `tracks` is your own state or `usePlaylistTimeline().tracks`. `usePlaylistMixer().trackStates` stays an array in the order of `tracks`, so `trackStates[i]` still belongs to `tracks[i]`.

**6. `SortableTrackControls`**

```tsx
// Before
function MyPanel({ trackIndex }: { trackIndex: number }) {
  const { tracks } = usePlaylistTimeline();
  const { trackReorderEpoch } = useTrackReorderPreview();
  const track = tracks[trackIndex];
  return (
    <SortableTrackControls
      key={`${track.id}-${trackReorderEpoch}`}
      trackId={track.id}
      index={trackIndex}
    >
      {({ ref, handleRef, isDragSource }) => (
        <div ref={ref} style={{ opacity: isDragSource ? 0.9 : 1 }}>
          <button ref={handleRef} aria-label="Drag to reorder">⠿</button>
          {/* the rest of the panel */}
        </div>
      )}
    </SortableTrackControls>
  );
}

// After, with the built-in grip
<WaveformTrackControls>
  <MyPanel />
  <TrackReorderGrip />
</WaveformTrackControls>

// After, with your own grip element
function MyGrip() {
  const { handleRef, isDragSource } = useTrackReorderHandle();
  return (
    <button
      ref={handleRef}
      aria-label="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
      style={{ opacity: isDragSource ? 0.6 : 1 }}
    >
      ⠿
    </button>
  );
}

<WaveformTrackControls>
  <MyPanel />
  <MyGrip />
</WaveformTrackControls>
```

There is no `ref` for the item any more: the element that moves is the slot the part draws around the panel, not an element of yours, and the part draws it lifted (opaque, with a shadow) while it is dragged. Delete the `key` with `trackReorderEpoch`: the part keys its slots itself, and it did so before as well, so that key was never needed. Call `useTrackReorderHandle()` once per panel (so not together with `<TrackReorderGrip />`). In the example `MyGrip` is written beside `MyPanel`: when the panel fills the slot (`height: 100%`), a grip beside it is below the visible area unless it positions itself (`position: absolute`, as `<TrackReorderGrip />` does) or is rendered inside the panel. For move buttons of your own use `useTrack().moveUp()` and `.moveDown()` with `isFirst` and `isLast`. The `disabled` prop has no replacement: leave the grip out.

### Behaviour

| | Before | Now |
| --- | --- | --- |
| `renderTrackControls`, `onRemoveTrack` or `trackReordering` left on `<WaveformTrackControls>` in plain JavaScript | the custom panel, a close button, a grip | ignored: the default panel, no remove button, no grip |
| `setTrackMute(0, true)` (an index; the same for the other three) | muted the first track | does nothing. In development each of the four setters warns once in the console (`[waveform-playlist] setTrackMute() takes a track id…`). A string that is no track's id is ignored without a warning |
| A track is removed, or one is added in front of the others (the number of tracks changes and the provider rebuilds) | the panels showed every remaining track back at the `muted`, `soloed`, `volume` and `pan` of its `ClipTrack`, and the rebuilt engine took its values from the old list by position, so a track could sound with a neighbour's values (read from the code, not reproduced as audio) | the other tracks keep what the user set |
| The list is replaced by one of the same length with other tracks, or the same tracks in another order | state stayed at its position | a track keeps its mixer state for as long as its id is in `tracks`; a new id starts from the fields of its `ClipTrack` |
| `usePlaylistMixer().trackStates` while tracks are loading (`deferEngineRebuild`, or tracks appended to a running playlist) | filled by position: shorter than `tracks` | one entry per track, in the order of `tracks`. The entry of a track that is still loading is `undefined` **at its own position**, which can be in the middle. `trackStates.length` equals `tracks.length` |
| The identity of the `trackStates` array | a new array with new state objects whenever the provider loaded `tracks` again (also when only `onTracksChange` was a new function) | the same array while no entry changed: a move of a trim, a clip edit or a re-load for a new `onTracksChange` does not change it, and a mute changes the object of that track only |
| A click in a panel of your own | selected nothing (only the default panel selected its track) | a click anywhere in a track's slot selects the track. `<TrackRemoveButton>`, the button of `<TrackMenuButton>` and the grip and buttons of `<TrackReorderGrip>` do not select. A render-mode choice in the open track menu selects the track, as it did in the default panel |
| The remove callback | `onRemoveTrack(trackIndex)` | `onRemove(trackId)` |
| The element a reorder drag moves | the element you gave `ref` from `SortableTrackControls` | the slot the part draws; your grip only starts the drag |
| Children written inline | (the equivalent: an unstable `renderTrackControls` or `onRemoveTrack` rendered every panel on each render of your component) | the part compares the children with the previous ones (element types, keys and props, `children` recursively, `style` one level deep) and keeps the previous ones while they are equal, so inline children cost nothing while their props are stable. A function or an object written inline as a prop (other than `style`) makes every panel render on each render of the component that composes the view |
| `useTrack()` outside the children of `<WaveformTrackControls>` | (new) | throws `useTrack must be used within <WaveformTrackControls>…`. For a mixer strip elsewhere on the page use `usePlaylistMixer()` and the id setters of `useEditorControls()`. Under `MediaElementPlaylistProvider` those two throw as well: it has one track and no mixer |
| A track that is still loading | the default panel's controls were disabled | the pieces: mute, solo, volume, pan and the two move buttons are disabled, the name is "Track N", `useTrack().isLoading` is true. The remove button and the track menu stay enabled |
| `<DefaultTrackControls>` | drew the close button and the grip itself, from props of the part | has neither. `<TrackRemoveButton>` places itself at the top left of the slot and `<TrackReorderGrip>` at its right edge; the default panel makes room for the grip on both sides (CSS `:has()`) |
| The size of a custom panel | the slot, as now | the slot is as wide as the column (`width` of the part) and as tall as the track's row, with `overflow: hidden`. Fill it with `height: 100%`; do not compute the row height |
| Selecting a track | changed the background of the two slots concerned without rendering their default panels, and called `renderTrackControls` for every track | renders the pieces of the two panels concerned (the one that stops being selected and the one that becomes selected): `isSelected` is in the value of `useTrack()` |
| A mute, solo, volume or pan change | called `renderTrackControls` for every track | renders the components of that track's panel that call `useTrack()` |
| `exportWav` (`useExportWav`) with a track that is still loading | failed with a `TypeError` (the track had no state) | the track is rendered with the `muted`, `soloed`, `volume` and `pan` of its `ClipTrack` (its `soloed` counts for the solo rule like any other) |
| Children that are `false`, `0` or `''` (`{flag && <Panel />}` with a false flag) | (new) | empty panels. Only `null` and `undefined` mean "the default panel": write `{flag ? <Panel /> : undefined}` |
| Two reorder handles in one panel (two `<TrackReorderGrip />`, or the grip and `useTrackReorderHandle()`) | (new) | both register the track as the same sortable item; a warning in the console in development. Render one |
| `<TrackReorderGrip />` as a child of `<DefaultTrackControls>`, or alone inside an element of yours | (new) | the default panel makes room for the grip only when the two are siblings; elsewhere the grip lies over the sliders |
| A browser without CSS `:has()` | the room for the grip was an inline style | no room is made: the grip lies over the edges of the sliders |
| `<TrackRemoveButton>` without `onRemove`, in plain JavaScript | (the close button was drawn only with `onRemoveTrack`) | the button is drawn and a click throws |
| Markup of the default panel | the close button was inside the panel's `<header>`, the reorder rail inside the panel, and the panel handled the click that selects | every slot has a `div` (`[data-track-controls]`) around the panel (before, only with `trackReordering`, and without the attribute); the remove button and the grip are siblings of the panel inside it; the slot handles the click. A selector such as `header button[title="Remove track"]` no longer matches |
| A reorder (`reorderTrack`, the move buttons, a drag) under a provider without `onTracksChange` | the mixer states were put in the new order while `tracks` stayed as it was, so the panels between the old and the new position showed another track's values | nothing changes on screen (the console warning about the missing `onTracksChange` is as before) |
| The same ids with other `muted`, `soloed`, `volume` or `pan` fields on the `ClipTrack`, in a list with another number of tracks | the fields were applied (every state was re-created) | the fields of a known id are ignored: the user's values stay. Set them with the setters |
| Tracks re-created with new ids on each change (`createTrack()` makes an id) | a list of the same length kept the mixer state by position | a new id starts from its `ClipTrack` fields: keep the ids of tracks that are the same track |
| An id removed while `deferEngineRebuild` is true and added again | (by position) | gets the state it had: entries are dropped at the next full build |
| Two tracks with the same id | two states, by position | one state for both |

### `trackStates` may hold `undefined`

The TypeScript type is still `TrackState[]`, so the compiler does not point at these. Search for every read of `trackStates`:

```tsx
// Before
const anySolo = trackStates.some((s) => s.soloed);
const volumes = trackStates.map((s) => s.volume);
const loadedCount = trackStates.length;

// After
const anySolo = trackStates.some((s) => s?.soloed);
const volumes = trackStates.map((s) => s?.volume ?? 1);
const loadedCount = trackStates.filter(Boolean).length;
```

Code that waited for `trackStates.length === tracks.length` to know that loading had finished is now always true: use `trackStates.every(Boolean)`, or `usePlaylistTimeline().isReady` (which says the engine is built for the current tracks).

### New attributes

| Attribute | On |
| --- | --- |
| `data-track-controls="<track id>"` | the element inside each track's slot that holds the panel (the element a reorder drag moves) |
| `data-track-name` | the element of `<TrackName />` |
| `data-track-reorder-grip` | the element around the grip and buttons of `<TrackReorderGrip />` |

### What to check after the replacement

- Every remove callback: it gets an id. One that still filters by index (`i !== trackIndex`) removes nothing.
- Every call of the four setters outside a panel, in plain JavaScript: watch the console in development for the one-time warning.
- A saved session that restores mixer values by position: map positions to ids first (`tracks[i].id`).
- Removing a track with other tracks muted or turned down: they stay as they are.
- Tracks built again on every change: keep their ids, or the mixer starts over for them.
- CSS or test selectors that reached the remove button or the reorder rail through the panel's markup.
- A custom panel: click on its background and see the track become selected. A control of yours that must not select calls `event.stopPropagation()` in its click handler.

## The annotation UI is two parts with their own options; the annotation options have one home under both providers

**Packages:** `@waveform-playlist/browser` (major), `@waveform-playlist/annotations` and `@waveform-playlist/ui-components` (additions). Both providers.

Apply this entry after the two above (#686).

It replaces names that earlier entries on this page send you to. Where an earlier entry says `useAnnotationEditing()`, `useAnnotations().continuousPlay`, `useEditorControls().setLinkEndpoints` / `.setAnnotationsEditable`, `getAnnotationBoxLabel`, `PlaylistAnnotationList`, `MediaElementAnnotationList` (with their `controls`, `annotationListConfig` and `renderAnnotationItem` props), `MediaElementAnnotationBoxes` or `onAnnotationUpdate`, says the ready-made views "take `className` and the annotation options they took before", or advises calling `useAnnotationDragHandlers` yourself, rendering the list only when there are annotations, or treating `WaveformAnnotationBoxes`, `LinkEndpointsCheckbox` and `EditableCheckbox` as `WaveformPlaylistProvider` only, go straight to what this entry says.

The annotation options no longer sit on the ready-made views. There are two components, the same under `WaveformPlaylistProvider` and `MediaElementPlaylistProvider`, and each takes its own options:

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
import type { AnnotationData } from '@waveform-playlist/core';

// Defined outside the component: a new function renders every box or row.
const boxLabel = (annotation: AnnotationData, index: number) => String(index + 1);

<WaveformRoot>
  <WaveformTimescale />
  <WaveformTracks />
  <WaveformAnnotationBoxes getLabel={boxLabel} height={30} />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>

{/* anywhere under the provider: below the view, in a sidebar, more than once */}
<AnnotationList height={300} actions={annotationActions} scrollActivePosition="center" />
```

Whether annotations can be edited, whether a dragged edge takes its neighbour along, and whether playback runs on past the end of an annotation are **provider state under both providers**. They start from the provider's `annotationList` prop and follow it; `useAnnotationOptions()` reads them; three setters of `usePlaybackControls()` and the three checkboxes change them (the checkboxes are imported from `@waveform-playlist/annotations`: [One owner per exported name](#one-owner-per-exported-name-the-annotation-controls-move-to-the-annotations-package-re-exports-and-unused-exports-are-removed)).

The row of boxes wires the drag of its edges itself. `<Waveform />`, `<WaveformEditor />` and `<MediaElementWaveform />` take `className` only.

### New exports

| Export | Is |
| --- | --- |
| `<WaveformAnnotationBoxes>` | the row of annotation boxes, a part of `WaveformRoot` and of `MediaElementWaveformRoot`. Props: `getLabel` (the label of a box; default: the annotation's id), `height` (pixels; default 30). It owns the `DragDropProvider` for its edges. The name existed (multitrack only, one prop); the part now serves both providers. Type: `WaveformAnnotationBoxesProps` |
| `<AnnotationList>` | the annotation text list, anywhere under either provider. Props: `height` (pixels; without it at most 200), `actions` (buttons on each row while editable), `scrollActivePosition` (`'center'` by default, `'start'`, `'end'`, `'nearest'`, or `'none'` for a list that does not follow playback), `scrollActiveContainer` (`'nearest'` by default, or `'all'`), and a function child that draws a row. Type: `AnnotationListProps` |
| `useAnnotationOptions()` | `{ editable, linkEndpoints, continuousPlay }`. Both providers. Type: `AnnotationOptionsContextValue` |
| `usePlaybackControls().setAnnotationsEditable`, `.setLinkEndpoints` | next to `setContinuousPlay`, under both providers |
| `usePlaybackControls().playAnnotation(annotation)` | what a click on a box or a list row does: the annotation becomes active and plays from its start, to its end when continuous play is off. For a box or a row of your own. Both providers |
| `AnnotationListProp` | the type of the `annotationList` prop of both providers: `{ annotations?, editable?, linkEndpoints?, isContinuousPlay? }` |
| theme key `annotationTextItemActiveColor` | the edge, tint and glow of the active row of the list, and the list's focus rings. Default `#ff9800` in both themes (the value that was fixed) |

### Removed

| Removed | Use |
| --- | --- |
| `<Waveform>` / `<WaveformEditor>` props `annotationTextHeight`, `annotationControls`, `renderAnnotationItem`, `scrollActivePosition`, `scrollActiveContainer` | compose the view; `height`, `actions`, the function child and the two scroll props of `<AnnotationList>` |
| `<Waveform>` / `<WaveformEditor>` / `<MediaElementWaveform>` prop `getAnnotationBoxLabel` | `<WaveformAnnotationBoxes getLabel>` |
| `annotationListConfig` (`<Waveform>`, `<WaveformEditor>`, the two list components) | nothing: an action's fourth argument is always the provider's `{ linkEndpoints, continuousPlay }` |
| `<MediaElementWaveform>` props `annotationTextHeight`, `renderAnnotationItem`, `scrollActivePosition`, `scrollActiveContainer` | compose the view; the props of `<AnnotationList>` |
| `<MediaElementWaveform>` props `editable`, `linkEndpoints` | `annotationList={{ …, editable, linkEndpoints }}` on the provider |
| `onAnnotationUpdate` on `<MediaElementWaveform>`, `<MediaElementAnnotationBoxes>`, the two list components, and (deprecated, never called) on `WaveformPlaylistProvider`; the type `OnAnnotationUpdateFn` | `onAnnotationsChange` on the provider: the one report of an annotation change |
| `MediaElementAnnotationBoxes`, `MediaElementAnnotationBoxesProps` | `WaveformAnnotationBoxes` |
| `PlaylistAnnotationList`, `MediaElementAnnotationList`, their props types | `AnnotationList` (`controls` is `actions`; `renderAnnotationItem` is the child; `editable` is the provider's) |
| `useAnnotationEditing()`, `AnnotationEditingContextValue` | `useAnnotationOptions()` (`annotationsEditable` is `editable`) |
| `useAnnotations().continuousPlay` | `useAnnotationOptions().continuousPlay` |
| `useEditorControls().setLinkEndpoints`, `.setAnnotationsEditable` | the same two on `usePlaybackControls()` |
| `annotationList.controls` on `WaveformPlaylistProvider` (declared, never read) | `<AnnotationList actions>` |

Removed names do not throw and have no shim. In plain JavaScript a leftover prop is ignored, a leftover field read is `undefined`, and a leftover call of a removed setter is a `TypeError`; TypeScript reports each of them.

### Find and replace

**Find:** `annotationTextHeight`, `annotationControls`, `renderAnnotationItem`, `scrollActivePosition`, `scrollActiveContainer`, `getAnnotationBoxLabel` on `<Waveform>`, `<WaveformEditor>` or `<MediaElementWaveform>`.

**Replace with:** the composition, with the options on the two parts.

```tsx
// Before
<Waveform
  annotationTextHeight={300}
  annotationControls={annotationActions}
  renderAnnotationItem={renderRow}
  getAnnotationBoxLabel={boxLabel}
  scrollActivePosition="start"
/>

// After
<WaveformRoot>
  <WaveformTimescale />
  <WaveformLoopRegion />
  <WaveformTrackControls />
  <WaveformTracks />
  <WaveformAnnotationBoxes getLabel={boxLabel} />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
<AnnotationList height={300} actions={annotationActions} scrollActivePosition="start">
  {renderRow}
</AnnotationList>
```

For `<WaveformEditor>`, `<WaveformTracks>` holds `<WaveformClipHeaders />` and `<WaveformFades />`. For `<MediaElementWaveform>` the root is `<MediaElementWaveformRoot>` and its parts are `<WaveformTimescale />`, `<WaveformTracks />`, `<WaveformAnnotationBoxes />`, `<WaveformSelection />`, `<WaveformPlayhead />`. A view that used none of these props needs no change.

**Find:** `annotationListConfig`.

**Replace with:** delete it. If it carried values other than the provider's, set the provider's options to them (`annotationList`, or the setters).

**Find:** `editable` or `linkEndpoints` on `<MediaElementWaveform>` or `<MediaElementAnnotationBoxes>`; `editable` on `<MediaElementAnnotationList>`.

**Replace with:** the same values in the provider's `annotationList`. The provider follows the prop, so values kept in your own state keep working:

```tsx
// Before
<MediaElementPlaylistProvider track={track} annotationList={{ annotations }}>
  <MediaElementWaveform editable={editable} linkEndpoints={linkEndpoints} />
</MediaElementPlaylistProvider>

// After
const annotationList = useMemo(
  () => ({ annotations, editable, linkEndpoints }),
  [annotations, editable, linkEndpoints]
);
<MediaElementPlaylistProvider track={track} annotationList={annotationList}>
  <MediaElementWaveform />
</MediaElementPlaylistProvider>
```

Or drop your own state and render `<EditableCheckbox />` and `<LinkEndpointsCheckbox />`, which now work under `MediaElementPlaylistProvider` (import them from `@waveform-playlist/annotations`: [One owner per exported name](#one-owner-per-exported-name-the-annotation-controls-move-to-the-annotations-package-re-exports-and-unused-exports-are-removed)).

**Find:** `onAnnotationUpdate`.

**Replace with:** `onAnnotationsChange` on the provider. If both were passed, keep one: every change (an edge drag, a text or id edit, an action button) is reported once, there.

**Find:** `MediaElementAnnotationBoxes`.

**Replace with:** `WaveformAnnotationBoxes`; `getAnnotationBoxLabel` is `getLabel`; delete `editable`, `linkEndpoints`, `onAnnotationUpdate` (see above).

**Find:** `PlaylistAnnotationList`, `MediaElementAnnotationList`.

**Replace with:** `AnnotationList`.

```tsx
// Before
<PlaylistAnnotationList controls={actions} height={200} renderAnnotationItem={renderRow} />

// After
<AnnotationList actions={actions} height={200}>
  {renderRow}
</AnnotationList>
```

A wrapper of yours that rendered the list only when there are annotations (`annotations.length > 0 ? <PlaylistAnnotationList /> : null`) can go: the list draws nothing without annotations.

**Find:** `useAnnotationEditing`.

**Replace with:**

```tsx
// Before
const { annotationsEditable, linkEndpoints } = useAnnotationEditing();
const { continuousPlay } = useAnnotations();
const { setLinkEndpoints, setAnnotationsEditable } = useEditorControls();

// After
const { editable, linkEndpoints, continuousPlay } = useAnnotationOptions();
const { setLinkEndpoints, setAnnotationsEditable, setContinuousPlay } = usePlaybackControls();
```

**Find:** `continuousPlay` next to `useAnnotations(`, including destructurings (`const { annotations, continuousPlay } = useAnnotations()`).

**Replace with:** `useAnnotationOptions().continuousPlay`.

**Find:** `useAnnotationDragHandlers` together with a `DragDropProvider` of yours around the view (the wiring the annotation examples had).

**Replace with:** delete both, with the `useDragSensors` call that fed them. The row of boxes has its own `DragDropProvider`, and yours no longer receives the drag of an annotation edge. If the sensors were `useDragSensors({ touchOptimized: true })`, render `<ClipInteractionOptions touchOptimized>` above the view (a `ClipInteractionProvider touchOptimized` sets it too, and also makes the clips below it draggable):

```tsx
// Before
const sensors = useDragSensors({ touchOptimized: true });
const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
  annotations,
  onAnnotationsChange: setAnnotations,
  preview: annotationPreview,
  samplesPerPixel,
  sampleRate,
  duration,
  linkEndpoints,
});
<DragDropProvider sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} modifiers={[RestrictToHorizontalAxis]}>
  <Waveform />
</DragDropProvider>

// After
<ClipInteractionOptions touchOptimized>
  <Waveform />
</ClipInteractionOptions>
```

`useAnnotationDragHandlers` and `useAnnotationsWithPreview` stay exported, for a row of boxes of your own.

**Find:** `annotationList={{ … controls: … }}` on `WaveformPlaylistProvider`.

**Replace with:** `<AnnotationList actions={…}>`. The field was never read.

**Find:** CSS or tests of yours that use `#continuous-play`, `#link-endpoints` or `#editable-annotations`.

**Replace with:** the classes `continuous-play` and `link-endpoints` (unchanged), or a `className` you pass. The ids of the three checkboxes are generated now.

### Behaviour changes

| | Before | Now |
| --- | --- | --- |
| The annotation props left on `<Waveform>`, `<WaveformEditor>` or `<MediaElementWaveform>` in plain JavaScript | applied | ignored: default boxes (label: the id; 30 px) and default list |
| `editable` / `linkEndpoints` left on `<MediaElementWaveform>` in plain JavaScript | applied | ignored: annotations are not editable until the provider's option says so |
| `annotationList.editable`, `.linkEndpoints`, `.isContinuousPlay` change after mount | ignored: initial values | the option takes the new value (a field left out says `false`). Between two changes of the prop, a setter or a checkbox changes the option; the prop is not told, and its next change wins for the field that changed |
| `annotationList.editable` / `.linkEndpoints` on `MediaElementPlaylistProvider` | not accepted | accepted |
| `WaveformPlaylistProvider`, `editable` on, no drag wiring of your own | handles shown, an edge could not be dragged | an edge can be dragged |
| Your own `DragDropProvider` + `useAnnotationDragHandlers` around the view | moved the edges | receives no annotation drag; the part's own wiring moves them. Harmless, and dead code |
| Touch drag of an edge | `MediaElementPlaylistProvider`: dnd-kit's default sensors. `WaveformPlaylistProvider`: the sensors of your own wiring | a pointer sensor that activates after 1 px; with `ClipInteractionOptions touchOptimized` above, a touch must be held 250 ms |
| `useAnnotationOptions()`, `<LinkEndpointsCheckbox />`, `<EditableCheckbox />` under `MediaElementPlaylistProvider` | the two checkboxes threw (`useAnnotationEditing needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it`) | work |
| The annotation list under `MediaElementPlaylistProvider`, link endpoints | an action always got `linkEndpoints: false` from the list used on its own; the composition's prop from `<MediaElementWaveform>` | the provider's value |
| An action's `continuousPlay` under `<MediaElementWaveform>` | always `false` (and no action could be given there) | the provider's value |
| A click on a row of the list | nothing; the `onClick` given to a custom row did nothing | the annotation becomes active and plays from its start, as a click on its box does. In the default row a click in a field that is being edited, or on an action button, does not |
| A click on a box | each provider's box part started playback its own way | the same two ways, through `usePlaybackControls().playAnnotation`: nothing changes in how a clicked annotation plays, under either provider |
| A clicked annotation whose playback fails to start, under `WaveformPlaylistProvider` | `console.error` with the error object | `console.warn` with one string that names the annotation and the error, as under `MediaElementPlaylistProvider` |
| The last annotation is removed while one of its edges is being dragged | `MediaElementPlaylistProvider`: the drag was cancelled. `WaveformPlaylistProvider`: whatever your own wiring did | the drag is cancelled and the removal stays, under both providers (read from the code, not tried in a browser) |
| The list with no annotations, rendered on its own | an empty box (as high as `height`) | nothing |
| The list without `<AnnotationProvider>` | threw (also `<Waveform />` and `<MediaElementWaveform />` with annotations) | draws nothing; one development warning |
| How far an edge can be dragged under `WaveformPlaylistProvider` | with your own wiring: as far as the `duration` you gave `useAnnotationDragHandlers` (the examples gave the audio's length: 0 on an empty timeline, where a dragged edge collapsed) | as far as the timeline is drawn, under both roots: past the end of the audio where the timeline is longer (an empty timeline's 60 s, a recording, a view that fills its container). Under `MediaElementPlaylistProvider` the drawn timeline is the audio, as before |
| The boundary shortcuts of `<KeyboardShortcuts annotations>` (`Shift+[`, `Shift+]`) | stop at the end of the audio | unchanged, and now reachable in a new way: an end that was dragged past the audio is pulled back to the end of the audio by one press, and on an empty timeline one press sets the end to the start plus 0.1 s. Drag the edge there. Tracked in #801 |
| A theme with its own `annotationBoxBorder` | ignored: the border of a box, and the glow of the active box, were a fixed `#ff9800` | applied to both. The dark default of the key changed from `#c49a6c` to `#ff9800`, so the default themes draw what they drew |
| The tints and glows of the active list row, an edited field and the active box | fixed `rgba()` colours | `color-mix()` of the theme colour. In a browser without `color-mix()` (Safari before 16.2, Chrome before 111, Firefox before 113) they are not drawn; the active row keeps its edge and the active box its border |
| A view with a `<WaveformAnnotationBoxes />` and annotations, under `WaveformPlaylistProvider` | no drag provider of the library's for annotations | the part's own `DragDropProvider` around the row (nothing is mounted while there are no annotations or no `<AnnotationProvider>`) |
| Two annotation lists on one page | (one list) | each scrolls its own container to the active annotation. In a browser where `scrollIntoView` has no `container` option, both also scroll the page; give one of them `scrollActivePosition="none"` |
| A row of the list and the keyboard | (a row did nothing) | a row is played with the pointer only: it cannot be focused. The annotation shortcuts of `<KeyboardShortcuts annotations>` (arrows, Enter) play and move between annotations, under `WaveformPlaylistProvider` |
| `WaveformPlaylistTheme` | no `annotationTextItemActiveColor` | the key is optional in the type, so a complete theme object of yours still compiles; without it the colour is `#ff9800` |
| The continuous-play toggle | rendered every reader of `useAnnotations()` | renders the readers of `useAnnotationOptions()`; readers of `useAnnotations()` stand still |
| Toggling editable or link endpoints under `WaveformPlaylistProvider` | rendered readers of `useAnnotationEditing()` | renders readers of `useAnnotationOptions()`, which now include every reader of `continuousPlay` |
| `WaveformAnnotationBoxes` under `MediaElementPlaylistProvider` | threw | works |
| The ids of the three checkboxes | `continuous-play`, `link-endpoints`, `editable-annotations` | generated (two of one checkbox no longer share an id) |
| Components rendered per move of an edge drag and per annotation boundary under `WaveformPlaylistProvider` | 47 and 50 on the annotations example | the same: the part gained its `DragDropProvider` and the list lost a wrapper. A view with boxes and no list renders one component more per move and per boundary |

Not changed: `useAnnotationDragHandlers`, `useAnnotationsWithPreview`, `useAnnotationKeyboardControls`, `<KeyboardShortcuts annotations>` (still `WaveformPlaylistProvider` only), `<ContinuousPlayCheckbox />`, `<DownloadAnnotationsButton />` (not changed by this entry; [One owner per exported name](#one-owner-per-exported-name-the-annotation-controls-move-to-the-annotations-package-re-exports-and-unused-exports-are-removed) moves the four controls to `@waveform-playlist/annotations`), the `AnnotationProvider` of `@waveform-playlist/annotations`, the annotation theme keys other than the two above, and the keys an edge can not be dragged with (a handle can be focused; the keyboard does not move it, as before).

## The options that only affect how a view draws are `<WaveformViewOptions>`; they leave the providers

**Packages:** `@waveform-playlist/browser` (major), `@waveform-playlist/ui-components` (major: the shape of `PlaylistInfoContext`), `@waveform-playlist/spectrogram`. Both providers.

Apply this entry after the ones above (#689).

It replaces names that earlier entries on this page send you to. Where an earlier entry says `waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` or `fillViewport` is on `usePlaylistView()`, or passes one of them to a provider, go straight to what this entry says.

The row height, the bar style, the playhead width and the filled layout are no longer props of `WaveformPlaylistProvider` and `MediaElementPlaylistProvider`. One component sets them, for every waveform root below it, under either provider:

```tsx
import { WaveformPlaylistProvider, Waveform, WaveformViewOptions } from '@waveform-playlist/browser';

<WaveformViewOptions waveHeight={100} barWidth={3} barGap={1} roundedBars>
  <WaveformPlaylistProvider tracks={tracks}>
    <Waveform />
  </WaveformPlaylistProvider>
</WaveformViewOptions>
```

`<WaveformViewOptions>` may sit below the provider, above it, or above several providers. A prop that is left out is taken from the `<WaveformViewOptions>` above it, and from the defaults when there is none (`0` and `false` are values, not "left out"). It goes above a root, not among a root's children. The roots, the parts and the three ready-made views (`<Waveform />`, `<WaveformEditor />`, `<MediaElementWaveform />`) take none of these options.

`mono`, `indefinitePlayback` and `theme` stay on the provider. The provider computes the peaks with `mono`. Its animation loop and `seekTo` follow `indefinitePlayback` (the multitrack root also draws the timeline as wide as its container then, as `fillViewport` does). The theme is read by the transport controls, the checkboxes and the annotation list too, which are drawn outside a view.

### New exports

| Export | Is |
| --- | --- |
| `<WaveformViewOptions>` (`@waveform-playlist/browser`) | the view options. Props: `waveHeight` (pixels of one channel of a track; default 80), `barWidth` (default 1), `barGap` (default 0), `roundedBars` (default `false`), `progressBarWidth` (pixels of the playhead line; default `barWidth + barGap`), `fillViewport` (default `false`; `WaveformRoot` only, `MediaElementWaveformRoot` ignores it), `children`. Type: `WaveformViewOptionsProps` |
| `<WaveformTimescale height>` | height in pixels of the timescale strip (default 30). The root reads it from the element. The first `<WaveformTimescale>` among the root's children decides; a strip with only a `<WaveformLoopRegion>` is 30 px |
| `PlaylistInfo` (`@waveform-playlist/ui-components`) | the type of the `usePlaylistInfo()` value |
| `DEFAULT_WAVE_HEIGHT`, `DEFAULT_BAR_WIDTH`, `DEFAULT_BAR_GAP` (`@waveform-playlist/ui-components`) | 80, 1, 0 |
| theme key `spectrogramBackgroundColor` | the background of the area a spectrogram is drawn in: what shows until the spectrogram has been drawn and where a part of it is not mounted (a drawn spectrogram is opaque and covers it). Optional in `WaveformPlaylistTheme`; `#000` in both default themes and when the key is missing (the value that was fixed) |

### Removed

| Removed | Use |
| --- | --- |
| `waveHeight` on `WaveformPlaylistProvider` and `MediaElementPlaylistProvider` | `<WaveformViewOptions waveHeight>` |
| `barWidth` on both providers | `<WaveformViewOptions barWidth>` |
| `barGap` on both providers | `<WaveformViewOptions barGap>` |
| `roundedBars` on both providers | `<WaveformViewOptions roundedBars>` |
| `progressBarWidth` on both providers | `<WaveformViewOptions progressBarWidth>` |
| `fillViewport` on `WaveformPlaylistProvider` | `<WaveformViewOptions fillViewport>` |
| `usePlaylistView().waveHeight` | inside a root: `usePlaylistInfo().waveHeight` from `@waveform-playlist/ui-components` |
| `usePlaylistView().barWidth` | inside a root: `usePlaylistInfo().barWidth` |
| `usePlaylistView().barGap` | inside a root: `usePlaylistInfo().barGap` |
| `usePlaylistView().roundedBars` | inside a root: `usePlaylistInfo().roundedBars` |
| `usePlaylistView().progressBarWidth` | inside a root: `usePlaylistInfo().progressBarWidth` |
| `usePlaylistView().fillViewport` | nothing reads it back: keep the value where you pass it to `<WaveformViewOptions>` |
| `usePlaylistInfo().controls` (`@waveform-playlist/ui-components`) | nothing: no component read it. The width of the controls column is the `width` you give `<WaveformTrackControls>` |
| `usePlaylistInfo().zoomLevels` | nothing: no component read it. The zoom levels are the provider's `zoomLevels` prop |

`usePlaylistView()` is now `{ sampleRate, mono, indefinitePlayback }`.

Removed names do not throw and have no shim. In plain JavaScript a leftover provider prop is ignored and a leftover field read is `undefined`; TypeScript reports each of them.

### Find and replace

**Find:** `waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` or `fillViewport` on `<WaveformPlaylistProvider>` or `<MediaElementPlaylistProvider>`.

**Replace with:** the same props on a `<WaveformViewOptions>` around the view, or around the provider.

```tsx
// Before
<WaveformPlaylistProvider
  tracks={tracks}
  mono
  theme={theme}
  waveHeight={100}
  barWidth={3}
  barGap={1}
  roundedBars
  fillViewport
>
  <Waveform />
</WaveformPlaylistProvider>

// After
<WaveformPlaylistProvider tracks={tracks} mono theme={theme}>
  <WaveformViewOptions waveHeight={100} barWidth={3} barGap={1} roundedBars fillViewport>
    <Waveform />
  </WaveformViewOptions>
</WaveformPlaylistProvider>
```

Several players with the same options need one element:

```tsx
// Before
<MediaElementPlaylistProvider track={first} waveHeight={60} barWidth={2} barGap={1}>
  <MediaElementWaveform />
</MediaElementPlaylistProvider>
<MediaElementPlaylistProvider track={second} waveHeight={60} barWidth={2} barGap={1}>
  <MediaElementWaveform />
</MediaElementPlaylistProvider>

// After
<WaveformViewOptions waveHeight={60} barWidth={2} barGap={1}>
  <MediaElementPlaylistProvider track={first}>
    <MediaElementWaveform />
  </MediaElementPlaylistProvider>
  <MediaElementPlaylistProvider track={second}>
    <MediaElementWaveform />
  </MediaElementPlaylistProvider>
</WaveformViewOptions>
```

**Find:** `<MediaElementPlaylistProvider` without a `waveHeight` prop.

**Replace with:** if the row must stay 100 px tall, `<WaveformViewOptions waveHeight={100}>` around it. The default is 80 under both providers now.

**Find:** `waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` or `fillViewport` next to `usePlaylistView(`, including destructurings (`const { sampleRate, waveHeight } = usePlaylistView()`).

**Replace with:** in a component drawn inside a root (a child of the root that is not a part, a custom playhead, a panel of the track controls), `usePlaylistInfo()` of `@waveform-playlist/ui-components`:

```tsx
// Before
const { sampleRate, waveHeight, barWidth } = usePlaylistView();

// After
import { usePlaylistView } from '@waveform-playlist/browser';
import { usePlaylistInfo } from '@waveform-playlist/ui-components';

const { sampleRate } = usePlaylistView();
const { waveHeight, barWidth } = usePlaylistInfo();
```

Outside a root `usePlaylistInfo()` returns its defaults, not the options of a `<WaveformViewOptions>` above. A component there that needs one of the numbers keeps it in a constant or in state and passes the same value to `<WaveformViewOptions>`.

**Find:** `PlaylistInfoContext.Provider` rendered by your own code (around `Track`, `SmartChannel`, `SmartScale` or `TimeScale` of `@waveform-playlist/ui-components` used directly).

**Replace with:** a value of the new shape. Remove `controls` and `zoomLevels`; add `roundedBars` and `progressBarWidth`, which are required now:

```tsx
// Before
<PlaylistInfoContext.Provider
  value={{
    sampleRate,
    samplesPerPixel,
    zoomLevels: [256, 512, 1024],
    waveHeight: 80,
    timeScaleHeight: 30,
    controls: { show: false, width: 0 },
    barWidth: 1,
    barGap: 0,
  }}
>

// After
<PlaylistInfoContext
  value={{
    sampleRate,
    samplesPerPixel,
    waveHeight: 80,
    timeScaleHeight: 30,
    barWidth: 1,
    barGap: 0,
    roundedBars: false,
    progressBarWidth: 1,
  }}
>
```

**Find:** `controls` or `zoomLevels` read from `usePlaylistInfo()` or `useContext(PlaylistInfoContext)`.

**Replace with:** your own values (see the table above). Both reads are `undefined` now.

### Behaviour changes

| | Before | Now |
| --- | --- | --- |
| One of the six props left on a provider in plain JavaScript | applied | ignored: the defaults are drawn (80 px rows, bars 1 px wide with no gap and square ends, a playhead line 1 px wide, a timeline that does not fill its container) |
| `waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth`, `fillViewport` read from `usePlaylistView()` in plain JavaScript | the provider's values | `undefined` |
| `waveHeight` under `MediaElementPlaylistProvider` when none is set | 100 | 80, the one default under both providers. Add `<WaveformViewOptions waveHeight={100}>` to look as before |
| A change of one of the options | changed the value of `usePlaylistView()`: every reader of that hook rendered | renders the roots below that `<WaveformViewOptions>` and what reads `usePlaylistInfo()` in them. The value of `usePlaylistView()` does not change |
| A spectrogram in "both" mode (spectrogram above waveform, each half a row tall) | the worker rendered the spectrogram at the full row height into a canvas half a row tall | the worker renders at the height the canvas has: half the row. `SpectrogramProvider` no longer reads a row height; it uses the height each canvas registered with |
| The value of `PlaylistInfoContext` (`usePlaylistInfo()`) | had `controls` and `zoomLevels`; `roundedBars` and `progressBarWidth` were optional in the type, and inside a root `progressBarWidth` was not provided | no `controls`, no `zoomLevels`; `roundedBars` and `progressBarWidth` are required in the type and provided inside a root. A `PlaylistInfoContext.Provider` of your own must give the new shape |
| `barWidth={0}` with `barGap={0}` | a blank waveform, and a playhead line 0 px wide | the bar width becomes 1 (the `barWidth` warning) and the gap stays 0: bars 1 px wide with no gap, and a playhead line 1 px wide |
| A `barWidth` above 0 with a `barGap` that makes `barWidth + barGap` less than 1 | a sum of 0 (1 and -1) drew a blank waveform. A negative sum on `main` was read from the code and not tried; during this work a test of the new code with the guard removed did not end: the loop that draws the bars never reached its end | the gap is raised until the next bar is one pixel on (`1 - barWidth`), with one warning in development: 1 and -1 give a gap of 0, 2 and -5 a gap of -1 |
| A `barGap` that is not a number (`NaN`) | used as given | replaced by 0, with one warning in development |
| A `progressBarWidth` that is not above 0 (0, a negative number, `NaN`) | used as given: no visible playhead line for 0 | replaced by `barWidth + barGap` (after the corrections above), with one warning in development. To draw no playhead, leave `<WaveformPlayhead>` out |
| A `waveHeight` or a `barWidth` that is not above 0 (0, a negative number, `NaN`) | used as given | replaced by the default (80, 1), with one warning in development. The default playhead width is worked out from the corrected bar and gap |
| `Channel` of `@waveform-playlist/ui-components` used directly, with `barWidth + barGap` less than 1 | as in the "less than 1" row above | steps one pixel from bar to bar, without a warning |
| The height of the timescale strip | 30 px | 30 px, or the `height` of the first `<WaveformTimescale>`. A `height` that is not a positive number: 30 is drawn, with one warning in development |
| The background of the area a spectrogram is drawn in (what shows until the spectrogram has been drawn, and where a part of it is not mounted; a drawn spectrogram is opaque and covers it) | a fixed `#000` | the theme's `spectrogramBackgroundColor`, `#000` in both default themes and without the key. `SpectrogramChannel` of `@waveform-playlist/ui-components` reads it too. The key is optional in `WaveformPlaylistTheme`, so a complete theme object of yours still compiles |
| Two views under one provider | the same row height, bar style and playhead width in both (the provider's) | each root draws with the `<WaveformViewOptions>` above it, so the two may differ in row height, bar style and playhead width. They share the provider's zoom, selection and playback, as before. A view at another zoom level: under `MediaElementPlaylistProvider`, another provider (each is independent); under `WaveformPlaylistProvider` with the default Tone.js engine it is not available by adding a provider, because only one such provider should be mounted on a page (they share one Tone.js transport), tracked in [#805](https://github.com/naomiaro/waveform-playlist/issues/805). Two limits of two views under one provider, tracked in [#803](https://github.com/naomiaro/waveform-playlist/issues/803): automatic scroll moves only the view that mounted last, and a spectrogram track is drawn in only one of the two views |
| A `<WaveformViewOptions>` nested in another, with a prop left out (or `null`) | (new) | inherits the value from the one above. A nested one therefore cannot return an option to its default or to its derived value: with `progressBarWidth={7}` outside and `barWidth={4}` inside the playhead stays 7 px wide. Write the value |
| A `<WaveformViewOptions>` among the children of a root | (new) | does nothing for that root, which reads the options above itself; the parts inside it are not recognised (they count as wrapped in a component). One warning in development. Put it around the root |
| A change of `progressBarWidth` alone | changed the value of `usePlaylistView()`: every reader of that hook rendered | changes the value of `usePlaylistInfo()` in the views below: every reader of it in such a view renders (each track, each channel, the timescale, the tracks part, the default playhead). No waveform canvas is drawn again |
| The timescale strip appears, disappears or changes height | rendered the readers of `usePlaylistInfo()` | the same, and those now include the tracks part (`<WaveformTracks>`) and the default playhead |
| The row height changes while a spectrogram is shown | the canvases stayed mounted | `SpectrogramChannel` mounts new canvases at the new height and registers them again (`onCanvasRegister`); they show the theme's spectrogram background until the worker has drawn them |

Not changed: `theme`, `samplesPerPixel` and `automaticScroll` on both providers; `mono`, `indefinitePlayback`, `zoomLevels` and `sampleRate` on `WaveformPlaylistProvider`; `usePlaylistView().sampleRate`, `.mono` and `.indefinitePlayback`; `usePlaylistInfo().sampleRate`, `.samplesPerPixel`, `.waveHeight`, `.timeScaleHeight`, `.barWidth` and `.barGap`. The empty timeline is still 60 s long and a timeline being recorded still grows in steps of 10 s; both are fixed values ([#804](https://github.com/naomiaro/waveform-playlist/issues/804)).

### What to check after the replacement

1. Search the whole project (examples and tests too) for `waveHeight=`, `barWidth=`, `barGap=`, `roundedBars`, `progressBarWidth=` and `fillViewport`: each remaining match must be on a `<WaveformViewOptions>`.
2. Every MediaElement player whose provider had no `waveHeight`: each channel is drawn 80 px tall where it was 100.
3. Every destructuring of `usePlaylistView()`: only `sampleRate`, `mono` and `indefinitePlayback` exist.

## One owner per exported name: the annotation controls move to the annotations package; re-exports and unused exports are removed

**Packages:** `@waveform-playlist/annotations` (major), `@waveform-playlist/browser` (major), `@waveform-playlist/ui-components` (major), `@waveform-playlist/spectrogram` (major), `@waveform-playlist/core` (major: `getShortcutLabel` is removed; one type added). Both providers.

Apply this entry after the ones above (#770).

It replaces names that earlier entries on this page send you to. Where an earlier entry imports `ClipTrack`, `AudioClip`, `Fade` or `AnnotationData` from `@waveform-playlist/browser`, tells you to render `<ContinuousPlayCheckbox />`, `<LinkEndpointsCheckbox />`, `<EditableCheckbox />` or `<DownloadAnnotationsButton />` of `@waveform-playlist/browser`, or says they need `<AnnotationProvider>`, go straight to what this entry says.

Among the React packages a name is now exported by one package. `browser`, `annotations`, `ui-components`, `spectrogram` and `recording` re-export nothing from another package: import a name from the package that owns it. Five names remain in two entry points, on purpose: `AutomaticScrollCheckbox`, `MasterVolumeControl`, `PlaybackRateSelect`, `SelectionTimeInputs` and `TimeFormatSelect`. The one in `@waveform-playlist/ui-components` is driven by props; the one in `@waveform-playlist/browser` reads the provider and renders it. (`Track` is two different things under one name: a type in `@waveform-playlist/core` and a component in `@waveform-playlist/ui-components`.) This holds for the main entries of those five packages, for `@waveform-playlist/browser/tone` and for `@waveform-playlist/core`, which a test compares. One pair is left and tracked: `createEffectInstance` is one function in `@waveform-playlist/browser/tone` and another in `@waveform-playlist/core`. The other packages (`midi`, `engine`, `playout`, `media-element-playout`, the web components) are not covered.

The four annotation controls are owned by `@waveform-playlist/annotations` and are bound to the playlist provider there:

```tsx
import {
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/annotations';

// Under WaveformPlaylistProvider or MediaElementPlaylistProvider. No <AnnotationProvider> needed.
<ContinuousPlayCheckbox />
<LinkEndpointsCheckbox />
<EditableCheckbox>Allow editing</EditableCheckbox>
<DownloadAnnotationsButton filename="chapters.json">Save chapters</DownloadAnnotationsButton>
```

The checkboxes take `className`, `disabled` and `children` (the label). The button takes `filename`, `disabled`, `className`, `children` (the label) and `title` (the tooltip). Every string the four controls draw can be supplied by your app: `children` on all four, `title` on the button. They read `useAnnotationOptions()`, `usePlaybackControls()` and `useAnnotations()`, so they show and change the provider's options and download the provider's annotations.

If your project uses a strict package manager (pnpm), a package you import from must be in your own `package.json`: after this entry that can include `@waveform-playlist/core`, `@waveform-playlist/ui-components` and `@waveform-playlist/playout`, which were reachable through `@waveform-playlist/browser` before.

### Moved: import from the owner

| Name | Was imported from | Import from |
| --- | --- | --- |
| `ContinuousPlayCheckbox` | `@waveform-playlist/browser` | `@waveform-playlist/annotations` |
| `LinkEndpointsCheckbox` | `@waveform-playlist/browser` | `@waveform-playlist/annotations` |
| `EditableCheckbox` | `@waveform-playlist/browser` | `@waveform-playlist/annotations` |
| `DownloadAnnotationsButton` | `@waveform-playlist/browser` | `@waveform-playlist/annotations` |
| `ClipTrack` (type) | `@waveform-playlist/browser` | `@waveform-playlist/core` |
| `AudioClip` (type) | `@waveform-playlist/browser` | `@waveform-playlist/core` |
| `Fade` (type) | `@waveform-playlist/browser` | `@waveform-playlist/core` |
| `AnnotationData` (type) | `@waveform-playlist/browser` | `@waveform-playlist/core` |
| `TimeFormat` (type) | `@waveform-playlist/browser` | `@waveform-playlist/ui-components` |
| `EffectsFunction` (type) | `@waveform-playlist/browser` | `@waveform-playlist/playout` |
| `TrackEffectsFunction` (type) | `@waveform-playlist/browser` | `@waveform-playlist/playout` |
| `SpectrogramCanvasRegistration` (type) | `@waveform-playlist/browser` or `@waveform-playlist/ui-components` | `@waveform-playlist/core` |
| `TrackMenuItem` (type) | `@waveform-playlist/spectrogram` | `@waveform-playlist/ui-components` (the `items` of `TrackMenu`) |
| `samplesToSeconds` | `@waveform-playlist/ui-components` | `@waveform-playlist/core` |
| `secondsToSamples` | `@waveform-playlist/ui-components` | `@waveform-playlist/core` |
| `samplesToPixels` | `@waveform-playlist/ui-components` | `@waveform-playlist/core` |
| `pixelsToSamples` | `@waveform-playlist/ui-components` | `@waveform-playlist/core` |
| `pixelsToSeconds` | `@waveform-playlist/ui-components` | `@waveform-playlist/core` |
| `secondsToPixels` | `@waveform-playlist/ui-components` | `@waveform-playlist/core` |

The six conversion functions in `@waveform-playlist/ui-components` were copies of core's with the same arithmetic, so the results do not change.

### Renamed

| Was | Is |
| --- | --- |
| `SnapTo` of `@waveform-playlist/ui-components` (`'bar' \| 'beat' \| 'off'`) | `BeatsAndBarsSnapTo` of `@waveform-playlist/ui-components`, the same three values. `SnapTo` of `@waveform-playlist/core` is another type (a longer list, used by the web components) and is unchanged: do not replace one with the other |
| `ContinuousPlayCheckboxProps`, `LinkEndpointsCheckboxProps`, `EditableCheckboxProps` of `@waveform-playlist/annotations` (`checked`, `onChange`, `className`; `disabled` on the first two) | `AnnotationCheckboxProps` of `@waveform-playlist/annotations` (`className`, `disabled`, `children`): one type for the three, and not the same shape |

### Removed

| Removed | Use |
| --- | --- |
| The controlled `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` of `@waveform-playlist/annotations` (props `checked`, `onChange`, and `disabled` on the first two) | under a playlist provider: the bound component of the same name, without `checked` and `onChange`; `disabled` is still taken, now by all three. Without a provider: a checkbox of your own from `BaseCheckboxWrapper`, `BaseCheckbox` and `BaseCheckboxLabel` of `@waveform-playlist/ui-components` (below) |
| The controlled `DownloadAnnotationsButton` of `@waveform-playlist/annotations` (prop `annotations`) | under a playlist provider: the bound component of the same name, without the prop. Without a provider: `annotations.map(serializeAeneas)` and a download of your own (below) |
| `AnnotationsTrack`, `AnnotationsTrackProps` (`@waveform-playlist/annotations`) | `AnnotationBoxesWrapper` with `height={100}` (its default is 30; `AnnotationsTrack`'s was 100). The other props are the same: `className`, `children`, `offset`, `width` |
| `useAnnotationControls`, `UseAnnotationControlsOptions`, `UseAnnotationControlsReturn` (`@waveform-playlist/annotations`) | under a playlist provider: `useAnnotationOptions()` and `setContinuousPlay`, `setLinkEndpoints`, `setAnnotationsEditable` of `usePlaybackControls()`. Without one: two `useState`s and `updateAnnotationBoundaries` of `@waveform-playlist/core` (below) |
| `AnnotationUpdateParams` (`@waveform-playlist/annotations`) | `AnnotationBoundaryUpdate` of `@waveform-playlist/core`, the same six fields |
| `Annotation`, `AnnotationProps` (`@waveform-playlist/annotations`) | no one-to-one replacement. It drew one annotation as an overlay with its text edited inside the box. `AnnotationBox` draws a box; `AnnotationList` of `@waveform-playlist/browser` draws and edits the text |
| `AnnotationIntegration.ContinuousPlayCheckbox`, `.LinkEndpointsCheckbox`, `.EditableCheckbox`, `.DownloadAnnotationsButton` (`@waveform-playlist/browser`) | nothing: no component reads them. The integration is `parseAeneas`, `serializeAeneas`, `AnnotationText`, `AnnotationBox`, `AnnotationBoxesWrapper` |
| `TrackControlsContext`, `useTrackControls` (`@waveform-playlist/ui-components`) | nothing: no component provided or read the context. A track control panel reads its track with `useTrack()` of `@waveform-playlist/browser` |
| `getShortcutLabel` (`@waveform-playlist/browser` and `@waveform-playlist/core`) | a function of your own that builds the label from the shortcut's fields (below). The `KeyboardShortcut` type and `handleKeyboardEvent` stay in `@waveform-playlist/core` (browser's entry never had those two) |
| `AudioPosition`, `AudioPositionProps` of `@waveform-playlist/ui-components` (prop `formattedTime`) | `AudioPosition` of `@waveform-playlist/browser`, which reads the provider and takes no time. Without a provider: a `<span>` of your own with the text from `formatTime` of `@waveform-playlist/ui-components` |

Removed names do not throw and have no shim. TypeScript reports each leftover import of a removed or moved name. Without TypeScript it depends on the bundler and the kind of module that imports the name. Either the build fails on the missing export (Rollup and Vite; webpack when the importing file is a strict ES module, such as an `.mjs` file or a package with `"type": "module"`; native ES modules fail when the module is loaded), or the name is `undefined` at runtime (CommonJS; webpack for other files, with a warning): then React reports "Element type is invalid" when it is rendered as a component, and calling it is a `TypeError`. Which of the two webpack does was read in its source; the others are how those tools are known to behave and were not tried here.

### Find and replace

**Find:** `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` or `DownloadAnnotationsButton` in an import from `@waveform-playlist/browser`.

**Replace with:** the same names from `@waveform-playlist/annotations`. The JSX does not change.

```tsx
// Before
import {
  WaveformPlaylistProvider,
  Waveform,
  ContinuousPlayCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/browser';
import { AnnotationProvider } from '@waveform-playlist/annotations';

// After
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import {
  AnnotationProvider,
  ContinuousPlayCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
} from '@waveform-playlist/annotations';
```

**Find:** `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox` or `EditableCheckbox` imported from `@waveform-playlist/annotations` and rendered with `checked` and `onChange`.

**Replace with:** under a playlist provider, delete the two props and the state behind them; the provider holds the option. To start it from a value, or to keep driving it from your own state, pass the value in the provider's `annotationList` (`editable`, `linkEndpoints`, `isContinuousPlay`).

```tsx
// Before
const [linkEndpoints, setLinkEndpoints] = useState(true);
<LinkEndpointsCheckbox checked={linkEndpoints} onChange={setLinkEndpoints} />

// After
<WaveformPlaylistProvider tracks={tracks} annotationList={{ annotations, linkEndpoints: true }}>
  <LinkEndpointsCheckbox />
</WaveformPlaylistProvider>
```

Without a playlist provider, build the checkbox:

```tsx
import { useId } from 'react';
import {
  BaseCheckboxWrapper,
  BaseCheckbox,
  BaseCheckboxLabel,
} from '@waveform-playlist/ui-components';

function LinkEndpointsToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <BaseCheckboxWrapper>
      <BaseCheckbox
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <BaseCheckboxLabel htmlFor={id}>Link Endpoints</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
}
```

**Find:** `<DownloadAnnotationsButton` with an `annotations` prop.

**Replace with:** under a playlist provider, delete the prop: the button downloads the provider's annotations. Without one, write the file yourself:

```tsx
import { serializeAeneas } from '@waveform-playlist/annotations';
import type { AnnotationData } from '@waveform-playlist/core';

function downloadAnnotations(annotations: AnnotationData[], filename = 'annotations.json') {
  const json = JSON.stringify(annotations.map(serializeAeneas), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

**Find:** `ContinuousPlayCheckboxProps`, `LinkEndpointsCheckboxProps`, `EditableCheckboxProps`.

**Replace with:** `AnnotationCheckboxProps` where the type described the library's checkbox. It has no `checked` and no `onChange`: a wrapper of yours that forwarded those two needs its own props type.

**Find:** `AnnotationsTrack`.

**Replace with:** `AnnotationBoxesWrapper`, with the height written out.

```tsx
// Before
<AnnotationsTrack width={timelineWidth}>{boxes}</AnnotationsTrack>

// After
<AnnotationBoxesWrapper height={100} width={timelineWidth}>{boxes}</AnnotationBoxesWrapper>
```

**Find:** `useAnnotationControls`.

**Replace with:** under a playlist provider, the provider's options:

```tsx
// Before
const { continuousPlay, linkEndpoints, setContinuousPlay, setLinkEndpoints } = useAnnotationControls();

// After
const { continuousPlay, linkEndpoints } = useAnnotationOptions();
const { setContinuousPlay, setLinkEndpoints } = usePlaybackControls();
```

Without a provider, your own state and core's function. The hook started `linkEndpoints` at `true`; keep that default if you relied on it:

```tsx
// Before
const { continuousPlay, linkEndpoints, setContinuousPlay, setLinkEndpoints, updateAnnotationBoundaries } =
  useAnnotationControls();

// After
import { updateAnnotationBoundaries } from '@waveform-playlist/core';

const [continuousPlay, setContinuousPlay] = useState(false);
const [linkEndpoints, setLinkEndpoints] = useState(true);
```

`updateAnnotationBoundaries({ annotationIndex, newTime, isDraggingStart, annotations, duration, linkEndpoints })` takes the same object and returns a new array, as the hook's function did (the hook called it).

**Find:** `<Annotation ` and `Annotation,` or `{ Annotation }` in an import from `@waveform-playlist/annotations`. Match the whole word: `AnnotationBox`, `AnnotationText`, `AnnotationProvider` and `AnnotationData` are other names and stay.

**Replace with:** `AnnotationBox` for the box, and `AnnotationList` (`@waveform-playlist/browser`) or `AnnotationText` for the text. There is no component that edits the text inside the box.

**Find:** `getShortcutLabel`, imported from `@waveform-playlist/browser` or from `@waveform-playlist/core`.

**Replace with:** a function of your own. The removed one returned English words joined with `+`: for `metaKey`, `Cmd` on a Mac and `Ctrl` elsewhere; `Ctrl` for `ctrlKey`, left out whenever `metaKey` was also set (so on a Mac a shortcut with both showed `Cmd` only); for `altKey`, `Option` on a Mac and `Alt` elsewhere; `Shift` for `shiftKey`; then `key.toUpperCase()`, so the Space key came out as a blank. Nothing in the library called it. Name the keys and the modifiers in your own words:

```tsx
import type { KeyboardShortcut } from '@waveform-playlist/core';

// Your own names for the keys that need one, in your own language.
const KEY_NAMES: Record<string, string> = { ' ': 'Space' };

const shortcutLabel = (shortcut: KeyboardShortcut): string =>
  [
    shortcut.metaKey ? 'Cmd' : null,
    shortcut.ctrlKey ? 'Ctrl' : null,
    shortcut.altKey ? 'Alt' : null,
    shortcut.shiftKey ? 'Shift' : null,
    KEY_NAMES[shortcut.key] ?? shortcut.key.toUpperCase(),
  ]
    .filter(Boolean)
    .join('+');
```

**Find:** `ClipTrack`, `AudioClip`, `Fade` or `AnnotationData` in an import from `@waveform-playlist/browser`; `TimeFormat` in one; `EffectsFunction` or `TrackEffectsFunction` in one.

**Replace with:** an import from the owner (the table above).

```tsx
// Before
import {
  WaveformPlaylistProvider,
  Waveform,
  type ClipTrack,
  type AnnotationData,
  type TimeFormat,
  type EffectsFunction,
} from '@waveform-playlist/browser';

// After
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import type { ClipTrack, AnnotationData } from '@waveform-playlist/core';
import type { TimeFormat } from '@waveform-playlist/ui-components';
import type { EffectsFunction } from '@waveform-playlist/playout';
```

**Find:** `samplesToSeconds`, `secondsToSamples`, `samplesToPixels`, `pixelsToSamples`, `pixelsToSeconds` or `secondsToPixels` in an import from `@waveform-playlist/ui-components`.

**Replace with:** the same names from `@waveform-playlist/core`.

**Find:** `SnapTo` in an import from `@waveform-playlist/ui-components`.

**Replace with:** `BeatsAndBarsSnapTo`. Leave a `SnapTo` imported from `@waveform-playlist/core` alone.

```tsx
// Before
import { BeatsAndBarsProvider, type SnapTo } from '@waveform-playlist/ui-components';
const [snapTo, setSnapTo] = useState<SnapTo>('beat');

// After
import { BeatsAndBarsProvider, type BeatsAndBarsSnapTo } from '@waveform-playlist/ui-components';
const [snapTo, setSnapTo] = useState<BeatsAndBarsSnapTo>('beat');
```

**Find:** `SpectrogramCanvasRegistration` in an import from `@waveform-playlist/browser` or `@waveform-playlist/ui-components`; `TrackMenuItem` in an import from `@waveform-playlist/spectrogram`.

**Replace with:** `SpectrogramCanvasRegistration` from `@waveform-playlist/core`; `TrackMenuItem` from `@waveform-playlist/ui-components`. Both types have the fields they had.

**Find:** `TrackControlsContext`, `useTrackControls`.

**Replace with:** delete them. The context was never provided by the library, so `useTrackControls()` returned its default, an empty fragment.

**Find:** `AudioPosition` in an import from `@waveform-playlist/ui-components`.

**Replace with:** `AudioPosition` from `@waveform-playlist/browser` under a playlist provider (no `formattedTime` prop), or an element of your own.

**Find:** an object given to `AnnotationIntegrationProvider` (or typed `AnnotationIntegration`) with the entries `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` or `DownloadAnnotationsButton`.

**Replace with:** delete the four entries, and render your own controls where you rendered the library's.

### Behaviour changes

| Tree or code | Before | After |
| --- | --- | --- |
| The four controls under a playlist provider, without `<AnnotationProvider>` | threw: `useAnnotationIntegration must be used within <AnnotationProvider>. …` | work: they read the playlist provider only |
| The four controls without a playlist provider | browser's threw (with or without `<AnnotationProvider>`); the controlled ones of the annotations package worked | throw the playlist hook's message (it names `WaveformPlaylistProvider or MediaElementPlaylistProvider`) |
| One of the four still imported from `@waveform-playlist/browser` | the bound control | a TypeScript error. Without TypeScript: a failed build, or `undefined` at runtime (React reports "Element type is invalid" where it is rendered), depending on the bundler (see above) |
| `<ContinuousPlayCheckbox checked={…} onChange={…} />` (also the other two) imported from `@waveform-playlist/annotations`, under a playlist provider | showed `checked`, called `onChange`; the provider's option was not touched | `checked` and `onChange` are ignored: the box shows the provider's option and a click sets it; your `onChange` is not called. No error in plain JavaScript; a TypeScript error |
| The same code without a playlist provider | worked | throws the playlist hook's message |
| `<DownloadAnnotationsButton annotations={…} />` imported from `@waveform-playlist/annotations` | downloaded the array it was given | under a playlist provider the prop is ignored and the provider's annotations are downloaded; without one it throws the playlist hook's message |
| A custom object passed to `AnnotationIntegrationProvider` with its own four control entries | browser's four controls rendered your components | the four entries are not read by anything. In TypeScript an object literal written where the `AnnotationIntegration` type is expected is an excess-property error when it has them (an object built in an untyped variable first is not) |
| `children` of `DownloadAnnotationsButton` | browser's button did not pass it on: the label was always "Download JSON" | the label (default "Download JSON") |
| `title` on `DownloadAnnotationsButton` | not taken: the tooltip was "No annotations to download" without annotations and "Download the annotations as JSON" with them | given, it is the tooltip in both cases; left out, the same two sentences |
| `disabled` on `DownloadAnnotationsButton` | browser's button did not take it: disabled only while there were no annotations | disables the button; it is also disabled while there are no annotations |
| `children` of the three checkboxes | not taken: the labels were fixed | the label (defaults "Continuous Play", "Link Endpoints", "Editable Annotations") |
| `disabled` on the three checkboxes | the controlled `ContinuousPlayCheckbox` and `LinkEndpointsCheckbox` of `@waveform-playlist/annotations` took it; `EditableCheckbox` and browser's three did not | all three take it: the input is disabled and a click changes nothing |
| `children={null}` on a checkbox | not taken | counts as not given, like leaving it out: the default label is drawn. Only `null` and `undefined` do: `false` or `''` (as from `{condition && 'Label'}`) draws an empty label, and the input then has no accessible name. On `DownloadAnnotationsButton` only `undefined` is "not given": `null` draws an empty button |
| `useAnnotationIntegration().ContinuousPlayCheckbox` (or one of the other three control entries) read in your own code | the component | `undefined`: the integration no longer carries the controls. Import them from `@waveform-playlist/annotations` |
| The bound `SelectionTimeInputs` when the automatic-scroll setting changes | did not render | renders once per change: it reads `usePlaylistSettings()`, whose value holds the time format and the automatic-scroll setting. (Seen once with a throwaway test; no test in the repository counts it) |
| `className` on the four controls, the input classes `continuous-play` and `link-endpoints`, the generated ids | | unchanged |
| `AutomaticScrollCheckbox`, `MasterVolumeControl`, `SelectionTimeInputs` (the controlled ones of `@waveform-playlist/ui-components` and the bound ones of `@waveform-playlist/browser`, which render them) | the inputs had the fixed ids `automatic-scroll`, `master-gain`, `audio_start` and `audio_end`, so two of one control on a page shared an id and a label reached the first one's input | each input has a generated id (`useId()`); the input classes `automatic-scroll`, `audio-start` and `audio-end` are unchanged. A selector such as `#master-gain` in your own CSS or tests no longer matches: use the class, the label or the accessible name |
| `SelectionTimeInputs`: the format the two times are shown and parsed in | the component looked in the page for the first element with the class `time-format` when it mounted and followed that element's `change` events. So it stayed on `hh:mm:ss.uuu` when no `TimeFormatSelect` was on the page or one was mounted later, did not follow `setTimeFormat()` called from code, and on a page with two players followed the first player's select | the bound one of `@waveform-playlist/browser` shows the provider's `timeFormat` under both providers, whatever is on the page. The controlled one of `@waveform-playlist/ui-components` takes `format` (default `hh:mm:ss.uuu`) and reads nothing from the page: pass it the format your own select holds |
| `AnnotationsTrack` replaced by `AnnotationBoxesWrapper` | a positioned container, default height 100, no `z-index` | the wrapper has `z-index: 110` and a default height of 30: write `height={100}`, and check what it now covers or is covered by |
| `useAnnotationControls()` replaced by your own state | `linkEndpoints` started `true`, `continuousPlay` `false` | whatever your `useState` starts with. The provider's options (`useAnnotationOptions()`) start `false` unless `annotationList` says otherwise |
| `SnapTo` imported from `@waveform-playlist/ui-components` | `'bar' \| 'beat' \| 'off'` | a TypeScript error (types only: nothing changes at runtime). The type is `BeatsAndBarsSnapTo` |
| A removed function called in plain JavaScript (`useAnnotationControls()`, `useTrackControls()`, a conversion imported from `@waveform-playlist/ui-components`, `getShortcutLabel` imported from either package) | ran | a TypeScript error. Without TypeScript: a failed build, or a `TypeError` where the import is `undefined`, depending on the bundler (see above) |

Not changed: `AnnotationProvider`, `AnnotationBox`, `AnnotationBoxesWrapper`, `AnnotationText`, `parseAeneas` and `serializeAeneas` of `@waveform-playlist/annotations`; `WaveformAnnotationBoxes` and `AnnotationList` of `@waveform-playlist/browser`, which still draw nothing without `<AnnotationProvider>`; `useAnnotationIntegration()` and `AnnotationIntegrationProvider`, still exported by `@waveform-playlist/browser`; `AudioPosition` of `@waveform-playlist/browser`; `SnapTo` and the conversion functions of `@waveform-playlist/core`; the five controls that `@waveform-playlist/ui-components` and `@waveform-playlist/browser` both export.

### What to check after the replacement

1. Search every import from `@waveform-playlist/browser` for the names in the "Moved" table, and the whole project for `getShortcutLabel`: none may remain.
2. Search for `checked=` and `onChange=` on the three annotation checkboxes and for `annotations=` on `DownloadAnnotationsButton`: none may remain.
3. With a strict package manager, every `@waveform-playlist/*` package you now import from is in your `package.json`.

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
    isRecording && recordingTrackId
      ? {
          isRecording: true,
          trackId: recordingTrackId, // NOT the selected track id: see "a take stays on its track" below
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
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import type { ClipTrack } from '@waveform-playlist/core';
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

**When the function is called:** each time a track's audio graph is built, with the `trackEffects` function from the latest render. Passing a new function identity rebuilds nothing, so an inline arrow is fine. Returning a different effects function for a track that is already built takes effect the next time that track is built. So return the same function for the same track id for as long as the track exists; to change what a track's chain does while it plays, change the chain behind a stable function, which is what `useTrackDynamicEffects()` does.

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

## A track has a kind: audio or MIDI, never both

**Packages:** `@waveform-playlist/core`, `@waveform-playlist/engine`, `@waveform-playlist/playout`, `@waveform-playlist/browser`, `@waveform-playlist/recording`, `@waveform-playlist/midi`.

`ClipTrack` has a new required field, `kind: 'audio' | 'midi'`. Every clip on an audio track is an audio clip, and every clip on a MIDI track has `midiNotes`. Before, a track could hold both, and the kind was guessed from the clips.

What sets it:

- `createTrack({ name, clips })` makes an audio track; pass `kind: 'midi'` for a MIDI track.
- `useAudioTracks` and `useDynamicTracks` make audio tracks. `useMidiTracks` makes MIDI tracks.
- A track object you write by hand needs the field. A MIDI track without it is read as an audio track and rejected.

:::danger A track that breaks the rule throws

`PlaylistEngine.setTracks()`, `addTrack()` and `updateTrack(id, track)` throw an `Error` for a track whose clips do not match its kind, before changing anything. The message names the track and the clip.

**In `WaveformPlaylistProvider` the error does not reach React, so an error boundary will not catch it.** The provider reports it instead:

- the `onError` prop is called with the error;
- `[waveform-playlist] Error loading audio: …` is logged as a console warning (when the bad track was appended to a running playlist, `Incremental add failed, falling through to full rebuild: …` is logged first, and none of the tracks appended with it are added);
- the playlist stays in its loading state (`isReady` false, `data-playlist-state="loading"`) and plays nothing, until `tracks` is valid again.

With `deferEngineRebuild` set, the report comes when the deferral ends, because that is when the engine is next built.

**Pass `onError` to the provider.** Without it, the only sign of a rejected track is the console warning and a playlist that never becomes ready.

```tsx
<WaveformPlaylistProvider tracks={tracks} onError={(error) => showProblem(error.message)}>
```

If you call a `PlaylistEngine` yourself, the throw is synchronous: wrap the call in `try`/`catch`, or call `assertTrackKind(track)` from `@waveform-playlist/core` first.

:::

**Find:**

- Track objects written by hand: object literals typed `ClipTrack`, and anything pushed into the provider's `tracks` that did not come from `createTrack` or one of the loading hooks. TypeScript reports each one (`Property 'kind' is missing`).
- Tracks holding `midiNotes` clips that are built with `createTrack({ … })` and no `kind`.
- Saved projects: track data stored before this release has no `kind`.
- Tracks that hold audio clips and MIDI clips together.

**Replace with:**

```tsx
// Before
const drums: ClipTrack = { id: 'drums', name: 'Drums', clips, muted: false, soloed: false, volume: 1, pan: 0 };
const keys = createTrack({ name: 'Keys', clips: [midiClip] });

// After
const drums: ClipTrack = { id: 'drums', kind: 'audio', name: 'Drums', clips, muted: false, soloed: false, volume: 1, pan: 0 };
const keys = createTrack({ name: 'Keys', kind: 'midi', clips: [midiClip] });
```

For saved data and for tracks that mixed the two, `splitTrackByKind(track)` from `@waveform-playlist/core` gives back valid tracks:

```tsx
import { splitTrackByKind } from '@waveform-playlist/core';

const tracks = savedTracks.flatMap((track) => splitTrackByKind(track));
```

The argument may lack `kind`, so saved data type-checks without a cast.

- A track whose clips are all of one kind comes back as one track with that kind set. An empty track keeps the kind it has, or becomes an audio track.
- A track holding both comes back as two. The audio track keeps the id; the MIDI track gets the id plus `-midi` (or the id you pass as the second argument) and the same name, volume, pan, mute and solo.

After a split the two tracks are separate: each has its own fader, mute and solo, and its own effects chain. If you key `trackEffects` or other per-track state by id, give the new MIDI track its own entry.

**What else changes:**

- **Rendering.** A MIDI track is drawn as a piano roll, including while it is empty, and an audio track never is. `'piano-roll'` is no longer a render mode: see [the section below](#piano-roll-is-removed-from-rendermode).
- **Recording.** A take cannot be recorded onto a MIDI track, and a take now stays on the track it was started on. See [the next section](#useintegratedrecording-a-take-stays-on-its-track-pass-recordingtrackid-to-the-preview): it needs a code change in every app that shows the live preview.
- **Tone.js adapter (`createToneAdapter`).** A track is one playout track under its own id. The second playout track that a mixed track used to get, under the id plus `:midi`, no longer exists; if you reached into `TonePlayout` with that id, use the track's id. The `trackInput` getter of `ToneTrack`, which existed to join the two, is removed: a track's effects function already receives that node as its first argument.

## `'piano-roll'` is removed from `RenderMode`

**Packages:** `@waveform-playlist/core`, `@waveform-playlist/ui-components`, `@waveform-playlist/browser`.

`RenderMode` is now `'waveform' | 'spectrogram' | 'both'`. A piano roll is not a mode you choose: it is how a MIDI track is drawn. Render modes apply to audio tracks only, and a `renderMode` or spectrogram override on a MIDI track does nothing. With the spectrogram integration mounted, the default track panel of a MIDI track no longer shows the track menu (the render-mode choices and the spectrogram settings).

**Find:** the string `'piano-roll'` in TypeScript or JSX: `renderMode: 'piano-roll'` on a track, `renderMode="piano-roll"` on `<SmartChannel>`, comparisons such as `mode === 'piano-roll'`, and `switch` statements over `RenderMode`. TypeScript reports each one.

**Replace with:**

```tsx
// Before: a track drawn as a piano roll
const keys = createTrack({ name: 'Keys', clips: [midiClip], renderMode: 'piano-roll' });

// After: a MIDI track
const keys = createTrack({ name: 'Keys', kind: 'midi', clips: [midiClip] });
```

```tsx
// Before: asking a track how it is drawn
const isPianoRoll = track.renderMode === 'piano-roll';

// After
const isPianoRoll = track.kind === 'midi';
```

If you render `<SmartChannel>` from `@waveform-playlist/ui-components` yourself, it now draws a piano roll whenever it is given `midiNotes` (an empty array included; `null` and `undefined` mean an audio clip) and ignores `renderMode` and the spectrogram props for that clip:

```tsx
// Before
<SmartChannel renderMode="piano-roll" midiNotes={clip.midiNotes} {...rest} />

// After
<SmartChannel midiNotes={clip.midiNotes} {...rest} />
```

Pass `midiNotes` only for a MIDI clip, and pass the same array while the notes are unchanged: before, a missing `midiNotes` in piano-roll mode was drawn as an empty piano roll; now a missing `midiNotes` means an audio clip.

In a page rendered by `<Waveform>`, the channel element of each MIDI clip has the attribute `data-piano-roll`, and each track row has `data-track-kind="audio"` or `"midi"`, for styling and tests.

## `useIntegratedRecording`: a take stays on its track; pass `recordingTrackId` to the preview

**Packages:** `@waveform-playlist/recording`.

:::warning Change `recordingState.trackId` in every recording UI

`useIntegratedRecording` returns a new field, **`recordingTrackId`**. Pass it as `recordingState.trackId` on `<Waveform>` in place of the selected track id. If you keep passing the selected track id, the live preview is drawn on whichever track the user selects during a take, while the finished clip is added to the track the take was started on.

:::

What changed:

- **The take belongs to the track it was started on.** The track that is selected when `startRecording()` is called receives the clip. Before, the clip went to whichever track was selected when the take _stopped_, so selecting another track mid-take moved it. The target can no longer be switched while a take is running, as in `<daw-editor>`.
- **`recordingTrackId: string | null`** is that track's id while a take is running, and `null` whenever `isRecording` is false: before a take, after it stops (also when it stops by itself because the microphone was unplugged), and after a start that failed.
- **A MIDI track is refused.** `startRecording()` returns `false` and sets `error` when the selected track is a MIDI track. Before, the take was added to the MIDI track and replaced the MIDI clips it overlapped.
- **A second `startRecording()` while a take is running or starting returns `false`** and changes nothing.

**Find:** `recordingState=` on `<Waveform>` (or `PlaylistVisualization`), and any other place that uses the selected track id to mean "the track being recorded": a guard that stops the take when that track is removed, a label that names it, a call to `setRecordingActive(true, trackId)` made after the take has started.

**Replace with:**

```tsx
// Before
const { isRecording, progress, startRecording, stopRecording } =
  useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime });

<Waveform
  recordingState={
    isRecording && selectedTrackId
      ? { isRecording: true, trackId: selectedTrackId, startSample, progress, bits: 16 }
      : undefined
  }
/>

// After
const { isRecording, progress, recordingTrackId, startRecording, stopRecording } =
  useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime });

<Waveform
  recordingState={
    isRecording && recordingTrackId
      ? { isRecording: true, trackId: recordingTrackId, startSample, progress, bits: 16 }
      : undefined
  }
/>
```

```tsx
// Before: stop the take when its track is removed
if (isRecording && removedTrack.id === selectedTrackId) await stopRecording();

// After
if (isRecording && removedTrack.id === recordingTrackId) await stopRecording();
```

The third argument of `useIntegratedRecording` is still the selected track id: it decides where the _next_ take starts.

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

## Web components: `<daw-track kind="midi">` declares a MIDI track

**Packages:** `@dawcore/components`.

This entry is for code that uses `<daw-editor>`. A `<daw-track>` now has a `kind` attribute, `audio` (the default) or `midi`, and holds clips of that kind only. `render-mode="piano-roll"` no longer exists: a MIDI track is always drawn as a piano roll, and `render-mode` (`waveform` or `spectrogram`) is for audio tracks. The old value, on the attribute or in `addTrack` / `updateTrack`, logs a console warning that names `kind="midi"` and is treated as `waveform`.

`editor.loadMidi()` and `editor.addTrack({ midi: { notes } })` set the kind for you and need no change.

**Find:**

- `<daw-track render-mode="piano-roll">` in markup, and `setAttribute('render-mode', 'piano-roll')` / `track.renderMode = 'piano-roll'` in scripts.
- `editor.addTrack({ renderMode: 'piano-roll', clips: [{ midiNotes }] })`.
- A `<daw-track>` that has both `<daw-clip src>` children and clips with `midiNotes`.

**Replace with:**

```html
<!-- Before -->
<daw-track name="Piano" render-mode="piano-roll"></daw-track>

<!-- After -->
<daw-track name="Piano" kind="midi"></daw-track>
```

```typescript
// Before
await editor.addTrack({ name: 'Piano', renderMode: 'piano-roll', clips: [{ midiNotes }] });

// After
await editor.addTrack({ name: 'Piano', kind: 'midi', clips: [{ midiNotes }] });
```

Put audio clips and MIDI clips on separate `<daw-track>` elements.

**What happens to a clip of the wrong kind:** it is not added, and the editor dispatches `daw-clip-error` with `{ trackId, clipId, error }` (`clipId` is `''` for a clip with no `<daw-clip>` element, such as the `<daw-track src>` shorthand). This covers:

- when a track loads: a MIDI clip (no `src`) on an audio track, and a `<daw-clip src>` on a MIDI track;
- `editor.addClip()` with a `src` onto a MIDI track (the promise rejects, nothing is fetched);
- `midiNotes` assigned to a source-less clip of an audio track.

If every clip of a track is refused, `daw-track-error` follows and `addTrack()` rejects. Listen for `daw-clip-error`: an un-migrated `render-mode="piano-roll"` track shows up as that event and an empty track.

Not covered: a source-less `<daw-clip>` appended to a track that has already loaded is ignored without an event, on a track of either kind. Adding a MIDI clip to a loaded track was not supported before this release either; put MIDI clips in the track when you create it.

Also:

- Set `kind` before the track is added to the editor. A later change is undone: the editor logs a console warning and sets the element's `kind` back.
- `editor.startRecording()` onto a MIDI track records nothing and dispatches `daw-recording-error`.
- `editor.tracks` entries have a `kind` field, and `TrackConfig` (the argument of `addTrack`) an optional one. The exported `TrackDescriptor` and `TrackWithId` types therefore have a new required field: code that builds one of them by hand must add `kind`.

