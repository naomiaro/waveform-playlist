---
'@waveform-playlist/browser': patch
---

A selection drag now follows the pointer outside the waveform, in both `<Waveform>` and `<MediaElementWaveform>`.

- The drag keeps updating while the button is held and the pointer is above, below or beside the waveform. Before, it stalled until the pointer came back.
- A position past either end clamps to that end, so a fast drag past the left edge selects from the start instead of from wherever the last move inside happened to land.
- Releasing the button anywhere ends the drag. Before, a release outside left the drag active: moving back over the waveform with no button held kept extending the selection until the next click, and in `<Waveform>` the click overlay stayed raised above the clips for that time, so clip headers and trim handles could not be grabbed.
- Switching to another application mid-drag ends the drag and keeps the selection as it was (during playback the cursor has already moved to the pressed position, and playback is not restarted there).
- Only the primary mouse button starts a selection. Before, a right-click on the waveform started one, and where the browser delivers no release for it the drag stayed active.
- During playback, a press on the waveform followed by a release anywhere seeks to the pressed position, as a release over the waveform already did.
- Page text is not selected while the drag passes over it (`user-select: none` on the root element for the length of the drag).

`@waveform-playlist/ui-components`' `<Playlist>` keeps its `onTracksMouseMove` and `onTracksMouseUp` props; the browser package no longer passes them.
