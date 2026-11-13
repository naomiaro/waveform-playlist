---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': major
'@waveform-playlist/spectrogram': patch
---

The options that only affect how a view draws have one home, the new `<WaveformViewOptions>`, and leave the providers (#689).

- `<WaveformViewOptions>` takes `waveHeight` (80), `barWidth` (1), `barGap` (0), `roundedBars` (false), `progressBarWidth` (`barWidth + barGap`) and `fillViewport` (false, `WaveformRoot` only). It sets them for every waveform root below it, under either provider, and may sit above the provider or above several: ten players are styled by one element. A prop left out is taken from the `<WaveformViewOptions>` above, then from the defaults.
- **Removed, with no shim** (nothing throws; the upgrade guide has the find-and-replace): `waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` on both providers and `fillViewport` on `WaveformPlaylistProvider`; the same six fields of `usePlaylistView()`, which is now `{ sampleRate, mono, indefinitePlayback }`. Left on a provider in plain JavaScript they are ignored and the defaults are drawn.
- One default for `waveHeight`: 80 under both providers. `MediaElementPlaylistProvider` drew 100; a player that set none needs `<WaveformViewOptions waveHeight={100}>` to look as it did.
- `mono` and `indefinitePlayback` stay on `WaveformPlaylistProvider` (the provider computes the peaks with the first; its animation loop and `seekTo` follow the second), and `theme` stays on both providers (the controls outside a view read it).
- `<WaveformTimescale height>`: the height of the timescale strip, 30 by default.
- New optional theme key `spectrogramBackgroundColor` (`#000` in both default themes).
- Values that cannot be drawn are corrected with one development warning each: a `waveHeight` or `barWidth` that is not above 0 becomes the default, and a `barGap` that would put the next bar less than one pixel on is raised until the step is one pixel. ui-components' `Channel` never steps less than one pixel either.
- An option change renders the view, not every reader of `usePlaylistView()`.

`@waveform-playlist/ui-components`: `PlaylistInfoContext` / `usePlaylistInfo()` lose `controls` and `zoomLevels`, which nothing read, and provide `progressBarWidth`; `roundedBars` and `progressBarWidth` are required in the value. The type `PlaylistInfo` and `DEFAULT_WAVE_HEIGHT`, `DEFAULT_BAR_WIDTH`, `DEFAULT_BAR_GAP` are exported. A `SpectrogramChannel` given a new `waveHeight` mounts new canvases and registers them again.

`@waveform-playlist/spectrogram`: `SpectrogramProvider` renders each spectrogram at the height its canvas registered with instead of the provider's `waveHeight`. In "both" mode the worker rendered the full row height into a canvas half as tall; it now renders at the canvas's height.

Two views under one provider can differ in these options. They share zoom, selection and playback on purpose; automatic scroll following only the view mounted last, and a spectrogram track drawing in only one of two views, are tracked in #803.
