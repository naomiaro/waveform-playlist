---
'@waveform-playlist/browser': minor
'@waveform-playlist/ui-components': minor
'@waveform-playlist/midi': minor
---

browser: `useCreateArrangement(init?, options?)`, `useArrangementTracks(arrangement)` and `useArrangementSources(arrangement)` (#812). The first makes the engine's `Arrangement` once per component instance (an initializer that throws goes to the render's error boundary), the second returns its tracks, loading clips included, and re-renders when they change but not on a mix change, the third returns where each audio source is (`pending`, `loaded` or `failed`). `WaveformPlaylistProvider` does not take an arrangement yet, so today they go with a `PlaylistEngine` an app builds itself (`new PlaylistEngine({ adapter, arrangement })`); the provider prop comes in a later release.

browser: `ClipPeaks` has a new required field, `isPlaceholder: boolean`, true for the record of a clip whose audio is still loading. Both providers set it to `false` on every record. An app that builds a `ClipPeaks` object adds `isPlaceholder: false`.

ui-components: `Clip` takes `isPlaceholder` (default false). A placeholder clip is drawn without a drag handle and without trim handles, and its container carries `data-clip-placeholder="true"`.

midi: `loadMidiTracks(src, { sampleRate, flatten?, start?, duration?, name?, signal? })` loads a URL, a `File` or a `Blob` as `kind: 'midi'` `ClipTrack[]`, without React. `useMidiTracks` is unchanged.
