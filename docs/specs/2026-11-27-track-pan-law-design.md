# A track has a pan law of its own (#684)

Working document. It is removed from the branch before the PR merges; the PR description carries the summary.

## Why

A track's pan law follows its clips today (`trackChannelCount(track)` in core: the highest channel count among the decoded clips). So the law changes when the clips change:

- the first stereo clip joins a track of mono clips, or the last one leaves: the mono clips move by 3 dB at centre (measured for the issue on both backends: 0.2501 to 0.3537 and back);
- a stereo file finishes loading on a track whose mono clip is already playing: the same step, with no user action at that moment (read from the code: adapters are sent a track without its loading clips);
- the four pan gains are set, not ramped, so the step can click.

The maintainer's decisions (2026-11-27, in this order):

1. Every track has a law of its own that its clips never change. Mixed mono and stereo clips stay legal. Strict tracks (Audacity style) are not built.
2. A track that says nothing gets its law from the first decoded audio it holds (**first-audio**), and the law is stored.
3. The law can be set later, by the app or by a user through the app.
4. It is a **mixer value**, beside `pan`, not a field changed through `updateTrack`.
5. It is called **`panLaw`**, with the laws `'mono'` and `'stereo'`.
6. A track that becomes empty **keeps** its law.
7. The value is never absent: its default is the named value **`'auto'`** ("decided by the first audio"), which first-audio replaces with `'mono'` or `'stereo'`. So the mixer value has a default like the other four. A decided track does not go back to `'auto'`.

## Goals

- Adding, removing, loading or recording a clip never changes the level or the pan behaviour of the audio already on the track.
- A track of one kind of clip sounds exactly as it does today, with no configuration.
- The law can be read and set on every surface: the arrangement, the engine, the React provider, `<daw-track>`.
- Live playback on both backends and both offline exports use the same law for the same track.

## Non-goals

- No conversion of audio: `panLaw: 'mono'` does not downmix a stereo clip. It selects the law only.
- No strict tracks: nothing is rejected or rerouted.
- No built-in control for the law in `ui-components` or in dawcore's track controls. The value and its setter are public; an app draws its own control. (My call; see "Calls made for the maintainer to check".)
- No way to set a decided law back to `'auto'` (Undo can return to a state that had it).
- `MediaElementPlaylistProvider` is not touched (it has no pan).
- #543 (export channel count with stereo-izing master effects) is not fixed here.

## Anti-goals

- A second stored copy of the law anywhere outside the arrangement.
- A "who set it" flag beside the law (that is what "keeps" avoids).
- A change of the law that restarts the track's clips during playback.

## Owner table

| State                               | Stored where (every place)                                                                                                                  | Who writes each place                                                                                                                               | Owner                                                                                     | How others change it                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A track's pan law                   | The arrangement's mixer Map, entry of the track id (`TrackMixerValues.panLaw`), in the current state and in each saved state of the history | The arrangement: when a track enters (seed), when first-audio replaces `'auto'`, in `setTrackPanLaw`, in undo/redo/abort (a saved state comes back) | The `Arrangement`                                                                         | `arrangement.setTrackPanLaw` (or the engine's, React's and `<daw-track>`'s, which call it) |
| The law a track enters with         | `ClipTrack.panLaw` on the track object the app passes in                                                                                    | The app                                                                                                                                             | The app, until the track enters; not read while the id has a mixer entry (as `pan` today) | n/a                                                                                        |
| What the audio graph uses           | Each adapter's pan stage (`currentChannelCount` in core's `createPanStage`)                                                                 | The adapter, from what the engine sends                                                                                                             | One-way cache downstream; never written back                                              | n/a                                                                                        |
| The declared law of a `<daw-track>` | The `pan-law` attribute                                                                                                                     | The page                                                                                                                                            | The page (declaration); the live value is read through the `panLaw` property              | n/a                                                                                        |

No row has two places that write back. The seed field and the attribute are declarations read once at entry, exactly as `pan` is.

