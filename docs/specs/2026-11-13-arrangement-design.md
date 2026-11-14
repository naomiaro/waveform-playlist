# The arrangement: one owner of the tracks and of everything that changes them (#812)

Status: design, not built. Statements about today's code carry a file and line
and were read (a full map of `PlaylistEngine` and its callers was made first,
and two reviews checked earlier drafts against the code); what was run says so.

This replaces "## The provider (PR 2)" of
`2026-11-13-provider-loads-sources-design.md`. From that document these stay
in force: the types (`LoadingClip`, `ArrangementTrack`, `AudioClip.src`),
`createSourceLoader`, `audioTrack()`, the conversion rules of a loading clip,
MIDI as an awaited function.

## Why

The first build kept two owners of the tracks, the app's React state and the
engine, joined by a controlled `tracks` prop and an `onTracksChange` callback.
Three faults in one day had that root: a loaded clip that stayed a loading
clip in the app's state, a lost update (run: the Waveform Data page showed 2,
4 and 3 rows of 4), and an undo that removed from the engine a track the app
still held. A "store" draft then moved the seam to store-and-engine (the
engine kept its own tracks and undo and wrote back) and was rejected in review.

## The rule

**Every piece of state has one owner. Everything else subscribes to it and
changes it by asking the owner.** (Maintainer, 2026-11-13.) It goes into root
`CLAUDE.md` under "Code Conventions" with this work.

## What the code already has

- `PlayoutAdapter` is already a player that only receives: `setTracks`,
  `addTrack?`, `removeTrack?`, `updateTrack?`, the mixer setters, the transport
  calls (`packages/engine/src/types.ts`). It never writes tracks back.
- `PlaylistEngine` already runs with no adapter (`PlaylistEngine.ts:60`), and
  its clip operations are pure functions (`operations/clipOperations.ts`).

What is wrong is who holds the tracks around it:

- The React provider builds a NEW `PlaylistEngine` on every full build
  (`WaveformPlaylistContext.tsx:904`) and feeds it from a `tracks` prop: the
  tracks live in the app's state and in the engine, undo history is lost on
  every rebuild, and the mixer, selection, loop, zoom and master volume are
  carried over by hand (`:912-929`).
- dawcore keeps descriptors, a map of engine-shaped tracks and the engine's
  own tracks, and reconciles them (`daw-editor.ts:443-444`, `:1511-1557`,
  `:2658-2665`). Not changed here.

## Owners after this change

| State | Owner | How others reach it |
| --- | --- | --- |
| The tracks and clips, including clips still loading | the arrangement | `subscribe` / `getTracks()`; its methods |
| Mixer values of a track | the arrangement, in a part of its own, by track id | `getMixer()`; the four setters |
| Undo and redo history, an open transaction | the arrangement | `undo`, `redo`, `beginTransaction` … |
| Which sources are pending, loaded, failed; their buffers | the arrangement's source loader | `arrangement.sources`, `retry` |
| A trim drag in progress | the provider's trim preview (view only) | the dragged clip's view |
| Audio nodes, transport position, play state | the engine and its adapter | as today |
| Selection, loop, zoom, selected track, master volume | the engine | as today |
| Tempo map, sample rate | the adapter / the engine | the engine converts for the arrangement |
| `isReady` | the provider | `usePlaylistTimeline()` |

Derived, not owned (computed from an owner, cached, never written back): the
engine's `getState().tracks`, the view's tracks with placeholders, peaks,
`duration`, `trackStates`, what an adapter holds.

## Goals

- One long-lived object owns the tracks and every change to them. The engine
  plays it and never writes tracks back.
- A clip switches from `LoadingClip` to `AudioClip` in the arrangement the moment
  its source has loaded, for every reader at once.
- No whole-array callback from the library into app state.
- `PlaylistEngine`'s public API keeps working for dawcore.
- The adapters and the view's parts still see `AudioClip` only.
- A subscriber to the arrangement only ever sees committed states.

## Non-goals

- dawcore moving onto a shared arrangement. The maintainer's picture is that
  `<daw-editor>` shares the CODE (a shared instance "could be interesting", not
  a target). The arrangement stays free of React and of anything
  provider-specific; a follow-up issue is filed when the interface is final and
  has to settle who wins between a arrangement and dawcore's declarative DOM.
