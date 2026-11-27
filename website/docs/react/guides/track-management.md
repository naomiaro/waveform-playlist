---
sidebar_position: 3
description: "Manage audio tracks with mute, solo, volume, pan, and dynamic add/remove"
---

# Track Management

Control individual tracks with mute, solo, volume, and pan controls.

## Track Controls Component

`<Waveform />` draws the built-in track controls panel in a 200 px column:

```tsx
<WaveformPlaylistProvider arrangement={arrangement}>
  <Waveform />
</WaveformPlaylistProvider>
```

The tracks, their mix and the undo history belong to the arrangement (`useCreateArrangement`, see [Loading Audio](/docs/react/guides/loading-audio)). Everything on this page reads it through the provider and changes it through its methods.

The column is a part of the view, `<WaveformTrackControls>`. In your own composition give it a `width`, or leave it out to have no column (see [Composing the View](/docs/react/guides/composing-the-view)):

```tsx
<WaveformRoot>
  <WaveformTimescale />
  <WaveformTrackControls width={160} />
  <WaveformTracks />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
```

Without children the part draws the default panel, `<DefaultTrackControls />`, for every track:
- Track name
- Track menu (under a `SpectrogramProvider`, for an audio track)
- Mute button
- Solo button
- Volume slider
- Pan slider

## The Panel of a Track

The children of `<WaveformTrackControls>` are the control panel of ONE track. The part renders them once per track, and each copy is bound to its track: the built-in pieces take no prop that says which track they are for.

### A remove button and a reorder grip

Both are drawn by being rendered beside the default panel. They place themselves: the remove button at the top left of the track's slot, the grip at its right edge.

```tsx
import {
  WaveformTrackControls,
  DefaultTrackControls,
  TrackRemoveButton,
  TrackReorderGrip,
} from '@waveform-playlist/browser';

<WaveformTrackControls>
  <DefaultTrackControls />
  <TrackRemoveButton onRemove={removeTrack} />
  <TrackReorderGrip />
</WaveformTrackControls>
```

`onRemove` is called with the track's id; removing the track is yours to do, with `arrangement.removeTrack(id)` (see [Adding and Removing Tracks](#adding-and-removing-tracks)). The grip's move-up and move-down buttons work with no other setup; dragging by the grip needs a `ClipInteractionProvider` above the view.

### Composing a panel from the pieces

The default panel is made of exported pieces. Leave one out, change the order, or put your own element between them:

```tsx
import {
  WaveformTrackControls,
  TrackName,
  TrackMuteButton,
  TrackSoloButton,
  TrackVolumeSlider,
  TrackPanSlider,
  TrackMenuButton,
} from '@waveform-playlist/browser';
import { ButtonGroup, Controls, Header } from '@waveform-playlist/ui-components';

// Name, mute, solo and volume; no pan slider
<WaveformTrackControls width={160}>
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

| Piece | Draws |
| --- | --- |
| `<TrackName />` | the track's name on one line; "Track N" for a track without a name |
| `<TrackMuteButton />`, `<TrackSoloButton />` | the two toggle buttons |
| `<TrackVolumeSlider />` | the volume, 0 to 1 |
| `<TrackPanSlider />` | the pan, -1 (left) to 1 (right) |
| `<TrackMenuButton />` | the track menu (render mode and spectrogram settings); nothing without a `SpectrogramProvider`, nothing for a MIDI track |
| `<TrackRemoveButton onRemove />` | a close button at the top left of the slot |
| `<TrackReorderGrip />` | a drag grip with move-up and move-down buttons at the right edge of the slot |

`Controls`, `Header` and `ButtonGroup` are the layout elements of the default panel, from `@waveform-playlist/ui-components`. The pieces work while a track's audio is still loading, and a value set then is kept. While a take is recorded onto a track, its mute button is disabled (see the [Recording guide](/docs/react/guides/recording)).

To add one control to the default panel, pass it as a child of `<DefaultTrackControls>`. It is drawn inside the panel, below the pan slider:

```tsx
<WaveformTrackControls>
  <DefaultTrackControls>
    <MyTrackColorPicker />
  </DefaultTrackControls>
</WaveformTrackControls>
```

The default panel fills its slot, so an element written beside it in the normal flow is outside the visible slot. Only an element that positions itself (as the remove button and the grip do) belongs beside it.

### A panel of your own with `useTrack()`

A component among the children reads its track with `useTrack()`: the id, the name, the mixer state and actions that are already bound to that track.

```tsx
import { useEffect, useRef, useState } from 'react';
import { WaveformTrackControls, useTrack } from '@waveform-playlist/browser';
import { createMixerGesture } from '@waveform-playlist/core';

