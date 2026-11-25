---
'@waveform-playlist/annotations': patch
'@waveform-playlist/recording': patch
---

annotations and recording declare `react-dom` `^19.0.0` as a peer. Both depend on `@waveform-playlist/ui-components`, which imports `react-dom` and peers on it, so every install that works today already has it; the packages now say so themselves.
