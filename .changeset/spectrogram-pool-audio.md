---
'@waveform-playlist/spectrogram': patch
---

`SpectrogramProvider` keeps in its worker pool only the audio a spectrogram needs:

- **Only tracks that draw a spectrogram.** A clip's audio goes to the workers when its track draws a spectrogram (`spectrogram` or `both`) and is released when the track goes back to `waveform`. Until now every loaded clip's audio was copied into the workers at load, also on a page where no track ever showed a spectrogram. Switching a track back to a spectrogram computes its FFT again.
- **Once per `AudioBuffer`.** Clips that share a buffer (the two halves of a split) share one copy in the workers, instead of one copy per clip.
- **Released when the last track goes.** Removing every track now releases the audio. Until now it stayed in the workers.
- **Given again to a new pool.** After React runs the provider's cleanup and then its effects again without unmounting it (a hidden `<Activity>` shown again; `<StrictMode>` in development), the new pool is given the audio again. Until now the provider still counted the audio as registered, so every FFT request copied the clip's whole audio into the worker again: 12.5 MB per redraw for one stereo track of `/examples/mir-spectrogram` after an `<Activity>` hide and reveal.

A `config` or `colorMap` written inline (`config={{ fftSize: 2048 }}`, as in the guide) is compared by content: an equal value no longer gives a new context value on every render of the app.
