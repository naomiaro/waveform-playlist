# dawcore MIDI Tracks (Tone Adapter Path) — Design Spec

**Status:** Draft
**Date:** 2026-05-02
**Scope:** First PR off the `feat/dawcore-midi-tone` branch
**Parent spec:** [`docs/specs/web-components-migration.md`](./web-components-migration.md) §"MIDI Loading", §"Piano-Roll Theming"

---

## Goal

Programmatic MIDI clips render as piano-roll in dawcore and play back via `TonePlayoutAdapter`. Establishes the editor's MIDI-aware track loading path, the new `<daw-piano-roll>` element, and the `<daw-clip>` / `<daw-track>` API surface needed for MIDI — without bringing in `.mid` parsing, file drop, native synthesis, or MIDI clip mutations.

## Non-Goals (Explicit)

- `editor.loadMidi(url)` and `.mid` file parsing — follow-up PR (will wrap `parseMidiUrl` from `@waveform-playlist/midi`)
- `.mid` / `.midi` file-drop routing — depends on `loadMidi`
- `@dawcore/midi` package extraction — independent rename PR later
- Native `Transport` / `ClipPlayer` MIDI scheduling — MIDI playback only via `TonePlayoutAdapter`
- MIDI clip **trim** and **split** — guarded as inert this PR; needs note-array slicing in `@waveform-playlist/engine`
- Per-channel routing for the `flatten` mode — not reachable without `loadMidi`
- SoundFont demo — `MidiExample.tsx`'s toggle pattern can be ported once the base lands

## Background

The MIDI plumbing in core / engine / playout already exists end-to-end:

- `AudioClip.midiNotes`, `midiChannel`, `midiProgram` are first-class fields in `@waveform-playlist/core` (`packages/core/src/types/clip.ts:155-161`).
- `createClip()` and `createClipFromSeconds()` accept `sampleRate` + `sourceDurationSamples` (or `sourceDuration`) without `audioBuffer` (`packages/core/src/types/clip.ts:411-431`).
- `TonePlayoutAdapter` already filters clips into audio vs MIDI buckets and routes MIDI clips to `MidiToneTrack` (PolySynth path) or `SoundFontToneTrack` based on whether `soundFontCache` is provided (`packages/playout/src/TonePlayoutAdapter.ts:50-138`). It uses `c.midiNotes != null` as the discriminator.
- React's `MidiExample.tsx` demonstrates the full Tone-adapter MIDI flow end-to-end with multi-track flattening and SoundFont toggling.

What is missing is the dawcore element and editor surface: nothing in `packages/dawcore/src/` references MIDI today.

## Scope Decision: Notes-Presence Discriminator

A clip is MIDI iff `clip.midiNotes != null`. This matches the discriminator already used by `TonePlayoutAdapter` and keeps `<daw-track render-mode="...">` strictly a *visual* concern (independent of clip content type). Considered alternatives:

- An explicit `kind="midi"` attribute on `<daw-clip>` — redundant with notes presence; creates a sync footgun.
- A separate `<daw-midi-clip>` element — doubles the element surface and breaks the spec's `<daw-clip>` model that explicitly accepts both.

## Architecture

```
HTML <daw-track render-mode="piano-roll">      Tone-side
   <daw-clip>                                  TonePlayoutAdapter
                                                ├ filters c.midiNotes
JS  clip.midiNotes = [...]   ───►              ├ creates MidiToneTrack
       │                                        │   (or SoundFontToneTrack)
       ▼                                        └ schedules notes via Part
   daw-clip-update event
       │
   <daw-editor>._loadTrack
       ├ skip fetch+decode (no src)
       ├ build clip via createClip({ sampleRate, sourceDurationSamples, midiNotes, ... })
       └ engine.setTracks(...)
       │
       ▼
   render: <daw-piano-roll midi-notes=… …>
```

## Files

### Added

- `packages/dawcore/src/elements/daw-piano-roll.ts` — new visual element
- `examples/dawcore-tone/midi.html` — demo page