## Approaches

- **Opt-in pin** (the law goes on following the clips unless the app sets it): rejected by the maintainer. The surprise stays for everyone who does not know about it.
- **Strict tracks**: rejected. It needs a reject/convert/reroute rule for recording, file drop, `addClip` and `updateTrack`, and none of that is needed to remove the jump.
- **The track always decides, default always-mono or always-stereo**: rejected. Always-mono makes every stereo track 3 dB quieter at centre; always-stereo makes a mono clip +3 dB at centre and +6 dB hard-panned (computed from `panMatrix`).
- **The track always decides, default first-audio, stored as a track field**: rejected. A change of the field is a whole-track `updateTrack` to the adapter, and the native clip player silences the track on that call (`packages/transport/src/audio/clip-player.ts`, `updateTrack` calls `_silenceTrack`).
- **The track always decides, default first-audio, stored as a mixer value**: chosen. A change is one small adapter call and an undo step like a pan move.

## The rules

**R1. Values.** `type PanLaw = 'auto' | 'mono' | 'stereo'`, exported by core. `'mono'` is the equal-power law (−3 dB per side at centre, channels never mixed); `'stereo'` is unity at centre with fold-over. These are the two laws `panMatrix` already has. `'auto'` is the default of every mixer entry and means "decided by the first audio". The type of a decided law, `Exclude<PanLaw, 'auto'>`, gets a name of the builder's choosing.

**R2. Only audio tracks get a decided law.** A MIDI track (`kind: 'midi'`) always plays with the mono law, its entry stays `'auto'`, and `setTrackPanLaw` on it does nothing.

**R3. Entry.** When a track's id gets a mixer entry (`setTracks`, `addTrack`, `updateTrack` to a new id), the entry's `panLaw` is the track's own `panLaw` field if it is `'mono'` or `'stereo'`; else the law of its decoded audio (R5); else `'auto'`.

**R4. First-audio fill.** After any change to the tracks, in the current state and in every saved state alike: an audio track whose entry is `'auto'` and which holds at least one decoded audio clip gets the law of that audio (R5). So `'auto'` is only ever seen on a track with no decoded audio. The fill is part of the change that brought the audio: no undo step of its own, one notification.

- A clip that arrives decoded (`addTrack`, `updateTrack`, a recorded take, a dropped file once decoded): the fill is in the same step, so Undo of that step returns to `'auto'`, and Redo brings the law back.
- A loading clip that resolves: resolution is already written into every state that holds the clip (`_switchLoaded` in `Arrangement.ts`). That pass maps tracks arrays only and keeps each state's mix (`mapHistoryTracks`), so the fill is a second per-state step there, over the current state, the history, `_gesture.before` and an open transaction's base, each from its own tracks. It is no undo step.
- A step the fill makes equal to the state next to it is dropped, as the `undoable: false` write-through does (`dropRepeats`, and the gesture repair of `_writeMixerThrough`). The case: a track holds only a loading stereo clip and the app calls `setTrackPanLaw(t, 'stereo')`; when the clip resolves, the step from before the call is filled to stereo too and no longer differs. Without the drop, `canUndo` stays true and Undo does nothing. With it, a load can change `canUndo`.

