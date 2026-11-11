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
| `usePlayoutStatus().selectionStart` / `.selectionEnd` | `usePlaylistState().selectionStart` / `.selectionEnd`                                   | no selection in this provider                                 |
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
import { usePlaybackAnimation, usePlaylistState } from '@waveform-playlist/browser';

function Status() {
  const { isPlaying } = usePlaybackAnimation();
  const { selectionStart, selectionEnd } = usePlaylistState();
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
