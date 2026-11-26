---
'@waveform-playlist/ui-components': patch
---

`SpectrogramChannel` unregisters each canvas once. A canvas that remounted under the same id (a new length, height or drawn range, as a trim or an undo makes) was unregistered once for each time it had registered, when it scrolled away and at unmount. A spectrogram is also drawn again under React's `<StrictMode>` and after a hidden `<Activity>` is shown again: a canvas the effect cleanup released was never registered again, because a canvas is handed to the worker once. Now fresh canvases are mounted and registered for the released ones. A hidden `<Activity>` releases its canvases, also when the channel is deleted before the reveal; under StrictMode, in development, each mount registers, releases and registers again.
