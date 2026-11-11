---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': major
'@waveform-playlist/annotations': major
'@waveform-playlist/spectrogram': major
'@waveform-playlist/recording': major
'@waveform-playlist/midi': major
---

**Breaking: React 19 is required.** Every React package now declares `react` (and `react-dom` where it has one) `^19.0.0`. Previously the ranges disagreed (`browser` `^18.2.0 || ^19.0.0`, `ui-components` `>=17.0.0`, the others `^18.0.0`), so the packages could not be installed together on React 19 without peer conflicts. `@waveform-playlist/ui-components` also narrows `styled-components` from `>=5.0.0` to `^6.0.0`, matching the rest.

To upgrade: move your app to `react` / `react-dom` `^19.0.0` (and `styled-components` `^6.0.0`). No Waveform Playlist API changes because of this. See the upgrade guide at `/docs/react/upgrading`.