// One gesture per slider: a drag, or a held arrow key, is one undo step.
function useMixerGesture() {
  const [gesture] = useState(createMixerGesture);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    return input ? gesture.attach(input) : undefined;
  }, [gesture]);
  return { gesture, ref };
}

function CustomTrackControls() {
  const { name, muted, soloed, volume, pan, isRecording, setMuted, setSoloed, setVolume, setPan } =
    useTrack();
  const volumeGesture = useMixerGesture();
  const panGesture = useMixerGesture();

  return (
    // The slot is as wide as the column and as tall as the track's row.
    <div style={{ height: '100%', boxSizing: 'border-box', padding: 8 }}>
      <div>{name}</div>
      {/* Pressed during a take: a click would set the track's own mute from it */}
      <button disabled={isRecording} onClick={() => setMuted(!muted)}>
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <button onClick={() => setSoloed(!soloed)}>
        {soloed ? 'Unsolo' : 'Solo'}
      </button>
      <input
        ref={volumeGesture.ref}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        aria-label="Volume"
        onChange={(e) => setVolume(parseFloat(e.target.value), { gesture: volumeGesture.gesture.id })}
      />
      <input
        ref={panGesture.ref}
        type="range"
        min="-1"
        max="1"
        step="0.01"
        value={pan}
        aria-label="Pan"
        onChange={(e) => setPan(parseFloat(e.target.value), { gesture: panGesture.gesture.id })}
      />
    </div>
  );
}

<WaveformTrackControls width={180}>
  <CustomTrackControls />
</WaveformTrackControls>
```

Four things to know:

- **Size.** Each track has a slot in the column: as wide as the column (the `width` of the part) and as tall as the track's row, with `overflow: hidden`, so a panel taller than the row is cut off. A mono track's row is `waveHeight` tall (80 px by default), plus the clip header's height when the view has `<WaveformClipHeaders />`; the panel above has four lines of controls and does not fit in that, so set a larger `waveHeight` with `<WaveformViewOptions>` (128, say) or lay the controls out in fewer lines. Fill the slot with `height: 100%`. Do not compute the row height yourself: it depends on the number of channels (also of a take being recorded) and on the clip headers.
- **Selection.** A click anywhere in a slot selects the track, in your own panel too. A control of yours that must not select calls `event.stopPropagation()` in its click handler. `useTrack().isSelected` says whether the track is the selected one.
- **Loading and recording.** The values are the arrangement's mix, also while the track's audio loads, and the actions work then: there is nothing to disable for loading (`isLoading` is removed). While a take is recorded onto the track, `useTrack().isRecording` is true: the take plays the track muted and `muted` is true, while its own mute is left as it is. A mute button that toggles from `muted` would set the track's own mute from the take's mute, so disable it then.
- **Undo.** Each mixer action is an undo step. A slider passes one `gesture` id per drag, as above, or every move is a step of its own; see [Undo of Mixer Moves](#undo-of-mixer-moves).
- **Where it works.** `useTrack()` and the pieces work only among the children of `<WaveformTrackControls>`. Anywhere else they throw. For a mixer elsewhere on the page see [Mixer State Outside the Panel](#mixer-state-outside-the-panel).

The complete list of fields is in the [`useTrack` reference](/docs/react/api/hooks#usetrack). For a drag grip of your own there is [`useTrackReorderHandle()`](/docs/react/api/hooks#usetrackreorderhandle).

### What renders when

The part keeps the children it was given while a new render hands it equal ones: the same element types and keys, and props that are identical, with `children` compared the same way and `style` compared one level deep. So the children can be written inline, and a render of the component that composes the view does not render the panels.

A function or an object written inline as a prop is new on every render, and then every panel of every track renders each time your component does:

```tsx
// Every panel renders whenever this component renders
<TrackRemoveButton onRemove={(id) => removeTrack(id)} />

