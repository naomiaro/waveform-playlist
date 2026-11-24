---
'@waveform-playlist/ui-components': major
---

**Breaking: `@waveform-playlist/playout` is no longer a dependency of `ui-components`.** Nothing in the package imported it, but because it was listed, every install of `@waveform-playlist/browser` installed `playout` and, through `playout`'s peer, `tone`, also with the MediaElement provider or an adapter of your own. Those setups now install neither.

A project that uses the default Tone.js engine of `WaveformPlaylistProvider` and did not list `@waveform-playlist/playout` itself got it only through `ui-components`; it now has to install it: `npm install @waveform-playlist/playout tone`. See the upgrade guide at `/docs/react/upgrading`.