### Modified

- `packages/dawcore/src/elements/daw-clip.ts` — `midiNotes` JS property + `midi-channel` / `midi-program` reflected attrs
- `packages/dawcore/src/elements/daw-track.ts` — `render-mode` reflected attr
- `packages/dawcore/src/elements/daw-editor.ts` — MIDI-aware `_loadTrack` branch + render-mode dispatch + interaction guards
- `packages/dawcore/src/types.ts` — descriptor fields (`renderMode`, `midiNotes`, `midiChannel`, `midiProgram`)
- `packages/dawcore/src/index.ts` — export `DawPianoRollElement`

### Not Touched (Intentionally)

- `packages/dawcore/src/interactions/file-loader.ts` — file drop stays audio-only
- `packages/core`, `packages/engine`, `packages/playout` — MIDI plumbing already exists
- `packages/midi` — not consumed yet
- `packages/transport/src/audio/clip-player.ts` — no native MIDI synth this PR
- `packages/dawcore/src/interactions/clip-pointer-handler.ts`, `split-handler.ts` — MIDI clip move/trim/split deferred (only inert guards added)

## Element APIs

### `<daw-piano-roll>` (new)

Visual element, Shadow DOM, chunked canvas — mirrors `<daw-waveform>`'s rendering pattern so virtual scroll, pixel-density, and chunk lifecycle behave identically.

| Property | Type | Purpose |
|---|---|---|
| `midiNotes` | `MidiNoteData[]` | Notes to draw |
| `length` | `number` | Total clip width in CSS pixels |
| `waveHeight` | `number` | Row height (matches sibling `<daw-waveform>`) |
| `samplesPerPixel` | `number` | Zoom — same units as the editor |
| `sampleRate` | `number` | Editor's `effectiveSampleRate`, for note→pixel conversion |
| `clipOffsetSeconds` | `number` | Trim offset (`clip.offsetSamples / sampleRate`) |
| `visibleStart` / `visibleEnd` / `originX` | `number` | Virtual-scroll inputs (same shape as `<daw-waveform>`) |
| `selected` | reflected boolean attr | Toggles between note / selected-note color |

**Internal:**

