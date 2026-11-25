# Mixer moves as undo steps, one per gesture (#843)

Design, 2026-11-25. Decided with the maintainer in conversation; every choice marked "maintainer" below was theirs, everything marked "my call" is open to correction. Statements about today's code are read from `dev` at `5551e69f`, not run, unless marked.

## Intent

Move a fader, press Undo, and the fader goes back. Mixer moves (a track's volume, pan, mute and solo) become steps in the same undo history as clip edits, in both editors: the React provider and dawcore's `<daw-editor>`, which play the same `Arrangement` through `PlaylistEngine`. A fader drag is one step, not one per pointer move.

Why: today Undo after a fader move takes back the previous clip edit and leaves the fader where it is (`Arrangement.ts:491-510`: the four setters push no step; the history holds tracks only, `history.ts`).

## Goals

- The four mixer setters are undo steps by default (maintainer).
- One gesture is one step: a drag from press to release, a key press (a held arrow key is one gesture, my call), a click on mute or solo.
- The grouping is one mechanism in the engine that both editors use (maintainer: "one method that both react and dawcore can use").
- dawcore's controls show what Undo did (maintainer: option A below).
- A recording's arm mute stays out of the history and no longer touches the stored mute (maintainer: the arm override).

## Non-goals

- Master volume. It is the engine's (`PlaylistEngine._masterVolume`), not the arrangement's, and putting it into the history means moving it into the arrangement first. Out of this issue (my call).
- Effect parameters (the effects rack owns them; the issue already lists them as a separate question).
- Tempo, selection, zoom, loop: stay outside the history.
- Whether a `<daw-track>` element reflects the mix after an Undo: the DOM-against-arrangement question of #848.
- Collaboration and per-person undo: #908 (filed 2026-11-25). Nothing here should be built to prepare for it beyond what it needs anyway.

## Anti-goals

- A drag that becomes dozens of steps, or a missed pointer-up that leaves something open.
- A second copy of the mix anywhere that has to be kept in step (`state-ownership`).
- Undo changing the arm mute during a take, or a take flattening a track's mute history.

## Who owns what

| State | Stored where today (every place) | Who writes each place | Owner after this change | How others change it |
| --- | --- | --- | --- | --- |
| Track mix (volume, pan, mute, solo) | the arrangement's mixer Map; dawcore: `_tracks` descriptors (`daw-editor.ts:1453-1463`, `:1621-1635`, `:2970-2986`), which `<daw-track-controls>` draws from (`:3809-3812`) and `editor.tracks` returns (`:1058`); dawcore: each `<daw-track>`'s properties | Map: the setters. Descriptors: `<daw-track>` attribute changes, `daw-track-control` events, `editor.updateTrack()`. Element: the app | the arrangement, in both editors | the four setters (arrangement, engine, `useEditorControls()`, `useTrack()`); dawcore's controls, attributes and `updateTrack` call `engine.setTrack*` |
| The mix of each earlier state | nowhere (the history holds tracks only) | — | the arrangement's history | undo, redo, abort |
| Undo history, open transaction | the arrangement | the arrangement | the arrangement | unchanged |
| Which tracks are armed for recording | React: the `armed` value source in `useRecordingActive` (`useArrangementEditing.ts:71-104`, with `prevMuted`); dawcore: each `RecordingSession.armedPrevMuted` (`recording-controller.ts:66`, `:383-387`) | each editor's recording code | the arrangement: a set of armed track ids, outside the history | `arrangement.setTrackArmed(trackId, armed)` (name my call), through the engine for dawcore |
| The mute from before a take | React `prevMuted`, dawcore `armedPrevMuted` | each editor | gone: nothing needs remembering | — |
| `_engineTracks` (dawcore) | the editor | refreshed from `engine.getState().tracks` on `tracksVersion` / `mixerVersion` (`:2653-2676`); ALSO written by `_loadTrack` with the descriptor's mix (`:2380-2390`, `:2504-2506`) and handed back through `engine.setTracks(this._getOrderedTracks()…)` (`:2514`, `:2047`, `recording-clip.ts:134`) | not an owner of the mix for a track the arrangement holds: `setTracks` keeps the entry of an id it already has (`Arrangement.ts:350-354`). For a track still loading it is how the starting mix reaches the arrangement (section 7, "seed until it enters") | — |
| Master volume | the engine; React `useMasterVolume` follows it from `statechange` | the engine | unchanged (non-goal) | `setMasterVolume` |

The row that had two places was the mix in dawcore. The sequence that showed it (read, not run): a dawcore fader goes 0.8 → 0.5 (descriptor and arrangement 0.5); Undo restores 0.8 in the arrangement while the descriptor and the slider keep 0.5; the app then sets `<daw-track volume="0.5">`, the editor finds the descriptor unchanged and sends nothing, and the audio stays at 0.8.

## Approaches

### Grouping a gesture into one step

1. **A gesture id on the setters, and one small id-maker both editors share** — chosen (maintainer). A change that carries the id of the change that pushed the top step joins that step. Nothing can be left open; a missed release makes the next drag on that control join the previous one.
2. **The existing transactions** (`beginTransaction` on press, `commitTransaction` on release). No new API, but it can be left open, it swallows any other undoable change made during the drag into the fader's step, and an Undo mid-drag aborts it. The maintainer asked whether transactions keyed by a gesture id would do: with several open at once, snapshot undo cannot keep them apart (the second commit's base already holds part of the first gesture); with the id only naming the one open transaction, the three problems stay; a transaction that opens on the first change with the id and ends by itself is approach 1. Transactions stay as they are, for clip drags, which need a cancel.
3. **Merging by time** (same track and value within a window). No control changes, but two quick separate moves merge and a slow drag with a pause splits.

