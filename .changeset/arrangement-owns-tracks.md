---
'@waveform-playlist/engine': major
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

engine: an arrangement owns the tracks, the mix and the undo history, and `PlaylistEngine` plays it. `createArrangement()` makes one; `new PlaylistEngine({ arrangement })` plays it, and a later engine built on the same arrangement finds its tracks, mix and history unchanged. Without the option an engine makes its own.

Breaking in the engine:

- `getState().tracks` and what a `PlayoutAdapter` is sent are the arrangement's own objects, typed `readonly ClipTrack[]` and frozen outside production builds. Copy before changing.
- A track's `volume`, `muted`, `soloed` and `pan` fields set its mix only the first time its id enters. Afterwards `setTracks`, `addTrack` and `updateTrack` keep the current mix; use the four setters.
- Undo, redo and `abortTransaction` never change the mix, and send the adapter only the tracks that differ.
- `setTracks`, `addTrack` and `updateTrack` throw on a duplicate track id or a duplicate clip id within a track.
- `updateTrack(id, track)` with an unknown id does nothing.
- `commitTransaction` (with a change) and `clearHistory` (with history) emit `statechange`; a mixer setter for a track the engine does not hold no longer does.
- `undo` and `redo` with a transaction open abort it first.
- A change made from inside a `statechange` listener is delivered after the one being handled.

browser: `onTracksChange` hands the app an array of its own; the track and clip objects in it are the engine's and are frozen in development.

dawcore: type-only changes to follow the engine's readonly tracks.
