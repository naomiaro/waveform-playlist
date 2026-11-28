---
sidebar_position: 3
description: 'Upgrade guide for the next major release of the Waveform Playlist React packages: every breaking change with its before/after'
---

# Upgrading to the next major

This page lists every breaking change in the next major release of the React packages, in the order you should apply them. Each entry says what changed, how to find affected code, and what to replace it with.

It is written to be followed mechanically, by a person or by a coding agent: search for the pattern under **Find**, apply the change under **Replace with**.

Each package is versioned independently, so "the next major" is a different number per package. Upgrade all `@waveform-playlist/*` packages together.

## React 19 is required

**Packages:** `@waveform-playlist/browser`, `ui-components`, `annotations`, `spectrogram`, `recording`. (`@waveform-playlist/midi` is no longer published, and its replacement `@dawcore/midi` has no `react` peer dependency: see [`@waveform-playlist/midi` is replaced by `@dawcore/midi`](#waveform-playlistmidi-is-replaced-by-dawcoremidi).)

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

## Install `@waveform-playlist/playout` yourself

**Package:** `@waveform-playlist/ui-components`, which every install of `@waveform-playlist/browser` brings in.

`ui-components` no longer depends on `@waveform-playlist/playout`. It never imported it, but because it was listed, every install of `@waveform-playlist/browser` also installed `playout` and its peer `tone`. A project that uses `WaveformPlaylistProvider`'s default Tone.js engine without listing `playout` in its own `package.json` (the stable README's `npm install @waveform-playlist/browser tone @dnd-kit/react` is one) got the engine only that way, and now has none: the bundler cannot resolve `@waveform-playlist/playout`, or, when the build goes through, the provider reports "@waveform-playlist/playout (and its peer `tone`) is required for the default WebAudio engine" through `onError`.

Projects on `MediaElementPlaylistProvider` or an adapter of their own (`createAdapter`) no longer install `playout` and `tone`. Their code needs no change, but browser's build still contains `import("@waveform-playlist/playout")`, and some tools follow it although the app never reaches it ([#892](https://github.com/naomiaro/waveform-playlist/issues/892)):

- esbuild (`--bundle`) stops with `Could not resolve "@waveform-playlist/playout"`. Mark it external, as below.
- webpack 5 builds and prints the warning `Module not found: Error: Can't resolve '@waveform-playlist/playout'`.
- Vite builds as before.
- TypeScript with `skipLibCheck: false` reports `Cannot find module '@waveform-playlist/playout'` from browser's type declarations. With `skipLibCheck: true` it does not.

**Find:** `@waveform-playlist/playout` in your `package.json`. If it is missing and the project renders `WaveformPlaylistProvider` without `createAdapter`, or imports from `@waveform-playlist/browser/tone` or `@waveform-playlist/playout`, add it.

**Replace with:**

```bash
npm install @waveform-playlist/playout tone
```

**Find (esbuild, without the Tone.js engine):** an esbuild build of a project that has no `@waveform-playlist/playout` in its `package.json`.

**Replace with:** `--external:@waveform-playlist/playout` on the command line, or `external: ['@waveform-playlist/playout']` in the build options. With an adapter of your own and no `@waveform-playlist/media-element-playout` installed, mark that one external too; esbuild asked for it before this change as well.

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

## A track keeps the pan law of its first audio

**Packages:** `@waveform-playlist/core`, `engine`, `playout`, `browser`.

Every audio track now has a pan law of its own, `'mono'` or `'stereo'`. It is decided by the first decoded audio the track holds and then kept; it is a mixer value of the arrangement, beside `pan`. Previously the law was derived from the track's clips each time the track was built (the highest channel count among them): it changed when a change to the tracks rebuilt the engine, and the WAV export derived it again from the clips it was given.

**What you will hear:**

- A track of mono clips only, or of stereo clips only, sounds as before.
- A stereo clip added to a track of mono clips (a file dropped on it, a recorded take) no longer makes the mono clips 3 dB louder at centre. The stereo clip plays under the track's mono law: 3 dB lower at centre than on a stereo-law track, and a hard pan mutes one side instead of folding it in.
- Removing the last stereo clip from such a track no longer makes the mono clips 3 dB quieter.
- A track that was emptied keeps its law for the next audio it is given. So does a track id you reuse: `setTracks` or `updateTrack` with an id the arrangement already holds keeps that id's law, as it keeps its volume and pan. Use a new id for new material (the default: `audioTrack()` and `createTrack()` generate one), or set the law.
- A new track whose first clips are a mono file and a stereo file, both loading, takes the law of whichever finishes first. Previously it had the stereo law once both were in.

**Find:** nothing to search for in most apps. If you want a particular law on a track that mixes mono and stereo clips, say so (the built-in track controls have no pan-law control, so a person using your app can change it only through one you draw):

```tsx
// When the track is made
audioTrack({ src: '/audio/room.wav', panLaw: 'stereo' });

// Later (an undo step)
const { setTrackPanLaw } = useEditorControls();
setTrackPanLaw(trackId, 'stereo');
```

**Find:** code that builds a `TrackState` object (the items of `usePlaylistMixer().trackStates`), for example in a test or a story.

**Replace with:** the same object with a `panLaw`:

```tsx
// Before
const state: TrackState = { name: 'Vocals', muted: false, soloed: false, volume: 1, pan: 0 };

// After
const state: TrackState = {
  name: 'Vocals',
  muted: false,
  soloed: false,
  volume: 1,
  pan: 0,
  panLaw: 'auto',
};
```

The states you pass to `exportWav(tracks, trackStates)` may leave `panLaw` out: a track is then exported with its own law.

**Find:** a `PlayoutAdapter` of your own.

**Replace with:** read the law from the track you are given, with `trackPanLaw(track)` from `@waveform-playlist/core` (`track.panLaw` when it is `'mono'` or `'stereo'`, else the law of the track's clips). Optionally add `setTrackPanLaw(trackId, panLaw)`; without it the engine sends the track again through `updateTrack` when only the law changed. An adapter that goes on deriving the law from the clips will disagree with the WAV export on a track that mixes mono and stereo clips.

**Find:** `channelCount` in the options of a `ToneTrack` you construct yourself, or of `TonePlayout.addTrack` (`@waveform-playlist/playout`). It set the channel count of the track's panner.

**Replace with:** `panLaw`. TypeScript reports a leftover `channelCount` in an object literal; in plain JavaScript it is ignored, and the track gets the mono law.

```tsx
// Before
playout.addTrack({ clips, track, channelCount: 2 });

// After
playout.addTrack({ clips, track, panLaw: 'stereo' }); // channelCount: 1 → panLaw: 'mono'
```

`createToneAdapter()` passes the law itself; only code that builds playout tracks directly is affected.

The [effects guide](./guides/effects.md#a-tracks-pan-law) describes the two laws.

## `PlayoutProvider`, `usePlayoutStatus` and `usePlayoutStatusUpdate` are removed

**Package:** `@waveform-playlist/ui-components`.

These three exports were a standalone playback-status context (`progress`, `isPlaying`, `selectionStart`, `selectionEnd` and their setters) left over from before the playlist providers existed. Nothing in Waveform Playlist read or wrote it, so it never reflected real playback.

**Find:** `PlayoutProvider`, `usePlayoutStatus` or `usePlayoutStatusUpdate` imported from `@waveform-playlist/ui-components`.

**Replace with:** the hooks of the provider you already render, from `@waveform-playlist/browser`. Delete the `<PlayoutProvider>` wrapper.

| Removed                                               | Under either provider                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `usePlayoutStatus().isPlaying`                        | `useIsPlaying().isPlaying`                                                                             |
| `usePlayoutStatus().progress`                         | `useCurrentTime().currentTime` (seconds), or `usePlaybackRefs().currentTimeRef` for per-frame reads    |
| `usePlayoutStatus().selectionStart` / `.selectionEnd` | `useSelection().selectionStart` / `.selectionEnd`                                                      |
| `usePlayoutStatusUpdate().setIsPlaying(true / false)` | `usePlaybackControls().play()` / `.pause()`                                                            |
| `usePlayoutStatusUpdate().setProgress(t)`             | `usePlaybackControls().seekTo(t)`                                                                      |
| `usePlayoutStatusUpdate().setSelection(start, end)`   | `usePlaybackControls().setSelection(start, end)`                                                       |

```tsx
// Before
import { PlayoutProvider, usePlayoutStatus } from '@waveform-playlist/ui-components';

function Status() {
  const { isPlaying, selectionStart, selectionEnd } = usePlayoutStatus();
  // ...
}

// After
import { useIsPlaying, useSelection } from '@waveform-playlist/browser';

function Status() {
  const { isPlaying } = useIsPlaying();
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

The deprecated `renderTimestamp` prop was typed as `(timeMs, pixelPosition) => ReactNode`, but it never received a time in milliseconds: it was given `parseFloat` of the formatted tick label, which is the minutes part (`"0:30"` → `0`, `"1:00"` → `1`), or the bar and beat read as a decimal number in beats mode (`"2.3"` gave `2.3`). It is removed; `renderTick` is the only label callback. It is an option of the timescale part, `<WaveformTimescale renderTick>`, in a composition of the view (see [the view is composed from parts](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed)).

**Find:** `renderTimestamp=` on `<Waveform>`.

**Replace with:** `renderTick`, which receives the formatted label and the same pixel position.

```tsx
// Before
<Waveform renderTimestamp={(timeMs, pixelPosition) => <MyLabel time={timeMs} />} />

// After: show the label as it is
<WaveformRoot>
  <WaveformTimescale renderTick={(label, pixelPosition) => <MyLabel text={label} />} />
  <WaveformTrackControls />
  <WaveformTracks />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
```

If the old callback really needs milliseconds, parse the label. In the temporal scale it is always `m:ss` on a whole second:

```tsx
function labelToMs(label: string): number {
  const [minutes, seconds] = label.split(':').map(Number);
  return (minutes * 60 + seconds) * 1000;
}

<WaveformTimescale renderTick={(label, pixelPosition) => <MyLabel time={labelToMs(label)} />} />;
```

Inside `BeatsAndBarsProvider` with `scaleMode="beats"` the label is bar and beat (`"2"`, `"2.3"`), not a time, and `labelToMs` does not apply.

## `audioBuffers` is removed from `usePlaylistData()`

**Package:** `@waveform-playlist/browser`.

`usePlaylistData().audioBuffers` was a flat list of every clip's `AudioBuffer`, filled in by an effect, so it lagged `tracks` by at least one render. Nothing in the library read it. The buffers are on the clips. (`usePlaylistData()` itself is replaced by smaller hooks: see [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields). `tracks` is on `usePlaylistTimeline()`.)

**Find:** `audioBuffers` read from `usePlaylistData()`.

**Replace with:** the clips of `tracks`, which is current in every render:

```tsx
// Before
const { audioBuffers } = usePlaylistData();

// After
const { tracks } = usePlaylistTimeline();
const audioBuffers = tracks.flatMap((track) =>
  track.clips.flatMap((clip) => (clip.audioBuffer ? [clip.audioBuffer] : []))
);
```

Two related values keep their names and types (now on `usePlaylistTimeline()`) but are derived from the tracks during render instead of being set by an effect:

- `duration` and `peaksDataArray` already match `tracks` in the render that has the new tracks. Code that waited a render for them (for example an effect that compared `peaksDataArray.length` with `tracks.length`) no longer needs to.
- `peaksDataArray` keeps the identity of everything that did not change: a clip's `peaks`, its entry, and its track's array. It is safe to use them as memo or effect dependencies.
- `<Waveform>` no longer renders the text "Loading waveform..." before the first peaks; clips render at once and their waveforms fill in.
- `<Waveform className="…">` (and `<WaveformRoot className="…">`) now sets the class on the playlist's outermost element (the one with `data-playlist-state`). Before, the class was only on the "Loading waveform..." placeholder and disappeared once the playlist rendered, so check that a class you pass there has the styles you want on the whole playlist.

## `formatTime` is removed from `usePlaylistControls()`, and `minimumPlaylistHeight` from `usePlaylistData()`

**Package:** `@waveform-playlist/browser`.

Nothing in the library read either field.

`usePlaylistControls().formatTime` formatted a time in the playlist's current time format. It was a new function after every `setTimeFormat`, which made the whole controls value change, so every component that called `usePlaylistControls()` rendered again. The controls that replace it (`usePlaybackControls()`, `useEditorControls()`: see [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers)) never change, neither with the time format nor with `duration`.

**Find:** `formatTime` read from `usePlaylistControls()`.

**Replace with:** `formatTime` from `@waveform-playlist/ui-components` and the `timeFormat` from `usePlaylistSettings()`:

```tsx
// Before
const { formatTime } = usePlaylistControls();
const label = formatTime(seconds);

// After
import { formatTime } from '@waveform-playlist/ui-components';

const { timeFormat } = usePlaylistSettings();
const label = formatTime(seconds, timeFormat);
```

`useTimeFormat()` is unchanged: it is a separate hook with its own state, and it still returns `formatTime`.

**Find:** `minimumPlaylistHeight` read from `usePlaylistData()`.

**Replace with:** the same sum, from the values that hold it now: the tracks from `usePlaylistTimeline()`, and inside a root of the view the row height and the timescale height from `usePlaylistInfo()` (`@waveform-playlist/ui-components`; `waveHeight` is set with `<WaveformViewOptions>`, see [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers)):

```tsx
// Before
const { minimumPlaylistHeight } = usePlaylistData();

// After (in a component drawn inside a root)
import { usePlaylistInfo } from '@waveform-playlist/ui-components';

const { tracks } = usePlaylistTimeline();
const { waveHeight, timeScaleHeight } = usePlaylistInfo();
const minimumPlaylistHeight = tracks.length * waveHeight + timeScaleHeight;
```

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

// After (`<WaveformEditor />` is the view with clip headers and fades: see the view parts entry)
<ClipInteractionProvider touchOptimized>
  <WaveformEditor />
</ClipInteractionProvider>
```

**If `touchOptimized` was on the `<Waveform>` but not on the provider**, you had wide handles with the normal mouse-tuned sensors. Moving the flag to the provider would also add the 250ms touch-hold delay. To keep exactly what you had, set only the handle width:

```tsx
// Before
<ClipInteractionProvider>
  <Waveform showClipHeaders touchOptimized />
</ClipInteractionProvider>

// After
import { ClipInteractionOptions, WaveformEditor } from '@waveform-playlist/browser';

<ClipInteractionProvider>
  <ClipInteractionOptions touchOptimized>
    <WaveformEditor />
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
import { ClipInteractionOptions, WaveformEditor } from '@waveform-playlist/browser';

<DragDropProvider sensors={sensors} /* … */>
  <ClipInteractionOptions enabled touchOptimized>
    <WaveformEditor />
  </ClipInteractionOptions>
</DragDropProvider>
```

Use `enabled` alone where you had `interactiveClips` alone.

**In plain JavaScript nothing reports a leftover prop.** `<Waveform interactiveClips>` and `<Waveform touchOptimized>` are ignored without a warning (TypeScript reports them). With your own `DragDropProvider` the visible result is clips that no longer drag and have no trim handles, so search for both names before you run the app.

**Behaviour that changes without a code change:**

- `<ClipInteractionProvider touchOptimized>` now also widens the trim handles, from 8px to 24px. If you set the flag on the provider only and want to keep the narrow handles, nest `<ClipInteractionOptions touchOptimized={false}>` inside the provider.
- A view used directly inside a `ClipInteractionProvider` has interactive clips, whatever root or composition it is (`<PlaylistVisualization>` did not pick that up from the provider before; it is replaced by the view's parts). To keep them static, nest `<ClipInteractionOptions enabled={false}>`.
- `<Waveform interactiveClips={false}>` inside a `ClipInteractionProvider` never switched interaction off (the provider's value won). `<ClipInteractionOptions enabled={false}>` does.
- A `ClipInteractionProvider` without `touchOptimized` now inherits it from a `ClipInteractionProvider` or `ClipInteractionOptions` above it. If you nest a plain provider inside `<ClipInteractionProvider touchOptimized>`, the inner one used to have mouse-tuned sensors and 8px handles; it now has the 250ms touch-hold sensors and 24px handles. Set `touchOptimized={false}` on the inner provider to keep what you had.
- A `ClipInteractionProvider` always makes the clips below it interactive, also inside `<ClipInteractionOptions enabled={false}>`. Put `<ClipInteractionOptions enabled={false}>` inside the provider to switch interaction off.
- `useClipInteractionEnabled()` used to mean "inside a `ClipInteractionProvider`". It now means "clips here can be dragged and trimmed": also true inside `<ClipInteractionOptions enabled>` with no provider, and false under `<ClipInteractionOptions enabled={false}>` inside one. Do not use it to detect the provider.

## `selectionStart` and `selectionEnd` move from `usePlaylistState()` to `useSelection()`

**Package:** `@waveform-playlist/browser`.

The selection changes on every pointer move of a selection drag; nothing else in `usePlaylistState()` does. While it was part of that hook's value, every component that called `usePlaylistState()` for any field (an annotation list reading `annotations`, a loop button reading `isLoopEnabled`) re-rendered on every pointer move. It now has its own context and hook. `usePlaylistState()` no longer has `selectionStart` or `selectionEnd`; reading them from it gives `undefined` (a type error in TypeScript).

**Find:** `selectionStart` or `selectionEnd` destructured or read from `usePlaylistState()`.

**Replace with:** `useSelection()`. The other fields of `usePlaylistState()` are on their own hooks too (`isLoopEnabled` on `useLoop()`: see [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields)):

```tsx
// Before
import { usePlaylistState } from '@waveform-playlist/browser';

const { selectionStart, selectionEnd, isLoopEnabled } = usePlaylistState();

// After
import { useLoop, useSelection } from '@waveform-playlist/browser';

const { selectionStart, selectionEnd } = useSelection();
const { isLoopEnabled } = useLoop();
```

`setSelection(start, end)` is on `usePlaybackControls()`. `useSelection()` works under either provider.

A component that calls `useSelection()` re-renders on every pointer move of a drag, so call it in the smallest component that shows the selection, not in a component that also renders a long list.

Fixed along the way: dragging a selection from right to left now selects the whole dragged range. Before, the range collapsed to the last pointer movement.

## `currentTime` moves from `usePlaybackAnimation()` to `useCurrentTime()`

**Package:** `@waveform-playlist/browser`.

`currentTime` is where the cursor rests: it changes on a seek, a pause, a stop and a selection whose start moves, and it does not advance during playback. While it was part of `usePlaybackAnimation()`, every component that called that hook for `isPlaying` or for a ref (a transport button, the whole playlist visualization, an app component that only wanted `currentTimeRef`) re-rendered on every seek and on every pointer move of a selection drag to the left. It now has its own context and hook. `usePlaybackAnimation()` no longer has `currentTime`; reading it from there gives `undefined` (a type error in TypeScript).

**Find:** `currentTime` destructured or read from `usePlaybackAnimation()`.

**Replace with:** `useCurrentTime()`. The other fields of `usePlaybackAnimation()` are on `useIsPlaying()` and `usePlaybackRefs()` (see [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields)):

```tsx
// Before
import { usePlaybackAnimation } from '@waveform-playlist/browser';

const { currentTime, isPlaying } = usePlaybackAnimation();

// After
import { useCurrentTime, useIsPlaying } from '@waveform-playlist/browser';

const { currentTime } = useCurrentTime();
const { isPlaying } = useIsPlaying();
```

If the value is only needed inside an event handler or a callback, do not subscribe at all; read the ref when the handler runs (`usePlaybackRefs()` never re-renders the component that calls it):

```tsx
const { currentTimeRef } = usePlaybackRefs();
const addMarker = () => createMarkerAt(currentTimeRef.current ?? 0);
```

**Also find (a search for `currentTime` misses it):** every component that called `usePlaybackAnimation()` and read `currentTimeRef.current` (or `visualTimeRef.current`) while rendering, or in an effect without a dependency array, to show the position while stopped. It used to be re-rendered by `usePlaybackAnimation()` on every seek; with the ref from `usePlaybackRefs()` it is not, so its display would stay at the old position after a seek, a pause-and-seek or a selection change. Search for `currentTimeRef.current` and `visualTimeRef.current` and check each use that is not inside an event handler or a frame callback.

**Replace with:** a `useCurrentTime()` call in that component, and use its value:

```tsx
// Before: re-rendered by usePlaybackAnimation() on a seek
const { isPlaying, currentTimeRef } = usePlaybackAnimation();
useEffect(() => {
  if (!isPlaying) label.current.textContent = format(currentTimeRef.current ?? 0);
});

// After
const { isPlaying } = useIsPlaying();
const { currentTime } = useCurrentTime();
useEffect(() => {
  if (!isPlaying) label.current.textContent = format(currentTime);
}, [isPlaying, currentTime]);
```

A custom `renderPlayhead` function needs no change: it is called again with the new `position` after a seek. `seekTo(t)` is on `usePlaybackControls()` and `setCurrentTime(t)` on `useEditorControls()`. `useCurrentTime()` works under either provider.

## `activeAnnotationId` moves from `usePlaylistState()` to `useActiveAnnotation()`

**Package:** `@waveform-playlist/browser`.

The active annotation changes at every annotation boundary during playback; nothing else in `usePlaylistState()` does. While it was part of that hook's value, every component that called `usePlaylistState()` for any field re-rendered at each boundary. It now has its own context and hook. `usePlaylistState()` no longer has `activeAnnotationId`; reading it from there gives `undefined` (a type error in TypeScript).

**Find:** `activeAnnotationId` destructured or read from `usePlaylistState()`.

**Replace with:** `useActiveAnnotation()`. `annotations` is on `useAnnotations()`:

```tsx
// Before
import { usePlaylistState } from '@waveform-playlist/browser';

const { annotations, activeAnnotationId } = usePlaylistState();

// After
import { useAnnotations, useActiveAnnotation } from '@waveform-playlist/browser';

const { annotations } = useAnnotations();
const { activeAnnotationId } = useActiveAnnotation();
```

`setActiveAnnotationId(id)` is on `usePlaybackControls()`. `useActiveAnnotation()` works under either provider (under `MediaElementPlaylistProvider` it replaces `useMediaElementState().activeAnnotationId`).

A component that calls `useActiveAnnotation()` re-renders at every annotation boundary during playback, so call it in a small component that shows the active annotation, not in the component that renders the whole page.

## `usePlaylistData()`, `usePlaylistState()` and `usePlaybackAnimation()` are replaced by one hook per group of fields

**Packages:** `@waveform-playlist/browser`, `@waveform-playlist/ui-components`, `@waveform-playlist/spectrogram`.

Four hooks are removed from `@waveform-playlist/browser`: `usePlaylistData()`, `usePlaylistState()`, `usePlaybackAnimation()` and `usePlaylistDataOptional()`. A context subscription is to the whole value, so a component that called `usePlaylistData()` for `sampleRate` also re-rendered on every step of a volume slider and on every pointer move of a trim, and one that called `usePlaybackAnimation()` for a ref re-rendered on play and stop. Each removed hook is replaced by hooks that return one group of fields that change together, so a component re-renders only for the group it reads.

`usePlaylistControls()` and the four MediaElement hooks (`useMediaElementAnimation()`, `useMediaElementState()`, `useMediaElementControls()`, `useMediaElementData()`) are removed too: [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers) says where their fields went. Where an entry on this page says to read a field from `usePlaylistData()`, `usePlaylistState()` or `usePlaybackAnimation()`, use the hook from the tables below.

### The new hooks

All of them are exported from `@waveform-playlist/browser`. The first group works under either provider; the second needs `WaveformPlaylistProvider`. Outside a provider a hook throws `<hook name> must be used within …`, naming the provider or providers that serve it; under the other kind of provider it throws `<hook name> needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it` (or the reverse).

| Hook | Returns | The component re-renders on |
| --- | --- | --- |
| `usePlaylistView()` (either provider) | `sampleRate`, `mono`, `indefinitePlayback` | a provider prop change (and once when the real sample rate is known) |
| `usePlaylistSettings()` (either provider) | `timeFormat`, `isAutomaticScroll` | the user changing either setting |
| `usePlaylistZoom()` (either provider) | `samplesPerPixel`, `canZoomIn`, `canZoomOut` | a zoom |
| `useIsPlaying()` (either provider) | `isPlaying` | play, pause, stop |
| `usePlaybackRefs()` (either provider) | `currentTimeRef`, `visualTimeRef`, `registerFrameCallback`, `unregisterFrameCallback` | never (the value keeps its identity) |
| `useAnnotations()` (either provider) | `annotations` | an annotation edit |
| `useAnnotationOptions()` (either provider) | `editable`, `linkEndpoints`, `continuousPlay` | one of the three being toggled |
| `usePlaylistTimeline()` | `tracks`, `peaksDataArray`, `duration`, `isReady` | every clip operation (a trim once, on release), a zoom (`peaksDataArray` is computed per zoom level), audio or peaks arriving, `isReady` changing |
| `usePlaylistMixer()` | `trackStates`, `masterVolume` | every mute, solo, volume or pan change (each step of a slider drag); tracks added, removed, renamed or reordered |
| `useTrackReorderPreview()` | `trackDragPreview` | every drag-over of a track reorder |
| `useLoop()` | `isLoopEnabled`, `loopStart`, `loopEnd` | a loop change |
| `useSelectedTrackId()` | `selectedTrackId` | another track being selected |
| `useUndoRedo()` | `canUndo`, `canRedo` | after an edit |
| `useEngineRefs()` | `playoutRef`, `playbackStartTimeRef`, `audioStartPositionRef`, `getPlaybackTime`, `getAudioContextTime`, `getLookAhead`, `getOutputLatency` | never (the value keeps its identity) |

The value types are exported too: `PlaylistViewContextValue`, `PlaylistSettingsContextValue`, `PlaylistZoomContextValue`, `IsPlayingContextValue`, `PlaybackRefsContextValue`, `AnnotationsContextValue`, `AnnotationOptionsContextValue`, `PlaylistTimelineContextValue`, `PlaylistMixerContextValue`, `TrackReorderPreviewContextValue`, `LoopContextValue`, `SelectedTrackIdContextValue`, `UndoRedoContextValue` and `EngineRefsContextValue`. `ClipPeaks`, `TrackClipPeaks` and `TrackDragPreview` are exported as well, so every field of these values can be named.

`timeFormat` and `isAutomaticScroll`, the two settings a user toggles, have their own hook and are not part of `usePlaylistView()`: every clip's progress overlay and the view read the view value, so a toggle there would re-render all of them.

### Where each field went

**Find:** `usePlaylistData`, `usePlaylistState`, `usePlaybackAnimation` and `usePlaylistDataOptional` (imports and calls).

**Replace with:** for each field the component reads, the place in the right-hand column. Call each hook once per component and destructure only the fields that component uses.

From `usePlaylistData()`:

| Field | Now from |
| --- | --- |
| `sampleRate` | `usePlaylistView()` |
| `mono` | `usePlaylistView()` |
| `waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` | props of `<WaveformViewOptions>`; inside a root of the view, `usePlaylistInfo()` from `@waveform-playlist/ui-components` (see [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers)) |
| `timeScaleHeight` | the `height` of `<WaveformTimescale>` (30 px without one); inside a root, `usePlaylistInfo().timeScaleHeight` (see [the view is composed from parts](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed)) |
| `controls` | removed: the column is the `<WaveformTrackControls width>` part (same entry) |
| `timeFormat` | `usePlaylistSettings()` |
| `samplesPerPixel`, `canZoomIn`, `canZoomOut` | `usePlaylistZoom()` |
| `tracks`, `peaksDataArray`, `duration`, `isReady` | `usePlaylistTimeline()` |
| `onTracksChange` | removed: see [`WaveformPlaylistProvider` takes an `arrangement`](#waveformplaylistprovider-takes-an-arrangement-tracks-ontrackschange-and-deferenginerebuild-are-removed) |
| `trackStates`, `masterVolume` | `usePlaylistMixer()` |
| `trackDragPreview` | `useTrackReorderPreview()` |
| `trackReorderEpoch` | removed: see [`trackReorderEpoch` and `bumpTrackReorderEpoch` are removed](#trackreorderepoch-and-bumptrackreorderepoch-are-removed-a-reorder-drag-keeps-the-track-panels-mounted) |
| `playoutRef` | `useEngineRefs()` |
| `isDraggingRef` | removed: see [`isDraggingRef` is removed](#isdraggingref-is-removed) |

From `usePlaylistState()`:

| Field | Now from |
| --- | --- |
| `annotations` | `useAnnotations()` |
| `annotationsEditable` | `useAnnotationOptions().editable` |
| `linkEndpoints`, `continuousPlay` | `useAnnotationOptions()` |
| `isLoopEnabled`, `loopStart`, `loopEnd` | `useLoop()` |
| `selectedTrackId` | `useSelectedTrackId()` |
| `canUndo`, `canRedo` | `useUndoRedo()` |
| `isAutomaticScroll` | `usePlaylistSettings()` |
| `indefinitePlayback` | `usePlaylistView()` |
| `fillViewport` | a prop of `<WaveformViewOptions>` (no reader) |

From `usePlaybackAnimation()`:

| Field | Now from |
| --- | --- |
| `isPlaying` | `useIsPlaying()` |
| `currentTimeRef`, `visualTimeRef`, `registerFrameCallback`, `unregisterFrameCallback` | `usePlaybackRefs()` |
| `playbackStartTimeRef`, `audioStartPositionRef`, `getPlaybackTime`, `getAudioContextTime`, `getLookAhead`, `getOutputLatency` | `useEngineRefs()` |

The fields that the entries above moved are on `useSelection()` (`selectionStart`, `selectionEnd`), `useCurrentTime()` (`currentTime`) and `useActiveAnnotation()` (`activeAnnotationId`). The setters (`setSelectedTrackId`, `setLoopEnabled`, `setMasterVolume`, `zoomIn`, `undo` and the rest) are on `useEditorControls()`, and `play`, `pause`, `stop`, `seekTo`, `setSelection` on `usePlaybackControls()`: see [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers).

`usePlaylistDataOptional()` has no public replacement. It existed so that `useAnnotationKeyboardControls` could run under either provider; the hook now reads `samplesPerPixel` and `sampleRate` from either provider itself (options that are passed still win). If your own component called `usePlaylistDataOptional()` to work with or without a provider, take the values it needs as props.

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
  useAnnotations,
  useLoop,
  useSelectedTrackId,
  useUndoRedo,
  useIsPlaying,
  usePlaybackRefs,
  useEngineRefs,
  usePlaybackControls,
} from '@waveform-playlist/browser';

function Toolbar() {
  const { sampleRate } = usePlaylistView();
  const { isAutomaticScroll } = usePlaylistSettings();
  const { samplesPerPixel } = usePlaylistZoom();
  const { tracks, duration } = usePlaylistTimeline();
  const { trackStates, masterVolume } = usePlaylistMixer();
  const { annotations } = useAnnotations();
  const { isLoopEnabled } = useLoop();
  const { selectedTrackId } = useSelectedTrackId();
  const { canUndo, canRedo } = useUndoRedo();
  const { isPlaying } = useIsPlaying();
  const { currentTimeRef, registerFrameCallback, unregisterFrameCallback } = usePlaybackRefs();
  const { playoutRef } = useEngineRefs();
  const { play, pause } = usePlaybackControls();
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

3. **Call `usePlaylistTimeline()` and `usePlaylistMixer()` in the smallest component that needs them.** The timeline value changes on every clip operation (a trim once, on release) and on a zoom (`peaksDataArray` is computed per zoom level), and also when audio or peaks arrive and when `isReady` changes. The mixer value changes on every mute, solo, volume or pan change (each step of a slider drag), and when tracks are added, removed, renamed or reordered. A page-level component that calls either re-renders its whole subtree that often. `useTrackReorderPreview()` changes on every drag-over of a track reorder, and the same advice applies.

4. **`trackDragPreview`** is in `useTrackReorderPreview()`, not in `usePlaylistData()`, and `trackReorderEpoch` is removed ([its entry](#trackreorderepoch-and-bumptrackreorderepoch-are-removed-a-reorder-drag-keeps-the-track-panels-mounted)). A custom track panel needs neither: `renderTrackControls` and `SortableTrackControls` are removed, and the slot around a panel is keyed by the part (see [track controls are composed from pieces](#track-controls-are-composed-from-pieces-bound-to-a-track-the-mixer-setters-take-a-track-id)).

5. **A small timing difference, nothing to migrate.** A `play()` called while a later engine is being built (an `effects` or `zoomLevels` change; a track change builds none) is queued. The playhead, the clip progress overlays and `AudioPosition` move to the queued start position when playback actually starts. Before, they jumped there when the rebuild finished, slightly earlier. If the build fails, playback shows stopped and the cursor stays where it was. (Before the playlist's first ready a `play()` does nothing at all: see [Ready comes once per mount](#ready-comes-once-per-mount-after-the-first-sources-play-does-nothing-before-it).)

### `PlaylistInfoContext` has no `duration`; `SmartScale` takes `durationMs`

**Package:** `@waveform-playlist/ui-components`.

This affects you only if you render `PlaylistInfoContext` or `<SmartScale>` yourself. The roots of the view (`<WaveformRoot>`, `<MediaElementWaveformRoot>` and the compositions built on them) do it for you and need no change.

The context value no longer has a `duration` field. Every channel and track reads `PlaylistInfoContext`, and the displayed length changes when a clip operation moves the end of the timeline, and in steps of 10 seconds while a trim is dragged past it. `<SmartScale>` now takes the length as a required prop, `durationMs`, in milliseconds (the unit the removed field had).

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

1. **The MediaElement player** (`MediaElementWaveform`; `MediaElementPlaylist` is replaced by the view's parts, see [the view is composed from parts](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed)): while an annotation edge is dragged, `onAnnotationsChange` (and `onAnnotationUpdate`) used to be called on every pointer move. The annotations now change once, when the edge is released. During the drag the boxes and the annotation list follow a preview that does not go through your state. (Both callbacks are removed in this major: the release is one write to the annotation store, see [the annotation store entry](#the-annotations-are-an-annotation-stores-annotationlistannotations-and-onannotationschange-are-removed).)
2. **Escape during the drag** (both players, `useAnnotationDragHandlers`) restores every annotation the drag moved. Before, only the dragged annotation was restored.

**Find:** code that relies on `onAnnotationsChange` firing during a drag in the MediaElement player (for example to show the dragged time somewhere of your own).

**Replace with:** read the preview. `annotationPreview` is on `usePlaybackControls()`, under either provider:

```tsx
import {
  useAnnotations,
  usePlaybackControls,
  useAnnotationsWithPreview,
} from '@waveform-playlist/browser';

function DraggedTimes() {
  const { annotations } = useAnnotations();
  const { annotationPreview } = usePlaybackControls();
  // The previewed annotations while an edge is dragged, `annotations` otherwise.
  const shown = useAnnotationsWithPreview(annotations, annotationPreview);
  // ...
}
```

**Optional, for a row of boxes of your own:** if you call `useAnnotationDragHandlers` yourself, nothing changes until you pass the preview; without it every move is written. To get one write per drag and stop re-rendering your component on every move (the hook's `store` option is the [annotation store entry](#useannotationdraghandlers-and-useannotationkeyboardcontrols-take-the-annotation-store)):

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
const { annotationStore, annotationPreview } = usePlaybackControls();
const { sampleRate } = usePlaylistView();
const { samplesPerPixel } = usePlaylistZoom();
const { duration } = usePlaylistTimeline();
const handlers = useAnnotationDragHandlers({
  store: annotationStore,
  preview: annotationPreview,
  samplesPerPixel,
  sampleRate,
  duration,
  linkEndpoints,
});
```

The built-in annotation boxes (`<WaveformAnnotationBoxes>`) and `<AnnotationList>` follow the preview by themselves. A custom annotation renderer needs `useAnnotationsWithPreview` to follow it.

## MediaElement player: the provider owns the selection and runs the one animation loop

**Package:** `@waveform-playlist/browser`.

`MediaElementPlaylistProvider` now keeps the time selection that `MediaElementPlaylist` used to keep in its own state (`MediaElementPlaylist` is replaced by `<MediaElementWaveform />` and the view's parts: see [the view is composed from parts](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed); "the view" below is either), and its animation loop draws the playhead and the progress overlay, which used to run a `requestAnimationFrame` loop each. Seven things behave differently:

1. **The selection survives a remount of `MediaElementPlaylist`** (or `MediaElementWaveform`). Before, unmounting the component dropped the highlighted range. It is now kept for as long as the provider is mounted.
2. **Two `MediaElementPlaylist` under one provider show the same selection.** Before, each had its own. A press on either one while stopped (a click to seek, or the start of a drag) therefore clears the range highlighted in both; during playback the release does.
3. **A custom `renderPlayhead` is not called on each pointer move of a selection drag.** A move re-renders the highlighted range only; the rest of `MediaElementPlaylist` (timescale, waveform, annotation boxes, your playhead) renders on the press and on the release, not in between. Once the waveform is shown, the function is still called each time `MediaElementPlaylist` renders for another reason, among them: playback starting, pausing, stopping or ending, a seek, the press and the release of a click or drag, and the track's data arriving.
4. **Automatic scroll positions are whole pixels**, as under `WaveformPlaylistProvider`.
5. **When the provider replaces its player during playback, `isPlaying` becomes `false`.** The player is replaced when the track's `source`, `waveformData`, `name`, `fadeIn` or `fadeOut` changes, when the `audioContext`, `playbackRate` or `preservesPitch` prop changes, and when `onReady`, `onError` or `createPlayout` gets a new identity. The audio always stopped at that moment; `isPlaying` used to stay `true`, so a Play button stayed disabled and nothing played. Playback does not resume by itself.
6. **New audio starts at 0.** When the track's `source` or `waveformData` changes, playing or not, the cursor goes to 0 and the active annotation is cleared; before, both were kept, so the old position was applied to the new audio. When the player is replaced for the same audio (any other reason in item 5), both are kept, `currentTime` is brought up to the position playback had reached, and the next `play()` continues from there. `waveformData` is compared by identity, so pass the same object while the audio is the same. The selection is kept either way. To start new audio somewhere else (a saved position per file), call `seekTo` or `setActiveAnnotationId` from a `useEffect` keyed on the source in a component under the provider, or from `onReady`: both run after the reset. A `useLayoutEffect` runs before it and is overwritten.
7. **`seekTo` clamps to the length of the current track (`track.waveformData.duration`), not to the `duration` value.** `duration` is 0 until the first player is ready and stays at the previous file's length while the next one loads, so a `seekTo` made before the player was ready went to 0, and a position restored for a longer file was cut off at the old file's length. Both now go where they were asked to: the position is shown at once, the player is moved to it when it is ready, and `play()` starts there.

What a click, a drag and Play do is in the next entry (the cursor follows the start of a dragged range, and a range can be played).

**Find:** `onReady`, `onError` or `createPlayout` passed to `MediaElementPlaylistProvider` as inline functions (`onReady={() => …}`), or a `track` built with inline `fadeIn` / `fadeOut` objects (`fadeIn: { duration: 1 }`), by a component that re-renders during playback: each render replaces the player, and playback now visibly stops. Also a `renderPlayhead` passed to `MediaElementWaveform` or `MediaElementPlaylist` that reads something of your own during a selection drag and relied on being called per pointer move; code that unmounts and remounts `MediaElementPlaylist` to clear the highlighted range.

**Replace with:** for the callbacks, a stable function (`useCallback`, or one defined outside the component); for the track, a `useMemo` or a constant, so the fade objects keep their identity. For the playhead, position from `visualTimeRef` of `usePlaybackRefs()` in your own effect or animation frame, as `PlayheadWithMarker` does; it does not need the call. To clear the range, call `usePlaybackControls().setSelection(t, t)` (a collapsed range; it also moves the cursor to `t`); `useSelection()` reads the range.

## MediaElement player: Stop, the ends of playback, seeking and the selection follow the multitrack player's rules

**Package:** `@waveform-playlist/browser`.

`MediaElementPlaylistProvider` now plays, stops, seeks and selects the way `WaveformPlaylistProvider` does, so that one set of controls means the same thing under both. The actions are on `usePlaybackControls()` and `duration`, `isReady` and `playoutRef` on `useMediaElementTrack()` (they replace `useMediaElementControls()` and `useMediaElementData()`: see [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers)). One signature changes (`play`), one field is added (`isReady`), and the meaning of `duration`, `onReady` and `onError` changes.

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
| `duration` (`useMediaElementData()`, now `useMediaElementTrack()`) | 0 until the player was created | the length from `track.waveformData`, from the first render |
| The waveform | "Loading waveform…" until the peaks effect ran | drawn on the first render |
| `onReady` | called when the player object was created | called when the media element has loaded its metadata (it knows its length and can be played and seeked) |
| A source that cannot be loaded or decoded | nothing | `onError` is called with an `Error` ("Media failed to load (code …)"; the provider does not add the URL to the message, because it may carry a token. The text after the code is the browser's own), and the player never becomes ready |
| A media error during playback (the network drops) | `isPlaying` stayed `true` with no sound | playback ends where it was (`isPlaying` `false`, cursor kept) and `onError` is called |
| The browser refuses to start playback (no user gesture, typically for a play from a mount effect or a queued play) | `isPlaying` stayed `true` with no sound | `isPlaying` goes back to `false`, cursor kept. Needs `@waveform-playlist/media-element-playout` from the same release (its new `playrejected` event). Not yet in one case with the `audioContext` prop: while that context is suspended the engine waits for it to resume, a browser may leave that pending when there was no user gesture, and `isPlaying` then stays `true` as before (#783) |
| `stop()` while already stopped | cursor to 0 | the cursor does not move, unless playback is paused (then it returns to where playback started; a pause followed by a replacement of the player for the same audio counts as stopped) |
| `createPlayout` | any object with the playout's methods | must also implement `on()` and emit `loadedmetadata`; without `on()` the provider calls `onError` |

**Where playback started** is the `startTime` of the last `play()`, or the cursor when it was called without one; for selection playback it is the start of the selection. A `seekTo` or a click on the waveform replaces it with the new position, during playback as well as while stopped. Wherever playback comes to rest by itself (the end of a range, of an annotation or of the audio, an error) is the new starting point too, so a `stop()` while stopped does not move the cursor. A `stop()` while a play is queued cancels it and leaves the cursor at that play's starting point (the start of the selection for a queued selection playback). To go back to the beginning, call `seekTo(0)`.

**Ranges.** A range rests at its own end, with two exceptions. (1) When an annotation is active and continuous play is off, playback stops at that annotation's end if it comes first, and the cursor returns to where playback started. The annotation keyboard controls (`useAnnotationKeyboardControls` with `onPlay: play`) now play a real range for this reason: their duration argument used to be ignored. (2) Selection playback: a `play(start, duration)` that starts inside the highlighted range and ends at its end stops there and returns the cursor to the START of the selection, also when it was resumed part-way after a pause, and continuous play has no effect on it. The shared Play button plays the selection this way. `play()` without a duration is open-ended from the cursor, selection or not.

**In a hidden tab** animation frames stop while the audio goes on. A range and an annotation are still ended there, from the media element's `timeupdate` event. Browsers fire it about four times a second of real time, so the stop can be late by that much (more audio at a higher playback rate). This path is covered by unit tests that fire the event with no animation frame; it has not been checked in a really hidden tab.

**`isReady` is not a condition for Play.** Some browsers do not load metadata before the first play (iOS on a cellular connection or in low-data mode may ignore `preload`; not verified here). There `isReady` and `onReady` come only after playback has been asked for. Do not disable a Play button on `isReady`: `play()` works before the player is ready. Other things to know: `onReady` is called again if your code calls `playoutRef.current.setSource()`; an effect keyed on `isReady` runs again each time the player is replaced; and an exception thrown inside `onReady` is caught and logged by the engine's event emitter (it used to reach `onError`).

**Find:**

- `stop()` (from `useMediaElementControls()`, now `usePlaybackControls()`) used as "rewind": code that reads `currentTime` or `currentTimeRef` after a stop and expects 0.
- An effect that lists `duration` (from `useMediaElementData()`, now `useMediaElementTrack()`) as a dependency in order to run again "when the player is ready", or a guard such as `duration === 0` / `duration > 0` used as "is it loaded".
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
const { playoutRef, isReady } = useMediaElementTrack();
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

Five hooks are removed: `usePlaylistControls()`, `useMediaElementAnimation()`, `useMediaElementState()`, `useMediaElementControls()` and `useMediaElementData()`. A leftover call to a removed hook fails at import (the export is missing), not silently: under webpack or Rspack the import is `undefined` and the call throws at the first render; in native ES modules and the Vite dev server the module fails to link ("does not provide an export named …"). TypeScript reports the import.

The engine and its clock (`playoutRef`, `getPlaybackTime`, `getAudioContextTime`, `getLookAhead`, `getOutputLatency`, `playbackStartTimeRef`, `audioStartPositionRef`) are on `useEngineRefs()` (`WaveformPlaylistProvider` only), and `usePlaybackRefs()` has the four fields both providers have: `currentTimeRef`, `visualTimeRef`, `registerFrameCallback`, `unregisterFrameCallback` (see [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields)). Under `MediaElementPlaylistProvider` the player is `useMediaElementTrack().playoutRef`.

| Removed | Replace with |
| --- | --- |
| `usePlaylistControls()` | `usePlaybackControls()` (the actions both providers have) and `useEditorControls()` (the rest) |
| `useMediaElementAnimation()` | `useIsPlaying()`, `useCurrentTime()`, `usePlaybackRefs()` |
| `useMediaElementState()` | `useAnnotations()`, `useAnnotationOptions()`, `useActiveAnnotation()`, `usePlaybackRate()`, `usePlaylistSettings()` |
| `useMediaElementControls()` | `usePlaybackControls()`, and `usePlaybackRate()` for `setPlaybackRate` |
| `useMediaElementData()` | `useMediaElementTrack()`, `usePlaylistView()`, `usePlaylistZoom()` |

### The hooks after this change

All are exported from `@waveform-playlist/browser`.

Under either provider:

| Hook | Returns |
| --- | --- |
| `useIsPlaying()` | `isPlaying` |
| `useCurrentTime()` | `currentTime` (where the cursor rests; it does not advance during playback) |
| `useSelection()` | `selectionStart`, `selectionEnd` |
| `useActiveAnnotation()` | `activeAnnotationId` |
| `useAnnotations()` | `annotations` |
| `useAnnotationOptions()` | `editable`, `linkEndpoints`, `continuousPlay` |
| `usePlaybackControls()` | `play`, `pause`, `stop`, `seekTo`, `setSelection`, `setTimeFormat`, `setAutomaticScroll`, `setScrollContainer`, `scrollContainerRef`, `setContinuousPlay`, `setAnnotationsEditable`, `setLinkEndpoints`, `annotationPreview`, `annotationStore`, `setActiveAnnotationId`, `playAnnotation` |
| `usePlaybackRefs()` | `currentTimeRef`, `visualTimeRef`, `registerFrameCallback`, `unregisterFrameCallback` |
| `usePlaylistView()` | `sampleRate`, `mono`, `indefinitePlayback` (the last two are always `false` under `MediaElementPlaylistProvider`) |
| `usePlaylistSettings()` | `timeFormat`, `isAutomaticScroll` |
| `usePlaylistZoom()` | `samplesPerPixel`, `canZoomIn`, `canZoomOut` (the last two are always `false` under `MediaElementPlaylistProvider`) |

`WaveformPlaylistProvider` only:

| Hook | Returns |
| --- | --- |
| `useArrangement()` | the arrangement the provider plays (see [`WaveformPlaylistProvider` takes an `arrangement`](#waveformplaylistprovider-takes-an-arrangement-tracks-ontrackschange-and-deferenginerebuild-are-removed)) |
| `useEditorControls()` | `setCurrentTime`, `setTrackMute`, `setTrackSolo`, `setTrackVolume`, `setTrackPan`, `reorderTrack`, `setTrackDragPreview`, `setSelectedTrackId`, `zoomIn`, `zoomOut`, `setMasterVolume`, `setLoopEnabled`, `setLoopRegion`, `setLoopRegionFromSelection`, `clearLoopRegion`, `undo`, `redo`, `setRecordingActive` |
| `useEngineRefs()` | `playbackStartTimeRef`, `audioStartPositionRef`, `getPlaybackTime`, `getAudioContextTime`, `getLookAhead`, `getOutputLatency`, `playoutRef` |
| `usePlaylistTimeline()`, `usePlaylistMixer()`, `useTrackReorderPreview()`, `useLoop()`, `useSelectedTrackId()`, `useUndoRedo()` | see [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields) |

`MediaElementPlaylistProvider` only:

| Hook | Returns |
| --- | --- |
| `usePlaybackRate()` | `playbackRate`, `setPlaybackRate` |
| `useMediaElementTrack()` | `duration`, `isReady`, `peaksDataArray`, `playoutRef` (the fades are on the clip in `peaksDataArray`: [see below](#usemediaelementtrack-fadein-and-fadeout-are-removed)) |

The values of `usePlaybackControls()`, `useEditorControls()`, `usePlaybackRefs()` and `useEngineRefs()` never change, so calling them never re-renders the component.

Type names: `PlaylistControlsContextValue`, `MediaElementAnimationContextValue`, `MediaElementStateContextValue`, `MediaElementControlsContextValue` and `MediaElementDataContextValue` are removed. The new value types are `PlaybackControlsContextValue`, `EditorControlsContextValue`, `AnnotationsContextValue`, `AnnotationOptionsContextValue`, `EngineRefsContextValue`, `PlaybackRefsContextValue`, `PlaybackRateContextValue` and `MediaElementTrackContextValue`.

### Where each field of the removed hooks went

**Find** (imports and calls; run each as a regular expression over your source):

- `\busePlaylistControls\b`
- `\buseMediaElement(Animation|State|Controls|Data)\b`
- `\b(PlaylistControls|MediaElement(Animation|State|Controls|Data))ContextValue\b`

**Replace with:** for each field the component reads, the hook in the right-hand column. Call each hook once per component and destructure only the fields that component uses.

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
| `setAnnotations` | removed: `usePlaybackControls().annotationStore` ([the annotation store](#setannotations-is-removed-write-through-the-annotation-store)) |
| `annotationPreview` | `usePlaybackControls()` |
| `setActiveAnnotationId` | `usePlaybackControls()` |
| `setLinkEndpoints` | `usePlaybackControls()` |
| `setAnnotationsEditable` | `usePlaybackControls()` |
| `setCurrentTime` | `useEditorControls()` |
| `setTrackMute` | `useEditorControls()` |
| `setTrackSolo` | `useEditorControls()` |
| `setTrackVolume` | `useEditorControls()` |
| `setTrackPan` | `useEditorControls()` |
| `reorderTrack` | `useEditorControls()` |
| `bumpTrackReorderEpoch` | removed: see [`trackReorderEpoch` and `bumpTrackReorderEpoch` are removed](#trackreorderepoch-and-bumptrackreorderepoch-are-removed-a-reorder-drag-keeps-the-track-panels-mounted) |
| `setTrackDragPreview` | `useEditorControls()` |
| `setSelectedTrackId` | `useEditorControls()` |
| `zoomIn` | `useEditorControls()` |
| `zoomOut` | `useEditorControls()` |
| `setMasterVolume` | `useEditorControls()` |
| `setLoopEnabled` | `useEditorControls()` |
| `setLoopRegion` | `useEditorControls()` |
| `setLoopRegionFromSelection` | `useEditorControls()` |
| `clearLoopRegion` | `useEditorControls()` |
| `undo` | `useEditorControls()` |
| `redo` | `useEditorControls()` |
| `setRecordingActive` | `useEditorControls()` |

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
| `continuousPlay` | `useAnnotationOptions()` |
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
| `setAnnotations` | removed: `usePlaybackControls().annotationStore` ([the annotation store](#setannotations-is-removed-write-through-the-annotation-store)) |
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
| `fadeIn` | `useMediaElementTrack().peaksDataArray[0]?.[0]?.fadeIn` ([the fades entry](#usemediaelementtrack-fadein-and-fadeout-are-removed)) |
| `fadeOut` | `useMediaElementTrack().peaksDataArray[0]?.[0]?.fadeOut` |
| `playoutRef` | `useMediaElementTrack()` |
| `sampleRate` | `usePlaylistView()` |
| `waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` | props of `<WaveformViewOptions>`; inside a root, `usePlaylistInfo()` (see [the view options entry](#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers)) |
| `timeScaleHeight` | the `height` of `<WaveformTimescale>`; inside a root, `usePlaylistInfo().timeScaleHeight` |
| `controls` | removed (this player has no controls column) |
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

`useClipDragHandlers` takes neither ref any more, nor `tracks` and `onTracksChange`: see [`useClipDragHandlers` and `useClipSplitting` read the arrangement from the provider](#useclipdraghandlers-and-useclipsplitting-read-the-arrangement-from-the-provider).

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

Under either provider: `PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`, `ClearAllButton`, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs`, `AutomaticScrollCheckbox`, `AnnotationList`, and the four annotation controls of `@waveform-playlist/annotations` (`ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox`, `DownloadAnnotationsButton`; see [One owner per exported name](#one-owner-per-exported-name-the-annotation-controls-move-to-the-annotations-package-re-exports-and-unused-exports-are-removed)).

`MediaElementPlaylistProvider` only: `PlaybackRateSelect`.

`WaveformPlaylistProvider` only (they throw under `MediaElementPlaylistProvider`): `LoopButton`, `SetLoopRegionButton`, `ZoomInButton`, `ZoomOutButton`, `MasterVolumeControl`, `KeyboardShortcuts`, and `ExportWavButton` from `@waveform-playlist/browser/tone`.

`MediaElementWaveform` keeps its name. `MediaElementPlaylist` and `MediaElementAnnotationList` are replaced: see [the view is composed from parts](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed) and [the annotation UI entry](#the-annotation-ui-is-two-parts-with-their-own-options-the-annotation-options-have-one-home-under-both-providers).

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
- **`useClipDragHandlers()` and `useClipSplitting()` need `WaveformPlaylistProvider`**: they work on its arrangement and throw under `MediaElementPlaylistProvider`.

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
3. **A `useMediaElementData()` reader of the view fields** (`sampleRate` and `samplesPerPixel`, now on `usePlaylistView()` and `usePlaylistZoom()`) no longer re-renders when `isReady` or the peaks change. `useMediaElementTrack()` does.
4. **A `useMediaElementState()` reader of `continuousPlay`** reads `useAnnotationOptions()`, which re-renders when one of the three annotation options is toggled; `useAnnotations()` does not.
5. **A custom `renderPlayhead` under `MediaElementPlaylistProvider`** is called on play, pause and stop and on a seek; while a range is highlighted and playback is stopped or paused it is not called, so then only play and a seek during playback call it.

## One playhead and one progress overlay for both providers; `PlayheadProps` has seven props

The playhead, the played-portion overlay of a channel, the selection highlight and the wrapper that calls a custom `renderPlayhead` exist once and are rendered by both players (the multitrack view and the MediaElement view; `<PlaylistVisualization>` and `<MediaElementPlaylist>` of the last release are replaced by the view's parts, see [the view is composed from parts](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed)). The playhead is the `<WaveformPlayhead renderPlayhead>` part. None of these was a public export in the last release; what changes for an app is the props a `renderPlayhead` function receives and the things listed under "On screen".

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

`PlayheadWithMarker` places itself from `visualTimeRef`, so `renderPlayhead={PlayheadWithMarker}` (now on the `<WaveformPlayhead>` part, under either provider) needs no change of its own.

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

The MediaElement waveform (`<MediaElementWaveform>`, or a composition on `<MediaElementWaveformRoot>`; `<MediaElementPlaylist>` and the show and render props are replaced by the view's parts, see [the next entry](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed)) is drawn by the same components as the multitrack view (one row of tracks, the timescale, the selection highlight, the playhead), so its markup and a few details follow the multitrack view.

| | Before | Now |
| --- | --- | --- |
| `className` | reached an element only when the peak data could not be read (see that row below) | is on the playlist's outermost element, as for `<Waveform>` |
| `theme.playlistBackgroundColor` | ignored; the background was always `waveOutlineColor` | used when set; `waveOutlineColor` otherwise |
| `data-playlist-state` | absent | on the outermost element, and always `"ready"`: the waveform is drawn from the first render and does not wait for the player. Whether the player has loaded its media is `useMediaElementTrack().isReady`, as before |
| The track's row | the track's element was a direct child of the tracks container | one `[data-track-row]` element with `data-track-id="media-element-track-0"`, `data-track-kind="audio"` and `data-selected="true"` (the one track is always drawn in the selected colours, as before), inside a positioning container: two more `div`s around the track. The row is positioned absolutely inside that container, which has the row's height |
| Fades (`showFades`, now the `<WaveformFades />` part) | the fade-out curve was placed from the length of the peak data | placed from the clip's width, so it ends where the clip ends: up to one pixel further left |
| `useMediaElementTrack().peaksDataArray` | the one clip had no fades | the one clip carries the track's `fadeIn` / `fadeOut` (`peaksDataArray[0][0].fadeIn`). The array is a new one when the fades or the name change; the peaks inside (`peaksDataArray[0][0].peaks`) keep their identity then. The fades are compared by value (`duration`, `type`), so a fade written inline (`fadeIn: { duration: 1 }` in a `track` object that is built on every render) changes nothing while its values are the same |
| The provider's `controls` prop with `show: true` | an empty column of that width to the left of the waveform | no column: there are no track controls for this player. The prop itself is removed ([the next entry](#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed)) |
| Peak data that cannot be read (the provider logs a warning) | the text "Loading waveform..." in a `div`, for good | the track's row, empty: as long as the audio and one `waveHeight` tall, under the timescale when there is one. `useMediaElementTrack().peaksDataArray` is still `[]` |
| A custom `renderPlayhead` | also called on every press and release on the waveform and when the player became ready | called on play, pause and stop, a seek, a selection change, a view-setting, zoom or theme change, and when the component that renders the view re-renders (and, as before, not while a range is highlighted at rest) |
| `getAnnotationBoxLabel` (now on `<WaveformAnnotationBoxes>`) | also called for every annotation on every press and release on the waveform, on play, pause and stop, and when the player became ready | called when the row of boxes itself renders: when the annotations (also each move of an edge drag), the active annotation, the view settings, the zoom or the length of the timeline change, or when one of `getAnnotationBoxLabel`, `editable`, `linkEndpoints`, `onAnnotationUpdate` is a new value |

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
  AnnotationList,
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
<AnnotationList />
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
| `WaveformAnnotationBoxes` | the row of annotation boxes, with the drag of their edges | `getLabel`, `height` (see [the annotation UI entry](#the-annotation-ui-is-two-parts-with-their-own-options-the-annotation-options-have-one-home-under-both-providers)) | either |
| `WaveformSelection` | the highlighted selection | none | either |
| `WaveformPlayhead` | the playhead | `renderPlayhead` | either |

Three compositions are ready-made. They take `className` and nothing else:

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
  <WaveformAnnotationBoxes getLabel={getAnnotationBoxLabel} />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
<AnnotationList
  height={annotationTextHeight}
  actions={annotationControls}
  scrollActivePosition={scrollActivePosition}
  scrollActiveContainer={scrollActiveContainer}
>
  {renderAnnotationItem}
</AnnotationList>
```

then apply each row that matches. The annotation props of the last release's `<Waveform>` map as shown (`annotationListConfig` has no replacement: the provider's options are used); the details are in [the annotation UI entry](#the-annotation-ui-is-two-parts-with-their-own-options-the-annotation-options-have-one-home-under-both-providers). Without annotations both annotation elements draw nothing (the list writes one development warning when there is no `<AnnotationProvider>`), so they can stay or go.

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
| `<PlaylistVisualization …props />` | the same composition without `<AnnotationList>` |

**5. `<MediaElementWaveform>`** with neither removed prop, under a provider that had `timescale`: keep it. Otherwise write the composition, which is what `<MediaElementWaveform />` renders:

```tsx
<MediaElementWaveformRoot className={className}>
  <WaveformTimescale />
  <WaveformTracks />
  <WaveformAnnotationBoxes getLabel={getAnnotationBoxLabel} />
  <WaveformSelection />
  <WaveformPlayhead />
</MediaElementWaveformRoot>
<AnnotationList
  height={annotationTextHeight}
  scrollActivePosition={scrollActivePosition}
  scrollActiveContainer={scrollActiveContainer}
>
  {renderAnnotationItem}
</AnnotationList>
```

| Was | Becomes |
| --- | --- |
| the provider had no `timescale` | delete `<WaveformTimescale />` |
| `showFades` | `<WaveformTracks><WaveformFades /></WaveformTracks>` |
| `renderPlayhead={f}` | `<WaveformPlayhead renderPlayhead={f} />` |
| `<MediaElementPlaylist …props />` | the same composition without `<AnnotationList>` |
| `editable`, `linkEndpoints`, `onAnnotationUpdate` | the provider's `annotationList={{ …, editable, linkEndpoints }}` and `annotationStore` (see the annotation UI entry and [the annotation store entry](#the-annotations-are-an-annotation-stores-annotationlistannotations-and-onannotationschange-are-removed)) |

The same holds for the two annotation elements here.

**6. A recording.** The view used to tell the provider that a take was running: for as long as `recordingState.isRecording` was true, the provider kept playback running past the end of the audio and muted what the take's track already held. `<WaveformRecordingPreview>` only draws the take. Call the hook in the component that calls `useIntegratedRecording` (it must be under `WaveformPlaylistProvider`):

```tsx
import { useRecordingSession } from '@waveform-playlist/browser';

const { isRecording, recordingTrackId } = useIntegratedRecording(/* … */);
useRecordingSession({ isRecording, trackId: recordingTrackId });
```

Without it a punch-in plays the old audio of the take's track under the take, and a take on an empty timeline stops playback at once. The type of the `recordingState` prop is exported as `WaveformRecordingState`.

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
- `<WaveformLoopRegion>`, `<WaveformTrackControls>` and `<WaveformRecordingPreview>` need `WaveformPlaylistProvider` (`<WaveformAnnotationBoxes>` works under either). Under `MediaElementPlaylistProvider` the loop region throws (`useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it`); the track controls draw nothing as a child of the root, and throw the same kind of message when they are wrapped in a component and so rendered among the tracks; the recording preview throws once a take runs into the player's track.
- `<WaveformTimescale>`, `<WaveformTracks>`, `<WaveformLoopRegion>`, `<WaveformTrackControls>` and `<WaveformAnnotationBoxes>` throw outside a root (`The timescale must be rendered inside the waveform root`). `<WaveformSelection>` and `<WaveformPlayhead>` draw wherever they are rendered under a provider; they are positioned for the tracks area.
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
| The fades of the clip in `useMediaElementTrack().peaksDataArray` (the hook's own `fadeIn` / `fadeOut` were removed later: [see below](#usemediaelementtrack-fadein-and-fadeout-are-removed)) | the object of the latest `track` prop | the first object seen while `duration` and `type` are the same, so the hook's value no longer changes on every render of a parent that writes the fade inline |
| A composition with `<WaveformLoopRegion />` and no `<WaveformTimescale />` | (not possible) | the 30 px strip is there for the loop region alone |
| `<WaveformTimescale>` switched off and on beside a `<WaveformLoopRegion>` | (not possible) | the loop region stays mounted |
| A take being recorded, without `useRecordingSession` | the take's track was muted for the take, and playback ran past the end of the audio | neither |
| A fade written inline on a MediaElement `track` that is built on every render | the player was disposed and created again on every render of the provider's parent (playback stopped, the media loaded again) | compared by value: nothing happens while `duration` and `type` are the same |
| A render of the component that renders `<Waveform />`, `<WaveformEditor />` or `<MediaElementWaveform />` | rendered the tracks part (not its rows) | does not: the composition hands the root the same elements each time |

### What to check after the replacement

- Every page that had no ruler or no controls column and still renders `<Waveform />` or `<MediaElementWaveform />`: it has them now.
- A recording: mute state of the take's track during a take, and that playback continues on an empty timeline.
- Code that wrapped `<Waveform>` to add its own props for the removed ones: it can render the composition directly.

## Track controls are composed from pieces bound to a track; the mixer setters take a track id

**Packages:** `@waveform-playlist/browser`. `WaveformPlaylistProvider` only.

The control panel of a track is no longer described by props of `<Waveform>` (`renderTrackControls`, `onRemoveTrack`, `trackReordering` in the last release). The **children** of the part are the panel of ONE track. The part renders them once per track, each copy inside that track's context, and a component in the panel reads its track with `useTrack()`. The built-in pieces do that already and take no prop for the track:

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

`<WaveformTrackControls />` without children draws `<DefaultTrackControls />`. Its props are `width` and `children`.

At the same time the four mixer setters (on `useEditorControls()`; they were on `usePlaylistControls()`) take a track **id** where they took an index, and the mixer state (mute, solo, volume, pan) is kept by track id: it is the arrangement's mix (see [`WaveformPlaylistProvider` takes an `arrangement`](#waveformplaylistprovider-takes-an-arrangement-tracks-ontrackschange-and-deferenginerebuild-are-removed)).

### New exports

| Export | Is |
| --- | --- |
| `useTrack()` | the track whose panel the calling component is part of: `id`, `kind`, `index`, `name`, `muted`, `soloed`, `volume`, `pan`, `renderMode`, `isSelected`, `isFirst`, `isLast`, `hasSpectrogram`, `isRecording`, and the actions `setMuted`, `setSoloed`, `setVolume`, `setPan`, `select`, `moveUp`, `moveDown`, `setRenderMode`, `openSpectrogramSettings`. Type: `TrackContextValue` |
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
| `renderTrackControls` prop of `<Waveform>` | the panel as children of `<WaveformTrackControls>`; a component in it calls `useTrack()` |
| `onRemoveTrack` prop of `<Waveform>` | `<TrackRemoveButton onRemove={f} />` among the children. `f` gets the track **id**, not the index |
| `trackReordering` prop of `<Waveform>` | `<TrackReorderGrip />` among the children |
| `SortableTrackControls`, `SortableTrackControlsProps`, `SortableTrackControlsRenderProps` | `<TrackReorderGrip />`, or `useTrackReorderHandle()` for your own grip element |
| `setTrackMute(trackIndex, muted)`, `setTrackSolo(trackIndex, soloed)`, `setTrackVolume(trackIndex, volume)`, `setTrackPan(trackIndex, pan)` | the same names with a track id: `setTrackMute(trackId, muted)` and so on; inside a panel, `useTrack().setMuted(muted)` and so on |

Nothing throws for a removed name. A removed prop that is still passed in plain JavaScript is ignored: the default panel is drawn, with no remove button and no grip. A setter called with an index does nothing (see the behaviour table). An import of `SortableTrackControls` is `undefined` (or fails when the module is linked, in native ES modules). TypeScript reports all of them.

### Find and replace

**Find:** `renderTrackControls`, `onRemoveTrack`, `trackReordering`, `SortableTrackControls`, `setTrackMute(`, `setTrackSolo(`, `setTrackVolume(`, `setTrackPan(`, `trackStates`, `trackReorderEpoch`.

**1. `trackReordering`**

```tsx
// Before
<Waveform trackReordering />

// After (in a composition of the view: see the view entry above)
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

<Waveform onRemoveTrack={removeTrack} />

// After: the callback gets the id
const removeTrack = useCallback((trackId: string) => arrangement.removeTrack(trackId), [arrangement]);

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
  const { trackStates } = usePlaylistData();
  const { setTrackMute, setTrackVolume } = usePlaylistControls();
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

<Waveform renderTrackControls={(trackIndex) => <MyTrackPanel trackIndex={trackIndex} />} />
```

```tsx
// After
import { WaveformTrackControls, useTrack } from '@waveform-playlist/browser';
import { Button, ButtonGroup, Controls, Header } from '@waveform-playlist/ui-components';

function MyTrackPanel() {
  const { name, muted, volume, isRecording, setMuted, setVolume } = useTrack();
  return (
    <Controls>
      <Header>{name}</Header>
      <ButtonGroup>
        <Button disabled={isRecording} onClick={() => setMuted(!muted)}>
          {muted ? 'Unmute' : 'Mute'}
        </Button>
      </ButtonGroup>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
      />
    </Controls>
  );
}

<WaveformTrackControls width={180}>
  <MyTrackPanel />
</WaveformTrackControls>
```

`useTrack()` always returns a value: `name` is "Track N" (N is the position, from 1) for a track without a name. While a track's audio is still loading, its panel is drawn and works: the values are the arrangement's mix for the track and a value set then is kept, so a panel needs no loading case (the `if (!state) return null` of the "Before" goes). While a take is recorded onto the track, `isRecording` is true: the built-in mute button is disabled then, and a mute control of your own can do the same. The props a panel took from the closure of `renderTrackControls` (a callback, a manager object) are props of the element among the children now; keep them stable (see the behaviour table).

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
  const { tracks, trackReorderEpoch } = usePlaylistData();
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

There is no `ref` for the item any more: the element that moves is the slot the part draws around the panel, not an element of yours, and the part draws it lifted (opaque, with a shadow) while it is dragged. Delete the `key` with `trackReorderEpoch`: the part keys its slots itself, and it did so before as well, so that key was never needed (and `trackReorderEpoch` is removed: [its entry](#trackreorderepoch-and-bumptrackreorderepoch-are-removed-a-reorder-drag-keeps-the-track-panels-mounted)). Call `useTrackReorderHandle()` once per panel (so not together with `<TrackReorderGrip />`). In the example `MyGrip` is written beside `MyPanel`: when the panel fills the slot (`height: 100%`), a grip beside it is below the visible area unless it positions itself (`position: absolute`, as `<TrackReorderGrip />` does) or is rendered inside the panel. For move buttons of your own use `useTrack().moveUp()` and `.moveDown()` with `isFirst` and `isLast`. The `disabled` prop has no replacement: leave the grip out.

### Behaviour

| | Before | Now |
| --- | --- | --- |
| `renderTrackControls`, `onRemoveTrack` or `trackReordering` left on `<WaveformTrackControls>` in plain JavaScript | the custom panel, a close button, a grip | ignored: the default panel, no remove button, no grip |
| `setTrackMute(0, true)` (an index; the same for the other three) | muted the first track | does nothing. In development each of the four setters warns once in the console (`[waveform-playlist] setTrackMute() takes a track id…`). A string that is no track's id is ignored without a warning |
| A track is removed, or one is added in front of the others (the number of tracks changes and the provider rebuilds) | the panels showed every remaining track back at the `muted`, `soloed`, `volume` and `pan` of its `ClipTrack`, and the rebuilt engine took its values from the old list by position, so a track could sound with a neighbour's values (read from the code, not reproduced as audio) | the other tracks keep what the user set |
| The list is replaced by one of the same length with other tracks, or the same tracks in another order | state stayed at its position | a track keeps its mixer state for as long as its id is in `tracks`; a new id starts from the fields of its `ClipTrack` |
| `usePlaylistMixer().trackStates` while tracks are loading | filled by position: shorter than `tracks` | one entry per track of the arrangement, in the order of `tracks`, from the moment the track enters it: `trackStates.length` equals `tracks.length`, and no entry is `undefined` |
| The identity of the `trackStates` array | a new array with new state objects whenever the provider loaded `tracks` again | the same array while no entry changed: a trim or another clip edit does not change it, and a mute changes the object of that track only |
| A click in a panel of your own | selected nothing (only the default panel selected its track) | a click anywhere in a track's slot selects the track. `<TrackRemoveButton>`, the button of `<TrackMenuButton>` and the grip and buttons of `<TrackReorderGrip>` do not select. A render-mode choice in the open track menu selects the track, as it did in the default panel |
| The remove callback | `onRemoveTrack(trackIndex)` | `onRemove(trackId)` |
| The element a reorder drag moves | the element you gave `ref` from `SortableTrackControls` | the slot the part draws; your grip only starts the drag |
| Children written inline | (the equivalent: an unstable `renderTrackControls` or `onRemoveTrack` rendered every panel on each render of your component) | the part compares the children with the previous ones (element types, keys and props, `children` recursively, `style` one level deep) and keeps the previous ones while they are equal, so inline children cost nothing while their props are stable. A function or an object written inline as a prop (other than `style`) makes every panel render on each render of the component that composes the view |
| `useTrack()` outside the children of `<WaveformTrackControls>` | (new) | throws `useTrack must be used within <WaveformTrackControls>…`. For a mixer strip elsewhere on the page use `usePlaylistMixer()` and the id setters of `useEditorControls()`. Under `MediaElementPlaylistProvider` those two throw as well: it has one track and no mixer |
| A track whose audio is still loading | the default panel's controls were disabled | the panel works: the values are the arrangement's mix for the track, a value set then is kept, and every piece is enabled. While a take is recorded onto a track its mute button is disabled (`useTrack().isRecording`) |
| `<DefaultTrackControls>` | drew the close button and the grip itself, from props of the part | has neither. `<TrackRemoveButton>` places itself at the top left of the slot and `<TrackReorderGrip>` at its right edge; the default panel makes room for the grip on both sides (CSS `:has()`) |
| The size of a custom panel | the slot, as now | the slot is as wide as the column (`width` of the part) and as tall as the track's row, with `overflow: hidden`. Fill it with `height: 100%`; do not compute the row height |
| Selecting a track | changed the background of the two slots concerned without rendering their default panels, and called `renderTrackControls` for every track | renders the pieces of the two panels concerned (the one that stops being selected and the one that becomes selected): `isSelected` is in the value of `useTrack()` |
| A mute, solo, volume or pan change | called `renderTrackControls` for every track | renders the components of that track's panel that call `useTrack()` |
| `exportWav` (`useExportWav`) while audio is still loading | failed with a `TypeError` (the track had no state) | renders the loaded clips, each track with its mix from `trackStates` |
| Children that are `false`, `0` or `''` (`{flag && <Panel />}` with a false flag) | (new) | empty panels. Only `null` and `undefined` mean "the default panel": write `{flag ? <Panel /> : undefined}` |
| Two reorder handles in one panel (two `<TrackReorderGrip />`, or the grip and `useTrackReorderHandle()`) | (new) | both register the track as the same sortable item; a warning in the console in development. Render one |
| `<TrackReorderGrip />` as a child of `<DefaultTrackControls>`, or alone inside an element of yours | (new) | the default panel makes room for the grip only when the two are siblings; elsewhere the grip lies over the sliders |
| A browser without CSS `:has()` | the room for the grip was an inline style | no room is made: the grip lies over the edges of the sliders |
| `<TrackRemoveButton>` without `onRemove`, in plain JavaScript | (the close button was drawn only with `onRemoveTrack`) | the button is drawn and a click throws |
| Markup of the default panel | the close button was inside the panel's `<header>`, the reorder rail inside the panel, and the panel handled the click that selects | every slot has a `div` (`[data-track-controls]`) around the panel (before, only with `trackReordering`, and without the attribute); the remove button and the grip are siblings of the panel inside it; the slot handles the click. A selector such as `header button[title="Remove track"]` no longer matches |
| A reorder (`reorderTrack`, the move buttons, a drag) | the mixer states followed the provider's `tracks` | an undo step of the arrangement; each track keeps its mix |
| A track given again (`arrangement.setTracks`, `updateTrack`) with other `muted`, `soloed`, `volume` or `pan` fields | the fields were applied (every state was re-created) | the mix of a known id stays: the fields are only the values a track enters with. Set them with the setters |
| Tracks re-created with new ids on each change (`createTrack()` and `audioTrack()` make an id) | a list of the same length kept the mixer state by position | a new id starts from its own fields: keep the ids of tracks that are the same track |
| A track removed and added again while its removal can still be undone | (by position) | gets the mix it had |
| Two tracks with the same id | two states, by position | refused: the arrangement throws at the call that offered them |

### `trackStates` is complete from the start

In the last release `trackStates` was filled by position while tracks loaded, so it could be shorter than `tracks`. It now has one entry per track from the moment the track enters the arrangement. Code that waited for `trackStates.length === tracks.length` to know that loading had finished is always true now: read `useArrangementSources(arrangement).isLoading` (or `pendingCount`) for the audio, or `usePlaylistTimeline().isReady` for the first ready.

```tsx
// Before
const loadingDone = trackStates.length === tracks.length;

// After
const { isLoading } = useArrangementSources(useArrangement());
const loadingDone = !isLoading;
```

### New attributes

| Attribute | On |
| --- | --- |
| `data-track-controls="<track id>"` | the element inside each track's slot that holds the panel (a reorder drag moves the slot around it) |
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

## `trackReorderEpoch` and `bumpTrackReorderEpoch` are removed; a reorder drag keeps the track panels mounted

**Package:** `@waveform-playlist/browser`. `WaveformPlaylistProvider` only.

A track-reorder drag no longer remounts the control panels when it ends. Until now `onDragEnd` bumped a counter, `trackReorderEpoch`, and the controls column keyed every panel with it, so each reorder drag mounted every panel again. That remount worked around dnd-kit moving a panel's element into the neighbouring slot during the drag. The slot itself is now what dnd-kit moves, which React can follow, so the counter and the call that bumped it are removed. React state inside a panel (`useState`, refs) now survives a reorder drag, as it already survived a reorder by the move buttons. Focus, though, is not kept: in Chromium, pressing the grip moves focus to it, and a drag that passes another track leaves focus on the page's body.

**Find:** `trackReorderEpoch`, `bumpTrackReorderEpoch`.

**Replace with:** nothing. Delete a `key` or a dependency built from `trackReorderEpoch`, and a call to `bumpTrackReorderEpoch()`.

```tsx
// Before (16.x)
const { trackReorderEpoch } = usePlaylistData();
const { reorderTrack, bumpTrackReorderEpoch } = usePlaylistControls();
// … in a drag integration of your own:
reorderTrack(trackId, toIndex);
bumpTrackReorderEpoch();
// … and a panel keyed with it:
<MyPanel key={`${track.id}-${trackReorderEpoch}`} />

// After
const { reorderTrack } = useEditorControls();
reorderTrack(trackId, toIndex);
<MyPanel key={track.id} />
```

From 16.x, the hooks in the "Before" code are removed too (`usePlaylistData()`: see [one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields); `usePlaylistControls()`: see [one set of hooks and controls for both providers](#one-set-of-hooks-and-controls-for-both-providers)), so the code fails there first. Read from this major's hooks, a leftover `useTrackReorderPreview().trackReorderEpoch` is `undefined` (a key such as `` `${id}-undefined` `` still works), and a leftover call of `bumpTrackReorderEpoch` from `useEditorControls()` throws a `TypeError` ("… is not a function"). TypeScript reports both.

While a track is dragged, dnd-kit's `popover` attribute, `data-dnd-dragging` and its `--dnd-*` inline styles are on the slot around `[data-track-controls]`, not on that element. The slot draws the lifted look (opaque, with a shadow) itself, and lands in its place as soon as the track is dropped, where it used to hang at the pointer for about a quarter of a second.

## The annotation UI is two parts with their own options; the annotation options have one home under both providers

**Packages:** `@waveform-playlist/browser` (major), `@waveform-playlist/annotations` and `@waveform-playlist/ui-components` (additions). Both providers.

It covers the annotation props of the last release's `<Waveform>` and `<MediaElementWaveform>`, `PlaylistAnnotationList`, `MediaElementAnnotationList` (with their `controls`, `annotationListConfig` and `renderAnnotationItem` props) and `onAnnotationUpdate`. The view entry above lists the parts; this one says where the annotation options went.

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
| `<WaveformAnnotationBoxes>` | the row of annotation boxes, a part of `WaveformRoot` and of `MediaElementWaveformRoot`. Props: `getLabel` (the label of a box; default: the annotation's id), `height` (pixels; default 30). It owns the `DragDropProvider` for its edges. It serves both providers. Type: `WaveformAnnotationBoxesProps` |
| `<AnnotationList>` | the annotation text list, anywhere under either provider. Props: `height` (pixels; without it at most 200), `actions` (buttons on each row while editable), `scrollActivePosition` (`'center'` by default, `'start'`, `'end'`, `'nearest'`, or `'none'` for a list that does not follow playback), `scrollActiveContainer` (`'nearest'` by default, or `'all'`), and a function child that draws a row. Type: `AnnotationListProps` |
| `useAnnotationOptions()` | `{ editable, linkEndpoints, continuousPlay }`. Both providers. Type: `AnnotationOptionsContextValue` |
| `usePlaybackControls().setAnnotationsEditable`, `.setLinkEndpoints` | next to `setContinuousPlay`, under both providers |
| `usePlaybackControls().playAnnotation(annotation)` | what a click on a box or a list row does: the annotation becomes active and plays from its start, to its end when continuous play is off. For a box or a row of your own. Both providers |
| `AnnotationListProp` | the type of the `annotationList` prop of both providers: `{ editable?, linkEndpoints?, isContinuousPlay? }` (its `annotations` field is removed by [the annotation store entry](#the-annotations-are-an-annotation-stores-annotationlistannotations-and-onannotationschange-are-removed)) |
| theme key `annotationTextItemActiveColor` | the edge, tint and glow of the active row of the list, and the list's focus rings. Default `#ff9800` in both themes (the value that was fixed) |

### Removed

| Removed | Use |
| --- | --- |
| `<Waveform>` / `<WaveformEditor>` props `annotationTextHeight`, `annotationControls`, `renderAnnotationItem`, `scrollActivePosition`, `scrollActiveContainer` | compose the view; `height`, `actions`, the function child and the two scroll props of `<AnnotationList>` |
| `<Waveform>` / `<WaveformEditor>` / `<MediaElementWaveform>` prop `getAnnotationBoxLabel` | `<WaveformAnnotationBoxes getLabel>` |
| `annotationListConfig` (`<Waveform>`, `<WaveformEditor>`, the two list components) | nothing: an action's fourth argument is always the provider's `{ linkEndpoints, continuousPlay }` |
| `<MediaElementWaveform>` props `annotationTextHeight`, `renderAnnotationItem`, `scrollActivePosition`, `scrollActiveContainer` | compose the view; the props of `<AnnotationList>` |
| `<MediaElementWaveform>` props `editable`, `linkEndpoints` | `annotationList={{ …, editable, linkEndpoints }}` on the provider |
| `onAnnotationUpdate` on `<MediaElementWaveform>`, the two list components, and (deprecated, never called) on `WaveformPlaylistProvider`; the type `OnAnnotationUpdateFn` | the provider's `annotationStore`: every annotation change is written there ([the annotation store entry](#the-annotations-are-an-annotation-stores-annotationlistannotations-and-onannotationschange-are-removed)) |
| `PlaylistAnnotationList`, `MediaElementAnnotationList`, their props types | `AnnotationList` (`controls` is `actions`; `renderAnnotationItem` is the child; `editable` is the provider's) |
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

**Find:** `editable` or `linkEndpoints` on `<MediaElementWaveform>`; `editable` on `<MediaElementAnnotationList>`.

**Replace with:** the same values in the provider's `annotationList`. The provider follows the prop, so values kept in your own state keep working:

```tsx
// Before
<MediaElementPlaylistProvider track={track} annotationList={{ annotations }}>
  <MediaElementWaveform editable={editable} linkEndpoints={linkEndpoints} />
</MediaElementPlaylistProvider>

// After (annotationStore from useCreateAnnotationStore: see the annotation store entry)
const annotationStore = useCreateAnnotationStore(() => initialAnnotations);
const annotationList = useMemo(() => ({ editable, linkEndpoints }), [editable, linkEndpoints]);
<MediaElementPlaylistProvider
  track={track}
  annotationStore={annotationStore}
  annotationList={annotationList}
>
  <MediaElementWaveform />
</MediaElementPlaylistProvider>
```

Or drop your own state and render `<EditableCheckbox />` and `<LinkEndpointsCheckbox />`, which now work under `MediaElementPlaylistProvider` (import them from `@waveform-playlist/annotations`: [One owner per exported name](#one-owner-per-exported-name-the-annotation-controls-move-to-the-annotations-package-re-exports-and-unused-exports-are-removed)).

**Find:** `onAnnotationUpdate`.

**Replace with:** the provider's `annotationStore`: every change (an edge drag, a text or id edit, an action button) is written to the store, and you read it there ([the annotation store entry](#the-annotations-are-an-annotation-stores-annotationlistannotations-and-onannotationschange-are-removed)).

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

**Find:** `annotationsEditable`, `linkEndpoints` and `continuousPlay` read from `usePlaylistState()`, and `setLinkEndpoints`, `setAnnotationsEditable`, `setContinuousPlay` from `usePlaylistControls()`.

**Replace with:**

```tsx
// Before
const { annotationsEditable, linkEndpoints, continuousPlay } = usePlaylistState();
const { setLinkEndpoints, setAnnotationsEditable, setContinuousPlay } = usePlaylistControls();

// After
const { editable, linkEndpoints, continuousPlay } = useAnnotationOptions();
const { setLinkEndpoints, setAnnotationsEditable, setContinuousPlay } = usePlaybackControls();
```

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
| `useAnnotationOptions()`, `<LinkEndpointsCheckbox />`, `<EditableCheckbox />` under `MediaElementPlaylistProvider` | the two checkboxes threw (they read `usePlaylistState()`) | work |
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
| The ids of the three checkboxes | `continuous-play`, `link-endpoints`, `editable-annotations` | generated (two of one checkbox no longer share an id) |
| Components rendered per move of an edge drag and per annotation boundary under `WaveformPlaylistProvider` | 47 and 50 on the annotations example | the same: the part gained its `DragDropProvider` and the list lost a wrapper. A view with boxes and no list renders one component more per move and per boundary |

Not changed by this entry: `useAnnotationDragHandlers`, `useAnnotationsWithPreview`, `useAnnotationKeyboardControls` ([the annotation store entries](#useannotationdraghandlers-and-useannotationkeyboardcontrols-take-the-annotation-store) change their options and types), `<KeyboardShortcuts annotations>` (still `WaveformPlaylistProvider` only), `<ContinuousPlayCheckbox />`, `<DownloadAnnotationsButton />` (not changed by this entry; [One owner per exported name](#one-owner-per-exported-name-the-annotation-controls-move-to-the-annotations-package-re-exports-and-unused-exports-are-removed) moves the four controls to `@waveform-playlist/annotations`), the `AnnotationProvider` of `@waveform-playlist/annotations`, the annotation theme keys other than the two above, and the keys an edge can not be dragged with (a handle can be focused; the keyboard does not move it, as before).

## The options that only affect how a view draws are `<WaveformViewOptions>`; they leave the providers

**Packages:** `@waveform-playlist/browser` (major), `@waveform-playlist/ui-components` (major: the shape of `PlaylistInfoContext`), `@waveform-playlist/spectrogram`. Both providers.

The row height, the bar style, the playhead width and the filled layout are no longer props of `WaveformPlaylistProvider` and `MediaElementPlaylistProvider`. One component sets them, for every waveform root below it, under either provider:

```tsx
import { WaveformPlaylistProvider, Waveform, WaveformViewOptions } from '@waveform-playlist/browser';

<WaveformViewOptions waveHeight={100} barWidth={3} barGap={1} roundedBars>
  <WaveformPlaylistProvider arrangement={arrangement}>
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

// After (`arrangement` replaces `tracks`: see the arrangement entry below)
<WaveformPlaylistProvider arrangement={arrangement} mono theme={theme}>
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

Among the React packages a name is now exported by one package. `browser`, `annotations`, `ui-components`, `spectrogram` and `recording` re-export nothing from another package: import a name from the package that owns it. Five names remain in two entry points, on purpose: `AutomaticScrollCheckbox`, `MasterVolumeControl`, `PlaybackRateSelect`, `SelectionTimeInputs` and `TimeFormatSelect`. The one in `@waveform-playlist/ui-components` is driven by props; the one in `@waveform-playlist/browser` reads the provider and renders it. (`Track` is two different things under one name: a type in `@waveform-playlist/core` and a component in `@waveform-playlist/ui-components`.) A test compares the entries of every package under `packages/` (the React packages, `@waveform-playlist/browser/tone`, core, engine, playout, media-element-playout, webaudio-peaks, worklets and the `@dawcore/*` packages). `createEffectInstance`, which was one function in `@waveform-playlist/browser/tone` and another in `@waveform-playlist/core`, is renamed in `@waveform-playlist/browser/tone`: [its own entry](#createeffectinstance-of-waveform-playlistbrowsertone-is-renamed-createtoneeffectinstance). Three more names are two different things in two packages: `ExportOptions` (the options of `useExportWav` in `@waveform-playlist/browser/tone` and of `exportAudio()` in `@dawcore/components`), `MeterEntry` (`@waveform-playlist/core` and `@dawcore/transport`, whose entry has a `Tick` and a `barAtTick`) and `RecordingOptions` (`@waveform-playlist/recording` and `@dawcore/components`).

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
| `AnnotationsTrack`, `AnnotationsTrackProps` (`@waveform-playlist/annotations`) | `AnnotationBoxesWrapper` with `height={100}` (its default is 30; `AnnotationsTrack`'s was 100). The other props are the same: `className`, `children`, `width` (`offset` is removed too: see [props and components the packages did not use](#props-and-components-the-packages-did-not-use-are-removed)) |
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

// After (annotationStore from useCreateAnnotationStore: see the annotation store entry)
const annotationStore = useCreateAnnotationStore(() => initialAnnotations);
<WaveformPlaylistProvider
  arrangement={arrangement}
  annotationStore={annotationStore}
  annotationList={{ linkEndpoints: true }}
>
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

function downloadAnnotations(annotations: readonly AnnotationData[], filename = 'annotations.json') {
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

**Replace with:** `SpectrogramCanvasRegistration` from `@waveform-playlist/core`; `TrackMenuItem` from `@waveform-playlist/ui-components`. Both types have the fields they had, except `TrackMenuItem.label`, which was never drawn and is removed (see [props and components the packages did not use](#props-and-components-the-packages-did-not-use-are-removed)). `SpectrogramCanvasRegistration` also gains two optional fields, `offsetSamples` and `durationSamples`: the range of the audio the canvas is drawn for (omitted: the clip's own).

**Find:** `TrackControlsContext`, `useTrackControls`.

**Replace with:** delete them. The context was never provided by the library, so `useTrackControls()` returned its default, an empty fragment.

**Find:** `AudioPosition` in an import from `@waveform-playlist/ui-components`.

**Replace with:** `AudioPosition` from `@waveform-playlist/browser` under a playlist provider (no `formattedTime` prop), or an element of your own.

**Find:** an object given to `AnnotationIntegrationProvider` (`AnnotationIntegrationContext` since [the aliases were removed](#annotationintegrationprovider-and-spectrogramintegrationprovider-are-replaced-by-their-contexts)) (or typed `AnnotationIntegration`) with the entries `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` or `DownloadAnnotationsButton`.

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
| A custom object passed to `AnnotationIntegrationProvider` (now `AnnotationIntegrationContext`) with its own four control entries | browser's four controls rendered your components | the four entries are not read by anything. In TypeScript an object literal written where the `AnnotationIntegration` type is expected is an excess-property error when it has them (an object built in an untyped variable first is not) |
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

Not changed by this entry: `AnnotationProvider`, `AnnotationBox` and `AnnotationBoxesWrapper` (both change in [a later entry](#props-and-components-the-packages-did-not-use-are-removed) and [`AnnotationBox` draws its edge handles only with `editable`](#annotationbox-draws-its-edge-handles-only-with-editable)), `AnnotationText`, `parseAeneas` and `serializeAeneas` of `@waveform-playlist/annotations`; `WaveformAnnotationBoxes` and `AnnotationList` of `@waveform-playlist/browser`, which still draw nothing without `<AnnotationProvider>`; `useAnnotationIntegration()`, still exported by `@waveform-playlist/browser` (`AnnotationIntegrationProvider` is replaced by `AnnotationIntegrationContext`: [its own entry](#annotationintegrationprovider-and-spectrogramintegrationprovider-are-replaced-by-their-contexts)); `AudioPosition` of `@waveform-playlist/browser`; `SnapTo` and the conversion functions of `@waveform-playlist/core`; the five controls that `@waveform-playlist/ui-components` and `@waveform-playlist/browser` both export.

### What to check after the replacement

1. Search every import from `@waveform-playlist/browser` for the names in the "Moved" table, and the whole project for `getShortcutLabel`: none may remain.
2. Search for `checked=` and `onChange=` on the three annotation checkboxes and for `annotations=` on `DownloadAnnotationsButton`: none may remain.
3. With a strict package manager, every `@waveform-playlist/*` package you now import from is in your `package.json`.

## `createEffectInstance` of `@waveform-playlist/browser/tone` is renamed `createToneEffectInstance`

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

`@waveform-playlist/core` exports a different function under the old name: the effect registry's `createEffectInstance(type, audioContext, params)` (see [the effect registry moves to core](#web-components-the-effect-registry-moves-from-dawcorecomponents-to-waveform-playlistcore)). The one of `@waveform-playlist/browser/tone`, which builds a built-in Tone.js effect from its definition, is renamed. Its arguments, `(definition, initialParams?)`, and its result, an `EffectInstance`, are unchanged. Core's function keeps its name.

**Find:** `createEffectInstance` in an import from `@waveform-playlist/browser/tone`.

**Replace with:**

```tsx
// Before
import { createEffectInstance, getEffectDefinition } from '@waveform-playlist/browser/tone';

const instance = createEffectInstance(getEffectDefinition('reverb')!, { decay: 2 });

// After
import { createToneEffectInstance, getEffectDefinition } from '@waveform-playlist/browser/tone';

const instance = createToneEffectInstance(getEffectDefinition('reverb')!, { decay: 2 });
```

A leftover import of the old name does not throw and has no shim: see [what a leftover import does](#one-owner-per-exported-name-the-annotation-controls-move-to-the-annotations-package-re-exports-and-unused-exports-are-removed).

## `calculateDuration` is removed from `@waveform-playlist/core`: use `samplesToSeconds`

**Package:** `@waveform-playlist/core`.

Core's `calculateDuration(sampleCount, sampleRate)` returned `sampleCount / sampleRate`, which is what `samplesToSeconds(samples, sampleRate)` of core returns. `@waveform-playlist/engine` exports a different `calculateDuration(tracks)`, the end of the last clip in seconds; that one stays. With a strict package manager, `@waveform-playlist/core` must be in your own `package.json` to import `samplesToSeconds` from it.

**Find:** `calculateDuration` in an import from `@waveform-playlist/core`.

**Replace with:**

```ts
// Before
import { calculateDuration } from '@waveform-playlist/core';

const seconds = calculateDuration(buffer.length, buffer.sampleRate);

// After
import { samplesToSeconds } from '@waveform-playlist/core';

const seconds = samplesToSeconds(buffer.length, buffer.sampleRate);
```

## `FadeConfig` is imported from `@waveform-playlist/core`

**Package:** `@waveform-playlist/media-element-playout` (types only: nothing changes at runtime).

`@waveform-playlist/media-element-playout` re-exported core's `FadeConfig` type and no longer does. `MediaElementTrackOptions.fadeIn` and `fadeOut`, `setFadeIn` and `setFadeOut` take the same type as before. With a strict package manager (pnpm), an app that has `@waveform-playlist/core` only as a dependency of another package adds it to its own `package.json` before importing from it.

**Find:** `FadeConfig` in an import from `@waveform-playlist/media-element-playout`.

**Replace with:**

```ts
// Before
import type { FadeConfig } from '@waveform-playlist/media-element-playout';

// After
import type { FadeConfig } from '@waveform-playlist/core';
```

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

## Undo and Escape during a drag (#848)

**Packages:** `@waveform-playlist/core` (`handleKeyboardEvent`), `@waveform-playlist/browser` (`useEditorControls`, `<KeyboardShortcuts>`, `useClipDragHandlers`, `ClipInteractionProvider`)

- **Undo and redo do nothing while a clip move, a clip trim or a track-reorder drag is in progress:** the keys of `<KeyboardShortcuts undo />` and `useEditorControls().undo()` / `redo()`. Before, an undo pressed with the mouse button held undid the step before the drag, and the drop then landed the clip away from the pointer; during a track drag it left the control panels' DOM (tab) order out of step with the screen. The arrangement's own `undo()` is not stopped.
- **An Escape that something other than a shortcut has already handled fires no shortcut.** `handleKeyboardEvent` skips an Escape whose default was prevented before it ran, unless a shortcut list prevented it (two lists that both bind Escape both run, as before). This is how Escape during a drag only cancels the drag: dnd-kit prevents the key's default when it cancels, so Stop and the annotation deselect do not also run, and a second Escape does them as usual.

**Find:** code of yours that calls `preventDefault()` on an Escape `keydown` before the library's listener sees it (a listener on an element, or on `window` in the capture phase), for example to close a menu or popup, and that expects Escape to stop playback as well.

**Replace with:** don't call `preventDefault()` on that Escape if Stop should run too; or call the action yourself (`usePlaybackControls().stop()`).

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

`useRecordingProgress` re-renders its component 10 times a second by default. If you only passed the values to the preview's `recordingState`, do not call it; pass `progress` itself (see below). After a stop, `progress.getSnapshot().duration` is the length of the recorded buffer, the same as `audioBuffer.duration`.

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

Applies to the `recordingState` prop of the last release's `<Waveform>` and `<PlaylistVisualization>`, which is now the `recordingState` of the `<WaveformRecordingPreview>` part (see the view entry). `durationSamples` and `peaks` are removed; pass the `progress` source from `useRecording` or `useIntegratedRecording` instead. Only the live preview clip follows it frame by frame.

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

// After: the preview is a part of the view's tracks (see the view entry); the take's
// session is useRecordingSession({ isRecording, trackId: recordingTrackId })
<WaveformTracks>
  {isRecording && recordingTrackId ? (
    <WaveformRecordingPreview
      recordingState={{
        isRecording: true,
        trackId: recordingTrackId, // NOT the selected track id: see "a take stays on its track" below
        startSample,
        progress,
        bits: 16,
        latencyOffset,
      }}
    />
  ) : null}
</WaveformTracks>
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
import type { Arrangement } from '@waveform-playlist/engine';
import {
  useDynamicEffects,
  useActiveEffects,
  type UseDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';

function App({ arrangement }: { arrangement: Arrangement }) {
  const masterFx = useDynamicEffects();

  return (
    <WaveformPlaylistProvider arrangement={arrangement} effects={masterFx.masterEffects}>
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

A track no longer carries its effects function. `ClipTrack.effects` is removed, and so is `effects` in `AudioTrackConfig` (the configs of the removed `useAudioTracks`). The provider has a `trackEffects` prop instead, and `createToneAdapter` a `trackEffects` option: a function from a track id to that track's effects function (or `undefined` for none).

Why: attaching the function meant copying every track object whenever the tracks changed, and in the last release every such copy disposed the engine and built a new one.

An `effects` field left on a track object is ignored at runtime: the chain is silently not connected. TypeScript reports it only where the object is checked against `ClipTrack` directly.

**Find:** `effects:` inside a `tracks.map(` (usually a `tracksWithEffects` memo), `effects` in an `AudioTrackConfig`, and `.effects` read from a track.

**Replace with:** the `trackEffects` prop:

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

<WaveformPlaylistProvider arrangement={arrangement} trackEffects={getTrackEffectsFunction}>
```

Delete the memo. (`arrangement` replaces `tracks` and `onTracksChange`: see [`WaveformPlaylistProvider` takes an `arrangement`](#waveformplaylistprovider-takes-an-arrangement-tracks-ontrackschange-and-deferenginerebuild-are-removed).)

A fixed effects function per track, which used to be `effects` in the track config, is keyed by track id as well. Give the track an id you know, `audioTrack({ id, src })` (without it an id is generated and is on the track once it is in the arrangement; an empty string counts as no id). Ids must be unique: the arrangement refuses a duplicate track id.

```tsx
// Before
const { tracks } = useAudioTracks([
  { src: 'vocals.mp3', name: 'Vocals', effects: vocalReverb },
  { src: 'drums.mp3', name: 'Drums' },
]);

<WaveformPlaylistProvider tracks={tracks}>

// After
const arrangement = useCreateArrangement(() => [
  audioTrack({ id: 'vocals', src: 'vocals.mp3', name: 'Vocals' }),
  audioTrack({ id: 'drums', src: 'drums.mp3', name: 'Drums' }),
]);

// Module level, or memoized: any stable object.
const effectsByTrackId: Record<string, TrackEffectsFunction | undefined> = {
  vocals: vocalReverb,
};

<WaveformPlaylistProvider arrangement={arrangement} trackEffects={(trackId) => effectsByTrackId[trackId]}>
```

**When the function is called:** each time a track's audio graph is built, with the `trackEffects` function from the latest render. Passing a new function identity rebuilds nothing, so an inline arrow is fine. Returning a different effects function for a track that is already built takes effect the next time that track is built. So return the same function for the same track id for as long as the track exists; to change what a track's chain does while it plays, change the chain behind a stable function, which is what `useTrackDynamicEffects()` does.

**With your own adapter:** the provider's `trackEffects` prop, like `effects`, reaches the default Tone.js adapter only. If you pass `createAdapter`, give the function to the adapter yourself:

```tsx
// Before
<WaveformPlaylistProvider tracks={tracksWithEffects} createAdapter={() => createToneAdapter()}>

// After
<WaveformPlaylistProvider
  arrangement={arrangement}
  createAdapter={() => createToneAdapter({ trackEffects: getTrackEffectsFunction })}
>
```

Also removed:

- The `TrackEffectsFunction` type exported from `@waveform-playlist/core` (it only typed the removed field). **Find:** `TrackEffectsFunction` imported from `@waveform-playlist/core`. **Replace with:** the same name from `@waveform-playlist/playout`.
- The deprecated `WaveformTrack` type from `@waveform-playlist/browser`. **Replace with:** `ClipTrack` from `@waveform-playlist/core`.

## A track has a kind: audio or MIDI, never both

**Packages:** `@waveform-playlist/core`, `@waveform-playlist/engine`, `@waveform-playlist/playout`, `@waveform-playlist/browser`, `@waveform-playlist/recording`. (`loadMidiTracks` of `@dawcore/midi` makes MIDI tracks.)

`ClipTrack` has a new required field, `kind: 'audio' | 'midi'`. Every clip on an audio track is an audio clip, and every clip on a MIDI track has `midiNotes`. Before, a track could hold both, and the kind was guessed from the clips.

What sets it:

- `createTrack({ name, clips })` makes an audio track; pass `kind: 'midi'` for a MIDI track.
- `audioTrack()` makes an audio track. `loadMidiTracks` makes MIDI tracks.
- A track object you write by hand needs the field. A MIDI track without it is read as an audio track and rejected.

:::danger A track that breaks the rule throws

`PlaylistEngine.setTracks()`, `addTrack()` and `updateTrack(id, track)` throw an `Error` for a track whose clips do not match its kind, before changing anything. The message names the track and the clip.

**Under `WaveformPlaylistProvider` the throw reaches whoever offered the track.** The provider takes an arrangement (see [A refused track throws at the call](#a-refused-track-throws-at-the-call-onerror-is-for-an-engine-that-cannot-be-built)), whose `setTracks()`, `addTrack()` and `updateTrack()` check the track the same way: a track refused in the `useCreateArrangement` initializer is a render error for the nearest error boundary above the component that calls it, and one refused by `arrangement.addTrack()` is that call's exception. The provider's `onError` is not called for it.

An `onReady` callback that throws is a separate report: `[waveform-playlist] The onReady callback threw: …` is logged as a console error and `onError` is called with the error, and the playlist is ready.

If you call a `PlaylistEngine` yourself, the throw is synchronous: wrap the call in `try`/`catch`, or call `assertTrackKind(track)` from `@waveform-playlist/core` first.

:::

**Find:**

- Track objects written by hand: object literals typed `ClipTrack`, and anything added to the arrangement (or, before it, pushed into the provider's `tracks`) that did not come from `createTrack`, `audioTrack` or `loadMidiTracks`. TypeScript reports each one (`Property 'kind' is missing`).
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

`RenderMode` is now `'waveform' | 'spectrogram' | 'both'`. A piano roll is not a mode you choose: it is how a MIDI track is drawn. Render modes apply to audio tracks only, and a `renderMode` on a MIDI track does nothing. With the spectrogram integration mounted, the default track panel of a MIDI track no longer shows the track menu (the render-mode choices and the spectrogram settings).

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

`useIntegratedRecording` returns a new field, **`recordingTrackId`**. Pass it as `recordingState.trackId` (now on `<WaveformRecordingPreview>`, see the view entry) in place of the selected track id. If you keep passing the selected track id, the live preview is drawn on whichever track the user selects during a take, while the finished clip is added to the track the take was started on.

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
const { isRecording, startRecording, stopRecording } =
  useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime });

<Waveform
  recordingState={
    isRecording && selectedTrackId
      ? { isRecording: true, trackId: selectedTrackId, startSample /* … */ }
      : undefined
  }
/>

// After
const { isRecording, progress, recordingTrackId, startRecording, stopRecording } =
  useIntegratedRecording(arrangement, selectedTrackId, { currentTime });
useRecordingSession({ isRecording, trackId: recordingTrackId });

<WaveformTracks>
  {isRecording && recordingTrackId ? (
    <WaveformRecordingPreview
      recordingState={{ isRecording: true, trackId: recordingTrackId, startSample, progress, bits: 16 }}
    />
  ) : null}
</WaveformTracks>
```

```tsx
// Before: stop the take when its track is removed
if (isRecording && removedTrack.id === selectedTrackId) await stopRecording();

// After
if (isRecording && removedTrack.id === recordingTrackId) await stopRecording();
```

The selected track id decides where the _next_ take starts. The hook's first arguments change too: [`useIntegratedRecording` takes the arrangement](#useintegratedrecording-takes-the-arrangement-a-take-is-one-undo-step).

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

An `EffectInstance` (returned by `createEffectInstance`, now [`createToneEffectInstance`](#createeffectinstance-of-waveform-playlistbrowsertone-is-renamed-createtoneeffectinstance), and `createWamEffectInstance`) had one node, `effect`. It now has `input` (where the chain connects in) and `output` (where it continues from), because a registered custom effect can have two different nodes. For a Tone.js effect and a WAM plugin they are the same node.

**Find:** `.effect` read from an `EffectInstance` or `WamEffectInstance`.

**Replace with:**

```tsx
// Before
const instance = createEffectInstance(definition);
source.connect(instance.effect);
instance.effect.connect(destination);

// After
import { connect } from 'tone';

const instance = createToneEffectInstance(definition);
connect(source, instance.input);
connect(instance.output, destination);
```

The nodes are typed `ToneAudioNode | AudioNode`, so use Tone's `connect()` helper, which accepts both, or `instance.connect(destination)` for the outgoing side.

Also changed: `EffectDefinition['category']` is now `EffectCategory`, the known category names or any other string (a registered custom effect names its own). `BuiltInEffectCategory` is the closed union it used to be. An exhaustive `switch` over `category` needs a `default` case.

## `PlaylistEngine`: the arrangement owns the tracks, the mix and the undo history

**Packages:** `@waveform-playlist/engine`, `@waveform-playlist/browser`.

This entry is for code that calls a `PlaylistEngine` itself: an engine you construct, or the one behind `useEngineRefs().playoutRef`. A React app on `WaveformPlaylistProvider` makes the arrangement itself and gives it to the provider: see [`WaveformPlaylistProvider` takes an `arrangement`](#waveformplaylistprovider-takes-an-arrangement-tracks-ontrackschange-and-deferenginerebuild-are-removed).

The tracks, the per-track mix and the undo history now have one owner, the arrangement (`createArrangement()` from `@waveform-playlist/engine`). An engine built without the new `arrangement` option makes its own, so constructing and calling an engine works as before, except for the seven changes that have a heading below and the seven listed under [Also changed](#also-changed-in-the-engine) at the end. One more heading, [The arrangement's own API](#the-arrangements-own-api-clips-that-are-still-loading), is about code written against the arrangement itself, which is new. The [engine guide](/docs/framework-agnostic/engine#the-arrangement) describes the arrangement.

### `getState().tracks` is read-only

`EngineState.tracks` is now `readonly ClipTrack[]` and is no longer a copy: it is the engine's own array, shared with the undo history. Before, every `getState()` and every `statechange` carried a fresh copy of each track and of its `clips` array, so a write to a track or to the array of clips changed only your copy; the clip objects were already the engine's. `PlayoutAdapter.setTracks` receives a `readonly ClipTrack[]` too.

Under `WaveformPlaylistProvider` the tracks you read (`arrangement.getTracks()`, `useArrangementTracks(arrangement)`, `usePlaylistTimeline().tracks`) are read-only too. The arrangement's own tracks are frozen as described next; in `usePlaylistTimeline().tracks` a track that holds a clip still loading is a copy without that clip, not frozen itself (its clips are). Do not write to either.

Outside production builds (`process.env.NODE_ENV` is not `'production'`) the tracks array, each track, its `clips` array and each clip are frozen, so a write throws a `TypeError` in a module. In a production build nothing is frozen and a write silently changes the engine's state and its undo history. What a clip refers to (its `AudioBuffer`, peaks, fades, notes) is not frozen.

**Find:**

- Assignments to a track or clip that came from `engine.getState().tracks`, from a `statechange` listener's `state.tracks`, or from the arrangement: `track.name = …`, `track.clips.push(…)`, `clip.startSample = …`.
- `tracks.sort(…)`, `tracks.splice(…)` and other writes to the array itself, for `engine.getState().tracks`, a listener's `state.tracks` and the arrangement's tracks.
- Variables typed `ClipTrack[]` that are assigned `engine.getState().tracks`. TypeScript reports each one (`The type 'readonly ClipTrack[]' is 'readonly' and cannot be assigned to the mutable type 'ClipTrack[]'`).
- A custom `PlayoutAdapter` whose `setTracks`, `addTrack` or `updateTrack` writes to the tracks it is given.

**Replace with:**

```typescript
// Before
const state = engine.getState();
const track = state.tracks.find((t) => t.id === id);
track.name = 'Bass';
engine.updateTrack(id, track);

// After
const track = engine.getState().tracks.find((t) => t.id === id);
if (track) {
  engine.updateTrack(id, { ...track, name: 'Bass' });
}
```

```tsx
// Under WaveformPlaylistProvider: change a track through the arrangement
arrangement.updateTrack(id, (track) => ({ ...track, name: 'Bass' }));
```

```typescript
// Before
const tracks: ClipTrack[] = engine.getState().tracks;

// After
const tracks: readonly ClipTrack[] = engine.getState().tracks;
// or, when you need an array of your own to sort or splice:
const mine = [...engine.getState().tracks];
```

`setTracks()`, `addTrack()` and `updateTrack()` copy the tracks they are given, so the objects you pass in are never frozen and stay yours.

Also changed: `state.tracks` is the same array until the tracks or the mix change, and a track that did not change is the same object from one state to the next (except across a `setTracks()`, which copies every track it is given). Code that relied on a new array per `statechange` (an effect keyed on `state.tracks`) now runs only when something in it changed.

### A track's `volume`, `muted`, `soloed` and `pan` fields seed the mix once

The mix is kept by track id, apart from the track objects. A track's own four fields are read when its id has no mixer entry yet. Otherwise they are not read: `setTracks()` keeps the mix of an id that is in the tracks it replaces, and `updateTrack(id, track)` keeps the track's mix (also when the new track has another id). `addTrack()` reads them, also for the id of a track removed earlier. Before, `setTracks()` and `updateTrack(id, track)` took the mix from the fields of the tracks they were given.

`getState().tracks` and the tracks an adapter receives carry the current mix in those fields.

**Find:** code that changes a track's mix by passing a track with other `volume`, `muted`, `soloed` or `pan` values to `engine.setTracks()` or `engine.updateTrack(id, track)`.

**Replace with:**

```typescript
// Before
engine.updateTrack(id, { ...track, volume: 0.5, muted: true });

// After
engine.setTrackVolume(id, 0.5);
engine.setTrackMute(id, true);
```

The current mix holds an entry for each current track, and each undo and redo step holds the mix it had: a removed track's entry goes with it, and is in the step from before the removal, so undoing the removal brings it back. A track that enters later with that id (`addTrack()`, `setTracks()`) is seeded from its own fields.

### The mixer setters are undo steps; undo, redo and an abort bring back the mix of the state they return to

`setTrackVolume()`, `setTrackMute()`, `setTrackSolo()` and `setTrackPan()` (on the engine and on the arrangement) are undo steps: each call pushes one and clears the redo steps. Before, they made no step, and an undo step was a copy of the tracks with the mix they had when the step was made, so a fader move alone could not be undone, and undoing a clip move also undid a fader move made after it (the step held the mix from before the move). Now each saved state holds the tracks and the mix, and `undo()`, `redo()` and `abortTransaction()` bring back both: an undo takes back the last change, a fader move as well as a clip edit, and leaves an earlier fader move alone. Undoing a `removeTrack()` brings the track back with the mix it had; undoing an `updateTrack()` that gave a track a new id brings back the old id with the mix it had then. An undoable mixer call made inside an open transaction is part of it: an abort takes it back, and the commit's step holds it (a call with `{ undoable: false }` is written into the transaction's base, so an abort keeps it). An undo that changes only the mix increments `mixerVersion` and not `tracksVersion`, and reaches the adapter through its mixer setters, not `updateTrack`.

The setters take a last argument, `options?: MixerChangeOptions` (exported type):

- `{ gesture: id }`: calls with the same id, one after another, are one step (a fader drag). `createMixerGesture()` (from `@waveform-playlist/core`) makes the ids for one control and `gesture.attach(input)` ends a gesture on the input's own events; see [Mixer moves](/docs/framework-agnostic/engine#mixer-moves) in the engine guide.
- `{ undoable: false }`: no step. The value is also written into every undo and redo state, so no undo or redo brings back an older one. It wins over `gesture`, and an abort does not take it back.

`setTrackRecording(trackId, recording)` (new, on the engine and the arrangement) marks the track a take is recording onto: it plays muted for the take (`getState().tracks` and the adapter have it muted) while its mute in `arrangement.getMixer()` stays as it is. It is not an undo step, and it is not a record-arm.

**Find:**

- `setTrackVolume(`, `setTrackMute(`, `setTrackSolo(` and `setTrackPan(` called from a slider's `input` handler: each call is now a step.
- The same calls made for a value that is not the user's edit: automation, a mix restored from a saved project, a value synced from elsewhere, a mute set around a recording.
- Code or tests that expect `undo()` after a mixer call to take back an earlier clip edit, or `canRedo` to survive a mixer call.
- Code that keeps an earlier mix itself to set it back after an undo.

**Replace with:**

```typescript
// Before
slider.addEventListener('input', () => engine.setTrackVolume(trackId, slider.valueAsNumber));
engine.setTrackVolume(trackId, automationValue);

// After
import { createMixerGesture } from '@waveform-playlist/core';

const gesture = createMixerGesture(); // one per slider
gesture.attach(slider);
slider.addEventListener('input', () =>
  engine.setTrackVolume(trackId, slider.valueAsNumber, { gesture: gesture.id })
);
engine.setTrackVolume(trackId, automationValue, { undoable: false });
```

For a recording mute, use `engine.setTrackRecording(trackId, true)` and `false` instead of `setTrackMute`: nothing to remember and set back. Code that kept an earlier mix to set it back after an undo can go: the undo does it.

### Duplicate track ids, and duplicate clip ids within a track, throw

`setTracks()`, `addTrack()` and `updateTrack(id, track)` now throw an `Error` whose message starts with `[waveform-playlist]`, before changing anything, for:

- two tracks with the same id (`setTracks`), a track whose id another track has (`addTrack`), or a track given a new id that another track has (`updateTrack`);
- two clips with the same id on one track. The same clip id on two different tracks is accepted.

Before, such tracks were accepted. Under `WaveformPlaylistProvider` the arrangement refuses them at the call that offers them, as for a track of the wrong kind (see [A refused track throws at the call](#a-refused-track-throws-at-the-call-onerror-is-for-an-engine-that-cannot-be-built)).

**Find:** places that build track or clip ids by hand (an index, a file name, a copied clip that keeps its id), and saved projects.

**Replace with:** an id per track and, within a track, per clip. `createTrack()`, `createClip()`, `createClipFromSeconds()` and `createClipFromTicks()` of `@waveform-playlist/core` generate a new id on every call.

```typescript
// Before: a duplicated clip keeps its id
const copy = { ...clip, startSample: clip.startSample + clip.durationSamples };

// After
const copy = { ...clip, id: crypto.randomUUID(), startSample: clip.startSample + clip.durationSamples };
```

### `updateTrack(id, track)` with an unknown id does nothing

Before, `engine.updateTrack(id, track)` for an id no track has still pushed an undo step, incremented `tracksVersion`, called the adapter and emitted `statechange`, while the tracks stayed as they were. Now it changes nothing: no undo step, no adapter call, no `statechange`. The track is still checked first, so one whose clips do not match its kind throws.

**Find:** `engine.updateTrack(id, track)` used to send a track the engine does not hold to the adapter.

**Replace with:** `engine.addTrack(track)` for a new track.

### `commitTransaction()` and `clearHistory()` emit `statechange`; a mixer setter for a track that is not in the current tracks does not

- `commitTransaction()` emits one `statechange` when the transaction changed something, and `clearHistory()` when there was history to clear. Before, neither emitted, and `canUndo` / `canRedo` in the last state could be out of date.
- `commitTransaction()` adds no undo step, and emits nothing, when the tracks and the mix are back where the transaction began (the same track objects in the same order and the same mixer values). Before, a transaction in which anything had changed always added a step.
- `setTrackVolume()`, `setTrackMute()`, `setTrackSolo()` and `setTrackPan()` act on a track that is in the current tracks. For any other id they still call the adapter, but no longer increment `mixerVersion` or emit `statechange`, and nothing is stored. That includes a removed track whose removal can still be undone: a value set while it is away is not there when an undo brings it back.

**Find:** `statechange` listeners that count emissions, or that do work on every emission without comparing `tracksVersion` / `mixerVersion`; and code that waits for a `statechange` after a mixer setter for a track that is not in the current tracks, or that sets the mix of a removed track before undoing the removal.

**Replace with:** compare `state.tracksVersion` and `state.mixerVersion` with the last values seen to decide what to do. Neither changes on a `statechange` that is about the history alone. Set a track's mix while the track is in the tracks (after the undo, not before).

### `undo()` and `redo()` abort an open transaction first

Between `beginTransaction()` and `commitTransaction()`, `undo()` and `redo()` now abort the transaction (its changes are dropped) and then undo or redo the step before it. Before, they acted on the history while the transaction stayed open. `setTracks()` also ends an open transaction: a `commitTransaction()` or `abortTransaction()` after it logs a console warning and does nothing.

**Find:** `undo()` or `redo()` reachable while a drag is in progress (a keyboard shortcut during a pointer drag).

**Replace with:** nothing, if aborting the drag is what you want and the drag ends there. Otherwise call `commitTransaction()` before `undo()`.

After an `undo()` that aborted the transaction there is no transaction any more. A drag handler that goes on calling `moveClip(…, skipAdapter)` for later pointer moves makes each of them an undo step of its own, and its `commitTransaction()` or `abortTransaction()` at the end logs a console warning and does nothing. A host that offers undo during a drag has to cancel the gesture when undo is pressed (stop handling its pointer moves), or not offer undo while a drag is in progress.

The built-in editors do not offer undo during a drag ([#848](https://github.com/naomiaro/waveform-playlist/issues/848)): `useEditorControls().undo()` / `redo()` and `<KeyboardShortcuts undo />` do nothing while a clip move, a clip trim or a track-reorder drag is in progress (see [Undo and Escape during a drag](#undo-and-escape-during-a-drag-848)), and `<daw-editor>` does the same and opens its drag's transaction only when the pointer has passed the drag threshold. Escape cancels the drag in both. The arrangement's own `undo()` is not stopped: in React it still lands the clip away from the pointer (the drags there open no transaction), and in `<daw-editor>` `editor.engine.undo()` still aborts the drag's transaction this way.

### The arrangement's own API: clips that are still loading

`createArrangement()`, the `Arrangement` type and everything on it are new in this version, so there is no earlier code to change. Three things to know when you write against it, because they differ from the engine's methods of the same names:

- **The clips in `arrangement.getTracks()` are `AudioClip | LoadingClip`.** The arrangement's tracks are `ArrangementTrack` (from `@waveform-playlist/core`), not `ClipTrack`: a clip whose audio is not loaded yet is a `LoadingClip`, which has `src` and optional `start`, `duration` and `offset` in seconds, and none of the sample fields. `engine.getState().tracks` is still `readonly ClipTrack[]`: it leaves the loading clips out, and so do `getState().duration` and the tracks a `PlayoutAdapter` receives. The engine's own `setTracks()`, `addTrack()` and `updateTrack()` still take `ClipTrack`.
- **A loading clip on a MIDI track throws.** `createArrangement({ tracks })`, `arrangement.setTracks()`, `arrangement.addTrack()` and `arrangement.updateTrack()` throw for a `kind: 'midi'` track that holds a `LoadingClip`, before anything changes, with the error for a track whose clips do not match its kind (see [A track has a kind](#a-track-has-a-kind-audio-or-midi-never-both)). A loading clip is an audio clip.
- **`updateTrack()` keeps the clip objects the track already holds,** whether it is given a track object or a function of the current track. Every other clip object is copied. A clip you did not replace is therefore the same object before and after.

**Find:** code that reads `startSample`, `durationSamples`, `offsetSamples`, `sampleRate` or `audioBuffer` from a clip of `arrangement.getTracks()`, or that passes such a clip to a function that takes an `AudioClip`. TypeScript reports each one (`Property 'startSample' does not exist on type 'LoadingClip'`).

**Replace with:**

```typescript
import { isLoadingClip } from '@waveform-playlist/core';

for (const track of arrangement.getTracks()) {
  for (const clip of track.clips) {
    if (isLoadingClip(clip)) {
      // clip.src, and clip.start / clip.duration / clip.offset in seconds (each may be undefined)
      continue;
    }
    // an AudioClip
    clip.startSample;
  }
}
```

The [engine guide](/docs/framework-agnostic/engine#loading-audio) describes loading: which sources are fetched, `arrangement.sources`, `arrangement.retry()`, the `loadSource` option and `attachDecodeContext()`.

### Also changed in the engine

- **Undo, redo and `abortTransaction()` send the adapter only the tracks that differ.** When the same track ids are there before and after, the adapter's `updateTrack` is called for each track that changed (one `setTracks` per changed track for an adapter without `updateTrack`), and an undo of a reorder calls no adapter method. Before, every track was sent again. "The same tracks" is decided by track id: before, it was decided by the number of tracks, so an undo that swapped one track for another sent `updateTrack` calls; now it sends one `setTracks`.
- **A change made from inside a `statechange` listener is delivered after the one being handled.** Every listener gets the states in the order the changes were made. Before, the inner change was emitted at once, so listeners registered later saw the newer state first. The adapter call for the inner change is also made later, after the outer change has reached every listener; if it throws, the error reaches the caller of the outer method.
- **`selectedTrackId` is cleared when its track goes away by an undo, a redo or an aborted transaction, or when `updateTrack(id, track)` gives the track a new id.** `setTracks()` still leaves it alone.
- **A track given a new id through `updateTrack(id, track)` keeps its mix,** whatever the new track's mixer fields say, and the adapter receives every track through `setTracks` instead of an `updateTrack` call under the old id.
- **After `dispose()`, the engine's track, clip, mixer and history methods change its arrangement but call no adapter and emit no `statechange`, and `setTempo()` does nothing.** Before, they still called the disposed adapter.
- **`updateTrack(id, track)` calls the adapter only when the track plays differently.** When the new track's clips are the same clip objects in the same order (objects taken from this track in `getState().tracks`) and its own fields are unchanged, the adapter is not called; the undo step and the `statechange` are as before. Before, the adapter's `updateTrack` was called every time. `updateTrack(id)` with no track still sends the track every time.
- **Two or more track edits made from inside one `statechange` or `subscribe` listener run rebuild the adapter.** The first of them is delivered after the tracks have changed again, so the engine sends the adapter every track once (`setTracks`, which can interrupt playback); the edits still waiting make no adapter call. One track edit made from inside a listener is sent as itself (`updateTrack`, `addTrack` or `removeTrack`). A reorder and a move made with `skipAdapter` count as track edits here. If a rebuild matters, make several track edits from an event handler, not from inside a listener (a transaction does not change this: it groups undo steps, not adapter calls). After an adapter call for a track change has thrown, the next track change sends every track.

**Find:** a custom `PlayoutAdapter` or a test that counts `setTracks` / `updateTrack` calls after an undo; `engine.updateTrack(id, track)` with an unchanged track, used to make the adapter rebuild that track (use `engine.updateTrack(id)`); `statechange` listeners that call an engine method and rely on later listeners seeing that change first; code that reads `selectedTrackId` after an undo; calls on an engine after `dispose()`.

**Replace with:** nothing for an adapter that implements `updateTrack(trackId, track)` and `setTracks(tracks)` by replacing what it holds. In a listener, read the state it is handed, not `engine.getState()`, when it needs the state of the change it is handling.

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

Core's `createEffectInstance(type, audioContext, params)` builds a registered effect. The function of `@waveform-playlist/browser/tone` that builds a built-in Tone.js effect, `createEffectInstance(definition, initialParams)` until now, is [renamed `createToneEffectInstance`](#createeffectinstance-of-waveform-playlistbrowsertone-is-renamed-createtoneeffectinstance).

## Web components: `KeyBinding` is imported from `@waveform-playlist/core`

**Package:** `@dawcore/components` (types only: nothing changes at runtime).

`@dawcore/components` declared its own `KeyBinding`, the same type as `@waveform-playlist/core`'s (`Pick<KeyboardShortcut, 'key' | 'ctrlKey' | 'shiftKey' | 'metaKey' | 'altKey'>`), and no longer exports it. `PlaybackShortcutMap`, `SplittingShortcutMap` and `UndoShortcutMap` still come from `@dawcore/components` and take the same bindings.

**Find:** `KeyBinding` in an import from `@dawcore/components`.

**Replace with:**

```ts
// Before
import type { KeyBinding, PlaybackShortcutMap } from '@dawcore/components';

// After
import type { KeyBinding } from '@waveform-playlist/core';
import type { PlaybackShortcutMap } from '@dawcore/components';
```

`@waveform-playlist/core` is a peer dependency of `@dawcore/components`, installed with the other peers in [Getting Started](/docs/web-components/getting-started#installation). With a strict package manager it must be in your own `package.json` to be imported.

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

**What happens to a clip of the wrong kind:** it is not added, and the editor dispatches `daw-clip-error` with `{ trackId, clipId, error }` (for a clip with no `<daw-clip>` element, such as the `<daw-track src>` shorthand, `clipId` is the id the editor gave it). This covers:

- when a track loads: a MIDI clip (no `src`) on an audio track, and a `<daw-clip src>` on a MIDI track;
- `editor.addClip()` with a `src` onto a MIDI track (the promise rejects, nothing is fetched);
- `midiNotes` assigned to a source-less clip of an audio track.

If every clip of a track is refused, the track enters with no clips, `daw-track-error` follows, and `addTrack()` still resolves with its id. Listen for `daw-clip-error`: an un-migrated `render-mode="piano-roll"` track shows up as that event and an empty track.

A `<daw-clip>` appended to a track later is checked the same way: a source-less clip on a MIDI track is added (one undo step), on an audio track it is refused with `daw-clip-error`.

Also:

- Set `kind` before the track is added to the editor. A later change is undone: the editor logs a console warning and sets the element's `kind` back.
- `editor.startRecording()` onto a MIDI track records nothing and dispatches `daw-recording-error`.
- `editor.tracks` entries have a `kind` field, and `TrackConfig` (the argument of `addTrack`) an optional one. The exported `TrackDescriptor` and `TrackWithId` types therefore have a new required field: code that builds one of them by hand must add `kind`.

## Playout adapters are not given a track's view fields

**Packages:** `@waveform-playlist/engine` (`PlayoutAdapter`), `@waveform-playlist/core` (`TRACK_VIEW_FIELDS`, `PlayoutTrack`), `@waveform-playlist/playout`, `@dawcore/transport`.

The fields that say how a track is drawn are listed in core's `TRACK_VIEW_FIELDS`: `name`, `color`, `height`, `renderMode`, `spectrogramConfig`, `spectrogramColorMap`. The engine gives an adapter its tracks without them (core's `PlayoutTrack`), and a change of those fields alone makes no adapter call: a rename or a render-mode choice during playback no longer stops the track's audio on the native transport (it stayed silent until the track's next clip). It is still an undo step and a `statechange`, and `getState().tracks` keeps the fields. The adapter's tracks are copies that share the engine's clips, so they are not the same objects as `getState().tracks`.

An adapter whose own methods still say `ClipTrack` keeps compiling (TypeScript checks method parameters bivariantly) and reads `undefined` for those fields at runtime; only the search below finds it.

**Find:** in a `PlayoutAdapter` of your own, a read of `track.name`, `track.color`, `track.height`, `track.renderMode`, `track.spectrogramConfig` or `track.spectrogramColorMap` on a track the engine gave it; and a comparison of a given track with `engine.getState().tracks` by identity.

**Replace with:** the track's id, or the fields from `engine.getState().tracks` (or `arrangement.getTracks()`) when the adapter really needs one; compare by id.

```ts
// Before
setTracks(tracks: readonly ClipTrack[]): void {
  for (const track of tracks) console.log(`building ${track.name}`);
}
// After
setTracks(tracks: readonly PlayoutTrack[]): void {
  for (const track of tracks) console.log(`building ${track.id}`);
}
```

## `WaveformPlaylistProvider` takes an `arrangement`: `tracks`, `onTracksChange` and `deferEngineRebuild` are removed

**Packages:** `@waveform-playlist/browser`.

The provider no longer takes a tracks array from your state and hands changes back. It takes an **arrangement**, an `Arrangement` from `@waveform-playlist/engine` that you make with `useCreateArrangement` from `@waveform-playlist/browser`. The arrangement owns the tracks and their clips, the mix (volume, mute, solo, pan by track id), the undo history and the loading of the audio the clips name. The provider derives everything it publishes from it and writes nothing back, except the mark on the track a take records onto (`setTrackRecording`, see [the take's track entry](#the-track-a-take-records-onto-shows-muted-during-the-take-and-its-mute-button-is-disabled)). A clip move, trim or split, a reorder, an undo and a recorded take each change the arrangement, and you read the tracks there.

What goes with it:

- **No copy of the tracks in your state.** Change tracks through the arrangement's methods (`addTrack`, `removeTrack`, `updateTrack`, `setTracks`, `reorderTrack`, the mixer setters, `undo`, `redo`), from a handler or an effect. Below the provider `useArrangement()` returns it. Read the tracks with `useArrangementTracks(arrangement)` (every clip, loading or not) or, below the provider, `usePlaylistTimeline().tracks` (loaded clips only).
- **One arrangement per playlist.** `useCreateArrangement` reads its initializer once and returns the same object on every render. A new `arrangement` object passed to the provider is a new playlist: everything below the provider mounts again, with a new engine; playback stops, and the zoom, the selection, the loop, the master volume and the scroll position start from their initial values. A development build says so once with a console warning (`WaveformPlaylistProvider was given a new \`arrangement\` prop: everything below it mounts again …`).
- **A track change never builds a new engine.** Before, a `tracks` array that did not come from the engine (a set of tracks that replaced the previous one) disposed the engine and built a new one, and `deferEngineRebuild` held that back during progressive loading. Now an engine is built when the provider mounts, when `effects` changes identity and when `zoomLevels` changes content; adding, removing or replacing tracks changes the running engine. `deferEngineRebuild` has nothing left to defer.
- **Not an undo step:** the tracks the initializer returns. Tracks you add later with `addTrack` are; call `arrangement.clearHistory()` once after a first load you make yourself (see [Loading Audio](/docs/react/guides/loading-audio#ready)).

In plain JavaScript a leftover `tracks`, `onTracksChange` or `deferEngineRebuild` prop is ignored: nothing reads it, nothing warns. A provider given no `arrangement` at all (or anything that is not an object, `null` included) throws an `Error` while it renders, in development and production builds alike, with this message:

```text
[waveform-playlist] WaveformPlaylistProvider needs an `arrangement` prop: an arrangement made with `useCreateArrangement`, which owns the tracks. The `tracks` and `onTracksChange` props were removed. See https://naomiaro.github.io/waveform-playlist/docs/react/upgrading
```

The nearest error boundary above the provider catches it. TypeScript reports each leftover prop and the missing `arrangement`.

**Find:** `<WaveformPlaylistProvider` with `tracks=`, `onTracksChange=` or `deferEngineRebuild=`; the `useState` that holds the tracks you passed to it (often `useState<ClipTrack[]>`), and the `useEffect` that copied loaded tracks into that state.

**Replace with:**

```tsx
// Before
const { tracks: loadedTracks, loading } = useAudioTracks(configs, { immediate: true });
const [tracks, setTracks] = useState<ClipTrack[]>([]);
useEffect(() => {
  if (!loading) setTracks(loadedTracks);
}, [loadedTracks, loading]);

const removeTrack = (id: string) => setTracks((prev) => prev.filter((t) => t.id !== id));

<WaveformPlaylistProvider tracks={tracks} onTracksChange={setTracks} deferEngineRebuild={loading}>
  <Waveform />
</WaveformPlaylistProvider>

// After
import { WaveformPlaylistProvider, Waveform, useCreateArrangement } from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

const arrangement = useCreateArrangement(() => configs.map((config) => audioTrack(config)));

const removeTrack = (id: string) => arrangement.removeTrack(id);

<WaveformPlaylistProvider arrangement={arrangement}>
  <Waveform />
</WaveformPlaylistProvider>
```

`configs` above are `audioTrack()` options, not the old `AudioTrackConfig`: see the next entry for the differences (`startTime` is `start`).

Tracks you built yourself as `ClipTrack[]` (decoded `AudioBuffer`s, MIDI tracks) go into the arrangement as they are: `useCreateArrangement(() => myTracks)` for the first ones, `arrangement.addTrack(track)` later, `arrangement.setTracks(tracks)` to replace them all (that also clears the undo history).

The `Arrangement` type is exported by `@waveform-playlist/engine`, a dependency of `@waveform-playlist/browser`. Add it to your own dependencies if you import the type and your package manager is strict (pnpm).

## `useAudioTracks` and `useDynamicTracks` are removed; a track names its audio with `audioTrack()`

**Packages:** `@waveform-playlist/browser`.

Removed from `@waveform-playlist/browser/tone`: `useAudioTracks`, `useDynamicTracks`, and the types `AudioTrackConfig`, `TrackSource`, `TrackLoadError` and `UseDynamicTracksReturn`. A track names its audio itself: `audioTrack(options)` from `@waveform-playlist/core` builds a track whose clip has a `src`, and the arrangement fetches and decodes it once the provider has its first adapter. The provider decodes with its adapter's `AudioContext` (before, the hooks decoded on the Tone.js global context).

A leftover import of a removed name fails the build (`useAudioTracks` is not exported); where a bundler lets it through, the value is `undefined` and the call throws a `TypeError`.

**`AudioTrackConfig` to `audioTrack()` options:**

| `AudioTrackConfig` | `audioTrack()` |
|---|---|
| `startTime` | `start` (seconds) |
| `src` (a URL) | `src`: a URL, a `Blob` or a `File` |
| `name`, `audioBuffer`, `waveformData`, `duration`, `offset`, `fadeIn`, `fadeOut`, `color`, `volume`, `muted`, `soloed`, `pan`, `renderMode`, `spectrogramConfig`, `spectrogramColorMap` | the same |
| `effects` | removed: the provider's `trackEffects` prop, keyed by track id (see [track effects are passed to the provider](#track-effects-are-passed-to-the-provider-not-set-on-tracks)) |
| (none) | `id` (the track's id), `clipId`, `gain` |

`useAudioTracks`' second argument, `{ immediate }` (and its alias `progressive`), is gone with it: every playlist now loads progressively. The rows are drawn at once, a clip with a `duration` or `waveformData` is drawn as a dimmed placeholder while its audio loads, and a clip that names only its `src` is drawn when it has loaded (see [Placeholders](/docs/react/guides/loading-audio#placeholders-while-audio-loads)). A placeholder is drawn only once the provider knows its real sample rate: pass the provider's `sampleRate` prop to have them from the first render.

**What replaces each returned field:**

| Before | After |
|---|---|
| `useAudioTracks().tracks` | `useArrangementTracks(arrangement)`, or `usePlaylistTimeline().tracks` below the provider |
| `loading` | `useArrangementSources(arrangement).isLoading` (the provider need not wait for it; Play works from the first ready) |
| `loadedCount`, `totalCount` | `sources.size - pendingCount - failedCount`, `sources.size` of `useArrangementSources(arrangement)` |
| `error` (a string) | the `error` (an `Error`) of each `failed` entry in `useArrangementSources(arrangement).sources`; `arrangement.retry(src)` starts it again |
| `useDynamicTracks().addTracks(sources)` | `arrangement.addTrack(audioTrack({ src }))` for each source; a `{ src, name }` source is `audioTrack({ src, name })` |
| `removeTrack(trackId)` | `arrangement.removeTrack(trackId)` |
| `loadingCount`, `isLoading` | `pendingCount`, `isLoading` of `useArrangementSources(arrangement)` |
| `errors` (failed tracks, removed automatically) | the `failed` entries of `useArrangementSources(arrangement).sources`. A failed track is not removed for you: to take a dropped file out again, call `arrangement.removeTrack(id, { undoable: false })` from an effect over that value (not from inside `arrangement.subscribe`) |

**A dropped file's track looks different while it loads.** `useDynamicTracks` added a placeholder track with `clips: []` and a name ending in `" (loading...)"`, and replaced it with the loaded track (same id). `arrangement.addTrack(audioTrack({ src: file }))` adds the track at once with its plain name (the file name without its extension) and one clip that is still loading (`isLoadingClip(clip)` is true); when the file has decoded, that clip becomes a loaded clip of the same id, in place. Code that recognised a loading track by `clips.length === 0` or by the `" (loading...)"` suffix reads `isLoadingClip` or `useArrangementSources(arrangement)` instead.

**The load error messages changed.** The hooks threw `Failed to fetch <src>: <statusText>` (with the whole `src`) and `Invalid audio buffer for <src>`. The arrangement's loader gives `Failed to fetch <label>: <status> <statusText>` for a response that is not OK, `Failed to fetch <label>` for a network failure or a refused cross-origin request, `Decoded audio is empty: <label>`, and the browser's own error, unchanged, when the decoder rejects the data. `<label>` is the URL without its query string, its fragment and a user name or password, `data: URL` / `blob: URL` for those, a `File`'s name, or `Blob`. Code that matches on the text of the old messages has to match the new ones.

**`useCreateArrangement` reads two options.** `useCreateArrangement(init?, { loadSource?, undoLimit? })` reads `init` and those two options on the first render only; any other key is not read (a `tracks` key left in the options from plain JavaScript does nothing: declare the tracks in `init`).

**Find:** `useAudioTracks`, `useDynamicTracks`, `AudioTrackConfig`, `TrackSource`, `TrackLoadError`, `UseDynamicTracksReturn`, `startTime:` in a track config, `URL.createObjectURL` used only to hand a file to `useAudioTracks`, `" (loading...)"`, and code that matches on `Failed to fetch` or `Invalid audio buffer`.

**Replace with:**

```tsx
// Before
import { useAudioTracks, useDynamicTracks } from '@waveform-playlist/browser/tone';

const { tracks, loading, error } = useAudioTracks([
  { src: '/audio/vocals.mp3', name: 'Vocals' },
  { src: '/audio/guitar.mp3', name: 'Guitar', startTime: 4, duration: 30 },
]);
if (loading) return <div>Loading…</div>;
if (error) return <div>Error: {error}</div>;

// Runtime additions
const { tracks, addTracks, removeTrack, isLoading, errors } = useDynamicTracks();
addTracks(files);

// After
import { useCreateArrangement, useArrangementSources } from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

const arrangement = useCreateArrangement(() => [
  audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),
  audioTrack({ src: '/audio/guitar.mp3', name: 'Guitar', start: 4, duration: 30 }),
]);
const { isLoading, failedCount } = useArrangementSources(arrangement);

// Runtime additions
files.forEach((file) => arrangement.addTrack(audioTrack({ src: file })));
```

Several clips on one track are `LoadingClip` objects (`{ id, src, start, duration, offset }`, seconds) in the track's `clips`; see [Several Clips per Track](/docs/react/guides/loading-audio#several-clips-per-track).

**MIDI:** `useMidiTracks` from `@waveform-playlist/midi` is removed. Load with `loadMidiTracks(src, { sampleRate })` from `@dawcore/midi`, add each track to the arrangement, call `arrangement.clearHistory()` once, and render the provider after that: see [`useMidiTracks` is removed: load with `loadMidiTracks`](#usemiditracks-is-removed-load-with-loadmiditracks).

## `usePlaylistTimeline()`: `onTracksChange` is removed; `tracks` is read-only and holds loaded clips

**Packages:** `@waveform-playlist/browser`.

In the last release these four values and `onTracksChange` were on `usePlaylistData()`. They are on `usePlaylistTimeline()` now ([one hook per group of fields](#useplaylistdata-useplayliststate-and-useplaybackanimation-are-replaced-by-one-hook-per-group-of-fields)), whose value is `{ tracks, peaksDataArray, duration, isReady }`, and what they hold changed:

- **`onTracksChange` is removed.** It is on no hook; a leftover read from the value is `undefined`, and calling it throws a `TypeError`. Change tracks through the arrangement (`useArrangement()`).
- **`tracks` is `readonly ClipTrack[]` and holds loaded clips only.** It is the arrangement's tracks without the clips whose audio is still loading. A track whose clips are all loaded is the arrangement's own object, frozen outside production builds; a track that holds a clip still loading is a copy without that clip. Do not write to either. Every track is there, also while all its clips load.
- **`peaksDataArray` can hold placeholder records.** A clip still loading that has a `duration` or `waveformData` has a record with `isPlaceholder: true` in its track's row, and no clip in `tracks`. So below the track, the two arrays do not line up: find a record by `clipId`. At track level they still do: `tracks[i]`, `peaksDataArray[i]` and `usePlaylistMixer().trackStates[i]` are the same track.
- **`duration` counts loaded audio only**, and equals the engine's. The view is drawn wide enough for a placeholder that ends later; `seekTo` clamps to `duration`.
- **An export renders what has loaded.** `ExportWavButton` and `useExportWav().exportWav(tracks, trackStates)` with these `tracks` render the loaded clips; a clip still loading is left out.
- **Read-only parameters (not breaking).** `useExportWav().exportWav(tracks, trackStates, options?)` now takes `readonly ClipTrack[]` and `readonly TrackState[]`, and `ClipCollisionModifier.configure({ tracks })` takes `readonly ClipTrack[]` (or a function returning one), so these `tracks` can be passed as they are; a mutable array is still accepted.

**Find:** `onTracksChange` next to `usePlaylistData`; `peaksDataArray[i][j]` read together with `tracks[i].clips[j]`; assignments to `tracks[i]`, `tracks[i].clips` or a clip of them; `duration` used as "the length of every clip".

**Replace with:**

```tsx
// Before
const { tracks, peaksDataArray, onTracksChange } = usePlaylistData();
const clip = tracks[i].clips[j];
const record = peaksDataArray[i][j];
onTracksChange?.(tracks.map((t) => (t.id === id ? { ...t, name } : t)));

// After
const { tracks, peaksDataArray } = usePlaylistTimeline();
const arrangement = useArrangement();
const clip = tracks[i].clips[j];
const record = peaksDataArray[i].find((r) => r.clipId === clip.id);
arrangement.updateTrack(id, (track) => ({ ...track, name }));
```

## Ready comes once per mount, after the first sources; Play does nothing before it

**Packages:** `@waveform-playlist/browser`.

Before, `onReady` was called and the window event `waveform-playlist:ready` dispatched after every engine build: the first load and every full rebuild. Now both happen **once per mount of the provider**: the first time an engine is attached and no source of the arrangement is still pending. A source that failed counts as settled; an empty arrangement is ready when its engine is attached; a file added during the first load extends the wait; a source that never settles means never ready. A later engine build, a StrictMode remount or an `<Activity>` hide and reveal does not repeat them.

`usePlaylistTimeline().isReady` (and `data-playlist-state` on the view) turns true at the same moment. After that it is false only while a later engine is being built (an `effects` or `zoomLevels` change) and true again when that engine is attached, whatever is still loading.

The event's `detail` is `{ trackCount, duration }`: `trackCount` counts every track of the arrangement, loaded or not; `duration` is the length of the loaded audio in seconds.

**Play does nothing before the first ready.** `play()` returns at once and queues nothing: a Play press, Space or an annotation click during the first load does nothing (the annotation is not highlighted either), and does not start later by itself. A development build writes one console warning per mount: `[waveform-playlist] play() was called before the playlist was ready and did nothing: …`; a production build is silent. Edits, the mixer, `seekTo` and `setSelection` work before ready. `play()` called from `onReady`, or from an effect or a layout effect that runs when `isReady` turns true, works. A `play()` made from an app's own `arrangement.sources` listener when the last of the first sources settles runs before React has committed that ready, and is refused: wait for `isReady` or `onReady`.

A page that loads something before its tracks exist (MIDI, peaks files) adds the tracks and then renders the provider, so that its one ready means "the tracks are in".

**Find:** `onReady` and `waveform-playlist:ready` handlers that expect to run again after a rebuild or a change of tracks; code that calls `play()` on mount, from a timer, or from a handler that can run during the first load (autoplay, a "play" deep link); tests that count ready events.

**Replace with:**

```tsx
// Before: play on mount (queued until the engine was built)
useEffect(() => {
  play();
}, []);

// After: play when the playlist is ready
const { isReady } = usePlaylistTimeline();
useEffect(() => {
  if (isReady) play();
}, [isReady, play]);

// Or
<WaveformPlaylistProvider arrangement={arrangement} onReady={() => startPlaybackOnce()}>
```

:::note Fixed: an inline `onReady` or `onError` no longer rebuilds the engine

Before, a new `onReady` or `onError` function identity (an inline arrow, on every render of the component that renders the provider) made the provider build its engine again. Both are now read when they are called, so an inline arrow is fine.

:::

## A refused track throws at the call; `onError` is for an engine that cannot be built

**Packages:** `@waveform-playlist/browser`.

The arrangement refuses a track whose clips do not match its `kind`, a clip still loading on a MIDI track, two tracks with one id and two clips with one id on a track, before changing anything. Before, such a track reached the engine inside the provider, which caught the throw, called `onError`, and left the playlist in its loading state. Now the throw reaches whoever offered the track:

- from the `useCreateArrangement` initializer it is a render error, thrown by the component that calls the hook: the nearest error boundary **above that component** catches it;
- from `arrangement.addTrack()`, `setTracks()` or `updateTrack()` it is that call's exception, in your handler or effect.

`onError` now means "the engine or its adapter could not be built" (a missing optional peer, a `createAdapter` that throws, invalid `zoomLevels` / `samplesPerPixel`), plus an `onReady` that throws. It is called only for a build that is still current: not for one replaced by a newer build or a StrictMode remount, nor after the provider unmounted (before, `onError` was called for those too). A source that fails to load does not call it: read `useArrangementSources(arrangement)`.

**Find:** `onError` handlers that show a message for a bad track or a duplicate id; places that add tracks without a `try`.

**Replace with:**

```tsx
// Before: a bad track came back through onError
<WaveformPlaylistProvider tracks={tracks} onError={(e) => showProblem(e.message)}>

// After: catch it where the track is offered
try {
  arrangement.addTrack(track);
} catch (error) {
  showProblem(error instanceof Error ? error.message : String(error));
}

// …and an error boundary AROUND the component that calls useCreateArrangement:
// a boundary inside that component (around its provider) does not catch the initializer's throw
function Editor() {
  const arrangement = useCreateArrangement(() => initialTracks);
  return (
    <WaveformPlaylistProvider arrangement={arrangement}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

<PlaylistErrorBoundary fallback={<p>The playlist could not be created.</p>}>
  <Editor />
</PlaylistErrorBoundary>

// onError stays for engine build failures
<WaveformPlaylistProvider arrangement={arrangement} onError={(e) => showProblem(e.message)}>
```

`PlaylistErrorBoundary` is exported by `@waveform-playlist/ui-components`.

## `ClipPeaks` has a required `isPlaceholder` field

**Packages:** `@waveform-playlist/browser`, `@waveform-playlist/ui-components`.

`ClipPeaks` has a new required field, `isPlaceholder: boolean`. It is true for the record of a clip whose audio is still loading: `WaveformPlaylistProvider` puts such a record in `usePlaylistTimeline().peaksDataArray` for each clip still loading that has a `duration` or `waveformData` (see [`usePlaylistTimeline()`](#useplaylisttimeline-ontrackschange-is-removed-tracks-is-read-only-and-holds-loaded-clips)); `MediaElementPlaylistProvider` sets it to `false` on every record.

`Clip` (`@waveform-playlist/ui-components`) takes the matching `isPlaceholder?: boolean` (default `false`). A placeholder clip is drawn without a drag handle and without trim handles, and dimmed: the whole clip container, header included, gets `opacity` from the theme key `placeholderClipOpacity` (optional; 0.5 when the theme does not set it or sets something that is not a number from 0 to 1), and its container carries `data-clip-placeholder="true"`. A placeholder that has no peaks (only a `duration`) is drawn by the multitrack view with the new `<ClipPlaceholderBody />` (`@waveform-playlist/ui-components`) as its first child: a box of the clip's extent in the colour of the waveform's bars, `data-clip-placeholder-body="true"`.

Code that only reads `ClipPeaks` is not affected; TypeScript code that builds a `ClipPeaks` object no longer compiles without the field. In plain JavaScript a record built without it is drawn as a loaded clip (`undefined` and `null` both render the loaded clip).

**Find:** an object literal typed `ClipPeaks` (or a function returning one), for example in a test or a custom `peaksDataArray`.

**Replace with:** the same object with `isPlaceholder: false`.

```ts
// Before
const record: ClipPeaks = { clipId, trackName, peaks, startSample, durationSamples };

// After
const record: ClipPeaks = { clipId, trackName, peaks, startSample, durationSamples, isPlaceholder: false };
```

## `isDraggingRef` is removed

**Package:** `@waveform-playlist/browser`.

In the last release `usePlaylistData()` returned `isDraggingRef`, and `useClipDragHandlers` took it as an option: while it was true, `WaveformPlaylistProvider` ignored changes to `tracks`, so that the per-move `onTracksChange` of a trim did not rebuild the engine. It is removed and has no replacement: a trim no longer changes the tracks while it is dragged (see [A clip trim previews in the view and is one undo step](#a-clip-trim-previews-in-the-view-and-is-one-undo-step)), and the provider has no `tracks` prop to hold back. `EngineRefsContextValue` (`useEngineRefs()`) has seven fields: `playbackStartTimeRef`, `audioStartPositionRef`, `getPlaybackTime`, `getAudioContextTime`, `getLookAhead`, `getOutputLatency` and `playoutRef`.

A leftover read of `isDraggingRef` is `undefined`, with no error at the read; code that sets `isDraggingRef.current` throws where it does. A TypeScript build reports the property as missing.

**An app with its own trim gesture** (one that does not use `useClipDragHandlers`): keep the gesture in your own state while the pointer is down and, on release, make one call on the arrangement, `arrangement.trimClip(trackId, clipId, boundary, deltaSamples)` (`useArrangement()` below the provider). It is one undo step, and it works while no engine is attached.

**Find:** `isDraggingRef`, next to `usePlaylistData`, or in the options of `useClipDragHandlers`.

**Replace with:** delete it.

```tsx
// Before
const { playoutRef, isDraggingRef } = usePlaylistData();

// After
const { playoutRef } = useEngineRefs();
```

## `useClipDragHandlers` and `useClipSplitting` read the arrangement from the provider

**Package:** `@waveform-playlist/browser`.

In the last release `useClipDragHandlers` took `{ tracks, onTracksChange, samplesPerPixel, engineRef, isDraggingRef, snapSamplePosition? }` and `useClipSplitting` took `{ tracks, samplesPerPixel, engineRef }`. Now `useClipDragHandlers({ snapSamplePosition? })` has one option and can be called with none, and `useClipSplitting()` has none: both hooks work on the arrangement of the nearest `WaveformPlaylistProvider` (`useArrangement()`) at its zoom level (`usePlaylistZoom().samplesPerPixel`, read by the hooks since #828), and both throw outside it (`useArrangement must be used within WaveformPlaylistProvider`) and under `MediaElementPlaylistProvider` (`useArrangement needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it`).

- **One call per gesture, one undo step each.** A move is one `arrangement.moveClip()` on drop, a trim one `arrangement.trimClip()` on release (see [the trim entry](#a-clip-trim-previews-in-the-view-and-is-one-undo-step)), a split one `arrangement.splitClip()`. Before, a drag opened an engine transaction at its start and committed it at its end, and a trim called `onTracksChange` on every pointer move.
- **A move, trim or split made while no engine is attached is kept** (before the first build, during a rebuild), and the next engine plays it. Before, it was not synced and a console warning said so (`engineRef is null — move not synced to adapter`, and the same for a trim and a split). `splitClipAt(trackId, clipId, time)` returns `true` with no engine attached.
- **The clip and track are the ones picked up.** A move or a trim commits the clip and track captured at drag start (by their ids), also if the row moves or other clips change position during the drag; the clip index in the drop's data is not read. A move whose clip is no longer in that track at the drop is dropped with a console warning (`[waveform-playlist] The move was dropped: track "t1" has no clip "c1".`).
- **A clip still loading** cannot be dragged, trimmed or split: its placeholder has no handles, and `splitClipAt` returns `false` for it.
- **The handlers' identity:** within one mount of the provider (the arrangement and the provider's trim preview do not change then) `onDragStart` keeps its identity, `onDragMove` changes with `samplesPerPixel` or the sample rate, and `onDragEnd` with `samplesPerPixel`.

In plain JavaScript leftover `tracks`, `onTracksChange`, `samplesPerPixel`, `engineRef` and `isDraggingRef` options are ignored. A leftover `samplesPerPixel` changes nothing when it was `usePlaylistZoom().samplesPerPixel`, as the docs said to pass; a different value (a constant, a state of your own) is now replaced by the provider's zoom level where pixels become samples: the distance of a move and of a trim, and the snapping of a split. TypeScript reports them: `Object literal may only specify known properties` for `useClipDragHandlers`, `Expected 0 arguments, but got 1` for `useClipSplitting`. `ClipCollisionModifier.configure({ tracks, samplesPerPixel })` still takes tracks: give it `usePlaylistTimeline().tracks` (its `tracks` is typed `readonly ClipTrack[]` or a function returning one).

**Find:** `useClipDragHandlers({` and `useClipSplitting({` with `tracks`, `onTracksChange`, `samplesPerPixel`, `engineRef` or `isDraggingRef`.

**Replace with:**

```tsx
import { useClipDragHandlers, useClipSplitting } from '@waveform-playlist/browser';

// Before
const { tracks, playoutRef, isDraggingRef } = usePlaylistData();
const handlers = useClipDragHandlers({
  tracks,
  onTracksChange: setTracks,
  samplesPerPixel,
  engineRef: playoutRef,
  isDraggingRef,
});
const { splitClipAtPlayhead } = useClipSplitting({ tracks, samplesPerPixel, engineRef: playoutRef });

// After
const handlers = useClipDragHandlers();
const { splitClipAtPlayhead } = useClipSplitting();
```

## `splitClipAt` takes a track id and a clip id; the clip drags find clips by id

**Package:** `@waveform-playlist/browser`.

`useClipSplitting().splitClipAt` was `(trackIndex, clipIndex, splitTime)` in the last release and is now `(trackId, clipId, splitTime)`. A track id or a clip id that is not in the arrangement, and a clip still loading, return `false` and change nothing. `splitClipAtPlayhead()` picks the loaded clip under the playhead on the selected track, as before.

The clip drags find their clip by id too. The drag data of a clip keeps its shape (`clipId`, `trackIndex`, `clipIndex`, and `boundary` for a trim handle), but `useClipDragHandlers` and `ClipCollisionModifier` look the clip up by `clipId` among the loaded clips of its track, and `clipIndex` is not read: it is a position in the drawn row, which can hold placeholders that are not loaded clips. Code that builds its own drag source for these handlers must put the clip's `clipId` in the data.

**Find:** `splitClipAt(` with a number as its first argument. TypeScript reports each one (`Argument of type 'number' is not assignable to parameter of type 'string'`); in plain JavaScript the call returns `false`.

**Replace with:**

```tsx
import { useClipSplitting, usePlaylistTimeline } from '@waveform-playlist/browser';

const { tracks } = usePlaylistTimeline();
const { splitClipAt } = useClipSplitting();

// Before
splitClipAt(trackIndex, clipIndex, splitTime);

// After
const track = tracks[trackIndex];
splitClipAt(track.id, track.clips[clipIndex].id, splitTime);
```

## The draggable ids of a clip are its track id and clip id

**Package:** `@waveform-playlist/ui-components` (major; the clips `@waveform-playlist/browser` draws use it).

The three draggables of a clip had ids built from positions: `clip-<trackIndex>-<clipIndex>` for the move, `clip-boundary-left-<trackIndex>-<clipIndex>` and `clip-boundary-right-<trackIndex>-<clipIndex>` for the trim handles. A clip with a `trackId` (every clip the library draws) now has ids built from identity: `clip/<trackId>/<clipId>`, `clip-boundary-left/<trackId>/<clipId>` and `clip-boundary-right/<trackId>/<clipId>`, each part `encodeURIComponent`-encoded. A position changes when a clip arrives earlier in the row (a placeholder that finishes loading) or a track is reordered; an id built from it then named another clip while a drag was under way. A `Clip` drawn on its own without a `trackId` keeps the positional ids. The drag data (`clipId`, `trackIndex`, `clipIndex`, `startSample`, `durationSamples`, and `boundary` on a handle) is unchanged, and the handlers read the data, not the id.

**Find:** `clip-boundary-left-`, `clip-boundary-right-`, `` `clip-${`` (or `'clip-' +`) in your own drag handlers, collision detectors, sensors or test selectors.

**Replace with:** read `event.operation.source.data` instead of parsing the id; where the id itself is matched, use the new form.

```tsx
// Before
const isTrimHandle = String(source.id).startsWith('clip-boundary-');
const [trackIndex, clipIndex] = String(source.id).split('-').slice(-2);

// After: the data says it all (the id is clip-boundary-left/<trackId>/<clipId>)
const { boundary, trackIndex, clipId } = source.data;
const isTrimHandle = boundary !== undefined;
```

## A clip trim previews in the view and is one undo step

**Package:** `@waveform-playlist/browser`.

In the last release a trim changed the tracks on every pointer move: `useClipDragHandlers` called `onTracksChange` per move, `isDraggingRef` kept the provider from rebuilding the engine meanwhile, and `engine.trimClip()` committed the delta on release. Now the tracks do not change while a trim handle is dragged. The dragged clip is drawn at the previewed start, length and offset, with the waveform for that slice, and only that clip's view follows the pointer. On release the handler calls `arrangement.trimClip(trackId, clipId, boundary, delta)` once: a trim is one undo step. Escape (a cancelled drag) clears the preview and changes nothing.

The preview is internal to the library. `useClipDragHandlers` and the clip view read it themselves; there is no exported hook or context to read or write it.

- **The width follows a trim dragged past the end.** While the previewed end is past the end of the timeline, the view is as wide as that end rounded up to the next 10 seconds; after the release the width is the exact new duration. The recording layout's own rule is unchanged. When the stepped width shrinks (on the release, or when the edge is dragged back inside), a view scrolled into the spare area is moved back by the browser.
- **A trimmed edge stops at a neighbouring clip during the drag.** Each move is constrained by `arrangement.constrainTrimDelta`, after the edge has been snapped to the grid. Before, the snapped edge was drawn without that constraint and the engine applied it on release, so with snapping on an edge could be drawn past a neighbour. The committed result is the same.
- **With no engine attached** (before the first build, during a rebuild) the trim is kept, and the next engine plays it.

**Find:** a test or a component that counts track changes during a trim (`onTracksChange` calls in the last release), or reads the tracks while a trim handle is dragged to learn the clip's new bounds.

**Replace with:** read the tracks after the release, from the arrangement (`arrangement.getTracks()`, `useArrangementTracks(arrangement)`) or `usePlaylistTimeline().tracks`. Nothing has to draw the trim during the drag: the library's clip view does.

## Edits and undo work with no engine attached

**Packages:** `@waveform-playlist/browser`.

The four mixer setters, `reorderTrack`, `undo` and `redo` of `useEditorControls()` call the provider's arrangement. They work before the first engine is built and while an engine is rebuilt, and the next engine plays what they changed. Before, `reorderTrack`, `undo` and `redo` with no engine did nothing and warned (`reorderTrack: engine not ready, call ignored`, and the same for `undo` and `redo`).

The undo history is the arrangement's: it survives an engine rebuild (an `effects` or `zoomLevels` change) and an `<Activity>` hide of the provider. Before, a full rebuild started with a new engine and an empty history. Audio arriving for a clip is not an undo step and does not clear the history.

**Find:** code that waits for an engine before calling a setter, `reorderTrack`, `undo` or `redo`.

**Replace with:** call them whenever; nothing to wait for.

## Undo moves a fader back: every mixer change is an undo step

**Packages:** `@waveform-playlist/browser`, `@waveform-playlist/engine`.

A mute, solo, volume or pan change is an undo step, in the same history as the clip edits, and an undo or a redo brings back the mix of the state it returns to. With the built-in controls (`<TrackMuteButton />`, `<TrackSoloButton />`, `<TrackVolumeSlider />`, `<TrackPanSlider />`, so also `<WaveformEditor />` and `<DefaultTrackControls>`), Undo after a fader move moves the fader back. A drag of a slider is one step, a key press on it is one (a held arrow key that repeats is one), and a click on mute or solo is one. Before, a mixer change made no step: Undo after a fader move took back the edit before it and left the fader where it was.

A mixer change clears the redo steps, as any other edit does. `usePlaylistMixer().trackStates` and `useTrack()` follow an undo with no code of yours; `useUndoRedo().canUndo` is true after a fader move.

Keyboard Undo (`<KeyboardShortcuts undo />`) does not fire while a slider has focus, and a slider keeps the focus after a mouse drag: press the key after focus has left the slider (a click elsewhere, Tab), or give the page an Undo button (`useEditorControls().undo`, enabled by `useUndoRedo().canUndo`). This is not new (no shortcut fires while an `<input>` has focus); it now matters for the mixer ([#730](https://github.com/naomiaro/waveform-playlist/issues/730)).

**Find:** tests or code that expect Undo after a mixer change to take back an earlier clip edit, or `canRedo` to stay true after one; code of yours that keeps an earlier mix to set it back after an undo.

**Replace with:** nothing for the built-in controls. Code that put a mix back after an undo can go: the undo does it. For a slider of your own see the next entry, and for mixer changes made from code the one after it.

## A slider of your own makes one undo step per move until it passes a gesture

**Packages:** `@waveform-playlist/browser`, `@waveform-playlist/engine`.

A range input calls its `onChange` on every move, so a slider of your own that calls a mixer setter there now makes one undo step per move: Undo after a drag moves the fader back by one move only. Pass one gesture id for the whole drag. The setters take a last argument, `options?: MixerChangeOptions`: `setTrackVolume(trackId, volume, options?)` and the other three of `useEditorControls()`, and `setVolume(volume, options?)` and the other three of `useTrack()`. Calls with the same `gesture` id, one after another, are one step. `createMixerGesture()` makes the ids for one slider: `gesture.id` is the id to pass, and `gesture.attach(input)` ends the gesture on the input's `change` (the end of a pointer drag), on the `keyup` of an arrow, Page, Home or End key held down, and on `blur`; it returns the function that detaches it. Make one per slider, so two sliders never share an id. Mute and solo buttons need nothing: each click is one step.

`createMixerGesture` is exported from `@waveform-playlist/core`, the package the app already imports `audioTrack` from. The type of the options, `MixerChangeOptions`, is exported from `@waveform-playlist/engine`.

The snippets pass a track id, as the setters have taken since [the track controls became pieces](#track-controls-are-composed-from-pieces-bound-to-a-track-the-mixer-setters-take-a-track-id); on the last release they took a track index, so make that change first.

**Find:** `setTrackVolume(`, `setTrackPan(`, `setVolume(` and `setPan(` called from an `onChange` (or an `onInput`, or a listener of the `input` event); also `setTrackMute(` and `setTrackSolo(` or `setMuted(` and `setSoloed(` called from a control that fires many times per gesture.

**Replace with:**

```tsx
// Before
const { setTrackVolume } = useEditorControls();
<input
  type="range"
  min="0"
  max="1"
  step="0.01"
  value={volume}
  onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value))}
/>

// After
import { useEffect, useRef, useState } from 'react';
import { createMixerGesture } from '@waveform-playlist/core';

function VolumeSlider({ trackId, volume }: { trackId: string; volume: number }) {
  const { setTrackVolume } = useEditorControls();
  const [gesture] = useState(createMixerGesture); // one per slider, kept across renders
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    return input ? gesture.attach(input) : undefined;
  }, [gesture]);
  return (
    <input
      ref={ref}
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={volume}
      onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value), { gesture: gesture.id })}
    />
  );
}
```

In a track's panel, the same with `useTrack()`: `setVolume(parseFloat(e.target.value), { gesture: gesture.id })`. A slider drawn in a `.map()` over the tracks becomes a component of its own, as above, so that each has its own gesture.

A slider component that is not an `<input>` (Radix's `Slider`, for one) has no `change` event for `attach()`: pass `{ gesture: gesture.id }` from its value callback and call `gesture.end()` where a drag or a key press ends, in its `onPointerUp`, `onKeyUp` and `onBlur`. The [Flexible API example](/examples/flexible-api) does this.

## Mixer changes made from code are undo steps; pass `{ undoable: false }` for automation

**Packages:** `@waveform-playlist/browser`, `@waveform-playlist/engine`.

A mixer setter called from code is an undo step too, each call one: restoring a saved mix, automation, a value synced from elsewhere. Before, no such call was a step. A change that is not the user's edit takes `{ undoable: false }`: no step, and the value is also written into every undo and redo state, so no undo or redo brings back an older one. With `gesture` as well, `undoable: false` wins.

The snippets pass a track id, as the setters have taken since [the track controls became pieces](#track-controls-are-composed-from-pieces-bound-to-a-track-the-mixer-setters-take-a-track-id); on the last release they took a track index, so make that change first.

**Find:** `setTrackMute(`, `setTrackSolo(`, `setTrackVolume(` and `setTrackPan(` (of `useEditorControls()` or of the arrangement) and `setMuted(`, `setSoloed(`, `setVolume(` and `setPan(` (of `useTrack()`) called from an effect, a timer, a load or restore function, or a subscription, rather than from a control.

**Replace with:**

```tsx
// Before
const { setTrackVolume, setTrackMute } = useEditorControls();
saved.forEach((t) => {
  setTrackVolume(t.id, t.volume);
  setTrackMute(t.id, t.muted);
});

// After
const { setTrackVolume, setTrackMute } = useEditorControls();
const restore = { undoable: false } as const;
saved.forEach((t) => {
  setTrackVolume(t.id, t.volume, restore);
  setTrackMute(t.id, t.muted, restore);
});
```

To make a restore one step the user can take back, leave the options out and wrap the calls in `arrangement.beginTransaction()` and `arrangement.commitTransaction()` (see the next entry).

## A mixer change made inside a transaction is part of it; an abort takes it back

**Packages:** `@waveform-playlist/engine`, `@waveform-playlist/browser`.

Between `arrangement.beginTransaction()` and `commitTransaction()`, a mixer setter call joins the transaction like any other edit: the commit makes one step of the edits and the mixer changes together, and `abortTransaction()` (or an `undo()` or `redo()` during the transaction, which abort it first) takes the mixer changes back with the rest. A `gesture` id is ignored inside a transaction. A call with `{ undoable: false }` is not taken back by the abort. Before, a mixer change inside a transaction was not part of it and stayed after an abort; a transaction in which only the mix changed now makes a step.

**Find:** `beginTransaction()` with a mixer setter called before its `commitTransaction()` or `abortTransaction()`.

**Replace with:** nothing, when the mixer change belongs to the transaction. A mixer change that must stay after an abort is made after the transaction ends, or with `{ undoable: false }`.

## `useIntegratedRecording` takes the arrangement; a take is one undo step

**Packages:** `@waveform-playlist/recording`.

`useIntegratedRecording(arrangement, selectedTrackId, options?)` (was `(tracks, setTracks, selectedTrackId, options?)`). The hook keeps no copy of the tracks: it reads the arrangement when a take starts and when it ends, and adds the take with one `arrangement.updateTrack()`, so the take and the clips it trims, removes or splits are one undo step. `@waveform-playlist/recording` now depends on `@waveform-playlist/engine` for the `Arrangement` type.

`startRecording()` refuses (resolves `false`, records nothing, sets `error` with a message that starts `Cannot start recording: ` and names the track or id):

- no track selected (as before);
- a selected id the arrangement does not hold: `Cannot start recording: the selected track "<id>" is not in the arrangement. Add it with arrangement.addTrack() first.` Before, the take started and was lost at the end;
- a MIDI track (as before);
- a track that holds a clip whose audio is still loading, whose load failed, or that cannot be made from its audio (each has its own message).

A take refused at the end (the track's kind changed during the take) sets `error` to `Recording completed but the take could not be saved on track "<id>": …`, with the arrangement's error as `cause`; a track removed during the take gives `Recording completed but track "<id>" no longer exists. The recorded audio could not be saved.`, as before.

In plain JavaScript the old call does not work: the arguments are read in the new order, so with no track selected the hook throws while it renders (the old third argument, `null`, is read as the options), and otherwise `startRecording()` rejects with a `TypeError` (`arrangement.getTracks is not a function`). TypeScript reports the old call.

**Find:** `useIntegratedRecording(` with four arguments, or with `tracks` and `setTracks` first.

**Replace with:**

```tsx
// Before
const recording = useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime });

// After
const arrangement = useArrangement(); // under WaveformPlaylistProvider; or the one you made
const recording = useIntegratedRecording(arrangement, selectedTrackId, { currentTime });
```

## The track a take records onto shows muted during the take, and its Mute button is disabled

**Packages:** `@waveform-playlist/browser`, `@waveform-playlist/engine`.

While a take records onto a track (`useRecordingSession`, or `setRecordingActive(true, trackId)`), the provider marks that track in the arrangement as the one the take is recording onto (`arrangement.setTrackRecording(trackId, true)`), so what it already holds does not play under the punch-in. That track plays muted for the take; the take's mute is not an undo step, and undo and redo do not change it. Before (the last stable release), the provider muted the track in the engine for the take while the mixer and the Mute button still showed it unmuted; a mute or an unmute made during the take went to the engine (an unmute made the track heard under the take), and when the take ended the provider set the engine's mute from before the take back, whatever the Mute button showed. Now:

- `usePlaylistMixer().trackStates` and the track's Mute button show it muted during the take: its `muted` is the track's own mute or the take's mute;
- `arrangement.getMixer()` holds the track's own mute, which the take does not change: a mute set on that track during the take stays after it, and the mute from before the take is not written back (there is nothing to write back);
- the built-in `<TrackMuteButton />` of that track is disabled during the take; solo, volume and pan stay enabled;
- `useTrack().isRecording` is true for that track, for a mute control of your own;
- the take's mute is cleared when the take ends or the take's track changes, and when the provider unmounts or is hidden by `<Activity>` while a take is recording. One track is recorded onto at a time: naming one clears any other.

Edges: a take started during the first load records without playback (Play does nothing before the first ready); an `<Activity>` hide of the component that calls `useRecordingSession` ends the session (when it also calls `useIntegratedRecording` the take ends too and is added to its track; with `isRecording` from elsewhere still `true`, the reveal mutes the track again); removing the take's track during a take as an undo step, and undoing that removal after the take, brings the track back with its own mute (the end of the take clears its take mute). A mute control of your own that toggles from the reported value during a take (`setMuted(!muted)`, `setTrackMute(id, !trackStates[i].muted)`) sets the track's own mute to false, since `muted` is true for the take: the track stays muted for the take and comes out of it unmuted.

**Find:** a mute control of your own in a track panel or a mixer strip; code that reads `trackStates[i].muted` during a take, or `arrangement.getMixer().get(id).muted` to learn whether a track is heard; code that mutes or unmutes the take's track during a take, or that saves a track's mute before a take to set it back after.

**Replace with:**

```tsx
// A mute control of your own, in a track panel
const { muted, isRecording, setMuted } = useTrack();
<button disabled={isRecording} aria-pressed={muted} onClick={() => setMuted(!muted)}>
  Mute
</button>
```

```tsx
// Is the track heard? Its own mute or the take's mute
const silent = arrangement.getMixer().get(id)?.muted || arrangement.recordingTrackIds.has(id);
// or, under the provider: usePlaylistMixer().trackStates[i].muted
```

Code that saved a track's mute before a take and set it back after can go.

## `@waveform-playlist/midi` is replaced by `@dawcore/midi`

**Packages:** `@waveform-playlist/midi`, which is no longer published, and `@dawcore/midi`.

`loadMidiTracks` and `LoadMidiTracksOptions` move to `@dawcore/midi`, the package that already defined the MIDI parser. `@waveform-playlist/midi` held only those two and a re-export of the parser (`parseMidiFile`, `parseMidiUrl`, `ParsedMidi`, `ParsedMidiTrack`, `ParseMidiOptions`). Its last versions stay on npm: `13.0.4` (`latest`, with the `useMidiTracks` hook of the next entry) and `14.0.0-next.8` (`next`, with `loadMidiTracks`). The names and what they do are unchanged. `@dawcore/midi` has the same dependencies (`@tonejs/midi`, `@waveform-playlist/core`) and no peer dependency.

**Find:** `@waveform-playlist/midi` in `package.json` and in imports.

**Replace with:**

```sh
npm uninstall @waveform-playlist/midi
npm install @dawcore/midi
```

```ts
// Before
import { loadMidiTracks, parseMidiFile } from '@waveform-playlist/midi';

// After
import { loadMidiTracks, parseMidiFile } from '@dawcore/midi';
```

From `13.x`, where the package had `useMidiTracks`, also apply the next entry.

## `useMidiTracks` is removed: load with `loadMidiTracks`

**Package:** `@waveform-playlist/midi` (replaced by `@dawcore/midi`: see the entry above).

`useMidiTracks(configs, { sampleRate })` returned `{ tracks, loading, error, loadedCount, totalCount }` for the provider's `tracks` prop, which no longer exists. The hook is removed, with its types `MidiTrackConfig`, `UseMidiTracksOptions` and `UseMidiTracksReturn`. Its replacement is `loadMidiTracks` of `@dawcore/midi` (with `LoadMidiTracksOptions`), which has no `react` peer dependency.

`loadMidiTracks(src, options)` is a function: `src` is one URL, `File` or `Blob`, and it resolves to `ClipTrack[]` with `kind: 'midi'`. The app keeps its own loading and error state and adds the tracks to the arrangement.

What the hook did that the function does not:

| `useMidiTracks` | Now |
| --- | --- |
| Several configs in one call, fetched in parallel | One `loadMidiTracks` call per file; `Promise.all` for several, then add the tracks in the order you want |
| `loading`, `error`, `loadedCount`, `totalCount` | Your own state around the promise; a rejection carries the message |
| A config's `startTime` | The option `start` (seconds) |
| A config's `muted`, `soloed`, `volume`, `pan`, `color` | Set them on the returned track before adding it: `arrangement.addTrack({ ...track, volume: 0.8 })` |
| A config's `name` (used only with `midiNotes`; the tracks of a file always kept their own MIDI names) | For a file, the new option `name` names the track and its clip when the file yields exactly one track; leave it out to keep the file's name, as the hook did. Several tracks keep their own MIDI names |
| A config with `midiNotes` (notes you already have, no file) | Build the track with `createClipFromSeconds` and `createTrack({ kind: 'midi' })` from `@waveform-playlist/core` (below) |
| A reload when a config changed | Call `loadMidiTracks` again and replace the tracks yourself (`arrangement.removeTrack`, `arrangement.addTrack`); every call makes new track and clip ids |
| The fetched file kept in memory, so a changed option did not fetch again | Not kept. To parse one file several ways, fetch it once and pass the `Blob` |

**Find:** `useMidiTracks`, `MidiTrackConfig`, `UseMidiTracksOptions`, `UseMidiTracksReturn`.

**Replace with:**

```tsx
// Before
import { useMidiTracks } from '@waveform-playlist/midi';

const { tracks, loading, error } = useMidiTracks([{ src: '/music/song.mid' }], {
  sampleRate: 48000,
});
if (loading) return <p>Loading MIDI…</p>;
if (error) return <p>Error: {error}</p>;
return <WaveformPlaylistProvider tracks={tracks}>…</WaveformPlaylistProvider>;

// After
import { loadMidiTracks } from '@dawcore/midi';

const arrangement = useCreateArrangement();
const [loaded, setLoaded] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const controller = new AbortController();
  loadMidiTracks('/music/song.mid', { sampleRate: 48000, signal: controller.signal })
    .then((tracks) => {
      if (arrangement.getTracks().length === 0) {
        tracks.forEach((track) => arrangement.addTrack(track));
        arrangement.clearHistory(); // the first load is not an undo step
      }
      setLoaded(true);
    })
    .catch((err: unknown) => {
      // An abort (unmount, StrictMode's first run) is not an error
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    });
  return () => controller.abort();
}, [arrangement]);

if (error) return <p>Error: {error}</p>;
if (!loaded) return <p>Loading MIDI…</p>;
return <WaveformPlaylistProvider arrangement={arrangement}>…</WaveformPlaylistProvider>;
```

Render the provider after the tracks are in: the playlist's ready happens once per mount and waits only for audio sources ([MIDI guide](/docs/react/guides/midi#basic-usage)). `sampleRate` means what it meant for the hook; the MIDI guide recommends passing the rate of the context the playlist plays on (`getGlobalAudioContext().sampleRate` with the default adapter) rather than a fixed number.

Notes you already have, with no file:

```tsx
// Before
const { tracks } = useMidiTracks([{ midiNotes: notes, name: 'Synth Lead', duration: 30 }], {
  sampleRate: 48000,
});

// After
import { createClipFromSeconds, createTrack } from '@waveform-playlist/core';

const clip = createClipFromSeconds({
  startTime: 0,
  duration: 30, // seconds; the hook's default was the end of the last note
  sourceDuration: 30,
  sampleRate: 48000,
  midiNotes: notes,
  name: 'Synth Lead',
});
arrangement.addTrack(createTrack({ name: 'Synth Lead', kind: 'midi', clips: [clip] }));
```

## The annotations are an annotation store's: `annotationList.annotations` and `onAnnotationsChange` are removed

**Packages:** `@waveform-playlist/browser` (major), `@waveform-playlist/core` (additions). Both providers.

The providers no longer take the annotations from your state and hand changes back (#867). They take an **annotation store**, an `AnnotationStore` from `@waveform-playlist/core` that you make with `useCreateAnnotationStore` from `@waveform-playlist/browser`. The store owns the annotations; the provider publishes what it holds and writes nothing back. An edge drag, a boundary key, a text, id or action-button edit in the list and your own code each change the store, with `set(list)` or `update(fn)`, and every change applies to the store's list as it is at the moment of the call. Before, the library built each change from the annotations of the last render and handed the whole array to `onAnnotationsChange`, so two changes in one tick lost one (two `setAnnotations(fn)` calls, or an annotation your app added in the same tick as a drag release).

What goes with it:

- **`annotationList` holds the three options only:** `editable`, `linkEndpoints`, `isContinuousPlay`. Its `annotations` field is removed; so is `onAnnotationsChange` on both providers.
- **No store, no annotations.** Without `annotationStore` the provider has none (`useAnnotations().annotations` is `[]`) and makes no store of its own; the drag, the boundary keys and the list's edits have nothing to write to.
- **To save the annotations,** subscribe to the store (`store.subscribe(listener)`, which returns the function that unsubscribes), or read it with `useStoredAnnotations(store)` and save from an effect.
- **One store per editor.** `useCreateAnnotationStore(init?, options?)` reads `init` once and returns the same store on every render. `options.beforeChange(next, current)` is your rule for every change: return `next` to accept it, `current` to refuse it, or another list to adjust it (see [Your Rules for Every Change](/docs/react/guides/annotations#your-rules-for-every-change-beforechange)).
- **The same store works under either provider**, and above the provider (`useStoredAnnotations` takes it as an argument).

In plain JavaScript a leftover `annotationList.annotations` or `onAnnotationsChange` is ignored: the provider shows no annotations, and nothing warns. TypeScript reports both.

**Find:** `onAnnotationsChange=` on `WaveformPlaylistProvider` or `MediaElementPlaylistProvider`; `annotations` inside their `annotationList`; the `useState` that held those annotations.

**Replace with:**

```tsx
// Before
const [annotations, setAnnotations] = useState<AnnotationData[]>(initialAnnotations);

<WaveformPlaylistProvider
  arrangement={arrangement}
  annotationList={{ annotations, editable: true }}
  onAnnotationsChange={(next) => {
    setAnnotations(next);
    save(next);
  }}
>
  <AnnotationProvider>
    <Waveform />
  </AnnotationProvider>
</WaveformPlaylistProvider>

// After
import { useCreateAnnotationStore, useStoredAnnotations } from '@waveform-playlist/browser';

const annotationStore = useCreateAnnotationStore(() => initialAnnotations);

const annotations = useStoredAnnotations(annotationStore); // only where you read them
useEffect(() => {
  save(annotations);
}, [annotations]);

<WaveformPlaylistProvider
  arrangement={arrangement}
  annotationStore={annotationStore}
  annotationList={{ editable: true }}
>
  <AnnotationProvider>
    <Waveform />
  </AnnotationProvider>
</WaveformPlaylistProvider>
```

The effect above also runs once on mount, with the initial annotations. To save only the changes, subscribe instead: `useEffect(() => annotationStore.subscribe(() => save(annotationStore.getAnnotations())), [annotationStore])`.

Where your code replaced the annotations (a file loaded, a "clear all" button), call `annotationStore.set(list)`; where it changed them from the previous value, `annotationStore.update((current) => next)`:

```tsx
// Before
setAnnotations(fragments.map(parseAeneas));
setAnnotations((prev) => prev.filter((a) => a.id !== id));

// After
annotationStore.set(fragments.map(parseAeneas));
annotationStore.update((current) => current.filter((a) => a.id !== id));
```

A `useMemo` that built the `annotationList` object from the annotations needs them no more: `useMemo(() => ({ isContinuousPlay: true }), [])`.

**New exports:** `useCreateAnnotationStore` and `useStoredAnnotations` (`@waveform-playlist/browser`); `createAnnotationStore`, `AnnotationStore`, `AnnotationStoreOptions`, `applyAnnotationBounds` and `AnnotationBoundsChange` (`@waveform-playlist/core`). `applyAnnotationBounds(current, changes)` writes the `start` and `end` of each change onto the annotation with that id, keeps everything else, skips ids that are not in `current`, and returns `current` itself when nothing changes.

## `setAnnotations` is removed: write through the annotation store

**Package:** `@waveform-playlist/browser`. Both providers.

`usePlaybackControls()` no longer has `setAnnotations`. It has `annotationStore` instead, next to `annotationPreview`: the store given to the provider's `annotationStore` prop, or `undefined` without one. Its identity changes only when the prop does. A component of your own that adds, removes or changes annotations writes through it, or through the store your app made, with `set` and `update`.

A leftover call of `setAnnotations` is a `TypeError` in plain JavaScript (`setAnnotations is not a function`); TypeScript reports the missing property.

**Find:** `setAnnotations` read from `usePlaybackControls()`.

**Replace with:**

```tsx
// Before
const { setAnnotations } = usePlaybackControls();
setAnnotations((prev) => [...prev, newAnnotation]);
setAnnotations([]);

// After
const { annotationStore } = usePlaybackControls();
annotationStore?.update((current) => [...current, newAnnotation]);
annotationStore?.set([]);
```

A function update reads the store's list at the moment of the call: two updates in one tick both land, in either order. Compute what you add inside the function from `current`, not from `useAnnotations()` of the last render (the annotations example finds the gap for a new annotation that way).

## `useAnnotationDragHandlers` and `useAnnotationKeyboardControls` take the annotation store

**Package:** `@waveform-playlist/browser`.

Both hooks take `store: AnnotationStore | undefined` in place of `annotations` and `onAnnotationsChange`. They read the annotations from the store and write their changes to it:

- **The drag** keeps the `start` and `end` of every annotation it has touched (the dragged one and the neighbours it moved, also one moved back to where it was). Each move is worked out over the store's current list with those bounds on top, so a neighbour your app moved during the drag is collided with where it is now. With `preview`, the moves are published to the preview (the store's current list with the drag's bounds on top, so a change made elsewhere is drawn at once) and only the release writes: the touched bounds, by id, onto the store's list as it is then; an annotation added during the drag stays, and so does any other edit made elsewhere, except to the `start` and `end` of an annotation the drag has touched: those are the drag's, and Escape writes nothing. Without `preview`, every move writes all the touched bounds, and Escape writes each touched annotation's bounds from the start of the drag back, by id.
- **The drag ends** and writes nothing more (its preview cleared) when the dragged annotation is removed from the store (a "clear all" included), when the provider is given another store, or when the component unmounts. Without `preview` the moves already written stay.
- **The boundary keys** (`[`, `]`, `Shift+[`, `Shift+]`) find the active annotation by id in the store's list when the key is pressed. A key at a limit (a start at 0, an end at the end of the audio, an annotation at its shortest) changes nothing and tells no subscriber.
- **Without a store** (`store: undefined`) both hooks do nothing: there are no annotations to drag, select or move.

In plain JavaScript a call that still passes `annotations` and `onAnnotationsChange` and no `store` does nothing: no drag moves an edge, no key selects or moves an annotation. TypeScript reports the two options and the missing `store`.

**Find:** `useAnnotationDragHandlers(` and `useAnnotationKeyboardControls(` with `annotations` and `onAnnotationsChange` in their options.

**Replace with:**

```tsx
// Before
const { annotations } = useAnnotations();
const { setAnnotations, annotationPreview, setActiveAnnotationId } = usePlaybackControls();
const handlers = useAnnotationDragHandlers({
  annotations,
  onAnnotationsChange: setAnnotations,
  preview: annotationPreview,
  samplesPerPixel,
  sampleRate,
  duration,
  linkEndpoints,
});
useAnnotationKeyboardControls({
  annotations,
  activeAnnotationId,
  onAnnotationsChange: setAnnotations,
  onActiveAnnotationChange: setActiveAnnotationId,
  duration,
  linkEndpoints,
});

// After
const { annotationStore, annotationPreview, setActiveAnnotationId } = usePlaybackControls();
const handlers = useAnnotationDragHandlers({
  store: annotationStore,
  preview: annotationPreview,
  samplesPerPixel,
  sampleRate,
  duration,
  linkEndpoints,
});
useAnnotationKeyboardControls({
  store: annotationStore,
  activeAnnotationId,
  onActiveAnnotationChange: setActiveAnnotationId,
  duration,
  linkEndpoints,
});
```

`useAnnotationsWithPreview(annotations, preview)` is unchanged except for its types: it takes and returns `readonly AnnotationData[]`. `<WaveformAnnotationBoxes>` and `<KeyboardShortcuts annotations>` call the two hooks with the provider's store themselves.

## `AnnotationText` writes to an annotation store; `onAnnotationUpdate` is removed

**Package:** `@waveform-playlist/annotations`.

`AnnotationText` no longer reports its edits through a callback. It takes `store?: AnnotationStore` instead: a text edit, an id edit and an action button call `store.update`, and each finds its annotation by id in the store's list as it is then. `annotations` stays what the list draws (`readonly AnnotationData[]` is accepted). Under a provider, `<AnnotationList>` passes the provider's store; this entry is for an `AnnotationText` you render yourself.

- **Without `store` the list is read-only:** no field can be edited and no action button is drawn, whatever `editable` says. Before, the fields were editable without `onAnnotationUpdate` (the edit was dropped) and `controls` were drawn whenever given.
- **The id field refuses a duplicate id** as it refused an empty one: nothing is written and the field shows the stored id again. Before, a duplicate was accepted.
- **A field whose edit was not stored** (refused by the store's `beforeChange`) shows the stored value again.
- **An action** (`AnnotationAction`, type unchanged) is called with copies: a new array and a copy of each annotation with its `lines`, so it may change them in place, as before. `index` is the annotation's position in the store's list. Annotations the action did not change keep their objects.

In plain JavaScript a leftover `onAnnotationUpdate` is ignored, and without a `store` the list is read-only. TypeScript reports the prop.

**Find:** `onAnnotationUpdate` on `<AnnotationText`.

**Replace with:**

```tsx
// Before
const [annotations, setAnnotations] = useState<AnnotationData[]>(initialAnnotations);
<AnnotationText annotations={annotations} editable onAnnotationUpdate={setAnnotations} />

// After
import { useCreateAnnotationStore, useStoredAnnotations } from '@waveform-playlist/browser';

const store = useCreateAnnotationStore(() => initialAnnotations);
const annotations = useStoredAnnotations(store);
<AnnotationText annotations={annotations} editable store={store} />
```

Without `@waveform-playlist/browser`, make the store with `createAnnotationStore(initialAnnotations)` from `@waveform-playlist/core` (once, outside the render) and re-render on `store.subscribe`.

## `useAnnotations().annotations` is read-only, and frozen in development

**Packages:** `@waveform-playlist/browser`, `@waveform-playlist/core`.

`useAnnotations().annotations` (`AnnotationsContextValue`) is typed `readonly AnnotationData[]`, as are `useStoredAnnotations(store)` and `store.getAnnotations()`. They are the store's own list. In a development build the store freezes the array, each annotation and each annotation's `lines`. A development build here is one where `process.env.NODE_ENV` is set and is not `'production'` (a bundler's dev server); a page that loads the module with no bundler and no `process` freezes nothing. On a frozen list `.sort(…)`, `.push(…)` and the other array writes throw a `TypeError` in any code; an assignment to a field (`annotations[0].end = 4`) throws in strict code, which every module is, and is silently ignored in a sloppy-mode script. In a production build nothing is frozen, and such a write changes the annotations every reader shares, without telling anyone.

The store freezes what you give it too: after `store.set(list)` (or an `update` that returns `list`), `list` and its annotations are frozen in a development build. Do not keep changing them.

The inputs that only read a list accept `readonly` arrays: `AnnotationText`'s `annotations`, `AnnotationFormat.serialize`, `useAnnotationsWithPreview` and core's `updateAnnotationBoundaries`. This breaks no code that calls them. It does break an `AnnotationFormat` you implement yourself whose `serialize` takes `AnnotationData[]`: under `strictFunctionTypes` (part of `strict`) TypeScript reports TS2322, because the interface now passes a `readonly` list. The `annotations` argument of an `AnnotationAction` stays `AnnotationData[]`: it is a copy, meant to be changed.

**Find:** a list from `useAnnotations()` (or `useAnnotationsWithPreview`) passed to a parameter of yours typed `AnnotationData[]`; `.sort(`, `.push(`, `.splice(` or `.reverse(` called on it; an assignment to a field of one of its annotations.

**Replace with:** widen your parameter to `readonly AnnotationData[]`, or pass a copy; sort a copy; change annotations through the store.

**Find:** an object typed `AnnotationFormat` that you write (a format of your own), with `serialize: (annotations: AnnotationData[]) => …`.

**Replace with:** the same function with its parameter widened to `readonly AnnotationData[]` (copy it first if the function sorts or changes it).

```ts
// Before
const csvFormat: AnnotationFormat = {
  name: 'csv',
  parse: parseCsv,
  serialize: (annotations: AnnotationData[]) => annotations.map(toCsvRow).join('\n'),
};

// After
const csvFormat: AnnotationFormat = {
  name: 'csv',
  parse: parseCsv,
  serialize: (annotations: readonly AnnotationData[]) => annotations.map(toCsvRow).join('\n'),
};
```

```tsx
// Before
const { annotations } = useAnnotations();
const sorted = annotations.sort((a, b) => a.start - b.start);
annotations[0].end = 4;

// After
const { annotations } = useAnnotations();
const sorted = [...annotations].sort((a, b) => a.start - b.start);
const { annotationStore } = usePlaybackControls();
annotationStore?.update((current) =>
  current.map((a, i) => (i === 0 ? { ...a, end: 4 } : a))
);
```

## Invalid annotations throw at the store; duplicate ids are refused

**Packages:** `@waveform-playlist/core`, `@waveform-playlist/browser`, `@waveform-playlist/annotations`.

The store checks every list it is given, in every build: the initial list, `set`, what `update`'s function returns and what `beforeChange` returns. Each annotation needs a `start` and an `end` that are finite numbers, and no two annotations may have the same `id`. A list that fails throws a `TypeError` from the call, and the store keeps its value:

```text
[waveform-playlist] Invalid annotations: annotation "f001" needs numeric start and end (got string and string). Parse text formats first, e.g. parseAeneas() from @waveform-playlist/annotations.
[waveform-playlist] Invalid annotations: two annotations have the id "3".
```

Before, a development build checked only the first annotation, logged a console error and showed no annotations; a production build checked nothing; and two annotations with one id were accepted, by the provider and by the id field of the list. Now a throw from the `useCreateAnnotationStore` initializer is a render error, caught by the nearest error boundary above the component that calls the hook; a throw from `set` or `update` is that call's exception, in your handler or effect. An action button whose `action` leaves an invalid list throws out of the click.

The id field of the list refuses a duplicate id: nothing is written and the field shows the stored id again.

**Find:** annotations loaded from a file or a server; Aeneas fragments (`begin`/`end` strings) passed without `parseAeneas`; lists that can hold two annotations with one id (ids made from a time or a counter).

**Replace with:** parse first, give every annotation its own id, and catch the throw where the list comes from outside your code:

```tsx
// Before: an invalid file showed no annotations, with a console error in development
setAnnotations(JSON.parse(text));

// After
try {
  annotationStore.set((JSON.parse(text) as AeneasFragment[]).map(parseAeneas));
} catch (error) {
  showProblem(error instanceof Error ? error.message : String(error));
}
```

## Spectrogram choices are stored on the track

**Packages:** `@waveform-playlist/core` (`TrackSpectrogramOverrides` removed), `@waveform-playlist/browser` (`trackSpectrogramOverrides` of `useSpectrogramIntegration()` removed), `@waveform-playlist/spectrogram` (`SpectrogramProvider`).

The track menu, `useTrack().setRenderMode` and the spectrogram settings dialog change the track in the arrangement: its `renderMode`, `spectrogramConfig` and `spectrogramColorMap`. `SpectrogramProvider` keeps no per-track overrides of its own. What a consumer sees:

- Each choice is an undo step, and clears the redo history like any edit. Choosing the mode a track is already drawn with (an unset mode is a waveform) changes nothing, and so does a mode for a MIDI track and an Apply in the settings dialog that changed nothing.
- A change the app makes to the track with `arrangement.updateTrack` after a choice in the menu is drawn. Before, the menu's override won for good.
- `arrangement.getTracks()` holds the choices. `arrangement.setTracks(…)` replaces them with the tracks it is given (before, a choice survived it by track id), and a track added with the id of a removed one starts from its own fields.

Reading the removed `trackSpectrogramOverrides` gives `undefined`, so `.get(…)` on it throws.

**Find:** `trackSpectrogramOverrides` and `TrackSpectrogramOverrides`.

**Replace with:** the track's own fields, from `usePlaylistTimeline().tracks` (or `arrangement.getTracks()`):

```ts
// Before
const { trackSpectrogramOverrides } = useSpectrogramIntegration();
const override = trackSpectrogramOverrides.get(track.id);
const mode = override?.renderMode ?? track.renderMode ?? 'waveform';
const config = override?.config ?? track.spectrogramConfig;
const colorMap = override?.colorMap ?? track.spectrogramColorMap;
// After
const mode = track.renderMode ?? 'waveform';
const config = track.spectrogramConfig;
const colorMap = track.spectrogramColorMap;
```

An app that keeps its own copy of the tracks and hands them to `arrangement.setTracks` should take the tracks from `arrangement.getTracks()` first, or the user's choices are replaced.

## Smaller changes of the provider

**Packages:** `@waveform-playlist/browser`.

- **An engine build that fails during playback shows stopped.** When a rebuild started during playback and the new engine cannot be built, `isPlaying` turns false and the cursor stays where it was; nothing starts by itself after a later successful build.
- **A load in flight across an engine rebuild** carries on with the previous adapter's `AudioContext`. A `createAdapter` whose adapter closes its context in `dispose()` can make such a load fail; `arrangement.retry(src)` loads it again.
- **Loading is aborted and restarted around an `<Activity>` hide**: the provider gives the arrangement its decode context on mount and takes it back on unmount or a hide; loads in flight are aborted and start again on the reveal.
- **`useArrangement()`** is new: the provider's arrangement, below `WaveformPlaylistProvider`.

**Find:** nothing to change for these unless your code depended on the old behaviour (a playback that resumed after a failed rebuild, an adapter that closes its context).

## `SegmentedVUMeter`: `showScale` is replaced by `hideScale`

**Package:** `@waveform-playlist/ui-components`.

A boolean prop defaults to `false` here, so the option is now the one that turns the scale off. The dB scale is still drawn by default.

In plain JavaScript a leftover `showScale={false}` is ignored and the scale is drawn; TypeScript reports it (`Property 'showScale' does not exist`). A leftover `showScale` (true) changes nothing.

**Find:** `showScale` on `SegmentedVUMeter`.

**Replace with:**

```tsx
// Before
<SegmentedVUMeter meter={meter} showScale={false} />
// After
<SegmentedVUMeter meter={meter} hideScale />
```

## `AnnotationBox` draws its edge handles only with `editable`

**Package:** `@waveform-playlist/annotations`.

`editable` defaulted to `true` and now defaults to `false`. The boxes that `@waveform-playlist/browser` draws (`<WaveformAnnotationBoxes>`) always pass it, from the provider's `editable` option, so they are unchanged. An `AnnotationBox` you render yourself without `editable` has no handles now.

**Find:** `<AnnotationBox` without an `editable` prop.

**Replace with:**

```tsx
// Before: handles drawn
<AnnotationBox annotationId={a.id} annotationIndex={i} startPosition={x0} endPosition={x1} />
// After
<AnnotationBox annotationId={a.id} annotationIndex={i} startPosition={x0} endPosition={x1} editable />
```

## `useZoomControls` and `useMasterVolume` are removed from the entry

**Package:** `@waveform-playlist/browser`, with the types `ZoomControls` and `MasterVolumeControls`.

They were the provider's own hooks: they took an engine ref and held a copy of the engine's state, which followed the engine only when its `onEngineState` was handed every `statechange`, as the provider did for its own call. The provider's hooks give the same values and setters.

**Find:** `useZoomControls`, `useMasterVolume`, `ZoomControls` and `MasterVolumeControls` in an import from `@waveform-playlist/browser`.

**Replace with:**

```tsx
// Before
const { samplesPerPixel, zoomIn, zoomOut, canZoomIn, canZoomOut } = useZoomControls({ engineRef, initialSamplesPerPixel });
const { masterVolume, setMasterVolume } = useMasterVolume({ engineRef });
// After
const { samplesPerPixel, canZoomIn, canZoomOut } = usePlaylistZoom();
const { masterVolume } = usePlaylistMixer();
const { zoomIn, zoomOut, setMasterVolume } = useEditorControls();
```

## Props and components the packages did not use are removed

**Packages:** `@waveform-playlist/ui-components` and `@waveform-playlist/annotations`.

| Removed | What it did | Replace with |
| --- | --- | --- |
| `theme` of `Playlist` (it was required) | nothing: the component reads the theme from styled-components | remove the prop |
| `StyledPlaylist` | `Playlist` with the theme injected into the unread `theme` prop | `Playlist` |
| `LoopRegion`, `LoopRegionProps` | an overlay with two markers; the views draw the loop with `TimescaleLoopRegion`, which stays | `TimescaleLoopRegion`, or an overlay of your own |
| `trackIndex`, `clipIndex` of `ClipHeader` and `ClipBoundary` | nothing (`Clip` keeps both: they are in the drag data) | remove the props |
| `isOverlay` of `Clip` | drew the clip in the flow (not at its position) for a drag overlay, without drag or trim handles; nothing in the packages renders a drag overlay | no replacement: a `Clip` is placed at its `startSample`. A copy left with `isOverlay` in plain JavaScript is now a real clip: with `showHeader` (and without `disableHeaderDrag`) it registers the header and both edges as draggables under the clip's own ids, beside the clip it copies |
| `offset` of `Track` (the views passed 0) | a `padding-left` inside the track. It moved only children placed in the flow, such as a `Channel` rendered straight in the track; a `Clip` sets its own `left` and was not moved | remove it; for content of your own, a wrapper with `padding-left`. The track's row element no longer has an inline `padding-left: 0px`, so a `padding-left` your CSS gives that element now applies |
| `offset` of `AnnotationBoxesWrapper` (`@waveform-playlist/annotations`) | a `padding-left` inside the wrapper. It moved only children placed in the flow; an `AnnotationBox` sets its own `left` and was not moved | remove it; for content of your own, a wrapper with `padding-left` |
| `samplesPerPixel` of `SpectrogramChannel` (it was required) | nothing | remove the prop |
| `samplesPerPixel` of `SmartChannel` | overrode the `PlaylistInfoContext` value for a piano roll (the spectrogram did not read it) | the `samplesPerPixel` of the `PlaylistInfoContext` value around it |
| `label` of `TrackMenuItem` | nothing: `TrackMenu` draws each item's `content` | remove the field |

In plain JavaScript a leftover prop is ignored (`isOverlay` aside, above); for `offset` that removes the padding it made, which moved no clip and no annotation box, and for `SmartChannel`'s `samplesPerPixel` the context's value is used. TypeScript reports each one.

**Find:** the names in the first column.

**Replace with:**

```tsx
// Before
<Playlist theme={theme} tracksWidth={width}>{rows}</Playlist>
<ClipBoundary clipId={id} trackIndex={t} clipIndex={c} edge="left" />
<SpectrogramChannel index={0} length={w} waveHeight={80} samplesPerPixel={1024} clipId={id} onCanvasRegister={reg} onCanvasUnregister={unreg} />
// After
<Playlist tracksWidth={width}>{rows}</Playlist>
<ClipBoundary clipId={id} edge="left" />
<SpectrogramChannel index={0} length={w} waveHeight={80} clipId={id} onCanvasRegister={reg} onCanvasUnregister={unreg} />
```

## `useIntegratedRecording` no longer switches microphone by itself

**Package:** `@waveform-playlist/recording`.

When the selected microphone left the device list, `useIntegratedRecording` asked for the first remaining one itself. It does not any more: the hooks open a microphone only when the app asks.

- When the open microphone is unplugged (or its permission revoked), `stream` becomes `null` and `error` says "The microphone was disconnected or its permission was revoked. Request microphone access again." This is `useMicrophoneAccess`'s behaviour, so it holds without `useIntegratedRecording` too. Before, the ended stream stayed in `stream` when no other microphone was there.
- `selectedDevice` is the microphone that is open: the id its stream reports (`getSettings().deviceId`), and `null` while none is open. Before, it named the first device of the list once access was granted, until `changeDevice()` chose another, whether or not that device was the one open, and it kept naming a device after a `changeDevice()` that failed. After `requestMicAccess()` it names the microphone that was opened: the default (`'default'` in Chromium), or the one the `audioConstraints` option names. A microphone chosen earlier is opened again with `changeDevice(id)`; the hook keeps no memory of it.
- New: `hasLabels` (also on `useMicrophoneAccess`) is `true` when `devices` names the real microphones. Chromium holding the permission named them before any microphone was open in our runs, so a picker can offer them and `changeDevice(id)` opens only the one chosen. Firefox and WebKit (Safari's engine) named them only once a microphone was open, so there the first open is still `requestMicAccess()`.

**Find:** components that use `useIntegratedRecording` or `useMicrophoneAccess` and show a "enable microphone" control only before the first grant; pickers that read `selectedDevice` as always naming a device, or fall back to `devices[0]`.

**Replace with:** show the control while no device is named and nothing is open (`!stream && !hasLabels`; `hasPermission` is removed, see the next section); otherwise the picker, with an option for a `selectedDevice` that `devices` does not hold (`null` included): a `<select>` whose value matches no option shows its first device.

```tsx
// Before: after an unplug the hook opened another microphone by itself, and
// the picker showed the first device of the list
{!hasPermission ? (
  <button onClick={requestMicAccess}>Enable microphone</button>
) : (
  <select value={selectedDevice ?? ''} onChange={(e) => changeDevice(e.target.value)}>
    {devices.map((d) => (
      <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
    ))}
  </select>
)}

// After: the app asks, and the picker shows the open microphone or none
const listed = devices.some((d) => d.deviceId === selectedDevice);

{!stream && !hasLabels ? (
  <button onClick={requestMicAccess}>Enable microphone</button>
) : (
  <select value={(listed && selectedDevice) || ''} onChange={(e) => changeDevice(e.target.value)}>
    {!listed && <option value="" disabled>Choose a microphone</option>}
    {devices.map((d) => (
      <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
    ))}
  </select>
)}
```

## `hasPermission` is removed from the recording hooks

**Package:** `@waveform-playlist/recording`.

`useMicrophoneAccess` and `useIntegratedRecording` no longer return `hasPermission`. It was kept by hand beside `stream` and could disagree with it. A device switch cleared `stream` and left `hasPermission` `true`, so a `stopStream()` during the switch, or a hide while its grant arrived, left it `true` with no stream: a Record button that read it stayed enabled, and `startRecording()` failed with "No microphone stream available". Read `stream` instead.

Two differences from the old field:

- While a request is opening a microphone (`changeDevice(id)`, or `requestAccess()` / `requestMicAccess()` while one is open), `stream` is `null`: the request stops the open microphone first. `hasPermission` stayed `true` then, with nothing to record from.
- Neither says whether the browser holds the microphone permission. `stream` says whether this hook has a microphone open; `hasPermission` was `false` after a `stopStream()` that closed one, with the permission still granted. `hasLabels` says whether the browser names the devices.

**Find:** `hasPermission`, in the values of `useMicrophoneAccess()` and `useIntegratedRecording()`.

**Replace with:** `stream !== null` (destructure `stream` if the component does not already).

```tsx
// Before
const { hasPermission, requestAccess } = useMicrophoneAccess();
if (!hasPermission) return <button onClick={() => requestAccess()}>Enable microphone</button>;

// After
const { stream, requestAccess } = useMicrophoneAccess();
if (stream === null) return <button onClick={() => requestAccess()}>Enable microphone</button>;
```

## Recording types nothing read are removed

**Package:** `@waveform-playlist/recording`.

| Removed | What it did | Replace with |
| --- | --- | --- |
| `RecordingState` (type) | nothing: no hook returned it | the fields of `UseRecordingReturn` (`isRecording`, `isPaused`, `progress`) |
| `RecordingData` (type) | nothing: no hook returned it | `UseRecordingReturn['audioBuffer']` and `progress` |
| `deviceId` of `RecordingOptions` | nothing: `useRecording` records the stream it is given | `requestAccess(deviceId)` of `useMicrophoneAccess`, or `changeDevice(deviceId)` of `useIntegratedRecording` |
| `audioConstraints` of `RecordingOptions` | nothing, for the same reason | `requestAccess(deviceId, audioConstraints)`, or the `audioConstraints` option of `useIntegratedRecording`, which stays |

In plain JavaScript a leftover option is ignored, as it was before. TypeScript reports each one.

**Find:** `RecordingState`, `RecordingData`, and `deviceId` or `audioConstraints` in the options of `useRecording(stream, { … })`.

**Replace with:**

```tsx
// Before: neither option reached the microphone
const { stream } = useMicrophoneAccess();
const recording = useRecording(stream, { deviceId, audioConstraints: { echoCancellation: true } });
// After: the stream is asked for with them
const { stream, requestAccess } = useMicrophoneAccess();
const recording = useRecording(stream);
await requestAccess(deviceId, { echoCancellation: true });
```

## `useMediaElementTrack()`: `fadeIn` and `fadeOut` are removed

**Package:** `@waveform-playlist/browser`.

The value held the track's fades twice: as its own fields and on its one clip. The clip is the one place now. Reading the removed fields gives `undefined`.

**Find:** `fadeIn` or `fadeOut` read from `useMediaElementTrack()`.

**Replace with:**

```tsx
// Before
const { fadeIn, fadeOut } = useMediaElementTrack();
// After
const { peaksDataArray } = useMediaElementTrack();
const clip = peaksDataArray[0]?.[0]; // undefined when the peak data could not be read
const fadeIn = clip?.fadeIn;
const fadeOut = clip?.fadeOut;
```

The fades are also the `fadeIn` and `fadeOut` of the `track` you give the provider.

## MediaElement player: the `samplesPerPixel` prop is followed

**Package:** `@waveform-playlist/browser`.

`MediaElementPlaylistProvider` read `samplesPerPixel` once, at mount. There is no zoom control under this provider, so the prop is the only place the zoom level is set, and the provider now follows it: a new value redraws the waveform at it (`usePlaylistZoom().samplesPerPixel` takes it), and the player is not rebuilt. The view stays anchored as described in [the next entry](#a-zoom-change-keeps-the-pointer-the-selection-the-cursor-or-the-centre-in-place).

A value finer than the waveform data (below its `scale`, the samples per pixel the `.dat` file was made at) is drawn at the data's own resolution, and `usePlaylistZoom().samplesPerPixel` reports that value. Before, such a value (at mount) left the track's row empty, with the console warning `Failed to extract peaks from waveform data: … Zoom level … too low`.

`automaticScroll` (both providers) and the `samplesPerPixel` of `WaveformPlaylistProvider` stay initial values. The provider owns them afterwards (`setAutomaticScroll` of `usePlaybackControls()`; `zoomIn` and `zoomOut` of `useEditorControls()`), and a later change of the prop is not followed, as before.

**Find:** a `samplesPerPixel` on `MediaElementPlaylistProvider` that changes after mount (state of the app, a prop passed down). If the old behaviour, a level fixed at mount, is what you want, pass a value that does not change.

**Replace with:** nothing to change: the change now shows.

## A zoom change keeps the pointer, the selection, the cursor or the centre in place

**Package:** `@waveform-playlist/browser` (both providers).

When the zoom level changes (`zoomIn()` / `zoomOut()` of `useEditorControls()`, the MediaElement provider's `samplesPerPixel` prop), the view keeps one point in place, as far as the scroll range allows. Before, `WaveformPlaylistProvider` kept the centre of the view (except on an empty timeline, below); the MediaElement player could not change its zoom until this release. The point is the first of:

1. **The time under a mouse or pen hovering over the timeline** (the tracks or the ruler), hit-tested at the zoom: an element drawn above the timeline (a toolbar, a popover) is not the timeline. A touch does not hover: after a tap this step is passed over.
2. **A selected range that is on screen** and does not fill the view: its centre, or the centre of its visible part when its centre is off screen. A point selection (after a click) is not a range.
3. **The cursor** (where Play starts; the playhead during playback), when it is on screen.
4. **The centre of the view.**

A click on the Zoom In or Zoom Out button puts the pointer on the button, so the buttons use the range, the cursor or the centre. Pressed from the keyboard while the mouse rests over the timeline, they keep the time under the mouse. On an empty timeline `WaveformPlaylistProvider` left the view alone on a zoom; it now anchors too (at scroll 0 with the cursor at 0, the start stays in view). With automatic scroll on (and audio on the timeline), the playhead is centred again on the next frame of playback.

Two more changes:

- **A zoom out from a scrolled view no longer jumps.** `WaveformPlaylistProvider` read the scroll position after the content had shrunk, when the browser had already clamped it to the new width, and kept the wrong time at the centre (on the multi-clip example, a Zoom Out from the middle of the timeline moved the centre by 12% of the timeline's length: `e2e/multi-clip.spec.ts`, "a zoom button keeps the time at the centre of the view where it is", run against the previous provider). The anchor now starts from the position before the zoom.
- **The scroll is set before the new zoom is painted** (a layout effect), not after (an effect).

A Ctrl/⌘ + wheel or pinch zoom gesture is not part of the library yet: [#933](https://github.com/naomiaro/waveform-playlist/issues/933).

**Find:** code that sets the scroll container's `scrollLeft` after a zoom of its own, to keep a point in view: in a `useEffect` it now runs after the provider's adjustment and replaces it (before, the provider's ran after it).

**Replace with:** nothing for most apps. To keep a point the four steps do not cover (a marker, an annotation, the playhead while a range is on screen), set `scrollLeft` in a `useEffect` that depends on `usePlaylistZoom().samplesPerPixel`, in a component below the provider. A `useLayoutEffect` there would not do: a child's layout effects run before the provider's, whose adjustment would replace the value.

## `AnnotationIntegrationProvider` and `SpectrogramIntegrationProvider` are replaced by their contexts

**Package:** `@waveform-playlist/browser`.

They were aliases of `AnnotationIntegrationContext.Provider` and `SpectrogramIntegrationContext.Provider`. In React 19 a context is its own provider, and the two contexts are exported instead. `<AnnotationProvider>` and `<SpectrogramProvider>` are unchanged; this concerns code that provides an integration object of its own.

**Find:** `AnnotationIntegrationProvider` and `SpectrogramIntegrationProvider`.

**Replace with:**

```tsx
import { AnnotationIntegrationContext } from '@waveform-playlist/browser';

// Before
<AnnotationIntegrationProvider value={integration}>{children}</AnnotationIntegrationProvider>
// After
<AnnotationIntegrationContext value={integration}>{children}</AnnotationIntegrationContext>
```

## `SpectrogramMenuItems` is renamed `spectrogramMenuItems`

**Package:** `@waveform-playlist/spectrogram`, with its type: `SpectrogramMenuItemsProps` is `SpectrogramMenuItemsOptions`.

It is a function that returns an array of `TrackMenuItem`, not a component; the name says so now. It takes the same options and returns the same items, without the `label` the first one had (`TrackMenuItem.label` is removed: [above](#props-and-components-the-packages-did-not-use-are-removed)).

**Find:** `SpectrogramMenuItems` and `SpectrogramMenuItemsProps`.

**Replace with:**

```tsx
// Before
import { SpectrogramMenuItems, type SpectrogramMenuItemsProps } from '@waveform-playlist/spectrogram';
const items = SpectrogramMenuItems({ renderMode, onRenderModeChange, onOpenSettings });
// After
import { spectrogramMenuItems, type SpectrogramMenuItemsOptions } from '@waveform-playlist/spectrogram';
const items = spectrogramMenuItems({ renderMode, onRenderModeChange, onOpenSettings });
```

## Selection, loop, zoom, selected track and master volume are the provider's

**Package:** `@waveform-playlist/browser`, `WaveformPlaylistProvider`.

The provider now owns these five values and gives them to its engine. Before, the engine owned them and the provider followed the engine's `statechange` event.

What this fixes: a call to `setSelection`, `setLoopEnabled`, `setLoopRegion`, `clearLoopRegion`, `setSelectedTrackId`, `zoomIn` or `zoomOut` made while the provider had no engine did nothing. That is before the first engine of a mount exists, and while a new engine is being built after the `effects` function or the `zoomLevels` changed. These calls now take effect at once, and the next engine starts with the values.

What changes for an app: a call made on the engine object itself is no longer followed. `playoutRef.current.setSelection(1, 2)` or `playoutRef.current.zoomIn()` (the engine from `useEngineRefs()`) changes that engine's copy only: the highlight, the zoom and the values of `useSelection()`, `useLoop()`, `usePlaylistZoom()`, `useSelectedTrackId()` and `usePlaylistMixer().masterVolume` stay as they were, and the next engine the provider builds starts with the provider's values. `setLoopRegion`, `setLoopEnabled` and `setMasterVolume` called on the engine still reach the audio until then.

`canZoomIn` and `canZoomOut` are now right from the first render. Before, both were `true` until the first engine existed.

**Find:** `playoutRef.current` followed by `setSelection`, `setLoopRegion`, `setLoopEnabled`, `selectTrack`, `zoomIn`, `zoomOut`, `setZoomLevel` or `setMasterVolume`.

**Replace with:**

```tsx
// Before
const { playoutRef } = useEngineRefs();
playoutRef.current?.setSelection(1, 2);
playoutRef.current?.setLoopRegion(1, 2);
playoutRef.current?.setLoopEnabled(true);
playoutRef.current?.selectTrack(trackId);
playoutRef.current?.zoomIn();
playoutRef.current?.setMasterVolume(0.5);
// After
const { setSelection } = usePlaybackControls();
const { setLoopRegion, setLoopEnabled, setSelectedTrackId, zoomIn, setMasterVolume } = useEditorControls();
setSelection(1, 2);
setLoopRegion(1, 2);
setLoopEnabled(true);
setSelectedTrackId(trackId);
zoomIn();
setMasterVolume(0.5);
```

`setSelection` from `usePlaybackControls()` also moves the cursor to the start of the range and restarts playback there if it is running; the engine's own `setSelection` did neither. There is no replacement for `setZoomLevel` with an arbitrary level: zoom moves one step at a time through `zoomLevels`.

## Chorus, tremolo, auto panner and auto filter are started for you

**Package:** `@waveform-playlist/browser` (`@waveform-playlist/browser/tone`).

Tone.js builds the LFO of `Chorus`, `Tremolo`, `AutoPanner` and `AutoFilter` stopped; until `start()` is called each is a fixed delay, gain, pan and filter. The library never called it, so these four built-in effects did not move, during playback or in an exported WAV. `createToneEffectInstance` now starts them, and with it the effects hooks and the WAV export. A mix that uses one of the four sounds different.

Nothing to change unless you worked around it by starting the node yourself. That second `start()` now throws in Tone.js when it lands at the same audio time as the library's ("Start time must be strictly greater than previous start time"). A call right after the instance is created does, on a running context too; so does a call at any later moment while the audio context is suspended, and any call in an offline render.

**Find:** `.start()` called on the node of an effect instance, which is `instance.effect` (before [`effect` became `input` and `output`](#effectinstanceeffect-is-replaced-by-input-and-output)) or `instance.input`. The node is typed `ToneAudioNode | AudioNode`, so in TypeScript the call is on a cast: search for `.effect as` and `.input as` as well as for `.start()`.

**Replace with:**

```tsx
// Before
import type { Tremolo } from 'tone';

const instance = createEffectInstance(getEffectDefinition('tremolo')!);
(instance.effect as Tremolo).start();

// After
const instance = createToneEffectInstance(getEffectDefinition('tremolo')!);
```

A Tone.js effect you construct yourself (`new Tremolo()`) is not touched: start it as before.
