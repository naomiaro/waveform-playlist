---
'@waveform-playlist/ui-components': patch
---

`SpectrogramChannel` unregisters each canvas once. A canvas that remounted under the same id (a new length, height or drawn range, as a trim or an undo makes) was unregistered once for each time it had registered, when it scrolled away and at unmount. A spectrogram also stays drawn under React's `<StrictMode>` and after a hidden `<Activity>` is shown again: their effect cleanups no longer unregister canvases that are still on the page, which could not be registered again (a canvas is handed to the worker once). While an `<Activity>` is hidden, the worker keeps its canvases.
