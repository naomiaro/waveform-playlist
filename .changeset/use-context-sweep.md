---
'@waveform-playlist/browser': patch
'@waveform-playlist/ui-components': patch
---

Internal: contexts are read with React 19's `use(Context)` and provided with `<Context value>` where the source had `useContext(Context)` and `<Context.Provider value>`. No hook returns or throws anything different and no export changed. What differs is the text of an error for a misuse: a hook whose first step is the context read (`useIsPlaying()`, `usePlaybackControls()` and the other provider hooks, `useTrack()`, `useTheme()`), called outside a component render after React has rendered once (an event handler, an effect, a timer), fails in a development build with React's "Context can only be read while React is rendering" where it said "Invalid hook call". With two copies of React on the page the `TypeError` names `use` where it named `useContext`. The two exported aliases `AnnotationIntegrationProvider` and `SpectrogramIntegrationProvider` are unchanged.