**R5. The law of some audio** is `'stereo'` if any decoded clip considered has 2 or more channels, else `'mono'`. When several decoded clips arrive in one change, all of them are considered (today's rule, so a track that enters complete gets the law it has today).

**R6. Keeps.** Once an entry is `'mono'` or `'stereo'`, no change to the track's clips changes it: not the first clip of the other kind, not the removal of every clip, not `setTracks` with the same id. Only `setTrackPanLaw`, and an undo/redo/abort that returns to a state with another value.

**R7. Setting it.** `setTrackPanLaw(trackId, panLaw, options?: MixerChangeOptions)` on the arrangement and the engine, the fifth mixer setter. Everything the other four do holds: an undo step; `gesture` and `undoable: false`; an unknown id or an unchanged value does nothing; no track object is replaced; `mixerVersion` moves, `tracksVersion` does not. It may be called while the entry is `'auto'` (the law is then decided and R4 never fills). It takes `'mono'` or `'stereo'`; any other value, `'auto'` included, throws a `TypeError` before anything changes.

**R8. What an adapter is given.** The projection the engine sends (`setTracks`, `addTrack`, `updateTrack`) and `getState().tracks` have the entry's `panLaw` in the track's field, like the other mixer values. Because every entry has a value (`'auto'` at least), the track's own seed field never shows through. `PlayoutAdapter` gains an optional `setTrackPanLaw?(trackId: string, panLaw: PanLaw): void`. For a change of the law alone the engine calls it, also for a return to `'auto'` (an Undo of a `setTrackPanLaw` made on a track without audio), which an adapter treats as "from the clips" (R9); an adapter without it gets `updateTrack` with the projected track, or `setTracks` when it has no `updateTrack` either. `NativePlayoutAdapter` (and `Transport`) and the Tone adapter implement it. One case makes no adapter call: an engine `setTrackPanLaw` that changed nothing in the arrangement. The other four engine setters do call the adapter in that case; this one does not, because on an adapter without the method the fallback is a whole-track `updateTrack`.

**R9. What an adapter does with it.** One function in core, `trackPanLaw(track)`: the track's `panLaw` if it is `'mono'` or `'stereo'`, else (`'auto'` or no field) R5 over its clips (today's `trackChannelCount` rule). Every place that passes `trackChannelCount(track)` to a pan stage today uses it instead (transport: three sites; Tone adapter: two; `useExportWav`; dawcore `exportAudio`). So a track given to the transport or to `TonePlayout` directly, without an arrangement, behaves as today unless it carries `panLaw`.

**R10. A switch is ramped.** When the law of a live pan stage changes, the four gains move to the new matrix over a short fixed time (a named constant, 10 ms as a starting value; my call) instead of stepping. A pan move stays as it is today. On an offline context no switch happens.

**R11. Exports.** Neither export reads the engine's projection: React's `exportWav(tracks, trackStates)` is given `usePlaylistTimeline().tracks` (whose mixer fields are the entered-with values) with the mix in `trackStates`; dawcore's reads `_loadedTracks()`, built by `loadedTrack` in `interactions/arrangement-view.ts` from four named mix fields. So: React resolves the law from `trackStates[i].panLaw` when it is `'mono'` or `'stereo'` (the state wins, as it does for volume and pan), else from `trackPanLaw(tracks[i])`, and dawcore's `loadedTrack` and its `sameMix` carry `panLaw`, after which `trackPanLaw(track)` is right there. Both then match live playback. React's output channel count becomes: 2 if any audible track has the stereo law or a stereo clip, else 1 (today: from the clips only). dawcore's `channels` option and its default of 2 are unchanged.

## Public surface

| Package   | Addition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| core      | `PanLaw`; `ClipTrack.panLaw?: PanLaw` (the value a track enters with; not a view field, so it stays in `PlayoutTrack`); `AudioTrackOptions.panLaw`; `trackPanLaw(track)`; `PanStage.setPanLaw(panLaw)` beside `setSourceChannelCount` if the builder finds it cleaner, otherwise the stage keeps its channel-count signature                                                                                                                                                                                                    |
| engine    | `TrackMixerValues.panLaw: PanLaw` (required, default `'auto'`); `setTrackPanLaw` on `Arrangement` and `PlaylistEngine`; `PlayoutAdapter.setTrackPanLaw?`                                                                                                                                                                                                                                                                                                                                                                        |
| transport | `Transport.setTrackPanLaw`, `NativePlayoutAdapter.setTrackPanLaw`, `TrackNode` reads the law                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| playout   | the Tone adapter's `setTrackPanLaw`; `ToneTrack` reads the law                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| browser   | `TrackState.panLaw: PanLaw` (required; `'auto'` until the track has audio. A new required field on a type a consumer can build: a major for browser); `setTrackPanLaw` wherever `setTrackPan` is published (the mixer controls of the provider and `useTrack()`)                                                                                                                                                                                                                                                                |
| dawcore   | `<daw-track pan-law>` with `mono` or `stereo` (declaration) and the live `panLaw` property, built exactly like `pan`: the attribute is what the track enters with, the property reads the arrangement's value while the track is in it (`'auto'` until it has audio) and setting it is a request (`setTrackPanLaw`). The library writes no attribute: a law that first-audio set shows in the property only. `pan-law="auto"` is the same as no attribute; any other value is treated as not declared, with one console warning |

