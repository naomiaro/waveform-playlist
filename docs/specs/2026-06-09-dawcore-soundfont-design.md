# SoundFont Support for dawcore MIDI (+ Late-Load Fix)

**Date:** 2026-06-09
**Status:** Approved
**Packages:** `@waveform-playlist/playout`, `@waveform-playlist/browser`, `examples/dawcore-tone`

## Goal

A dawcore (web components) consumer can play MIDI tracks through SF2 soundfont
samples, exactly like the React version. Additionally, both stacks gain the
ability to provide or swap the soundfont *after* tracks exist — fixing the
current race where MIDI tracks silently fall back to PolySynth forever when the
SF2 file downloads slower than track setup.

## Background

The React version's "soundfont support" is a `soundFontCache` prop on
`WaveformPlaylistProvider` that is forwarded to
`createToneAdapter({ soundFontCache })`. The adapter routes MIDI clips to
`SoundFontToneTrack` when `cache.isLoaded`, else `MidiToneTrack` (PolySynth)
(`TonePlayoutAdapter.ts`, `addTrackToPlayout`).

In dawcore, the adapter-pluggable design (issue #378) means the consumer
creates the adapter themselves and assigns it to `<daw-editor>`. So
`createToneAdapter({ soundFontCache })` already reaches dawcore — no element
API is needed. `daw-clip` already carries `midiNotes`/`midiChannel`/
`midiProgram`, and the dawcore `midi-loader` extracts `programNumber` from
`.mid` files.

The one real gap (shared by React): the soundfont decision is burned in at
track-add time. The adapter has no way to set or swap the cache afterwards, and
because the routing creates *different track classes*, a swap must remove and
recreate the MIDI track objects.

## Design

### 1. Adapter API — `@waveform-playlist/playout`

New public type; `createToneAdapter` returns it (backwards-compatible —
`ToneAdapter` extends `PlayoutAdapter`):

```typescript
export interface ToneAdapter extends PlayoutAdapter {
  /** Provide or swap the SoundFont after creation. Rebuilds only MIDI tracks;
   *  audio tracks keep playing untouched. Pass undefined to revert to PolySynth. */
  setSoundFontCache(cache: SoundFontCache | undefined): void;
}

export function createToneAdapter(options?: ToneAdapterOptions): ToneAdapter;
```

Internals:

- `let _soundFontCache = options?.soundFontCache` replaces the direct
  `options?.soundFontCache` reads in `addTrackToPlayout`.
- Extract `addMidiTrackToPlayout(p, track)` from the MIDI half of
  `addTrackToPlayout` (~90 lines today; this also brings it under the style
  guideline for function size).
- New closure state `const _currentTracks = new Map<string, ClipTrack>()`,
  maintained immutably: set in `setTracks`/`addTrack`/`updateTrack`, deleted in
  `removeTrack`, and field-updated (new object via spread) in
  `setTrackVolume`/`setTrackMute`/`setTrackSolo`/`setTrackPan` so the snapshot
  never goes stale.
- `setSoundFontCache(cache)`:
  1. Store the cache.
  2. If playout is disposed/absent: store only (no-op rebuild).
  3. For each snapshot track with MIDI clips:
     `playout.removeTrack(midiTrackId)` → `addMidiTrackToPlayout(playout, track)`
     → `resumeTrackMidPlayback(midiTrackId)` if playing.
     (`midiTrackId` is `track.id + ':midi'` when the track also has audio
     clips, else `track.id` — same rule as `addTrackToPlayout`.)
  4. `playout.applyInitialSoloState()` once at the end.

### 2. React provider — `@waveform-playlist/browser`

`WaveformPlaylistContext.tsx` gets a small effect: when the `soundFontCache`
prop changes (including arriving late), call
`adapter.setSoundFontCache(soundFontCache)` on the live adapter. The existing
creation-time pass-through stays.

### 3. dawcore — no package changes

`<daw-editor>` stays adapter-agnostic per issue #378 — the consumer owns the
adapter, so soundfont config belongs on `createToneAdapter`, not on the
element.

### 4. Example — `examples/dawcore-tone/soundfont.html`

Mirrors `midi-load.html`'s structure and dark styling:

- Preload `/media/soundfont/A320U.sf2` via `SoundFontCache`.
- `createToneAdapter({ soundFontCache, ppqn: 960 })`.
- `editor.loadMidi('/media/midi/RedHotChiliPeppers-Otherside.mid')` —
  multi-track with real GM programs and channel-9 percussion.
- Linked from the example `index.html`.

### 5. Error handling

- SF2 fetch/parse failure in the example: log + proceed without cache
  (PolySynth fallback, user-visible message in the example's log panel).
- The existing "SoundFont not loaded — falling back to PolySynth" console
  warning stays, but the condition is now recoverable via
  `setSoundFontCache`.

### 6. Testing

Extend `TonePlayoutAdapter.test.ts` (mocked `TonePlayout`, no AudioContext):

- Loaded cache at creation → `addSoundFontTrack` called with
  `programNumber`/`isPercussion`.
- No cache → `addMidiTrack`; then `setSoundFontCache(loadedCache)` → MIDI
  track removed + re-added via `addSoundFontTrack`; audio tracks untouched.
- `setSoundFontCache(undefined)` reverts to `addMidiTrack`.
- Swap during playback calls `resumeTrackMidPlayback`.
- Mute/volume changed before swap is preserved in the rebuilt track
  (snapshot freshness).
- Browser package: late `soundFontCache` prop change triggers
  `adapter.setSoundFontCache` (mock adapter).

## Out of Scope

- Soundfont in `NativePlayoutAdapter` (`@dawcore/transport`).
- Per-track soundfont selection.
- `soundFontUrl` convenience option on `ToneAdapterOptions`.
- Unifying `MidiToneTrack`/`SoundFontToneTrack` into one lazy-routing class.