The command pattern (each change an object with an inverse) was considered and not adopted: every operation would need an inverse correct in every state, and the passes that rewrite every stored state (`_switchLoaded`, `purgeTrack`, `tickPreparer`) would have to reach into commands. Its real use, collaboration, is #908.

### dawcore's copy of the mix

- **A. The arrangement owns the mix in dawcore too** — chosen (maintainer). The controls draw from `_engineTracks`, the descriptors stop holding mixer values, a `<daw-track>` attribute change is an input that calls the setter.
- B. Copy the mix into the descriptors on every mixer change: the controls still write the descriptors, so two owners remain.
- C. Mixer undo in React only: ruled out by the maintainer's "one method" note.

### An app's own setter calls

- **Undoable by default** — chosen (maintainer): every call is a step, `{ gesture }` groups, `{ undoable: false }` keeps a change out. The same rule as every other arrangement method (`moveClip`, `removeTrack`'s `{ undoable: false }`).
- Undo only when asked (`{ gesture }` opts in): app sliders and scripts unchanged, but the mixer setters would be the opposite of every other method.

### The arm mute

- **Arm override** — chosen (maintainer): an armed track plays muted through a flag of its own, never saved in the history; its stored mute is never touched, so there is nothing to remember or write back.
- Written mute with `{ undoable: false }`: writing it into every saved state would flatten the track's mute history (mute, unmute, record a take: the two undo steps of the mute no longer move it).

## The design

### 1. A saved state holds the mix

An undo step, a redo step and a transaction's base become `{ tracks, mixer }` (both immutable references; a step still copies nothing). `undo`, `redo` and `abortTransaction` restore both. `commitTransaction` pushes a step when the tracks or the mix differ from the base. `setTracks` and `clearHistory` behave as today.

What follows from it, my calls:

- The current mixer Map holds entries for the current tracks; each saved state holds its own Map. The retention machinery that exists because the history had no mix (`retainMixer` over `_heldStates()`, entries "kept for an undo") becomes unnecessary and goes.
- The two documented exceptions in `packages/engine/CLAUDE.md` ("Undo, redo and abort never change the mix": the rename case and the id-of-a-removed-track case) disappear: undoing a rename restores the earlier state with its own mix.
- `addTrack` with the id of a track removed earlier seeds its entry from the new track's fields (today it finds the kept entry again).
- A mixer change inside an open transaction joins the transaction like any other undoable change (its gesture id is ignored), and an abort takes it back. Today it survives the abort.

### 2. The setters

```ts
interface MixerChangeOptions {
  /** Changes with the same id, one after another, are one undo step. */
  gesture?: string;
  /** Not an undo step: the value is written into every saved state as well. */
  undoable?: false;
}
setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void;
// setTrackPan, setTrackMute, setTrackSolo the same
```

On the arrangement, on `PlaylistEngine`, on `useEditorControls()` (`setTrackVolume(trackId, volume, options?)` …) and on `useTrack()` (`setVolume(volume, options?)` …). `TrackMixerValues` and the getters are unchanged.

- **Default:** an undo step (pushes the state from before; clears redo).
- **`gesture`:** the change joins the top step when the step was pushed by a change with the same id and nothing has touched the history since (no other step pushed, no undo, redo, `clearHistory`, `setTracks`, transaction begin, commit or abort, no purge). Otherwise it pushes a step and becomes that step's gesture. The id is compared as a string; the helper (below) makes ids unique per control. When a joined change brings the tracks and the mix back to the step's state, the step is dropped (as `commitTransaction` does for a drag that ends where it began; my call), and the next change with that id pushes a new one.
- **`undoable: false`:** no step; the field is set in the current mix and in the entry of that track in every saved state that has one (the same reach as `purgeTrack`), so no later undo or redo brings the old value back. Saved states that shared a Map go on sharing it. A step that no longer differs from the state next to it is dropped, as `purgeTrack` does (`history.ts:91-107`), so Undo never does nothing visible while `canUndo` is true; if the dropped step was the one a gesture joins, the next change of that gesture pushes a new step (my call). With both options, `undoable: false` wins and `gesture` is ignored (my call).
- A change that changes nothing (same value, or an id not in the current tracks) does nothing, as today: no step, no announcement.

### 3. `createMixerGesture()`

A framework-free helper in `@waveform-playlist/engine`, the one piece both editors' controls use:

```ts
const gesture = createMixerGesture();
gesture.id;    // the id to pass while a gesture is going on
gesture.end(); // the gesture is over: the next change starts a new one
```

How a range control uses it (behaviour; the wiring is the builder's):

- Every `input` passes `{ gesture: gesture.id }`.
- The gesture ends on the native `change` that ends a pointer drag, and on `keyup` of an arrow, Page or Home/End key; a held key's auto-repeat is one gesture. Also on `blur`.
- Mute and solo buttons pass nothing: each click is a step.

One helper per control instance (one per slider), so two sliders never share an id.

### 4. The arm override

The arrangement keeps a set of armed track ids, outside the history and outside every saved state: `setTrackArmed(trackId, armed)` (my naming) and a read of the set. An armed track plays muted: the engine's projection (`AdapterSync.tracks()`, which is both what the adapter receives and `getState().tracks`) has `muted: stored || armed`; `getMixer()` holds the stored mute. An arm change increments `mixerVersion` (the projection is cached on the two versions, so it must) and is forwarded to the adapter through `sendMixerValues`, like a mixer change. Undo and redo never change the set. An armed id that is not in the current tracks mutes nothing until it enters. The engine's fallback for a track the arrangement does not hold yet (`PlaylistEngine.ts:509-527`, the setter calls the adapter directly) sends the value it was given; the arm applies when the track enters (my call). Consequences of the arm being in the projection, my calls: dawcore's `_engineTracks` shows an armed track muted, so its controls do; `exportAudio`, which mutes by `_engineTracks` (`daw-editor.ts:600`, `export-audio.ts:110-112`), leaves an armed track out of an export made during a take.

- React: `setRecordingActive(active, armedTrackId)` arms and disarms through the arrangement; the `armed` value source and `prevMuted` go; `useTrack().isRecordingArmed` and `RecordingArmContext` read the arrangement's set. One armed track at a time, as today.
- dawcore: the recording controller arms each session's track through the engine and disarms it on every teardown path; `armedPrevMuted` and `_restoreArmedTrackMute`'s write-back go. dawcore can have several sessions, hence a set.
- **An armed track shows as muted, in both editors** (maintainer, 2026-11-25: "their audio isn't output to the speakers"). React: `trackStates` and `useTrack().muted` report `muted: stored || armed`, as today; `getMixer()` holds the stored mute. dawcore: the controls draw from the projection, which has the arm. The built-in mute button stays disabled on the armed track (`isRecordingArmed`). An app's own mute button that toggles from the reported value during a take sets the stored mute to false: the track stays muted by the arm and comes out of the take unmuted.

### 5. The engine

- **An undo, redo or abort that changes the mix reaches the adapter through the mixer setters.** Today a restore is announced as `'restore'`, always increments `tracksVersion` (`Arrangement.ts:655-660`), and `AdapterSync.follow` decides by `tracksVersion` (`adapterSync.ts:128-133`); `sendTrack` cannot carry the mix, because the Tone adapter's `updateTrack` replaces clips only (`playout/src/TonePlayoutAdapter.ts:341-372`). So: a restore that changes only the mix is announced as a change of its own kind (not `'restore'`), increments `mixerVersion` and not `tracksVersion` (my call; consumers gate structural work on `tracksVersion`), and the engine calls `sendMixerValues` for each track whose values differ between the two states. A restore that changes both does today's `'restore'` for the tracks and, in the same delivery, `sendMixerValues` for each track whose values differ. The change type's name and shape are the builder's.
- The interface the engine reaches the arrangement through by name changes (history shape, setter options, the arm), so the attach keys in `attach.ts` move to `/v2` (the rule in `packages/engine/CLAUDE.md`, "Attaching goes through shared keys").
- `mixerVersion` counts every change of the current mix, also one made by undo, redo or abort, so dawcore's cache refresh (`daw-editor.ts:2663`) follows an undo. `tracksVersion` is not bumped by a mixer-only undo (my call; consumers gate structural work on it).

### 6. React

- `useEditorControls()` and `useTrack()` setters take the options and pass them on.
- `TrackVolumeSlider` and `TrackPanSlider` use one `createMixerGesture()` each (kept across renders) and end it as in section 3.
- `trackStates` is derived from `arrangement.getMixer()` and the arm set (`muted: stored || armed`, section 4), so it follows undo with no new code.

### 7. dawcore (option A)

- `<daw-track-controls>` draws volume, pan, mute and solo from the arrangement's mix (`_engineTracks`, which follows `mixerVersion`; or the arrangement's `getMixer()`, which the engine does not expose today and the editor would have to hold; builder's choice), not from `_tracks`.
- The `_tracks` descriptors stop holding volume, pan, mute and solo. `editor.tracks` reports them from the arrangement's mix.
- **Which attribute changed comes from the element, not from a comparison** (my call). Today `daw-track-update` carries only `{ trackId }` (`daw-track.ts:220-227`) and the editor compares the whole element with the old descriptor (`daw-editor.ts:1423-1463`). Compared with the arrangement instead, an unrelated attribute change (`name`, `src`) after an Undo would write the element's stale volume back as a new step and reverse the Undo. So the event's detail gains the names of the properties that changed (the element already has them, Lit's `changed` map), and the editor calls a setter only for a mixer property in that list.
- A `<daw-track>` attribute change after the track has entered the arrangement calls the setter: an undo step, by the default. One `daw-track-update` that changes several mixer properties is one step: the editor passes one fresh gesture id for all of them (my call). The values a track is loaded with seed its entry, as today, and are not a step. The editor never writes the element back (#848).
- `editor.updateTrack(id, { volume, … })` keeps today's route for a track with an element (it writes the element's properties and attributes, and the element's update calls the setters), and for a track without one calls the setters directly. One call is one step, by the same fresh gesture id (my call).
- `<daw-track-controls>` keeps one `createMixerGesture()` per slider and adds `gesture` to the `daw-track-control` event's detail; the editor passes it to the setter.
- **A track still loading: seed until it enters** (maintainer, 2026-11-25). Until a track is in the arrangement, the editor holds the values it will start with: from the `<daw-track>` element or the `addTrack` config, changed by a control move or an `updateTrack` during loading. They seed the arrangement's entry when the track enters, and are not read after that; loading is not an undo step. One place holds the mix at any moment. React does not need this: `audioTrack()` gives a track with a loading clip that enters the arrangement at once, so its mix is there from the start. Moving dawcore's loading onto the arrangement's (the same as React) is #848's, and removes the seed.
- `_reconcileDescriptorsWithEngineTracks` stops copying mixer fields into synthesized descriptors.

## Behaviour changes a consumer can see

| Consumer | Before | After | Upgrade guide |
| --- | --- | --- | --- |
| React app with the built-in controls | Undo after a fader move takes back the previous clip edit | Undo moves the fader back; one step per drag, key press or click | yes |
| React app with its own slider calling `setTrackVolume` on each move | no undo | one step per move until it uses `createMixerGesture()` | yes, with a Find / Replace |
| App or script setting the mix programmatically | no undo | each call a step; `{ undoable: false }` for automation | yes |
| Mixer change inside an open transaction, then abort | survives | taken back | yes |
| Undo past a rename or a removal | the two exceptions in the engine notes | each state brings its own mix | engine notes only |
| Re-adding the id of a removed track | finds the kept mix | seeded from the new track's fields | engine notes |
| During a take, React | `getMixer()` and `trackStates` report `muted: true` (written into the mix) | `trackStates` reports `muted: true` (the arm); `getMixer()` holds the stored mute, untouched | yes (`getMixer()` only) |
| dawcore, controls after Undo | slider keeps the old value | slider follows | dawcore notes, COMPONENTS.md |
| dawcore, `<daw-track volume>` changed by the app | not an undo step | an undo step | COMPONENTS.md |
| dawcore, during a take | the controls do not show the arm mute | they do (the arm is in the projection) | dawcore notes |
| dawcore, `editor.tracks` | the descriptor's values | the arrangement's mix | COMPONENTS.md |

## Documentation to update (decided now, per root `CLAUDE.md`)

`website/docs/react/upgrading.md` (the rows marked yes), the engine guide's undo section, `website/docs/llm-reference.md` (setter signatures, `MixerChangeOptions`, `createMixerGesture`, the arm), `website/static/llms.txt`, `website/docs/api/hooks.md` (`useEditorControls`, `useTrack`), `packages/engine/CLAUDE.md` ("The arrangement owns the tracks", "Undo/Redo", "Mixer setters"), `packages/browser/CLAUDE.md` owner table and `notes/playback-and-engine.md` (the recording arm), `packages/dawcore/notes/elements.md` and `notes/recording.md`, `packages/dawcore/COMPONENTS.md`, `packages/engine/README.md` if it shows the setters. Changesets: engine major (setters become undo steps), browser major (rides the pending major), `@dawcore/components` patch.

## Left to the builder

- The order of work and how the PRs are cut.
- Internal names and file layout (a history entry type, where `createMixerGesture` lives in the engine).
- The exact event wiring of section 3 in React and Lit.
- Whether dawcore's controls read `_engineTracks` or the mixer Map.
- Tests: per rule above, a negative test for each "does not" (an arm change is not a step; a mixer-only undo does not bump `tracksVersion`), a browser run of a drag plus Undo in both editors.

## Limits this change keeps (my calls; stated in the docs)

- **dawcore clears the history when a track finishes loading.** `_loadTrack` ends with `engine.setTracks(...)` (`daw-editor.ts:2514`; also `:2047` and `recording-clip.ts:134` for an adapter without `updateTrack`), and `setTracks` clears the history (`Arrangement.ts:348-349`). A file dropped, an `editor.addTrack` or a `<daw-track>` appended mid-session wipes every step, the mixer steps as well as the clip steps it already wipes today. Moving dawcore's load path to `addTrack` / `updateTrack` is #848's (the issue body gets a line).
- **Keyboard Undo does not fire while a slider has focus.** `ownsAllKeys` (`core/src/keyboard.ts:69-80`) blocks every shortcut while an `<input>` has focus, and a slider keeps focus after a mouse drag; the maintainer deferred that to #730, and confirmed it for this change on 2026-11-25 (asked after a side agent raised it): no exception for sliders, because an app can replace the control with one that is not a range input, so a rule keyed on the element type would not hold. Undo from a button, or by keyboard after focus has left the slider, works; the browser test and the upgrade guide promise only that.

## To ask the maintainer

1. Answered: dawcore, a track still loading: seed until it enters (section 7).
2. Answered: an armed track shows as muted (section 4).