`trackChannelCount` stays exported (the React export still reads clip channel counts).

## What a consumer sees change

| Case                                                                  | Before                              | After                                                                                            | In the upgrade guide |
| --------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------- |
| Track of mono clips only, or stereo clips only                        | its law                             | the same law                                                                                     | no                   |
| Stereo clip joins a track of mono clips (drop, record, `updateTrack`) | mono clips +3 dB at centre, stepped | nothing moves; the stereo clip plays under the mono law (−3 dB at centre, hard pan mutes a side) | yes                  |
| Mono clip joins a track of stereo clips                               | nothing moves                       | nothing moves (the mono clip plays under the stereo law, as today)                               | no                   |
| Last stereo clip leaves a mixed track                                 | mono clips −3 dB                    | nothing moves                                                                                    | yes                  |
| Stereo file finishes loading on a track playing a mono clip           | +3 dB step                          | nothing moves                                                                                    | yes                  |
| A new track given one mono and one stereo file to load                | stereo law once both are in         | the law of whichever decodes first; set `panLaw` on the track to fix it                          | yes                  |
| Track enters with mono and stereo clips already decoded               | stereo law                          | stereo law                                                                                       | no                   |
| Track emptied, then given audio of the other kind                     | law follows the new audio           | keeps the old law                                                                                | yes                  |
| Undo of the change that brought a track's first audio                 | law re-derived                      | back to `'auto'`; Redo restores it                                                               | no                   |
| React WAV export of mono clips on a track set to `'stereo'`           | n/a                                 | a 2-channel file                                                                                 | with the new option  |
| Transport or `TonePlayout` used without an arrangement                | law follows the clips               | the same, unless the track carries `panLaw`                                                      | no                   |
| A third-party `PlayoutAdapter`                                        | derives what it likes               | is handed `track.panLaw`; if it ignores it, live and export can differ on a mixed track          | yes, one line        |

## Order of events

Set, then audio: `setTrackPanLaw('t', 'stereo')` on an empty track (entry: stereo), then a mono clip decodes: R4 does not fill, the entry stays stereo.

Audio, then set: a mono clip decodes (entry: mono, same change), then `setTrackPanLaw('t', 'stereo')`: an undo step; Undo returns to mono.

Two loads on one new track: mono `M` and stereo `S` are loading (entry: `'auto'`). Whichever resolves first fills the entry in every state that holds it resolved; the second changes nothing. This is the one order-dependent case, and it is documented, with the fix (declare `panLaw`).

A saved state with other clips: Undo state `U` holds only loading `S`; the current state also holds decoded mono `M` (entry: mono). `S` resolves: the current entry stays mono; `U`'s entry is filled from `U`'s own tracks (stereo). Undo then returns to a track that holds only `S`, with the stereo law. Each state is what it would have been.

## Documentation

