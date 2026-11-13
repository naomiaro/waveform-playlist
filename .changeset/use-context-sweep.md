---
'@waveform-playlist/browser': patch
'@waveform-playlist/ui-components': patch
---

Internal: contexts are read with React 19's `use(Context)` and provided with `<Context value>` where the source had `useContext(Context)` and `<Context.Provider value>`. No hook returns or throws anything different and no export changed. One message differs: a library hook called outside a component render now fails with React's "Context can only be read while React is rendering" where it said "Invalid hook call".
