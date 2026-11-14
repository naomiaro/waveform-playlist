---
'@waveform-playlist/engine': major
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

engine: an arrangement owns the tracks, the mix and the undo history, and `PlaylistEngine` plays it. `createArrangement()` makes one; `new PlaylistEngine({ arrangement })` plays it, and a later engine built on the same arrangement finds its tracks, mix and history unchanged. Without the option an engine makes its own. The arrangement's `removeTrack(id, { undoable: false })` removes a track without an undo step and takes it out of every undo and redo state.

Breaking in the engine:

- `getState().tracks` and what a `PlayoutAdapter` is sent are the engine's own objects (the arrangement's tracks with the current mix in their fields), shared with the undo history, typed `readonly ClipTrack[]` and frozen outside production builds. Copy before changing.
- A track's `volume`, `muted`, `soloed` and `pan` fields set its mix only when its id has no mixer entry. `setTracks` keeps the mix of an id that is in the tracks it replaces, `updateTrack` keeps the track's mix, and `addTrack` of a track whose removal can still be undone finds the mix it had; use the four setters to change it. An entry is dropped when no current, undo or redo state holds its track any more.
- Undo, redo and `abortTransaction` never change the mix, and send the adapter only the tracks that differ. Whether the same tracks are there before and after is decided by track id, not by count; when they are not, the adapter gets `setTracks`.
- The selected track id is cleared when an undo, a redo or an abort takes its track away, and when `updateTrack` gives the track a new id.
- A track given a new id through `updateTrack` keeps its mix and reaches the adapter as `setTracks`.
- `setTracks`, `addTrack` and `updateTrack` throw on a duplicate track id or a duplicate clip id within a track.
- `updateTrack(id, track)` with an unknown id changes nothing (the track is still checked and may throw).
- `commitTransaction` (with a change) and `clearHistory` (with history) emit `statechange`; `commitTransaction` adds no step when the tracks are back where the transaction began. A mixer setter for a track that is not in the current tracks (also a removed track whose removal can be undone) still calls the adapter, changes nothing and emits no `statechange`.
- `undo` and `redo` with a transaction open abort it first, and `setTracks` ends an open transaction.
- Track, clip and history methods called on a disposed engine change its arrangement but no longer reach the adapter or emit.
- A change made from inside a `statechange` listener is delivered after the one being handled.

browser: `onTracksChange` hands the app an array of its own; the track and clip objects in it are the engine's and are frozen in development. When a playlist cannot be built (a duplicate track id, a track of the wrong kind, an adapter that fails), the provider logs a console error that says the playlist stays in its loading state and why, and suggests `onError` when the prop is missing; it was a console warning.

dawcore: type-only changes to follow the engine's readonly tracks. `<daw-editor>` users see the engine's changes through it: an undo no longer changes the audible mix, and undoing the addition of a track clears the selected track when it was that track.
