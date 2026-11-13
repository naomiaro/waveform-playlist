---
'@waveform-playlist/browser': major
---

Track controls are composed from pieces bound to a track, and the mixer setters take a track id (#687).

The children of `<WaveformTrackControls>` are the control panel of one track. The part renders them once per track, each copy inside that track's context:

- `useTrack()` (type `TrackContextValue`): the track whose panel the calling component is part of: `id`, `kind`, `index`, `name`, `muted`, `soloed`, `volume`, `pan`, `renderMode`, `isLoading`, `isSelected`, `isFirst`, `isLast`, `hasSpectrogram`, and the bound actions `setMuted`, `setSoloed`, `setVolume`, `setPan`, `select`, `moveUp`, `moveDown`, `setRenderMode`, `openSpectrogramSettings`.
- `DefaultTrackControls` (the default panel, now exported; its `children` are drawn inside it, below the pan slider) and the pieces it is made of: `TrackName`, `TrackMuteButton`, `TrackSoloButton`, `TrackVolumeSlider`, `TrackPanSlider`, `TrackMenuButton`.
- `TrackRemoveButton` (`onRemove(trackId)`) and `TrackReorderGrip` (drag grip with move up/down buttons), drawn by being rendered among the children.
- `useTrackReorderHandle()` (type `TrackReorderHandle`): `{ handleRef, isDragSource }` for a drag grip of your own.
- Types `DefaultTrackControlsProps`, `TrackRemoveButtonProps`.
- New attributes: `data-track-controls="<track id>"` on the element that holds a track's panel, `data-track-name` on the name, `data-track-reorder-grip` around the grip.

```tsx
<WaveformTrackControls width={200}>
  <DefaultTrackControls />
  <TrackRemoveButton onRemove={removeTrack} />
  <TrackReorderGrip />
</WaveformTrackControls>
```

Removed:

- From `<WaveformTrackControls>`: `renderTrackControls`, `onRemoveTrack`, `trackReordering`. Its props are `width` and `children`; without children it draws `<DefaultTrackControls />`. A removed prop left in plain JavaScript is ignored: the default panel, no remove button, no grip.
- `SortableTrackControls`, `SortableTrackControlsProps`, `SortableTrackControlsRenderProps`: use `<TrackReorderGrip />` or `useTrackReorderHandle()`. The element a reorder drag moves is the slot the part draws around the panel.
- The index signatures of `setTrackMute`, `setTrackSolo`, `setTrackVolume` and `setTrackPan` (`useEditorControls()`): the first argument is the track id. A call with anything but a string is ignored, with one console warning per setter in development; an id no track has is ignored.

Behaviour:

- Mixer state (mute, solo, volume, pan) is kept by track id. Removing a track no longer puts the remaining tracks back at the values of their `ClipTrack` (and the rebuilt engine no longer takes its values from the old list by position); a track keeps its state when tracks are removed, added in front of it or reordered, and a new id starts from its `ClipTrack` fields.
- `usePlaylistMixer().trackStates` has one entry per track, in the order of `tracks`. The entry of a track that is still loading is `undefined` at its own position, where the array used to be shorter. Its length equals `tracks.length`; the TypeScript type is still `TrackState[]`. Read `trackStates[i]?.soloed`, count loaded tracks with `trackStates.filter(Boolean).length`.
- The `trackStates` array keeps its identity while no entry changed (a move of a trim; a re-load caused by a new `onTracksChange` function no longer publishes new state objects).
- A click anywhere in a track's slot of the controls column selects the track, in a panel of your own too. The remove button, the button of the track menu and the reorder grip and buttons do not select; a render-mode choice in the open track menu does, as before.
- `onRemove` gets the track id; the removed `onRemoveTrack` got the index.
- The part compares its children with the previous ones (element types, keys, props; `children` recursively, `style` one level deep) and keeps the previous ones while they are equal, so children written inline do not render the panels. A function or object written inline as a prop renders every panel on each render of the composing component.
- `useTrack()` and the pieces throw outside the children of `<WaveformTrackControls>` (so also under `MediaElementPlaylistProvider`). For a mixer strip elsewhere under `WaveformPlaylistProvider` use `usePlaylistMixer()` and the id setters.
- While a track is loading, the mute, solo, volume and pan pieces and the move buttons are disabled, and its name is "Track N".
- `<DefaultTrackControls>` has no remove button and no grip. `TrackRemoveButton` places itself at the top left of the slot, `TrackReorderGrip` at its right edge. A custom panel gets the slot: as wide as the column, as tall as the row, `overflow: hidden`; fill it with `height: 100%`.
- A mixer change renders the pieces of that track's panel only; selecting a track renders the pieces of the two panels concerned.
- A second reorder handle in one panel warns once in the console in development.
- `exportWav`: a track that is still loading is rendered with the fields of its `ClipTrack` (it failed with a `TypeError`), and its `soloed` counts for the solo rule.
- Internal: `ClipInteractionProvider` ignores a dragover that arrives when no track-reorder drag is in progress (dnd-kit sends one after the dragend of a canceled drag once the slot's element is registered by the reorder handle).

The upgrade guide has the find-and-replace for each removed name.
