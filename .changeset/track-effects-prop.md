---
'@waveform-playlist/core': major
'@waveform-playlist/playout': major
'@waveform-playlist/browser': major
---

Track effects are looked up by track id instead of being a field of the track.

**Breaking:**

- `@waveform-playlist/core`: `ClipTrack.effects` is removed; a track is plain data. Core's own `TrackEffectsFunction` type, which existed only to type that field, is removed too: import `TrackEffectsFunction` from `@waveform-playlist/playout`.
- `@waveform-playlist/playout`: `createToneAdapter` no longer reads `track.effects`. New option `trackEffects: (trackId) => TrackEffectsFunction | undefined`, called each time the adapter builds a track's audio graph. An `effects` property left on a track object is ignored.
- `@waveform-playlist/browser`: new `WaveformPlaylistProvider` prop `trackEffects` (pass `getTrackEffectsFunction` from `useTrackDynamicEffects()`), forwarded to the default Tone.js adapter. The deprecated `WaveformTrack` type is removed.

An app keys `trackEffects` on ids it chooses: `audioTrack({ id, … })` and `createTrack({ id, … })` from `@waveform-playlist/core` take an optional `id`. Ids must be unique; the arrangement throws on a duplicate.

**Why:** attaching the function meant copying every track object (`{ ...track, effects }`) whenever the tracks changed, and a function is not data an arrangement can hold, copy and put in an undo step. A track is plain data; what is not goes through a provider prop keyed by track id.

The provider reads the prop through a ref when a track is built: a new function identity rebuilds nothing, and a different effects function for a track that is already built applies the next time that track is built.

Migration: `website/docs/react/upgrading.md`, "Track effects are passed to the provider, not set on tracks".