The doc surface is decided here. Consumer-facing: the pan section of `website/docs/react/guides/effects.md` ("Why tracks are not panned with…", whose last paragraph describes the mixed-track rule being removed); `website/docs/react/upgrading.md` (one entry: the rows marked "yes" above; this is a behaviour change with no Find/Replace, plus the adapter line); `website/docs/llm-reference.md`; `website/static/llms.txt`; `website/docs/api/hooks.md`; the provider API page that lists the mixer setters. Package READMEs: transport (the "Pan" section), core (`createPanStage`), engine (mixer setters, `PlayoutAdapter`, "The mix is separate from the tracks"), dawcore `README.md` and `COMPONENTS.md`. Notes: core, engine, transport, playout `CLAUDE.md`, `packages/transport/TRANSPORT.md`, `packages/browser/notes/effects-and-export.md`, `packages/dawcore/notes/effects.md`, dawcore's `<daw-track>` entry, and the attribute table of `docs/specs/web-components-migration.md`. Grep `.changeset/` for "pan law" and `trackChannelCount`: `shared-pan-stage.md` describes the rule being replaced.

A changeset names every package whose `src` changes (`patch` for `@dawcore/*`). The issue body of #684 is rewritten when the PR opens (the decision; the stale MIDI-trim paragraph, removed by #758).

## Verification

- Unit: the mixer functions (seed, fill, keeps, changes, write-through); the arrangement (R3 to R7, the four sequences above, undo/redo of each); adapter sync (the setter, both fallbacks); `trackPanLaw`; the pan stage ramp; each adapter; both exports; `<daw-track>`; the React view. Each new regression test is mutation-checked.
- A negative test for each "nothing moves" row of the table.
- In a browser, on both backends (the issue's measurement, repeated): a centred mono clip's level before and after a stereo clip joins and leaves is unchanged; after `setTrackPanLaw` it moves by 3 dB without a restart of the clip; live and export match.
- `moveBefore` and reparenting are not involved; `<daw-track pan-law>` is checked in Chromium once (declared law, live property after first-audio, a set during playback).

## Calls made for the maintainer to check

1. No built-in control for the law (non-goals).
2. `setTrackPanLaw` throws a `TypeError` on a value that is not `'mono'` or `'stereo'`, `'auto'` included.
3. A switch of law ramps over about 10 ms; pan moves are unchanged.
4. React's export writes 2 channels when any audible track has the stereo law (R11).
5. Several decoded clips arriving at once: the highest channel count decides (R5).
6. An adapter without `setTrackPanLaw` gets a whole-track `updateTrack` (R8), which on such an adapter may restart the track's clips.
7. `<daw-track pan-law>` with an unknown value: treated as not declared, one warning.
8. A step that the first-audio fill makes a no-op is dropped, so a file finishing its load can turn `canUndo` false (R4). The alternative is an Undo that does nothing.
9. The engine's `setTrackPanLaw` does not call the adapter when the arrangement changed nothing, unlike the other four setters (R8).
10. In `exportWav(tracks, trackStates)`, `trackStates[i].panLaw` wins over `tracks[i].panLaw` (R11).

## Functions that list the four mixer fields

Each ignores `panLaw` until it is extended, and each failure is silent: `sameValues`, `mixerChanges`, `mixerValuesOf` and the equality check of `withMixerValues` (engine `mixer.ts`; without the first, `setTrackPanLaw` does nothing and law-only steps are dropped; without the second, an Undo of a law is not announced or sent); `sendMixerValues` (`adapterSync.ts`); `sameState` and `DEFAULT_MIX` (`useArrangementView.ts`; every default mix gets `panLaw: 'auto'`); the local `TrackState` of `useExportWav.ts`; dawcore's `mixOfTrack`, `mixOfElement`, `pickMix`, `withMix`, `DEFAULT_TRACK_MIX` (`utils/track-mix.ts`), `sameMix` and `loadedTrack` (`interactions/arrangement-view.ts`) and `_writeMix` (`daw-editor.ts`). `stateWithMixerValues` and `writeThrough` are generic. One inherited edge is left as it is: `setTrackPanLaw(t, sameValue, { undoable: false })` returns early, as `setTrackPan` does.

## Left to the builder

Where in `Arrangement.ts` the fill is called (one function over a state, applied wherever tracks are written and in the sources pass); whether the pan stage takes a `PanLaw` or keeps a channel count; the ramp's node calls; test file layout.
