---
'@waveform-playlist/ui-components': patch
---

ui-components no longer installs `react-async-hook` and `waveform-data`: its source imports neither.

The track-control icons are imported one module each (`@phosphor-icons/react/dist/csr/<Name>`, the path Phosphor's README recommends) instead of from the package root. An ESM dev server or test runner (Vite, Vitest, webpack 5) then loads eight icon modules instead of all 3,045 of Phosphor's exports; in a throwaway script in Node 24 that was 3 ms against 600 to 970 ms. Phosphor maps a CommonJS `require` of these paths to its whole bundle, so a CommonJS test run loads what it did before. Production builds already left the unused icons out (Phosphor declares `sideEffects: false`).

These paths exist only through Phosphor's `exports` map, so the app's tooling must read it: webpack 5, Vite, Jest 28 or newer, Node 12.7 or newer. webpack 4 and Jest 27 cannot find them.
