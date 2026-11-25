---
'@waveform-playlist/ui-components': patch
---

ui-components no longer installs `react-async-hook` and `waveform-data`: its source imports neither. The track-control icons are imported one module each (`@phosphor-icons/react/dist/csr/<Name>`, the path Phosphor's README recommends) instead of from the package root, so a dev server or a test run no longer loads all 3,045 of Phosphor's exports (about 970 ms in Node, against 3 ms for one icon). Phosphor declares `sideEffects: false`, so a tree-shaking production build could already leave the unused icons out; the change is for development servers and tests.
