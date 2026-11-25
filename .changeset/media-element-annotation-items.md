---
'@waveform-playlist/browser': patch
---

`MediaElementPlaylistProvider`: when the active annotation changes, which happens at every annotation boundary during playback, of the annotation boxes and list rows only the two that stop being active and the two that become active render, and the waveform does not render at all. Before, every box, every row and the whole waveform did.

- The MediaElement view no longer reads the annotations or the active annotation; the annotation boxes part does, and renders the boxes through the same memoized box the `WaveformPlaylistProvider` view uses.
- The annotation list no longer builds a new options object for its actions on every render (it re-rendered every row).
- Both players use one annotation list component and one boxes component. No behaviour change for `WaveformPlaylistProvider`.
- Fix: dragging an annotation boundary in the MediaElement player converted pixels to seconds with 48000 Hz whatever the track's sample rate was, so on a 44100 Hz file the boundary moved about 8% less than the pointer. It now uses the track's rate.

No API change of its own. Measured on the new Media Element Annotations example (15 annotations), development build, per annotation boundary: 220 components and about 14 ms of React render at 4x CPU throttle before, 45 components and about 4.5 ms after.
