---
'@dawcore/components': patch
---

fix: preserve declared `<daw-track>` DOM order when audio decodes finish out of order (#625). `_syncDomToEngineOrder` now permutes only engine-known elements among the DOM slots they already occupy, instead of anchoring the loaded subset at the front — tracks no longer re-sort into decode-completion order during initial load.
