---
'@waveform-playlist/engine': major
---

engine: mixer moves are undo steps (#843). `setTrackVolume`, `setTrackMute`, `setTrackSolo` and `setTrackPan`, on the arrangement and on `PlaylistEngine`, take a last argument `options?: MixerChangeOptions` (exported type):

- By default each call is an undo step (it clears redo, like every other edit). Before, the mix was never an undo step.
- `{ gesture: id }`: calls with the same id, one after another, are one undo step (a fader drag from press to release). Anything else that touches the history in between ends that step. A gesture that ends where its step began leaves no step, and the redo states its first call cleared come back.
- `{ undoable: false }`: no undo step. The value is also written into every saved state, so no undo or redo brings back an older one (for automation, or any value that is not the user's edit). It wins over `gesture`.
- A call given the value the track already has does nothing: no step, no `mixerVersion` change, no `statechange`. The engine still calls the adapter's setter for it, as it does for a track it does not hold.

Undo, redo and `abortTransaction` bring back the mix of the state they return to: an undo after a fader move puts the fader back (before, it took back the previous edit and left the fader where it was), undoing a `removeTrack` brings the track back with the mix it had, and undoing a rename brings back the old id with its mix (the two exceptions documented before are gone). A mixer change made inside an open transaction is part of it, and an abort now takes it back (before, it survived). An undo that changes only the mix increments `mixerVersion`, not `tracksVersion`, and reaches the adapter through its mixer setters with no track call. `addTrack` with the id of a track removed earlier seeds the mix from the new track's fields (before, it found the removed track's mix again), and `getMixer()` holds the entries of the current tracks only.

`createMixerGesture()` (exported with the type `MixerGesture`) makes the gesture ids of one control: `id`, `end()`, and `attach(input)`, which ends the gesture on the input's `change` (the end of a pointer drag), on the `keyup` of a held arrow, Page Up/Down, Home or End key (a held key is one step), and on `blur`, and returns the function that removes its listeners. Use one per slider; ids are unique per helper, also across two installed copies of the package.

The recording arm: `setTrackArmed(trackId, armed)` (arrangement and engine) and `arrangement.armedTrackIds`. An armed track plays muted (`getState().tracks` and the adapter have it muted) while its mute in `getMixer()` stays as it is and comes back at the disarm. Arming is not an undo step, and undo, redo, an abort, `setTracks` and `clearHistory` do not change which tracks are armed.

The keys an engine recognises an arrangement by moved to `/v2` (`@waveform-playlist/engine/arrangement/time-base/v2`, `…/attach-decode/v2`), because the interface the engine uses by name changed: an engine and an arrangement from copies of the package on either side of this change refuse each other (the engine throws that the `arrangement` option must be an arrangement made by `createArrangement()`).
