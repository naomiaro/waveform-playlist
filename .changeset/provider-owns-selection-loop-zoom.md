---
'@waveform-playlist/browser': major
---

`WaveformPlaylistProvider` owns the selection, the loop, the zoom, the selected track and the master volume, and gives them to its engine (#826). A call to `setSelection`, `setLoopEnabled`, `setLoopRegion`, `clearLoopRegion`, `setSelectedTrackId`, `zoomIn` or `zoomOut` made while there was no engine (before the first engine of a mount, and while a new engine was being built after `effects` or `zoomLevels` changed) used to do nothing; in that window a click on the waveform moved the cursor and left the old range highlighted, and a play waiting for the new engine then played a range the highlight did not show. These calls now take effect at once and the next engine starts with the values. `canZoomIn` and `canZoomOut` are right from the first render.

Breaking: the provider no longer follows the engine's `statechange` for these five values. A call on the engine itself (`useEngineRefs().playoutRef.current.setSelection(…)`, `.zoomIn()`, `.selectTrack(…)`, `.setLoopRegion(…)`, `.setLoopEnabled(…)`, `.setMasterVolume(…)`) changes that engine's copy only: the view does not follow it, and the next engine is built with the provider's values. Use the setters of `usePlaybackControls()` and `useEditorControls()`.