// The panels are left alone
const removeTrack = useCallback((id: string) => arrangement.removeTrack(id), [arrangement]);
<TrackRemoveButton onRemove={removeTrack} />
```

A change to one track (a volume step, a mute) renders the components of that track's panel that call `useTrack()`, and no other panel. Selecting a track renders them in the panel that stops being selected and in the one that becomes selected.

### Attributes for styling and tests

| Attribute | On |
| --- | --- |
| `data-track-controls="<track id>"` | the element inside a track's slot that holds the panel |
| `data-track-name` | the element of `<TrackName />` |

## Mixer State Outside the Panel

Outside the controls column (a mixer strip elsewhere on the page, a keyboard shortcut, restoring a saved session) read the state with `usePlaylistMixer()` and change it with the setters of `useEditorControls()`. The setters take the track's **id**:

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  useEditorControls,
  usePlaylistMixer,
  usePlaylistTimeline,
} from '@waveform-playlist/browser';
import { createMixerGesture } from '@waveform-playlist/core';

// A component per slider, so that each has its own gesture.
function VolumeSlider({ trackId, volume }: { trackId: string; volume: number }) {
  const { setTrackVolume } = useEditorControls();
  const [gesture] = useState(createMixerGesture);
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
      aria-label="Volume"
      onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value), { gesture: gesture.id })}
    />
  );
}

function MixerStrip() {
  const { tracks } = usePlaylistTimeline();
  const { trackStates } = usePlaylistMixer();
  const { setTrackMute } = useEditorControls();

  return (
    <div>
      {tracks.map((track, i) => {
        // Every track has its entry, also while its audio loads.
        const state = trackStates[i];
        return (
          <div key={track.id}>
            <span>{state.name}</span>
            <button onClick={() => setTrackMute(track.id, !state.muted)}>
              {state.muted ? 'Unmute' : 'Mute'}
            </button>
            <VolumeSlider trackId={track.id} volume={state.volume} />
          </div>
        );
      })}
    </div>
  );
}
```

`trackStates` has one entry per track, in the order of `tracks`, so `trackStates[i]` belongs to `tracks[i]`. A component that calls `usePlaylistMixer()` renders on every mixer change of any track, and one that calls `usePlaylistTimeline()` on every clip edit, so keep such a component small.

A setter called with something that is not a string (an index, from code written for an earlier version) does nothing, and in development says so once in the console. An id that no track has is ignored.

## Undo of Mixer Moves

Every mute, solo, volume and pan change is an undo step of the arrangement, in the same history as the clip edits: Undo after a fader move moves the fader back, and an undo, a redo or an aborted transaction brings back the mix of the state it returns to. The setters of `useEditorControls()` and the actions of `useTrack()` take a last `options` argument (`MixerChangeOptions` from `@waveform-playlist/engine`):

- **No options:** the call is one step. A click on a mute or solo button is one step.
- **`{ gesture: id }`:** calls with the same id, one after another, are one step. A slider calls its setter on every move, so it passes one id for the whole drag. `createMixerGesture()` makes the ids for one slider: `gesture.attach(input)` ends the gesture on the input's `change` (the end of a pointer drag), on the `keyup` of an arrow, Page or Home/End key that is held down, and on `blur`; `gesture.id` is the id to pass. Make one per slider, as in the examples above. The built-in `<TrackVolumeSlider />` and `<TrackPanSlider />` do this.
- **`{ undoable: false }`:** no step. The value is also written into every saved state, so no undo or redo brings back an older one. Use it for a value that is not the user's edit: automation, a mix restored from a saved project, a value synced from elsewhere.

