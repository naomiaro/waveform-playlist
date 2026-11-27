---
'@waveform-playlist/engine': major
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

engine: an arrangement owns the tracks, the mix and the undo history, and `PlaylistEngine` plays it. `createArrangement()` makes one; `new PlaylistEngine({ arrangement })` plays it, and a later engine built on the same arrangement finds its tracks, mix and history unchanged. Without the option an engine makes its own. The arrangement's `removeTrack(id, { undoable: false })` removes a track without an undo step and takes it out of every undo and redo state.

engine: the arrangement loads audio. Its tracks are core's `ArrangementTrack`, whose clips are `AudioClip` or `LoadingClip` (a `src` and times in seconds; tell them apart with `isLoadingClip`). It fetches and decodes every source a loading clip names in the current tracks, in an undo or redo state or in an open transaction's base, and when a source is loaded every loading clip that names it becomes an `AudioClip` of the same id (seconds to integer samples at the decoded buffer's sample rate), in the current tracks and in every stored state, with one notification and no undo step. `arrangement.sources` (a `ValueSource` of `{ sources, pendingCount, failedCount, isLoading }`) says where each source is; `arrangement.retry(src)` starts a source whose load failed again. A clip that cannot be made from its audio stays a loading clip, and while it is in the current tracks its source shows as failed with the reason. `createArrangement({ loadSource })` replaces the default loader, exported as `defaultLoadSource` with the type `LoadSource`. Nothing is fetched until a decode context is attached: an engine with an adapter attaches `adapter.audioContext` and detaches it in `dispose()` (the engine option `attachDecodeContext: false` leaves it to the host), and `attachDecodeContext(arrangement, getContext)` does it without an engine. New exported types: `ArrangementSourcesValue`, `ArrangementSourceState`, `LoadSource`.

A loading clip is held like any clip (copied on its way in, part of the undo steps) but cannot be moved, trimmed or split until its audio has loaded, and loaded clips do not collide with it. A loading clip on a `kind: 'midi'` track throws. `getState().tracks`, `getState().duration` and the tracks a `PlayoutAdapter` is sent leave loading clips out. The engine's own `setTracks`, `addTrack` and `updateTrack` still take `ClipTrack`. The engine recognises an arrangement by a versioned `Symbol.for` key and not by `instanceof`, so an arrangement made by another installed copy of the package can be played.

Breaking in the engine:

- `getState().tracks` are the engine's own objects (the arrangement's tracks with the current mix in their fields), shared with the undo history, typed `readonly ClipTrack[]` and frozen outside production builds; what a `PlayoutAdapter` is sent is those tracks without their view fields (`PlayoutTrack`), sharing their clips, and frozen the same way. Copy before changing.
- A track's `volume`, `muted`, `soloed` and `pan` fields set its mix only when its id has no mixer entry. `setTracks` keeps the mix of an id that is in the tracks it replaces and `updateTrack` keeps the track's mix; use the four setters to change it.
- Undo, redo and `abortTransaction` send the adapter only the tracks that differ. Whether the same tracks are there before and after is decided by track id, not by count; when they are not, the adapter gets `setTracks`.
- The selected track id is cleared when an undo, a redo or an abort takes its track away, and when `updateTrack` gives the track a new id (before: only by `removeTrack`). `setTracks` leaves it alone, as before.
- A track given a new id through `updateTrack` keeps its mix and reaches the adapter as `setTracks`.
- `setTracks`, `addTrack` and `updateTrack` throw on a duplicate track id or a duplicate clip id within a track.
- `updateTrack(id, track)` with an unknown id changes nothing (the track is still checked and may throw).
- `updateTrack(id, track)` keeps each clip object the track already holds and copies every other clip. When the track's loaded clips are the same objects in the same order and its own fields are unchanged, the adapter is not called (the undo step and the `statechange` are as before); `updateTrack(id)` always sends.
- `commitTransaction` (with a change) and `clearHistory` (with history) emit `statechange`; `commitTransaction` adds no step when the tracks and the mix are back where the transaction began. A mixer setter for a track that is not in the current tracks (also a removed track) still calls the adapter, changes nothing and emits no `statechange`.
- `undo` and `redo` with a transaction open abort it first, and `setTracks` ends an open transaction.
- Track, clip, mixer and history methods called on a disposed engine change its arrangement but no longer reach the adapter or emit, and `setTempo` on it does nothing.
- A change made from inside a `statechange` listener is delivered after the one being handled. Two or more track edits made in one listener run make the engine send the adapter every track once (`setTracks`); one edit is sent as itself.

browser: type-only changes to follow the engine's readonly tracks. What `WaveformPlaylistProvider` does with an arrangement is in the changeset of its `arrangement` prop.

dawcore: type-only changes to follow the engine's readonly tracks. `<daw-editor>` users see the engine's changes through it: undoing the addition of a track clears the selected track when it was that track.