- Reuses `getVisibleChunkIndices()` from `utils/viewport.ts`
- Auto-fits pitch range: `[max(0, minMidi - 1), min(127, maxMidi + 1)]` from actual note data; falls back to `[0, 127]` if empty
- Velocity → opacity (0.3 + velocity × 0.7); minimum 2px note width / height; 1px rounded rect
- Drawing in `willUpdate()` + `firstUpdated()` (Lit equivalent of React's `useLayoutEffect` — paint-aligned, no flicker)
- Reads CSS custom props at draw time:
  - `--daw-piano-roll-note-color` (default `#2a7070`)
  - `--daw-piano-roll-selected-note-color` (default `#3d9e9e`)
  - `--daw-piano-roll-background` (default `#1a1a2e`, applied to host)

### `<daw-clip>` (modified)

| Surface | Form | Behavior |
|---|---|---|
| `midiNotes` | JS property only (`MidiNoteData[] \| null`, default `null`) | Setter dispatches `daw-clip-update`. Not reflected — note arrays are too large. |
| `midi-channel` / `midiChannel` | Reflected number attribute | Default `null`. Used by `TonePlayoutAdapter` to detect channel 9 = percussion. |
| `midi-program` / `midiProgram` | Reflected number attribute | Default `null`. GM program (0-127) for `SoundFontToneTrack` instrument lookup. |

`daw-clip-update` is the existing event — already carries the changed clip via `composedPath`, so no new event type.

### `<daw-track>` (modified)

| Surface | Form | Behavior |
|---|---|---|
| `render-mode` / `renderMode` | Reflected string attribute (`'waveform' \| 'piano-roll'`, default `'waveform'`) | When changed, dispatches existing `daw-track-update`. Editor re-renders the row. |

### `types.ts` (modified)

```typescript
interface BaseClipDescriptor {
  // ... existing
  midiNotes: MidiNoteData[] | null;
  midiChannel: number | null;
  midiProgram: number | null;
}

interface TrackDescriptor {
  // ... existing
  renderMode: 'waveform' | 'piano-roll';
}
```

`MidiNoteData` imported from `@waveform-playlist/core`.

## Editor Changes

### Per-clip branch in `_loadTrack`

```
for each clip in track:
  if clip.src:                       → existing audio path (fetch, decode, peaks)
  else:                              → MIDI path (always registers, even empty)
```

A clip with no `src` is treated as MIDI. It always registers in the engine — even with no notes and no declared `duration` — so `_applyClipUpdate` can reliably find it when notes arrive later via property assignment.

### MIDI path

1. Resolve inputs:
   - `notes = clip.midiNotes ?? []`
   - `noteSpanSeconds = notes.length ? max(note.time + note.duration) : 0`
   - `sourceDurationSamples = Math.ceil(Math.max(noteSpanSeconds, clip.duration, 1) × effectiveSampleRate)` — at least 1 second so the engine has a non-zero clip span. Late note arrivals upgrade this via `_applyClipUpdate`.
   - `requestedDurationSamples = clip.duration > 0 ? Math.round(clip.duration × effectiveSampleRate) : sourceDurationSamples`
2. Build engine clip via `createClip({ startSample, durationSamples: requestedDurationSamples, offsetSamples, sampleRate, sourceDurationSamples, midiNotes: notes, midiChannel, midiProgram, gain, fadeIn, fadeOut, name })`. Align `clip.id = clipEl.clipId`.
3. Push into `_engineTracks` Map under the track's id; do **not** touch `_clipBuffers`, `_peaksData`, `_clipOffsets`.
4. Build engine if not yet built (existing lazy path). The engine accepts MIDI clips because `AudioClip.audioBuffer` is optional.
5. Call `engine.setTracks(...)` (same point existing path calls it). The Tone adapter routes the clip — empty `notes` array produces no scheduled events but reserves the track shell so subsequent `engine.updateTrack` calls work.

### Reactive updates when notes arrive late

`daw-clip-update` already fires when `<daw-clip>` properties change. The existing handler reads the clip's current state — extend it to:

- Re-derive `sourceDurationSamples` from new `midiNotes`
- Replace the engine's clip via `engine.updateTrack(trackId)` (the same incremental path used after recording)

### Render branch per clip

In `daw-editor.ts`'s `render()` clip-iteration block, render-mode alone decides the renderer — content type doesn't override the visual choice:

```typescript
track.renderMode === 'piano-roll'
  ? html`<daw-piano-roll .midiNotes=${clip.midiNotes ?? []} ...>`
  : html`<daw-waveform ...>`
```

This means a piano-roll track + audio clip renders an empty piano-roll body, and a waveform track + MIDI clip renders an empty waveform — both intentional, since render-mode is the user's explicit choice. Mixed-content tracks are uncommon; the consistent-with-track-mode behavior beats the surprise of mid-row renderer swapping.

`<daw-piano-roll>` reads the same shared props as `<daw-waveform>` (length, sampleRate, samplesPerPixel, virtual-scroll inputs).

### Sample rate

`effectiveSampleRate` already falls back through `sampleRate` → `_externalAdapter.audioContext.sampleRate` → `48000` (`packages/dawcore/src/elements/daw-editor.ts:168-171, 310-311`). MIDI-only-first-track gets a usable rate without any change.

### Zoom floor

`_minSamplesPerPixel` is currently set from peak cache after successful `extractPeaks`. MIDI clips don't generate peaks, so they don't contribute to the floor. If the track is MIDI-only, the floor stays at 1 (no constraint). Consistent — no peak data to over-zoom past.

### Interaction guards (defensive no-ops)

- `ClipPointerHandler` — `moveClip` is safe (only changes `start`); `trimClip` would change `offsetSamples` / `durationSamples` but the notes wouldn't slice. **This PR:** allow move; disable trim handles for MIDI clips by checking `clip.midiNotes` in the hit-test (treat the trim-boundary zones as inert).
- `splitAtPlayhead` — would create two clips both holding the full notes array. **This PR:** `canSplitAtTime()` returns false when the target clip has `midiNotes`. The pre-flight check already exists; just extend the predicate.

These two guards are tiny but necessary so the first PR doesn't ship broken interactions.

### `addTrack()` API extension

```typescript
editor.addTrack({
  name: 'Lead Synth',
  renderMode: 'piano-roll',
  midi: {
    notes: MidiNoteData[],
    channel?: number,
    program?: number,
  },
});
```

Returns the new `<daw-track>` element. Sugar: when `midi` is present, the method creates a single `<daw-clip>` child, sets `midiNotes`, sets `midi-channel` / `midi-program`, sets `render-mode="piano-roll"` on the track. Equivalent to the declarative HTML form.

## Demo

`examples/dawcore-tone/midi.html` — programmatic, single page, no `.mid` file. Mirrors `examples/dawcore-tone/basic.html`:

- `createToneAdapter({ ppqn: 960 })`, `editor.adapter = adapter`
- `<daw-editor>` with `<daw-transport>` (play / pause / stop)
- One `<daw-track render-mode="piano-roll" name="Lead">` containing one `<daw-clip>`
- Inline note array (e.g. C major scale, 8 notes)
- Script: `appendChild(track)` → set `clip.midiNotes = [...]`
- No SoundFont (PolySynth path) — keeps the demo dependency-free

## Tests

| File | Coverage |
|---|---|
| `packages/dawcore/src/__tests__/daw-piano-roll.test.ts` | Element registration, property-driven re-render, canvas mock (same pattern as `daw-waveform.test.ts`). Smoke-test that `midiNotes`, `length`, `sampleRate` updates trigger redraw. |
| `packages/dawcore/src/__tests__/daw-clip.test.ts` (extend) | `midiNotes` setter dispatches `daw-clip-update`; `midi-channel` / `midi-program` attrs reflect to property and back. |
| `packages/dawcore/src/__tests__/daw-track.test.ts` (extend) | `render-mode` attribute reflection; `daw-track-update` fires on change. |
| `packages/dawcore/src/__tests__/daw-editor.test.ts` (extend) | MIDI clip path skips fetch (`fetch` mock is not called); engine `setTracks` receives clip with `midiNotes` populated and no `audioBuffer`; render mounts `<daw-piano-roll>` when `renderMode === 'piano-roll'`. |

happy-dom + canvas mock conventions per `packages/dawcore/CLAUDE.md` testing notes. No new test infra.

## Verification

- `cd packages/dawcore && pnpm typecheck` after each meaningful change
- `pnpm lint` from repo root before commit
- `cd packages/dawcore && npx vitest run` for unit tests
- Manual: open `examples/dawcore-tone/midi.html` via `pnpm example:dawcore-tone`; verify notes render, Play schedules synth, Stop halts cleanly

## Risks

- **Late note arrival timing:** declarative HTML often does `appendChild(clipEl)` before `clipEl.midiNotes = [...]`. The editor must register the clip on connect (deferred if no notes / no duration), and re-register via `daw-clip-update` when notes arrive. The existing `daw-clip-update` handler covers most of this; the new branch must not throw when notes are absent at first read.
- **Mixed-content tracks:** A track with both audio clips (`src`) and MIDI clips (`midiNotes`) is supported by `TonePlayoutAdapter` (uses `:midi` suffix on engine track id). Editor's per-clip branch handles this, but tests should exercise it.
- **Zoom floor regressions on mixed tracks:** A mixed audio-MIDI track would still set `_minSamplesPerPixel` from the audio clip's peaks. That's correct behavior, but worth noting so reviewers don't flag it.
