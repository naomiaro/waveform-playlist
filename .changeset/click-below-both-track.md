---
'@waveform-playlist/browser': patch
---

A press on the tracks selects the track whose row is under the pointer. With a track in `'both'` render mode (spectrogram above waveform), a press on any row below it selected the row above, because the press handler counted a `'both'` track twice as tall as it is drawn. The handler now finds the row in the layout the rows are positioned with.

The selected track's row (`[data-track-row]`) has the attribute `data-selected="true"`, for styling and tests.