A mixer change made inside an open transaction (`arrangement.beginTransaction()`) is part of it, and an abort takes it back (one with `undoable: false` stays). The mute a take puts on the track it records onto is not an undo step (see [Recording](/docs/react/guides/recording#the-recorded-track-is-muted-during-the-take)).

`createMixerGesture` is imported from `@waveform-playlist/core`, the package an app already imports `audioTrack` from.

Keyboard Undo (`<KeyboardShortcuts undo />`) does not fire while a slider has focus, and a slider keeps the focus after a mouse drag ([#730](https://github.com/naomiaro/waveform-playlist/issues/730)). An Undo button of your own (`useEditorControls().undo`, enabled by `useUndoRedo().canUndo`) works, and so does the key once focus has left the slider.

## Mute and Solo

### Mute

Muting a track silences it completely:

```tsx
// In a track's panel
const { muted, setMuted } = useTrack();
setMuted(!muted);

// Anywhere under the provider
const { setTrackMute } = useEditorControls();
setTrackMute(trackId, true);
setTrackMute(trackId, false);
```

### Solo

Soloing a track mutes all other non-soloed tracks:

```tsx
// In a track's panel
const { soloed, setSoloed } = useTrack();
setSoloed(!soloed);

// Anywhere under the provider
const { setTrackSolo } = useEditorControls();
setTrackSolo(trackId, true);
```

When multiple tracks are soloed, only those tracks are audible.

## Volume Control

Volume ranges from 0 (silent) to 1 (full volume):

```tsx
// In a track's panel
const { setVolume } = useTrack();
setVolume(0.5);

// Anywhere under the provider
const { setTrackVolume } = useEditorControls();
setTrackVolume(trackId, 0.5);
```

## Pan Control

Pan ranges from -1 (full left) to 1 (full right):

```tsx
// In a track's panel
const { setPan } = useTrack();
setPan(-1); // fully left
setPan(0); // centre
setPan(1); // fully right

// Anywhere under the provider
const { setTrackPan } = useEditorControls();
setTrackPan(trackId, -1);
```

### Pan law

How a track is panned depends on its pan law: `'mono'` (equal power, 3 dB down per side at centre) or `'stereo'` (unity at centre). A track takes the law of the first audio it holds and keeps it, whatever clips follow; `useTrack().panLaw` reads `'auto'` until then. To let a user choose:

```tsx
// In a track's panel (among the children of <WaveformTrackControls>)
function PanLawButtons() {
  const { panLaw, setPanLaw } = useTrack();
  return (
    <span role="group" aria-label="Pan law">
      <button aria-pressed={panLaw === 'mono'} onClick={() => setPanLaw('mono')}>
        Mono
      </button>
      <button aria-pressed={panLaw === 'stereo'} onClick={() => setPanLaw('stereo')}>
        Stereo
      </button>
    </span>
  );
}
```

The [effects guide](./effects.md#a-tracks-pan-law) says what each law does to a clip of the other kind.

A track keeps its mute, solo, volume and pan for as long as its id is in the arrangement: removing another track, adding tracks in front of it or reordering does not reset it, and an undo or a redo never changes it. The setters work with no engine attached (before the first build, during a rebuild).

## Track Selection

Select tracks for operations like deletion or effects:

```tsx
import {
  useSelectedTrackId,
  useEditorControls,
  usePlaylistTimeline,
} from '@waveform-playlist/browser';

function TrackSelector() {
  const { tracks } = usePlaylistTimeline();
  const { selectedTrackId } = useSelectedTrackId();
  const { setSelectedTrackId } = useEditorControls();

  return (
    <ul>
      {tracks.map((track) => (
        <li
          key={track.id}
          onClick={() => setSelectedTrackId(track.id)}
          style={{
            background: selectedTrackId === track.id ? '#e0e0ff' : 'transparent',
          }}
        >
          {track.name}
        </li>
      ))}
    </ul>
  );
}
```

In the multitrack view (`<Waveform>`, `<WaveformEditor>` or your own composition in `<WaveformRoot>`), a press on the waveform area of a track's row selects that track, and so does a click anywhere in its slot of the controls column, whatever panel is drawn there (apart from the remove button, the track menu button and the reorder grip and buttons). The selected track's row has the attribute `data-selected="true"`, next to `data-track-id` and `data-track-kind`, so it can be styled or found in a test without reading the state:

```css
/* A border drawn over the selected row. The row's clips are painted above the
   row's own outline and background, so the border goes on a pseudo-element. */
[data-track-row][data-selected='true']::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid #63c75f;
  pointer-events: none; /* presses still reach the clips and the waveform */
  z-index: 120; /* above the clip headers */
}
```

The selected track's colours come from the theme: `selectedTrackBackground` is the background behind its clips and `selectedTrackControlsBackground` the background of its controls (see [Theming](./theming.md)).

## Adding and Removing Tracks

Tracks are added and removed through the arrangement: `arrangement.addTrack(track)`, `arrangement.removeTrack(trackId)`, `arrangement.updateTrack(trackId, fn)` and `arrangement.setTracks(tracks)`. Each is an undo step except `setTracks`, which also clears the history. Edits made in the view (a reorder, a clip move, a take) change the same arrangement, so there is nothing to keep in step:

```tsx
import { useCallback } from 'react';
import {
  WaveformPlaylistProvider,
  WaveformRoot,
  WaveformTimescale,
  WaveformTrackControls,
  DefaultTrackControls,
  TrackRemoveButton,
  TrackReorderGrip,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  useCreateArrangement,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

function TrackManagementExample() {
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/drums.mp3', name: 'Drums' }),
    audioTrack({ src: '/audio/bass.mp3', name: 'Bass' }),
  ]);

  // Stable, so the track panels do not render with this component.
  const removeTrack = useCallback((trackId: string) => arrangement.removeTrack(trackId), [arrangement]);
  const addFile = useCallback((file: File) => arrangement.addTrack(audioTrack({ src: file })), [arrangement]);

  return (
    <>
      <input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && addFile(e.target.files[0])} />
      <WaveformPlaylistProvider arrangement={arrangement}>
        <WaveformRoot>
          <WaveformTimescale />
          <WaveformTrackControls>
            <DefaultTrackControls />
            <TrackRemoveButton onRemove={removeTrack} />
            <TrackReorderGrip />
          </WaveformTrackControls>
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </WaveformPlaylistProvider>
    </>
  );
}
```

A track is removed even while its audio loads; its load is dropped once no undo step names it. To read the tracks in your own component, `useArrangementTracks(arrangement)` (every clip, loading or not) or, below the provider, `usePlaylistTimeline().tracks` (loaded clips only). Make track changes from a handler or an effect, not from inside an `arrangement.subscribe()` listener: see [Loading Audio](/docs/react/guides/loading-audio#adding-tracks-at-runtime).

### Reordering from code

`<TrackReorderGrip />` covers reordering from the view. From code, call `reorderTrack` of `useEditorControls()` (or `arrangement.reorderTrack`) with the track's id and its new position; playback is not interrupted, and the reorder is an undo step:

```tsx
const { reorderTrack } = useEditorControls();

// Move a track to the top
reorderTrack(trackId, 0);
```

Inside a track's panel, `useTrack()` has `moveUp()` and `moveDown()`, with `isFirst` and `isLast` for disabling a button.

## Initial Track Configuration

Set the values a track starts with in `audioTrack()`. They are the values it enters the arrangement with; after that the mix is changed with the setters.

```tsx
const arrangement = useCreateArrangement(() => [
  audioTrack({
    src: '/audio/drums.mp3',
    name: 'Drums',
    volume: 0.8,       // 80% volume
    pan: 0,            // Center
  }),
  audioTrack({
    src: '/audio/bass.mp3',
    name: 'Bass',
    volume: 1.0,       // Full volume
    pan: -0.3,         // Slightly left
  }),
  audioTrack({
    src: '/audio/keys.mp3',
    name: 'Keys',
    volume: 0.7,
    muted: true,       // Start muted
    pan: 0.3,          // Slightly right
  }),
]);
```

## Complete Example

A horizontal panel of its own for every track, with a remove button:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WaveformPlaylistProvider,
  WaveformRoot,
  WaveformTimescale,
  WaveformTrackControls,
  TrackRemoveButton,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformViewOptions,
  useCreateArrangement,
  useTrack,
} from '@waveform-playlist/browser';
import { audioTrack, createMixerGesture } from '@waveform-playlist/core';

// One gesture per slider: a drag is one undo step.
function useMixerGesture() {
  const [gesture] = useState(createMixerGesture);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    return input ? gesture.attach(input) : undefined;
  }, [gesture]);
  return { gesture, ref };
}

// Rendered once per track by <WaveformTrackControls>; useTrack() is the track.
function TrackControlRow() {
  const { name, muted, soloed, volume, pan, isRecording, setMuted, setSoloed, setVolume, setPan } =
    useTrack();
  const volumeGesture = useMixerGesture();
  const panGesture = useMixerGesture();

  return (
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        padding: '0.5rem 0.5rem 0.5rem 1.75rem', // room for the remove button
      }}
    >
      <span>{name}</span>
      <div>
        <button
          disabled={isRecording}
          aria-pressed={muted}
          onClick={() => setMuted(!muted)}
          style={{ background: muted ? '#ff6b6b' : '#e0e0e0' }}
        >
          M
        </button>
        <button
          aria-pressed={soloed}
          onClick={() => setSoloed(!soloed)}
          style={{ background: soloed ? '#ffd93d' : '#e0e0e0' }}
        >
          S
        </button>
      </div>
      <label>
        Vol
        <input
          ref={volumeGesture.ref}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value), { gesture: volumeGesture.gesture.id })}
        />
      </label>
      <label>
        Pan
        <input
          ref={panGesture.ref}
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={pan}
          onChange={(e) => setPan(parseFloat(e.target.value), { gesture: panGesture.gesture.id })}
        />
      </label>
    </div>
  );
}

function TrackManagementExample() {
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/drums.mp3', name: 'Drums' }),
    audioTrack({ src: '/audio/bass.mp3', name: 'Bass' }),
    audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),
  ]);

  const removeTrack = useCallback((trackId: string) => arrangement.removeTrack(trackId), [arrangement]);

  return (
    <WaveformPlaylistProvider arrangement={arrangement}>
      {/* Rows of 128 px: the panel below has four lines of controls. */}
      <WaveformViewOptions waveHeight={128}>
        <WaveformRoot>
          <WaveformTimescale />
          <WaveformTrackControls width={200}>
            <TrackControlRow />
            <TrackRemoveButton onRemove={removeTrack} />
          </WaveformTrackControls>
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </WaveformViewOptions>
    </WaveformPlaylistProvider>
  );
}
```

## Next Steps

- [Annotations](/docs/react/guides/annotations) - Add time-synchronized annotations
- [Audio Effects](/docs/react/guides/effects) - Apply effects to tracks
