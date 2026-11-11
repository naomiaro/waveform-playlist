---
'@waveform-playlist/core': major
'@waveform-playlist/playout': major
'@waveform-playlist/browser': major
---

Track effects are looked up by track id instead of being a field of the track.

**Breaking:**

- `@waveform-playlist/core`: `ClipTrack.effects` is removed; a track is plain data. Core's own `TrackEffectsFunction` type, which existed only to type that field, is removed too: import `TrackEffectsFunction` from `@waveform-playlist/playout`.
- `@waveform-playlist/playout`: `createToneAdapter` no longer reads `track.effects`. New option `trackEffects: (trackId) => TrackEffectsFunction | undefined`, called each time the adapter builds a track's audio graph. An `effects` property left on a track object is ignored.
- `@waveform-playlist/browser`: new `WaveformPlaylistProvider` prop `trackEffects` (pass `getTrackEffectsFunction` from `useTrackDynamicEffects()`), forwarded to the default Tone.js adapter. `effects` is removed from `AudioTrackConfig`. The deprecated `WaveformTrack` type is removed.

**New:** `AudioTrackConfig.id` (optional). The track built from the config gets that id instead of a generated one, so an app can key `trackEffects` on an id it knows before the track exists. Ids must be unique; `useAudioTracks` warns about duplicates.

**Why:** attaching the function meant `tracks.map((track) => ({ ...track, effects }))`, which replaced every track object on every `tracks` change. The provider recognises a change it can apply to the running engine by the identity of the track objects, so with those copies every clip move, trim and split, and every added file, disposed the engine and built a new one (measured with a counting adapter: one full rebuild per operation, against none with the tracks passed through). With the prop, `tracks` is passed as it is and those operations update the running engine.

The provider reads the prop through a ref when a track is built: a new function identity rebuilds nothing, and a different effects function for a track that is already built applies the next time that track is built.

Migration: `website/docs/react/upgrading.md`, "Track effects are passed to the provider, not set on tracks".
