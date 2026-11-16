---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': minor
'@waveform-playlist/midi': minor
---

browser: `useCreateArrangement(init?, options?)`, `useArrangementTracks(arrangement)` and `useArrangementSources(arrangement)` (#812). The first makes the engine's `Arrangement` once per component instance (an initializer that throws goes to the render's error boundary), the second returns its tracks, loading clips included, and re-renders when they change but not on a mix change, the third returns where each audio source is (`pending`, `loaded` or `failed`). They also go with a `PlaylistEngine` an app builds itself (`new PlaylistEngine({ adapter, arrangement })`); `WaveformPlaylistProvider` takes the arrangement as its `arrangement` prop (see the changeset of that change).

browser: `ClipPeaks` has a new required field, `isPlaceholder: boolean`, true for the record of a clip whose audio is still loading. `WaveformPlaylistProvider` sets it for clips still loading and `MediaElementPlaylistProvider` sets it to `false` on every record. An app that builds a `ClipPeaks` object adds `isPlaceholder: false`.

ui-components: `Clip` takes `isPlaceholder` (default false). A placeholder clip is drawn without a drag handle and without trim handles, dimmed (the whole container, header included) to the new optional theme key `placeholderClipOpacity`, 0.5 when the theme does not set it or sets something that is not a number from 0 to 1; its container carries `data-clip-placeholder="true"`. `WaveformPlaylistProvider` draws a clip still loading this way. New component `ClipPlaceholderBody` (optional `isSelected`): the body of a placeholder with no peaks, a box over the clip's channel area in the colour of the waveform's bars (`waveFillColor`, the selected one when selected; `grey` when the theme gives no usable colour), with `data-clip-placeholder-body="true"`. The browser package draws it for a clip still loading that has a `duration` and no peaks, with or without clip headers.

midi: `loadMidiTracks(src, { sampleRate, flatten?, start?, duration?, name?, signal? })` loads a URL, a `File` or a `Blob` as `kind: 'midi'` `ClipTrack[]`, without React.