- View state (selection, loop, zoom, selected track, master volume) leaving
  the engine.
- Keeping the engine alive across a hidden `<Activity>` (#842). The arrangement,
  its buffers and its undo history do survive.
- Reworking how tick and sample positions are kept in step. Today's rule
  stays: a clip without a `startTick` gets one when it enters an engine, and
  `startSample` is re-derived from ticks only on `setTempo`
  (`PlaylistEngine.ts:218, 927-943`). A first draft re-derived on every attach
  and every undo; with the Tone adapter's 192 ppqn that would have snapped
  every clip to a grid of about 125 samples. Known and left: an undo after a
  tempo change restores positions from the old tempo, as on `main`.
- Serializable tracks (#836), a source timeout (#840), mixer moves as undo
  steps (#843), #841 (a reschedule that clicks), #838 (splitting a MIDI clip).

## Anti-goals

- No controlled mode beside the arrangement: `tracks` and `onTracksChange` leave
  `WaveformPlaylistProvider`.
- No second stored copy of the tracks in the React packages.
- No engine method that changes tracks without going through the arrangement.
- No arrangement write during a React render.

## Approaches

1. **A arrangement that owns the tracks and every change; the engine plays it
   (chosen by the maintainer).** The DAWs looked at work this way: one owner,
   every edit through it, a gesture is one undo step (Ardour `HistoryOwner`,
   Nota's gesture rule, Zrythm's preview-then-commit, openDAW's
   `BoxEditing.modify`), and the engine only receives (Nota's published graph,
   openDAW's `apply_updates`).
2. **A store beside an engine that keeps its own tracks and undo.** Rejected
   after review: two owners one level down.
3. **Make `PlaylistEngine` itself the long-lived object.** Not chosen: it would
   make transport and view state long-lived too and change the lifecycle the
   provider's rebuild logic (#675, #811) is written around.

## Decided by the maintainer (2026-11-13)

- The arrangement, and the rule.
- **The name is `Arrangement`** (the DAW word for tracks holding clips on a
  timeline). Not "document" (`document` is the DOM global: a prop or variable
  of that name shadows it) and nothing with "Playlist" in it (#781 drops that
  word from the public names, so a new name carrying it is one more to rename).
  The track type of #839 is renamed to match: `ArrangementTrack`. Existing
  names (`PlaylistEngine`, `WaveformPlaylistProvider`, `usePlaylistTimeline`)
  are #781's and are not renamed here.
- **Structure-only undo.** Mixer values are not undo steps (as today), and an
  undo or redo never changes them. No ability is removed: what goes is the side
  effect that a snapshot captures the mix (`PlaylistEngine.ts:852-854`).
  Mixer moves as undo steps are #843.
- **A trim previews in the view, not in the arrangement.** The drag updates a
  view-only preview that the dragged clip follows; the arrangement changes once,
  on release.
- **Mixer values are a part of the arrangement of their own, by track id.** A
  fader move replaces no track object.
- **The armed track's mute during a take is visible:** recording mutes the
  track through the arrangement and restores it afterwards.
- Carried over: a source added while the engine runs does not stop it; an
  arriving clip is applied in place whatever its position; files dropped on an
  empty timeline play one by one; no source timeout; a loading clip on a MIDI
  track is reported and never fetched; a dropped file that cannot be decoded is
  removed by the example pages and listed; the engine is disposed on every
  cleanup of the provider; recording does not start on a track that holds a
  clip still loading.

## My calls (for the maintainer to confirm or change)

1. **Arriving audio is not an undo step and never clears the history.** It is
   written into the current tracks and into every snapshot the history holds.
   This reverses "arriving audio clears undo" from the first design and is why
   #837 was folded into #812.
2. **`useEngineRefs().isDraggingRef` is removed** (the earlier choice to keep
   it with a setter is moot: a trim no longer holds back the engine).
3. **"Ready" waits for the first sources, once.** The engine is built as soon
   as the provider mounts. `isReady`, `waveform-playlist:ready` and `onReady`
   happen the first time an engine is attached AND every source named at that
   moment has settled; Play does nothing before. Later engine rebuilds are
   ready when the engine is attached, whatever is still loading.
4. **Track changes never rebuild the engine.**
5. **Loading clips cannot be moved, trimmed or split** until they have loaded.
6. **A clip that cannot be made from its audio** (its `offset` is past the end
   of the decoded file, its `duration` is not usable) **stays a loading clip
   and its source is shown as failed** with a message. The arrangement deletes
   nothing the app put in it.
7. **Names:** `Arrangement`, `createArrangement`, the provider prop
   `arrangement`, `useCreateArrangement(init, options?)` to make one for a
   component, `useArrangement()` to read the provider's.
8. The arrangement lives in `@waveform-playlist/engine`. `LoadSource`,
   `defaultLoadSource` and the sources value type move there from browser.
   `packages/recording` gains engine as a dependency.

## The arrangement (`@waveform-playlist/engine`)

```ts
export interface TrackMixerValues {
  volume: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
}

export interface Arrangement {
  // read
  getTracks(): readonly ArrangementTrack[]; // structure; same array until it changes
  getMixer(): ReadonlyMap<string, TrackMixerValues>; // same Map until a value changes
  subscribe(listener: () => void): () => void;
  readonly tracksVersion: number; // structural changes
  readonly mixerVersion: number; // mixer changes

  // whole set (clears the history, as engine.setTracks does today)
  setTracks(tracks: readonly ArrangementTrack[]): void;

  // tracks
  addTrack(track: ArrangementTrack, options?: { undoable?: boolean }): void;
  removeTrack(trackId: string, options?: { undoable?: boolean }): void;
  updateTrack(
    trackId: string,
    next: ArrangementTrack | ((track: ArrangementTrack) => ArrangementTrack),
    options?: { undoable?: boolean }
  ): void;
  reorderTrack(trackId: string, toIndex: number): void;

  // clips (today's engine methods, same contracts and return values)
  moveClip(trackId: string, clipId: string, deltaSamples: number): number;
  trimClip(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): void;
  splitClip(trackId: string, clipId: string, atSample: number): void;
  getClipBounds(trackId: string, clipId: string): ClipBounds | null;
  constrainTrimDelta(trackId: string, clipId: string, boundary: 'left' | 'right', delta: number): number;

  // mixer (not undo steps)
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  setTrackPan(trackId: string, pan: number): void;

  // history
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  undo(): void;
  redo(): void;
  clearHistory(): void;
  beginTransaction(): void;
  commitTransaction(): void;
  abortTransaction(): void;

  // loading
  readonly sources: ValueSource<ArrangementSourcesValue>;
  retry(src: ClipSource): void;
}

export function createArrangement(options?: {
  tracks?: readonly ArrangementTrack[];
  loadSource?: LoadSource;
  undoLimit?: number;
}): Arrangement;
```

Rules (each gets a test; where a rule is today's engine behaviour, the engine
test that pins it moves with it):

- **Immutable.** A change replaces the tracks array and only the track and
  clip objects that changed. A snapshot is a reference to an earlier array.
- **Synchronous.** When a method returns, `getTracks()` / `getMixer()` are the
  new state and subscribers have been told once, in the order the changes were
  made (a listener that writes gets its own change delivered after the one it
  is handling).
- **Validation first.** `assertTrackKind`, unique track ids, and unique clip
  ids within a track are checked before anything changes; a failed check
  throws and leaves everything as it was (the #756 rule). `updateTrack` with
  an unknown id does nothing (today it pushes an undo step and calls the
  adapter; `PlaylistEngine.ts:282-304`).
- **History.** `addTrack`, `removeTrack`, `updateTrack`, `reorderTrack`,
  `moveClip`, `trimClip`, `splitClip` are undo steps unless `undoable: false`.
  `setTracks` clears the history. Transactions keep today's contract: inside
  one, changes push no step; `commit` pushes one step if anything changed;
  `abort` restores the state from before it; other changes made while one is
  open join it, as today. (In React nothing opens a transaction for a trim any
  more; dawcore's drags do.) New: `undo` / `redo` with a transaction open
  abort it first; every history change notifies subscribers, so `canUndo` /
  `canRedo` are never stale (today `commitTransaction` and `clearHistory` emit
  nothing; `PlaylistEngine.ts:121-155`).
- **Clip order inside a track is the arrangement's.** Readers address clips by
  id, never by index.

### The mixer part

- The mixer values of a track live in `getMixer()`, keyed by track id. A track
  that enters (`setTracks`, `addTrack`) seeds its entry from its own `volume`,
  `muted`, `soloed`, `pan` fields unless the arrangement already holds an entry
  for that id. The fields on a track object in `getTracks()` are the values it
  ENTERED with; the current values are in the mixer part. The docs say so, as
  they say today that those fields are starting values.
- A setter replaces the Map and that track's entry, bumps `mixerVersion`,
  notifies, and replaces no track object. A setter for an id the arrangement does
  not hold does nothing.
- `updateTrack` does not change mixer values: the mixer fields of the track it
  is given are ignored once an entry exists.
- **Undo restores structure.** The mixer part is not in a snapshot. The entry
  of a removed track is kept while any snapshot of the history still holds
  that track, so undoing a removal brings the track back with the mix it had.
- `getTracksWithMixer()` is NOT part of the interface. An app that saves a
  session reads both parts.

### Loading and the switch

- The arrangement owns one `createSourceLoader`. The wanted sources are those
  named by the current tracks, by every snapshot of the undo and redo stacks
  and by an open transaction's snapshot, so an undo never starts a fetch for a
  source the history still names and a failed source stays failed until
  `retry`. Loading clips on MIDI tracks are skipped and reported once through
  `sources`. A clip that carries `src` and `audioBuffer` is given to the
  loader (`provide`). The wanted set is re-declared only when it changed.
- When a source becomes `loaded`, the arrangement replaces every `LoadingClip`
  object naming it with its `AudioClip`, in the current tracks and in every
  snapshot it holds, per loading-clip object (the same clip id can be a
  different object in different snapshots) and memoized per track object, so
  snapshots keep sharing the tracks they shared. The conversion is the first
  design's (seconds to integer samples at the BUFFER's rate, same id; a
  duration past the end cut with a warning). One notification. No undo step.
- A clip that cannot be made (call 6) stays a loading clip; `sources` shows
  that source as failed with the reason.
- A failed source changes no track; `retry` restarts it.
- A clip added for a source that is already loaded is resolved in the same
  call.
- `arrangement.sources` covers every wanted source, including ones not yet given
  to the loader (shown as pending).

### Attaching (internal, safe across two copies of the package)

Two things reach the arrangement from outside: a decode context and a time base.
They are methods on the arrangement object under versioned `Symbol.for` keys
(the #679 lesson: browser pins engine exactly, so an app can hold two copies,
and a module-private function of one copy does not know the other's object).

- **Decode context:** `attach(getContext: () => Promise<BaseAudioContext>)`
  returns a detach function. While none is attached nothing is fetched.
  Detaching suspends loads in flight and keeps what has loaded; the next attach
  starts them again. WHO attaches: the owner of the engine's lifetime. The
  React provider does it in a mount-only effect, with a getter that resolves
  to its current adapter's context, so loads continue across an engine
  rebuild. A standalone `PlaylistEngine` given a arrangement attaches in its
  constructor and detaches in `dispose()` unless told that someone else does.
- **Time base:** the engine gives the arrangement `sampleRate` and the two tick
  conversions when it attaches. The arrangement uses them exactly where the
  engine does today: a clip without `startTick` gets one on entry;
  `minDuration` for a trim or split; `recomputeStartSamples()` when the engine
  handles `setTempo`. Without an engine attached, entries are not given ticks
  (they get them at attach) and `minDuration` uses each clip's own
  `sampleRate`.

## `PlaylistEngine` on a arrangement

```ts
new PlaylistEngine({ adapter, arrangement?, … })
```

- Without `arrangement` the engine creates its own. dawcore, the examples and
  every existing caller are unchanged in what they call.
- `_tracks`, the undo stacks, the transaction fields and the two version
  counters leave the engine. Its track, clip, mixer, undo and transaction
  methods delegate and keep their signatures and return values, including
  `skipAdapter` on `moveClip` / `trimClip` (the engine does not forward that
  one change to the adapter) and `updateTrack(id)` with no track (forwards the
  current track to the adapter, as today). The mixer setters keep forwarding
  to the adapter for an id the arrangement does not hold, as dawcore relies on.
- **On construction** the engine gives the arrangement its time base and, when
  the arrangement already holds tracks, calls `adapter.setTracks` with them.
- **Arrangement to adapter.** The engine subscribes. Each change carries what it
  was (`set`, `add`, `remove`, `update`, `reorder`, `restore`, `mixer`, with
  the track ids), and the engine makes the adapter call it makes today for
  that operation, in the same order relative to `statechange`: `add` →
  `addTrack?` else `setTracks`; `remove` → `removeTrack?` else `setTracks`;
  `update` → `updateTrack?` else `setTracks`; `reorder` → nothing; `restore` →
  `updateTrack` for each track that differs when the set of tracks is the
  same, `setTracks` when it changed (as `_restoreTracks` does, `:868-884`,
  except that unchanged tracks are now really skipped); a switch →
  `updateTrack` for each track that gained a clip. What the adapter is given
  is the track without its loading clips and WITH its current mixer values
  merged in.
- **`getState()`** returns `tracks` as that same projection, cached by
  `tracksVersion` and `mixerVersion` (today every `statechange`, including a
  selection or zoom change, copies every track; `:179`). `statechange` is
  emitted for every arrangement change, including history changes.
- `removeTrack` clearing the selected track (`:251-253`) becomes the engine
  reacting to the change.
- One engine per arrangement at a time; a second one attaching warns.

## The provider (`@waveform-playlist/browser`)

```tsx
const arrangement = useCreateArrangement(() => [audioTrack({ src: 'a.mp3', name: 'A' })]);
<WaveformPlaylistProvider arrangement={arrangement}>…</WaveformPlaylistProvider>
```

- Props removed: `tracks`, `onTracksChange`, `loadSource`. Prop added:
  `arrangement` (required). A new `arrangement` object is a new mount of everything
  below; a development warning says so.
- The loading effect loses everything about tracks: the comparison with the
  previous tracks, `incrementalTrackChange`, the "came from the engine" guard,
  the seed, the merge, the echo suppression, the first-load wait, the early
  adapter. It resolves an adapter and builds an engine around `arrangement` when
  the provider mounts and when something that needs a new adapter changes, and
  disposes them in its cleanup. The #675 rules stay: no disposed engine is
  reachable, and a play asked for while a rebuild is in flight starts on the
  new engine (`pendingResumeRef`, `engineEpoch`); the new engine already holds
  the tracks when it is assigned.
- **Ready** (call 3). A flag, set once per provider mount, when an engine is
  attached and no wanted source is pending. Before it: `isReady` false, Play
  does nothing. After it: `isReady` follows "an engine is attached".
- **The decode context** is attached in a mount-only effect (see "Attaching").
- **The view** derives from `arrangement` with `useSyncExternalStore`: the tracks
  without loading clips, plus a placeholder for each loading clip that has a
  `duration` or `waveformData` (the placeholder derivation and
  `ClipPeaks.isPlaceholder` of the first build stay). A mixer change does not
  change this value. `usePlaylistTimeline()` keeps `tracks`, `peaksDataArray`,
  `duration`, `isReady`; `onTracksChange` leaves it.
- **The mixer:** `usePlaylistMixer().trackStates` is derived from
  `arrangement.getMixer()` and the track names; the provider's own map by id and
  the seeding of tracks with it go. The setters call the arrangement. What
  renders on a fader step is what renders today
  (`contextSplitByChangeRate.test.tsx` stays the contract).
- `useUndoRedo()` reads the arrangement. `useArrangementSources()` reads
  `arrangement.sources`.
- Hooks: `useCreateArrangement(init?, { loadSource?, undoLimit? })` (one arrangement
  for the component's life; most apps never import the engine package),
  `useArrangement()` (the provider's arrangement; throws outside a provider),
  `useArrangementTracks(arrangement?)`.

### Drags, split, shortcuts

- **Trim.** The provider holds a trim preview, a `ValueSource` of
  `{ trackId, clipId, startSample, durationSamples, offsetSamples } | null`
  (the `annotationPreview` pattern). `useClipDragHandlers` computes each move
  from the bounds captured at the start, snapped and constrained as today
  (`calculateBoundaryTrim`, `arrangement.constrainTrimDelta`), and publishes it;
  only the dragged clip's view follows the preview. Release: one
  `arrangement.trimClip` with the final delta, and the preview is cleared in the
  same flush. Cancel: the preview is cleared. No transaction, no
  `isDraggingRef`.
- **Move.** One `arrangement.moveClip` on drop, as today, without the
  transaction around it.
- `useClipDragHandlers` takes the arrangement from the provider and loses its
  `tracks`, `onTracksChange`, `engineRef` and `isDraggingRef` options.
- `useClipSplitting` and the keyboard shortcuts call the arrangement and address
  clips by id (`splitClipAt(trackIndex, clipIndex, …)` becomes ids).
- All of them work while no engine is attached (during a rebuild).

### Recording

`useIntegratedRecording(arrangement, …)` takes the arrangement and adds its take with
`updateTrack(id, (track) => …)`, which makes a take an undo step. A loaded clip
is an `AudioClip` in the arrangement, so punch-in carves it. `startRecording`
refuses, through the hook's error state, when the armed track holds a
`LoadingClip`, and says whether it is still loading or failed.

The arm mute is `arrangement.setTrackMute(id, true)` when a take starts and a
restore of the earlier value when it ends, so the track shows as muted during
the take. A user's own mute change during the take is what is kept at the end.

## What an app writes

```tsx
// before (main)
const { tracks, loading } = useAudioTracks(configs, { immediate: true });
const [state, setState] = useState(tracks);
useEffect(() => setState(tracks), [tracks]);
<WaveformPlaylistProvider tracks={state} onTracksChange={setState} deferEngineRebuild={loading}>

// after
const arrangement = useCreateArrangement(() => configs.map(audioTrack));
<WaveformPlaylistProvider arrangement={arrangement}>

arrangement.addTrack(audioTrack({ src: file })); // a dropped file
arrangement.removeTrack(id, { undoable: false }); // a file that failed to decode
const tracks = useArrangementTracks(arrangement); // read, anywhere
const stop = arrangement.subscribe(() => save(arrangement.getTracks(), arrangement.getMixer()));
```

## Behaviour a consumer will notice (for the upgrade guide)

| Before (main) | After |
| --- | --- |
| `tracks` / `onTracksChange` props | `arrangement` prop; edits need no wiring |
| `useAudioTracks`, `useDynamicTracks`, `deferEngineRebuild` | `audioTrack()` in the arrangement |
| A page without `onTracksChange` reverts every edit and warns | edits stay |
| Removing a track, or replacing tracks, rebuilds the engine | an adapter call; the other tracks keep playing |
| Undo history is lost on every engine rebuild, and when a dropped file finishes loading | it is kept |
| Undoing a clip edit can put old volume, pan and mute values back | undo never changes the mix |
| A recorded take rebuilds nothing but is not an undo step of its own | a take is an undo step |
| The armed track is muted during a take without the mixer showing it | the mute button shows it |
| A track's `volume` / `muted` / `soloed` / `pan` fields are starting values; the current ones are in `usePlaylistMixer()` | the same, and `arrangement.getMixer()` outside React |
| Edits and undo do nothing while the engine is being rebuilt | they work |
| `useClipDragHandlers({ tracks, onTracksChange, engineRef, isDraggingRef, … })` | takes the arrangement |
| `useEngineRefs().isDraggingRef` | removed |
| `useIntegratedRecording(tracks, setTracks, …)` | takes the arrangement; refuses over a clip still loading |
| `splitClipAt(trackIndex, clipIndex, time)` | by track id and clip id |
| `statechange` hands listeners freshly copied tracks on every event | the same array until tracks or mix change |
| `engine.updateTrack(id, track)` with an unknown id pushes an undo step | does nothing |
| `engine.undo()` during a transaction ignores it | aborts it first |
| `commitTransaction` and `clearHistory` emit no `statechange` | they do |

## What happens to the first build of PR 2

Branch `feat/812-2-provider-resolution` (not pushed as a PR).

| Piece | Fate |
| --- | --- |
| core: loader, types, `audioTrack` (PR 1, #839) | unchanged |
| `defaultLoadSource`, `LoadSource`, the sources value type | move to the engine package |
| the loading-clip conversion, warn-once, validation (`resolveTracks.ts`) | the conversion moves into the arrangement; the placeholder derivation stays in browser |
| `incrementalTrackChange`, `mergeLoadingClips`, `unappliedClips`, `useMergedTracksChange`, `useSourceLoading`, `useEarlyAdapter`, `useDragFlag`, the echo suppression | go |
| `useDisposeEngineOnUnmount`, the duplicate-id warning (becomes the arrangement's validation), `useReportRejectedClips` | kept |
| `useArrangementSources()` and its context | kept, fed by the arrangement |
| placeholders not editable (`ClipPeaks.isPlaceholder`, `Clip`'s prop, export, controls) | kept; split's skip becomes the arrangement's refusal (call 5) |
| removal of the two hooks; the converted pages, stories, starter | kept; each page swaps `useState` and two props for a arrangement |
| recording's index rule for loading clips | goes |
| the provider tests | the load, arrival, failure, retry, unmount, StrictMode and `<Activity>` cases are re-expressed over a arrangement; the guard, seed and merge cases go |

## PRs

1. #839 as it is (core loader, types, `audioTrack`).
2. **engine: extract the arrangement, code motion only.** `PlaylistEngine`
   delegates to an internal arrangement that still copies snapshots and still
   writes mixer values in place; every engine, browser and dawcore test passes
   unchanged. It adds the tests nobody has today: the adapter calls of `undo`,
   `redo`, `abortTransaction` and `_restoreTracks`.
3. **engine: the arrangement's rules, part a.** Immutability, snapshots by
   reference, the mixer part and structure-only undo, history notifications,
   the unknown-id and undo-in-transaction fixes, the cached `getState`,
   `arrangement` as an engine option with the initial sync. Each behaviour change
   is listed with the dawcore path it touches; dawcore's unit suite and e2e
   run.
4. **engine: part b.** The loader, the switch, history patching, attaching.
5. **browser, recording, examples, docs:** the provider on the arrangement; the
   removals; the trim preview; the upgrade guide; the rule in `CLAUDE.md`.
6. midi: `loadMidiTracks`; `useMidiTracks` removed; the sweep.

## Tests that must exist

- Arrangement alone: every rule above; an arrival then an abort, an arrival then
  an undo, and a track added with a pending clip then undo, redo and the
  arrival, each ending with the clip present and loaded; undo of a removal
  brings back the track's mix; a fader move changes no track object; nothing
  fetched before a decode context is attached; a re-attach restarts suspended
  loads and keeps buffers; a arrangement from a second copy of the module can be
  attached.
- Engine on a arrangement: the adapter receives exactly today's calls for each
  operation (pinned in PR 2); dawcore's move drag (`skipAdapter` moves, then
  `updateTrack(id)`) makes the adapter calls it makes today; a second engine
  built on the same arrangement after the first is disposed plays the same
  tracks with the history and the mix intact.
- Provider: one "ready" per mount after the first sources settle, and a
  rebuild after it that does not wait for a pending drop; a file dropped while
  playing; a source that settles during a trim drag, then release, then
  cancel; removal of a track during playback does not rebuild; a fader step
  renders what it renders today; a trim move renders only the dragged clip's
  view and notifies no arrangement subscriber; unmount on every path; StrictMode;
  a hidden `<Activity>` keeps the history.
- e2e: Waveform Data with every peaks file delayed shows 4 rows of 4; a drop
  while playing; recording refused over a loading clip; punch-in over a clip
  that loaded and was never edited carves it; undo after an arrival keeps the
  arrived clip; Escape during a trim leaves the clip where it was.

## Left to the builder

- The arrangement's internals and the shape of a change description.
- How the engine keeps `statechange` ordering identical in PR 2.
- The placeholder derivation's cache; the test harness.

## Open, for the maintainer

- "My calls" 1 to 8.
- Whether one arrangement may be attached to two engines at once (a React
  provider and a `<daw-editor>` on one page). Not built here; nothing in the
  interface assumes one attacher beyond the warning.
