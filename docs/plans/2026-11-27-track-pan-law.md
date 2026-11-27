# A Track Has a Pan Law of Its Own (#684) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A track's pan law is a mixer value (`panLaw`: `'auto'`, `'mono'` or `'stereo'`) that the track's first decoded audio decides and that clips never change afterwards, readable and settable on every surface.

**Architecture:** The `Arrangement`'s mixer Map is the one owner. `'auto'` is the default of every entry; the arrangement replaces it with the law of the first decoded audio in the same change that brings the audio, in the current state and in every saved state. The engine sends the value to the adapter like `pan`; every renderer (native transport, Tone adapter, both offline exports) resolves it with one core function, `trackPanLaw`.

**Tech Stack:** TypeScript, pnpm workspace, vitest, Web Audio, Tone.js 15, React 19, Lit.

**Spec:** `docs/specs/2026-11-27-track-pan-law-design.md`. Read it first: rules R1 to R11, "What a consumer sees change", "Functions that list the four mixer fields" and the ten calls are requirements of this plan.

## Global Constraints

- Work in the worktree `/Users/naomiaro/Code/waveform-playlist-track-channels`, branch `feat/track-channel-mode-684`. Check `git branch --show-current` before every commit. Never `git commit --amend`; never force-push.
- The whole change is ONE PR (every merge to `dev` publishes `@next`).
- Read the root `CLAUDE.md` and the `CLAUDE.md` of each package a task touches. Load the project skills `unit-testing` (every task), `mutation-testing` (after each task's tests pass: break the guarded line, see the test fail, restore), `react-patterns` (Task 7), `web-component-design` (Task 8), `browser-probes` and `e2e-playwright` (Task 9).
- Downstream packages resolve siblings through `dist`: after changing a package's `src`, run `pnpm --filter <its name> build` before testing or typechecking a package that depends on it.
- Every check (tests, typecheck, lint, build) is its own command; read its result before committing. Commit messages: `feat:` / `test:` / `docs:` plus a body; use `git commit -F - <<'EOF'` when the message has backticks.
- Format only the files you changed: `npx prettier --write <paths>`. Never run prettier on `PROJECT_STRUCTURE.md`, `website/src` or `examples/`.
- Immutable updates only; no cross-package re-exports; one owner per exported name.
- Exact values: `type PanLaw = 'auto' | 'mono' | 'stereo'`; `type DecidedPanLaw = 'mono' | 'stereo'`; the default is `'auto'`; a law switch ramps over `PAN_LAW_RAMP_SECONDS = 0.01`; the attribute is `pan-law`; the setter is `setTrackPanLaw`.
- A value from plain JS that is not one of the three strings counts as `'auto'` when read from a track or an attribute, and throws a `TypeError` when given to `setTrackPanLaw` (which also throws for `'auto'`).
- Do not write this PR's number into any file before `gh pr create` has printed it; refer to #684.

## Review Focus

1. **A track from plain JS with `panLaw: 'bogus'`, `null` or `2`** enters with `'auto'` and nothing throws (Task 3 tests it at entry; Task 1 tests `trackPanLaw`).
2. **A clip that is not loading but has no `audioBuffer`** (built from `waveformData` alone) is not "decoded audio": the track stays `'auto'` until a clip with a buffer arrives (Task 3).
3. **A pan move during or right after a law switch** ends on the matrix of the new law and the new pan; no scheduled ramp overrides it later (Task 2).
4. **An Undo that returns a playing track to `'auto'`, and `setTrackPanLaw` for an id the transport does not hold**: no throw; the transport warns for the unknown id as `setTrackPan` does (Tasks 5 and 6).
5. **The law travels with the track's identity, not its contents**: `updateTrack` to a new id carries it; `setTracks` with the same id and entirely different clips keeps it; with `undoLimit: 0` the fill still happens (Task 3).

---

### Task 0: Prepare the worktree

- [ ] **Step 1:** `cd /Users/naomiaro/Code/waveform-playlist-track-channels && pnpm install` (expected: lockfile unchanged; `git status --short` prints nothing).
- [ ] **Step 2:** `pnpm build` as its own command (expected: every package builds). This checkout is not the one the maintainer's dev server runs in, so port 3000 is not affected; do not build in `/Users/naomiaro/Code/waveform-playlist`.
- [ ] **Step 3:** Baseline, each its own command, output to a file in the session scratchpad: `(cd packages/core && npx vitest run)`, the same for `engine`, `transport`, `playout`, `browser`, `dawcore`. Record the pass counts; a failure here is reported before any change.

### Task 1: core: the `PanLaw` type and `trackPanLaw`

**Files:**

- Create: `packages/core/src/panLaw.ts`, `packages/core/src/__tests__/panLaw.test.ts`
- Modify: `packages/core/src/types/clip.ts` (`ClipTrack`), `packages/core/src/audioTrack.ts`, `packages/core/src/index.ts`, `packages/core/src/__tests__/audioTrack.test.ts`

**Interfaces (produces):**

```ts
// packages/core/src/panLaw.ts
export type PanLaw = 'auto' | 'mono' | 'stereo';
export type DecidedPanLaw = Exclude<PanLaw, 'auto'>;
export const DEFAULT_PAN_LAW: PanLaw = 'auto';
/** True for 'mono' and 'stereo' only (any other value, of any type, is false). */
export function isDecidedPanLaw(value: unknown): value is DecidedPanLaw;
/** The part of a track `trackPanLaw` reads. */
export interface TrackPanLawSource {
  panLaw?: PanLaw;
  clips: ReadonlyArray<{ audioBuffer?: { numberOfChannels: number } }>;
}
/** 'stereo' if any clip has an audioBuffer with 2 or more channels, 'mono' if at least one has a buffer, null if none has. */
export function audioPanLaw(track: Pick<TrackPanLawSource, 'clips'>): DecidedPanLaw | null;
/** The law a renderer uses: the track's own when decided, else audioPanLaw, else 'mono'. */
export function trackPanLaw(track: TrackPanLawSource): DecidedPanLaw;
```

`ClipTrack` gains `panLaw?: PanLaw` with the JSDoc "The pan law this track enters with (default `'auto'`: decided by its first decoded audio). While the track is in an arrangement the arrangement's mixer holds the value." It is NOT added to `TRACK_VIEW_FIELDS`. `AudioTrackOptions` gains `panLaw?: PanLaw`, copied onto the track only when given.

- [ ] **Step 1: Write the failing tests** in `panLaw.test.ts`:

```ts
const buf = (numberOfChannels: number) => ({ audioBuffer: { numberOfChannels } });
it('a decided law wins over the clips', () => {
  expect(trackPanLaw({ panLaw: 'mono', clips: [buf(2)] })).toBe('mono');
  expect(trackPanLaw({ panLaw: 'stereo', clips: [buf(1)] })).toBe('stereo');
});
it("'auto' or no field takes the law from the clips, highest channel count", () => {
  expect(trackPanLaw({ panLaw: 'auto', clips: [buf(1), buf(2)] })).toBe('stereo');
  expect(trackPanLaw({ clips: [buf(1)] })).toBe('mono');
  expect(trackPanLaw({ clips: [] })).toBe('mono');
  expect(trackPanLaw({ clips: [{}] })).toBe('mono'); // MIDI or peaks-only clip
});
it('a value that is not a law counts as auto', () => {
  for (const bad of ['bogus', null, 2, '']) {
    expect(trackPanLaw({ panLaw: bad as never, clips: [buf(2)] })).toBe('stereo');
    expect(isDecidedPanLaw(bad)).toBe(false);
  }
});
it('audioPanLaw is null without a buffer', () => {
  expect(audioPanLaw({ clips: [{}] })).toBeNull();
  expect(audioPanLaw({ clips: [buf(1)] })).toBe('mono');
  expect(audioPanLaw({ clips: [buf(1), buf(6)] })).toBe('stereo');
});
```

and in `audioTrack.test.ts`: `audioTrack({ audioBuffer, panLaw: 'stereo' }).panLaw` is `'stereo'`; without the option the track has no `panLaw` key (`'panLaw' in track` is false).

- [ ] **Step 2:** `(cd packages/core && npx vitest run src/__tests__/panLaw.test.ts src/__tests__/audioTrack.test.ts)`. Expected: FAIL (module not found; `panLaw` undefined).
- [ ] **Step 3:** Implement the file, the `ClipTrack` field, the `audioTrack` option and the exports from `index.ts`.
- [ ] **Step 4:** Run the two files again (PASS), then `(cd packages/core && npx vitest run)` and `pnpm --filter @waveform-playlist/core typecheck`.
- [ ] **Step 5:** Commit: `feat(core): PanLaw and trackPanLaw (#684)`.

### Task 2: the pan stage takes a law, ramps a switch, and every renderer resolves it with `trackPanLaw`

This is one task because changing the stage's signature breaks its six callers.

**Files:**

- Modify: `packages/core/src/panStage.ts`, `packages/core/src/__tests__/panStage.test.ts`
- Modify: `packages/transport/src/audio/track-node.ts`, `packages/transport/src/transport.ts` (the three `trackChannelCount(track)` sites: two `new TrackNode(...)` and `updateTrack`), their tests `track-node.test.ts`, `transport.test.ts`
- Modify: `packages/playout/src/ToneTrack.ts`, `MidiToneTrack.ts`, `SoundFontToneTrack.ts`, `TonePlayout.ts` (`replaceTrackClips`), `TonePlayoutAdapter.ts` (two sites), and their tests
- Modify: `packages/browser/src/hooks/useExportWav.ts` (the pan stage call only; the rest is Task 7), `packages/dawcore/src/interactions/export-audio.ts`

**Interfaces:**

- Consumes: `DecidedPanLaw`, `trackPanLaw` (Task 1).
- Produces:

```ts
export function panMatrix(pan: number, panLaw: DecidedPanLaw): PanMatrix;
export type PanStageContext = Pick<
  BaseAudioContext,
  'createGain' | 'createChannelSplitter' | 'createChannelMerger' | 'currentTime'
>;
export interface PanStage {
  readonly input: AudioNode;
  readonly output: AudioNode;
  setPan(pan: number): void;
  /** Switch the law, keeping the pan. The four gains ramp over PAN_LAW_RAMP_SECONDS. The same law does nothing. */
  setPanLaw(panLaw: DecidedPanLaw): void;
  dispose(): void;
}
export const PAN_LAW_RAMP_SECONDS = 0.01;
export function createPanStage(
  context: PanStageContext,
  pan: number,
  panLaw: DecidedPanLaw
): PanStage;
// transport
class TrackNode {
  constructor(id: string, audioContext: AudioContext, panLaw: DecidedPanLaw = 'mono');
  setPanLaw(panLaw: DecidedPanLaw): void;
}
// playout
interface ToneTrackOptions {
  /** Default 'mono'. */ panLaw?: DecidedPanLaw; /* channelCount is removed */
}
class ToneTrack {
  setPanLaw(panLaw: DecidedPanLaw): void;
}
class TonePlayout {
  replaceTrackClips(trackId, clips, startTime, panLaw?: DecidedPanLaw): boolean;
}
```

`setSourceChannelCount` is removed from `PanStage`, `TrackNode` and `ToneTrack`; `panMatrix` and `createPanStage` no longer take a channel count. These are removals of public API: Task 10 writes the upgrade entry. `trackChannelCount` stays.

The ramp, which the signature does not determine: on a switch, for each of the four gains, with `now = context.currentTime`: `cancelScheduledValues(now)`, `setValueAtTime(gain.value, now)`, `linearRampToValueAtTime(target, now + PAN_LAW_RAMP_SECONDS)`. `setPan` first calls `cancelScheduledValues(now)` on each gain and then sets `.value` (so a pan move after a switch is not overridden by the ramp's end). Construction sets `.value` directly.

Every caller passes `trackPanLaw(track)`; `MidiToneTrack` and `SoundFontToneTrack` pass `'mono'`.

- [ ] **Step 1: Write the failing tests.** In `panStage.test.ts` change the existing channel-count arguments to laws (`1` to `'mono'`, `2` to `'stereo'`) and add, with the file's mock context extended by `currentTime` and by gain params that record `cancelScheduledValues`, `setValueAtTime` and `linearRampToValueAtTime` calls:

```ts
it('a law switch ramps each gain to the new matrix over 10 ms', () => {
  const stage = createPanStage(context, 0, 'mono');
  context.currentTime = 2;
  stage.setPanLaw('stereo');
  const target = panMatrix(0, 'stereo');
  expect(gains.ll.linearRampToValueAtTime).toHaveBeenCalledWith(
    target.ll,
    2 + PAN_LAW_RAMP_SECONDS
  );
  expect(gains.rr.linearRampToValueAtTime).toHaveBeenCalledWith(
    target.rr,
    2 + PAN_LAW_RAMP_SECONDS
  );
});
it('the same law schedules nothing', () => {
  /* setPanLaw('mono') on a mono stage: no ramp call */
});
it('a pan move after a switch cancels the ramp and lands on the new law', () => {
  const stage = createPanStage(context, 0, 'mono');
  stage.setPanLaw('stereo');
  stage.setPan(-1);
  expect(gains.rl.cancelScheduledValues).toHaveBeenCalled();
  expect(gains.rl.value).toBeCloseTo(panMatrix(-1, 'stereo').rl);
});
```

In `track-node.test.ts`, `transport.test.ts`, `ToneTrack.test.ts`, `TonePlayout.test.ts`, `TonePlayoutAdapter.test.ts`: rename the existing channel-count assertions to laws, and add one per package: a track `{ panLaw: 'mono', clips: [stereo clip] }` given to `Transport.setTracks` / the Tone adapter's `setTracks` builds its stage with `'mono'` (today: stereo), and `Transport.updateTrack` with a stereo clip added to a `panLaw: 'mono'` track does not switch the stage.

- [ ] **Step 2:** Run `(cd packages/core && npx vitest run src/__tests__/panStage.test.ts)`. Expected: FAIL.
- [ ] **Step 3:** Implement core; `pnpm --filter @waveform-playlist/core build`.
- [ ] **Step 4:** Update transport, playout, the two exports. Grep to confirm nothing is left: `git grep -n -w -e setSourceChannelCount -e channelCount -- packages website/src examples` (expected: no pan-stage use; `channelCount` in recording and the pan stage's own `upmix.channelCount` remain).
- [ ] **Step 5:** `pnpm build`, then each as its own command: vitest in `core`, `transport`, `playout`, `browser`, `dawcore`; `pnpm typecheck`.
- [ ] **Step 6:** Commit: `feat!: the pan stage takes a pan law and ramps a switch (#684)`.

### Task 3: engine: the mixer value, first-audio and `setTrackPanLaw` on the arrangement

**Files:**

- Modify: `packages/engine/src/arrangement/mixer.ts`, `history.ts`, `Arrangement.ts`, `types.ts`
- Create: `packages/engine/src/__tests__/arrangementPanLaw.test.ts`
- Modify: any existing engine test that builds a `TrackMixerValues` literal or compares one with `toEqual` (run the suite to find them)

**Interfaces:**

- Consumes: `PanLaw`, `DecidedPanLaw`, `isDecidedPanLaw`, `audioPanLaw`, `DEFAULT_PAN_LAW`, `trackKind` from core.
- Produces:

```ts
// mixer.ts
export interface TrackMixerValues { volume: number; muted: boolean; soloed: boolean; pan: number; panLaw: PanLaw; }
/** R3: the track's own field when decided; else, for an audio track, audioPanLaw; else 'auto'. */
export function mixerValuesOf(track: ArrangementTrack): TrackMixerValues;
/** R4: each audio track whose entry is 'auto' and that holds decoded audio gets its law. The same Map when nothing changes. */
export function decidePanLaws(mixer: Mixer, tracks: readonly ArrangementTrack[]): Mixer;
// history.ts
/** A state whose mixer is decidePanLaws of its own tracks; the same state when nothing changes; states that shared a Map go on sharing one. */
export function stateWithDecidedPanLaws(): (state: SavedState) => SavedState;
// Arrangement (class and the `Arrangement` interface in types.ts)
setTrackPanLaw(trackId: string, panLaw: DecidedPanLaw, options?: MixerChangeOptions): void;
```

Extend `sameValues`, `mixerChanges` and the equality check of `withMixerValues` with `panLaw` (spec, "Functions that list the four mixer fields").

Where the fill runs in `Arrangement.ts`: (a) after `seedMixer`/`mixerOf` in `setTracks`, `addTrack`, `updateTrack` (seeding covers a new id; `decidePanLaws` covers an id that already had an `'auto'` entry); (b) in `_replaceTrack` and wherever else `_tracks` is assigned outside a restore (read every assignment of `this._tracks`); (c) in `_switchLoaded`, after the tracks pass, over the current mixer, and with `stateWithDecidedPanLaws()` mapped over `_history`, `_gesture.before` and the open transaction's state, followed by `dropRepeats` exactly as `_writeMixerThrough` does (including its gesture repair). When (c) changes the current mixer, `_mixerVersion` is incremented; no `'mixer'` change is emitted (the tracks change that carried the audio is the announcement, and the adapter receives the law in the track it is sent).

`setTrackPanLaw`: throws `new TypeError("setTrackPanLaw: panLaw must be 'mono' or 'stereo', got …")` before anything else when `!isDecidedPanLaw(panLaw)`; does nothing for a MIDI track; otherwise `this._setMixerValues(trackId, { panLaw }, options)`.

- [ ] **Step 1: Write the failing tests** in `arrangementPanLaw.test.ts`. Build tracks as `arrangementLoading.test.ts` does (`createTrack`, `createClip`, a `LoadingClip` literal, its way of resolving a source); a decoded clip of `n` channels is `createClip({ audioBuffer: { numberOfChannels: n, sampleRate: 48000, length: 48000, duration: 1 } as AudioBuffer, … })`. With `law = (id) => arrangement.getMixer().get(id)?.panLaw`:

| Test name                                       | Arrange and act                                                                                            | Assert                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| an empty track enters with auto                 | `addTrack` empty audio track                                                                               | `law('t') === 'auto'`                                                                                      |
| a track enters with the law of its audio        | `addTrack` with a 1-channel clip; another with 1- and 2-channel clips                                      | `'mono'`; `'stereo'`                                                                                       |
| the track's own field wins at entry             | `addTrack({ panLaw: 'mono', clips: [stereo] })`                                                            | `'mono'`                                                                                                   |
| a field that is not a law enters as auto        | `panLaw: 'bogus' as never`, no clips                                                                       | `'auto'`, no throw                                                                                         |
| first audio decides, in the same undo step      | empty track; `updateTrack` adding a mono clip; `undo()`; `redo()`                                          | `'mono'`; `'auto'`; `'mono'`; `canUndo` false after one more `undo()` past the add                         |
| a clip of the other kind changes nothing        | mono track; `updateTrack` adding a stereo clip                                                             | `'mono'`; `mixerVersion` unchanged by the second update                                                    |
| the last stereo clip leaving changes nothing    | track with mono + stereo clips (`'stereo'`); `removeClip` the stereo one                                   | `'stereo'`                                                                                                 |
| an emptied track keeps its law                  | mono track; remove every clip; add a stereo clip                                                           | `'mono'`                                                                                                   |
| a clip without a buffer is not audio            | track whose only clip has `waveformData` and no `audioBuffer`                                              | `'auto'`; then a buffered clip decides                                                                     |
| a MIDI track stays auto and ignores the setter  | `kind: 'midi'` track; `setTrackPanLaw`                                                                     | `'auto'`; `canUndo` unchanged                                                                              |
| setTrackPanLaw is a mixer move                  | mono track; `setTrackPanLaw('t','stereo')`                                                                 | `'stereo'`; `tracksVersion` same; `mixerVersion` +1; `getTracks()[0]` same object; `undo()` gives `'mono'` |
| set before audio pins the law                   | empty track; `setTrackPanLaw('t','stereo')`; add a mono clip                                               | `'stereo'`                                                                                                 |
| an unchanged value or unknown id does nothing   |                                                                                                            | no step, no version change                                                                                 |
| a bad value throws before anything changes      | `setTrackPanLaw('t', 'auto' as never)`, `'bogus'`, `undefined`                                             | `TypeError`; `canUndo`, versions unchanged                                                                 |
| gesture and undoable:false work as for pan      | two calls with one `gesture`; one with `undoable: false`                                                   | one step; no step and Undo does not bring the old law back                                                 |
| a resolving clip decides the law in every state | track with one loading stereo clip; make an unrelated undo step (rename another track); resolve the source | `'stereo'` now; after `undo()` still `'stereo'`; resolving pushed no step                                  |
| two loads: the first to resolve decides         | loading mono `M` and stereo `S`; resolve `M`, then `S`                                                     | `'mono'` after both                                                                                        |
| a saved state is filled from its own tracks     | spec, "A saved state with other clips"                                                                     | current `'mono'`; after `undo()` `'stereo'`                                                                |
| a step the fill makes a no-op is dropped        | only loading stereo `S`; `setTrackPanLaw('t','stereo')` (`canUndo` true); resolve `S`                      | `canUndo` false                                                                                            |
| the law follows the id                          | `updateTrack('t', { ...track, id: 'u' })`                                                                  | `law('u')` is the old law, `law('t')` undefined                                                            |
| setTracks with the same id keeps the law        | mono track; `setTracks([same id, only a stereo clip])`                                                     | `'mono'`                                                                                                   |
| the fill needs no history                       | `createArrangement({ undoLimit: 0 })`, first audio                                                         | decided                                                                                                    |
| inside a transaction                            | `beginTransaction`; add first audio; `abortTransaction`                                                    | `'auto'` after the abort                                                                                   |

- [ ] **Step 2:** `(cd packages/engine && npx vitest run src/__tests__/arrangementPanLaw.test.ts)`. Expected: FAIL.
- [ ] **Step 3:** Implement `mixer.ts` and `history.ts`, then `Arrangement.ts` and `types.ts`.
- [ ] **Step 4:** Run the new file (PASS), then `(cd packages/engine && npx vitest run)` with the output in a scratchpad file. Fix existing tests whose literals lack `panLaw` (a test that asserts an exact mixer entry gains `panLaw`; do not loosen it to `toMatchObject`).
- [ ] **Step 5:** Mutation check: remove the `decidePanLaws` call in `_switchLoaded`, then in `updateTrack`, then the `panLaw` line of `sameValues` and of `mixerChanges`; each must fail at least one test; restore each.
- [ ] **Step 6:** `pnpm --filter @waveform-playlist/engine typecheck`; commit: `feat(engine): the pan law is a mixer value the first audio decides (#684)`.

### Task 4: engine: the adapter is sent the law

**Files:**

- Modify: `packages/engine/src/types.ts` (`PlayoutAdapter`), `adapterSync.ts`, `PlaylistEngine.ts`, `packages/engine/src/__tests__/helpers/recordingAdapter.ts`
- Create: `packages/engine/src/__tests__/adapterPanLaw.test.ts`

**Interfaces:**

- Consumes: Task 3.
- Produces:

```ts
interface PlayoutAdapter {
  /** A track's pan law changed. 'auto': take it from the track's clips (core's trackPanLaw).
   *  Optional: without it the engine sends the track through updateTrack (or setTracks). */
  setTrackPanLaw?(trackId: string, panLaw: PanLaw): void;
}
class PlaylistEngine {
  setTrackPanLaw(trackId: string, panLaw: DecidedPanLaw, options?: MixerChangeOptions): void;
}
```

`sendMixerValues`: when `values.panLaw !== undefined`, call `adapter.setTrackPanLaw` if the adapter has it; otherwise send the projected track the way `sendTrack`-style code just above `sendMixerValues` does (`updateTrack` if present, else `sendAllTracks()`). `PlaylistEngine.setTrackPanLaw` is `this._mixerChanged(() => this._arrangement.setTrackPanLaw(trackId, panLaw, options))` and nothing else: unlike the other four it does NOT call the adapter when the arrangement changed nothing (spec, call 9). Update the comment block above the setters to say so.

- [ ] **Step 1: Write the failing tests** (`recordingAdapter` records calls; give it `setTrackPanLaw` and an option to build it without, and without `updateTrack`):

| Test name                                               | Assert                                                                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the projection carries the entry's law                  | after first audio, the track the adapter was last sent has `panLaw: 'mono'`; `engine.getState().tracks[0].panLaw === 'mono'`; an empty track is sent `panLaw: 'auto'` |
| the track's own field never shows through               | a track entered while its id already had a `'mono'` entry, carrying `panLaw: 'stereo'`, is sent `'mono'`                                                              |
| setTrackPanLaw makes one adapter call and no track call | calls are exactly `[['setTrackPanLaw', 't', 'stereo']]`; one `statechange`                                                                                            |
| undo of a law sends the old one                         | `['setTrackPanLaw', 't', 'mono']`                                                                                                                                     |
| undo back to auto sends auto                            | empty track; set `'stereo'`; `undo()`                                                                                                                                 | `['setTrackPanLaw', 't', 'auto']` |
| an adapter without the method gets updateTrack          | one `updateTrack('t', track)` with `track.panLaw === 'stereo'`                                                                                                        |
| an adapter with neither gets setTracks                  | one `setTracks`                                                                                                                                                       |
| an unchanged value makes no adapter call                | calling it twice: one call in total; an unknown id: none                                                                                                              |
| first audio makes no setTrackPanLaw call                | only the track call that carries the clip                                                                                                                             |
| a bad value throws and calls nothing                    | `TypeError`; no adapter call                                                                                                                                          |

- [ ] **Step 2:** Run the file. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** New file PASS; whole engine suite; `pnpm --filter @waveform-playlist/engine typecheck`; `pnpm --filter @waveform-playlist/engine build`.
- [ ] **Step 5:** Mutation check the `panLaw` line of `sendMixerValues` and the fallback branch. Commit: `feat(engine): setTrackPanLaw reaches the adapter (#684)`.

### Task 5: transport: `setTrackPanLaw`

**Files:** Modify `packages/transport/src/transport.ts`, `adapter.ts`; tests `transport.test.ts`, `adapter.test.ts`.

**Interfaces (produces):** `Transport.setTrackPanLaw(trackId: string, panLaw: PanLaw): void` and the same on `NativePlayoutAdapter`.

Behaviour: an unknown id warns `'[waveform-playlist] setTrackPanLaw: unknown trackId "…"'` and returns (as `setTrackPan`). Otherwise the stored track becomes `{ ...track, panLaw }` (a new object in a new `_tracks` array) and the node gets `setPanLaw(trackPanLaw(thatTrack))`. It does not touch the clip player (no `_silenceTrack`).

- [ ] **Step 1: Failing tests:** a mono-clip track; `setTrackPanLaw(id, 'stereo')` switches the node's stage to `'stereo'`; then `'auto'` switches it back to `'mono'` (from the clips); the clip player's `updateTrack` is not called (spy); an unknown id warns and does not throw; a later `updateTrack(id, sameTrackWith panLaw 'stereo')` keeps `'stereo'`; the adapter forwards.
- [ ] **Step 2:** Run (FAIL). **Step 3:** Implement. **Step 4:** `(cd packages/transport && npx vitest run)`; typecheck; `pnpm --filter @dawcore/transport build`.
- [ ] **Step 5:** Commit: `feat(transport): setTrackPanLaw (#684)`.

### Task 6: playout: the Tone adapter's `setTrackPanLaw`

**Files:** Modify `packages/playout/src/TonePlayoutAdapter.ts`; test `TonePlayoutAdapter.test.ts`.

**Interfaces (produces):** `setTrackPanLaw(trackId: string, panLaw: PanLaw): void` on the object `createToneAdapter` returns.

Behaviour, after the pattern of `setTrackPan` in the same file: the `_currentTracks` entry becomes `{ ...existing, panLaw }`; `playout?.getTrack(trackId)?.setPanLaw(trackPanLaw(updated))`. An id with no entry or no audio `ToneTrack` (a MIDI track) does nothing.

- [ ] **Step 1: Failing tests:** as Task 5 (switch, back to `'auto'`, unknown id silent, MIDI track untouched), plus: a rebuild (`setTracks` again with the engine's projection carrying `'stereo'`) keeps `'stereo'`.
- [ ] **Step 2:** Run (FAIL). **Step 3:** Implement. **Step 4:** `(cd packages/playout && npx vitest run)`; typecheck; `pnpm --filter @waveform-playlist/playout build`.
- [ ] **Step 5:** Commit: `feat(playout): the Tone adapter's setTrackPanLaw (#684)`.

### Task 7: browser: the state, the setter, `useTrack()` and the export

**Files:**

- Modify: `packages/browser/src/WaveformPlaylistContext.tsx` (`TrackState`, the editor-controls value near lines 1405 and 1435), `contexts/playlistContexts.ts` (beside `setTrackPan`), `providerInternals/useArrangementEditing.ts`, `providerInternals/useArrangementView.ts` (`DEFAULT_MIX`, `sameState`, `deriveTrackStates`), `components/trackContext.ts`, `components/TrackControlsColumn.tsx`, `hooks/useExportWav.ts`
- Test: `packages/browser/src/__tests__/trackPanLaw.test.tsx` (create), `exportWavDirectCall.test.tsx`, `mixerStateByTrackId.test.tsx`

**Interfaces (produces):**

```ts
export interface TrackState { name: string; muted: boolean; soloed: boolean; volume: number; pan: number; panLaw: PanLaw; }
// useEditorControls()
setTrackPanLaw: (trackId: string, panLaw: DecidedPanLaw, options?: MixerChangeOptions) => void;
// useTrack()
panLaw: PanLaw;
setPanLaw: (panLaw: DecidedPanLaw, options?: MixerChangeOptions) => void;
// useExportWav.ts: its local TrackState gains `panLaw?: PanLaw` (optional: a direct caller may omit it)
```

`setTrackPanLaw` in `useArrangementEditing` follows `setTrackPan` (the `isTrackId` guard, `MixerSetter` union extended) and calls `arrangement.setTrackPanLaw`. A `TypeError` from the arrangement propagates to the caller.

Export (spec R11): the law of a rendered track is `state.panLaw` when `isDecidedPanLaw(state.panLaw)`, else `trackPanLaw(track)`; the `stateOf` fallback adds `panLaw: tracks[index].panLaw`. `outputChannels` is 2 when any audible track has the stereo law by that rule or `trackChannelCount(track) >= 2`, else 1.

- [ ] **Step 1: Failing tests** (mount with `renderWithArrangement` from `__tests__/helpers/arrangementProvider.tsx`):
  - `usePlaylistMixer().trackStates[0].panLaw` is `'auto'` for an empty track and `'mono'` after a mono clip is added; the state object keeps its identity across an unrelated render and is a new object after `setTrackPanLaw`.
  - `useEditorControls().setTrackPanLaw(id, 'stereo')` changes it; `useUndoRedo().undo()` restores `'mono'`; a non-string id is ignored with the one warning.
  - `useTrack()` inside a control panel exposes `panLaw` and `setPanLaw`.
  - Export, in `exportWavDirectCall.test.tsx`'s style (it observes `createPanStage` calls or the rendered buffer; follow what the file does): mono clips with `trackStates[0].panLaw === 'stereo'` use the stereo law and write 2 channels; a stereo clip with state `'mono'` uses the mono law and still writes 2 channels; a caller that passes no `trackStates` gets `trackPanLaw(track)`; mono clips, state `'auto'`: 1 channel (as today).
- [ ] **Step 2:** Run (FAIL). **Step 3:** Implement.
- [ ] **Step 4:** `(cd packages/browser && npx vitest run)` to a scratchpad log (the suite also runs `oneOwnerPerExport` and the lint-rule tests); `pnpm --filter @waveform-playlist/browser typecheck`; `git grep -n -w trackStates -- website/src examples | head` and read each hit that builds a `TrackState` literal (nothing typechecks `website/src`).
- [ ] **Step 5:** Commit: `feat(browser): panLaw in the track state, setTrackPanLaw, and the export follows it (#684)`.

### Task 8: dawcore: `<daw-track pan-law>`, the live `panLaw` property and the export

**Files:**

- Modify: `packages/dawcore/src/utils/track-mix.ts` (`DEFAULT_TRACK_MIX`, `mixOfTrack`, `mixOfElement`, `pickMix`, `withMix`), `interactions/arrangement-view.ts` (`sameMix`, `loadedTrack`), `interactions/element-links.ts` (`TrackLinkValues`), `elements/daw-track.ts` (`_declared`, `TRACK_PROPS`, a new property), `elements/daw-editor.ts` (`_writeMix`, `_writeMixFields`, the `addTrack` mix near line 3510, `updateTrack` near line 3620, `TrackConfig`), `interactions/track-entry.ts` if it names the fields, `interactions/export-audio.ts`
- Test: `packages/dawcore/src/__tests__/daw-track-pan-law.test.ts` (create), `export-audio.test.ts`, `daw-editor-mixer-undo.test.ts`

**Interfaces (produces):**

```ts
// <daw-track>
@property({ attribute: 'pan-law', noAccessor: true })
get panLaw(): PanLaw;            // the arrangement's value while the track is in it; the declaration otherwise
set panLaw(value: PanLaw);       // a request, like `pan`
// TrackConfig (editor.addTrack / updateTrack)
panLaw?: PanLaw;
```

Rules: the declaration is read from the attribute as a law only when it is `mono` or `stereo`; `auto`, an empty value and no attribute are `'auto'`; any other value is `'auto'` with one `console.warn('[dawcore] <daw-track pan-law> must be "mono", "stereo" or "auto", got "…"')`. A request with `'auto'` (property set or `updateTrack({ panLaw: 'auto' })`) on an entered track is ignored (the editor does not call `setTrackPanLaw` with it); with a value that is not one of the three it is ignored with the same warning; neither throws into the page. The library writes no attribute. `export-audio.ts` keeps `trackPanLaw(track)`, which is right once `loadedTrack` carries the mix's `panLaw`.

- [ ] **Step 1: Failing tests** (follow `daw-track.test.ts` and `daw-editor-mixer-undo.test.ts` for mounting and for giving the editor an arrangement and decoded audio):
  - `<daw-track pan-law="stereo">` with a mono clip: `track.panLaw === 'stereo'` after entry and the arrangement's entry is `'stereo'`.
  - No attribute, mono audio: `track.panLaw` is `'auto'` before the audio and `'mono'` after; `track.getAttribute('pan-law')` stays `null`.
  - `track.panLaw = 'stereo'` on an entered track: the arrangement's entry changes, one undo step; `editor.undo()` gives `'mono'` and the attribute is untouched.
  - `pan-law="bogus"`: `'auto'`, one warning. `track.panLaw = 'auto'` on a decided track: no change, no throw.
  - `editor.addTrack({ …, panLaw: 'stereo' })` and `editor.updateTrack(id, { panLaw: 'stereo' })`.
  - `loadedTrack` returns a new view when only `panLaw` differs (the cache must not serve the old one).
  - Export: a mono clip on a track whose mix is `'stereo'` is rendered with `createPanStage(ctx, pan, 'stereo')`.
- [ ] **Step 2:** Run (FAIL). **Step 3:** Implement.
- [ ] **Step 4:** `(cd packages/dawcore && npx vitest run)`; `pnpm --filter @dawcore/components typecheck`; `pnpm --filter @dawcore/components build`.
- [ ] **Step 5:** Commit: `feat(dawcore): pan-law on daw-track and in the export (#684)`.

### Task 9: full checks, and the measurement in a browser

- [ ] **Step 1:** `pnpm build` (own command). **Step 2:** `pnpm typecheck`. **Step 3:** `pnpm lint` (exit 0, 0 errors; no file this branch changed among the warning paths: root `CLAUDE.md`, "ESLint Baseline"). **Step 4:** vitest in each of the six packages, each its own command.
- [ ] **Step 5: Measure, on both backends.** Load `browser-probes`. Serve from THIS worktree: `pnpm exec vite --config examples/dawcore-native/vite.config.ts --port 5391 --strictPort`, measure, stop it, then the same for `examples/dawcore-tone` on port 5392 (one at a time: they share a dep cache). Write an ad-hoc Playwright script in the session scratchpad that, on each page: builds a track with one centred mono clip (a generated 1-channel buffer of a constant 0.5 or a sine), taps the output with an `AnalyserNode` or renders through the page's context, and records the RMS per channel: (a) alone; (b) after a stereo clip is added to the track; (c) after it is removed; (d) after `setTrackPanLaw(id, 'stereo')` during playback, also checking the clip's source was not restarted (the playhead and the audio continue); (e) after `undo()`. Expected: (a) = (b) = (c) within 0.001; (d) is (a) × √2 within 0.005; (e) = (a). Then compare an offline export with live for the `'stereo'`-pinned mono track (difference within 0.001). Run the same script against `dev` for (a) to (c) to show the old step (the spec quotes 0.2501 to 0.3537): check out `dev`'s `packages/*/src` under the running example server as root `CLAUDE.md` describes, measure, restore.
- [ ] **Step 6:** Check `<daw-track pan-law>` once in Chromium on the native example: declared law, the live property after first audio, a set during playback.
- [ ] **Step 7:** React page: `lsof -nP -iTCP:3000 -sTCP:LISTEN` first; start this worktree's site with `cd website && pnpm exec docusaurus start --port 3077 --no-open`; on a multitrack example call the setter from the console or a probe and repeat (a), (b), (d). Then, with a clean tree and nothing editing source, `PORT=3077 pnpm test` (the whole e2e suite; `website/static/storybook` must exist in this worktree: link it from the main checkout). All green, or failure rates compared with `dev`.
- [ ] **Step 8:** Record every number measured, with "measured in a throwaway script" beside it, for the PR text. No commit unless a fix was needed (a fix gets its failing test first).

### Task 10: documentation, the upgrade entry and the changeset

**Files:** every surface in the spec's "Documentation" section, plus `.changeset/track-pan-law.md` and `.changeset/shared-pan-stage.md`.

- [ ] **Step 1: The guide.** In `website/docs/react/guides/effects.md`, replace the paragraph "A track that mixes mono and stereo clips is panned with the stereo law…" with the new rule in plain words: a track takes its law from the first audio it holds and keeps it; what a clip of the other kind then does (−3 dB at centre and no fold for a stereo clip under the mono law; +3 dB at centre for a mono clip under the stereo law); how to read and set it (`useTrack().panLaw` / `setPanLaw`, `audioTrack({ panLaw })`); the two-files-loading case and its fix. Add a short "Pan law" subsection to `website/docs/react/guides/track-management.md` beside the pan example, with a two-button control using `useTrack()`. Check every sentence against the source line it describes.
- [ ] **Step 2: The upgrade entry** in `website/docs/react/upgrading.md`, one section, in that page's format: what changed (the rows marked "yes" in the spec's table, as a list); **Find:** nothing to search for in app code, except custom adapters (`implements PlayoutAdapter`), direct `createPanStage(` / `panMatrix(` / `setSourceChannelCount(` calls and `ToneTrackOptions.channelCount`, and code that builds a `TrackState` object; **Replace with:** before/after for each (channel count `1` to `'mono'`, `2` to `'stereo'`; `setSourceChannelCount(n)` to `setPanLaw(…)`; add `panLaw` to a built `TrackState`; an adapter reads `trackPanLaw(track)` and may add `setTrackPanLaw`). Check the "Before" halves against `git show dev:<file>`.
- [ ] **Step 3: Reference surfaces:** `website/docs/llm-reference.md` (every interface touched: `TrackState`, the editor controls, `useTrack`, `PlayoutAdapter`, `Arrangement`, `PanStage`, `createPanStage`, `panMatrix`, `trackPanLaw`, `PanLaw`, `AudioTrackOptions`, `ClipTrack`), `website/static/llms.txt`, `website/docs/react/api/hooks.md` (the spec's `website/docs/api/hooks.md` does not exist; this is the file), the provider API page listing the mixer setters, `website/docs/examples.md` if it shows a `TrackState`.
- [ ] **Step 4: READMEs and notes:** `packages/transport/README.md` ("Pan" section and the adapter method list), `packages/core/README.md` (the pan stage section and the export table), `packages/engine/README.md` (mixer setters, "The mix is separate from the tracks", the `PlayoutAdapter` listing, the `Arrangement` listing), `packages/dawcore/README.md` and `COMPONENTS.md`, the root `README.md` if it lists track options; `CLAUDE.md` of core (the `trackChannelCount` and pan-stage paragraphs, and a line in "Key Patterns": the pan law is a mixer value, `'auto'` until first audio), engine, transport, playout; `packages/transport/TRANSPORT.md`; `packages/browser/notes/effects-and-export.md` ("Pan law from source", "Output channels from source"); `packages/dawcore/notes/effects.md`; dawcore's `<daw-track>` entry; the attribute table of `docs/specs/web-components-migration.md`; `PROJECT_STRUCTURE.md` by hand if it describes the pan law. Then grep for leftovers, each its own command: `git grep -n -i -e 'pan law follows' -e 'source material' -e 'setSourceChannelCount' -e 'sourceChannelCount' -- . ':!**/CHANGELOG.md' ':!docs/plans' ':!docs/specs/2026-11-27-track-pan-law-design.md'` and read every hit.
- [ ] **Step 5: Changesets.** `.changeset/track-pan-law.md` naming every package whose `src` changed: `@waveform-playlist/core`, `engine`, `playout`, `browser` at `major` (removed pan-stage API in core; a required field on `TrackMixerValues` and `TrackState`; `ToneTrackOptions.channelCount` removed), `@dawcore/transport` and `@dawcore/components` at `patch` (zerover). Body: the rule, the rows that change what is heard, the new API, the removed API. In `.changeset/shared-pan-stage.md` correct the sentences that describe the law following the clips and the removed signatures. `git grep -n -i -e 'pan law' -e trackChannelCount -e sourceChannelCount -- .changeset` and read every hit.
- [ ] **Step 6:** `pnpm --filter website build` (own command; CSS calc warnings are expected; a broken link fails it). `npx prettier --check` on each changed Markdown file under `website/docs`, `packages/*/` and `.changeset` (not `PROJECT_STRUCTURE.md`).
- [ ] **Step 7:** Commit: `docs: the per-track pan law (#684)`.

### Task 11: finish

- [ ] **Step 1:** `git rm docs/specs/2026-11-27-track-pan-law-design.md docs/plans/2026-11-27-track-pan-law.md`; commit `docs: remove the working documents of #684`.
- [ ] **Step 2:** Re-run Task 9 steps 1 to 4 on the final tree, each its own command.
- [ ] **Step 3:** Stop and report to the maintainer before pushing: what was run and its numbers, what was only read, each of the spec's ten calls as built, and any behaviour found on the way that the spec does not cover. Opening the PR, the review rounds (skill `review-rounds`), `revise-claude-md`, rewriting the body of #684 and the merge are the maintainer's go-ahead, not part of this plan.
