# The playlist document: one owner of the tracks and of everything that changes them (#812)

Status: design, not built. Statements about today's code carry a file and line
and were read (a full map of `PlaylistEngine` and its callers was made first);
what was run says so.

This replaces "## The provider (PR 2)" of
`2026-11-13-provider-loads-sources-design.md` and an earlier "store" draft of
this file. From the first document these stay in force: the types
(`LoadingClip`, `PlaylistTrack`, `AudioClip.src`), `createSourceLoader`,
`audioTrack()`, the conversion rules of a loading clip, MIDI as an awaited
function.

## Why

The first build kept two owners of the tracks, the app's React state and the
engine, joined by a controlled `tracks` prop and an `onTracksChange` callback.
Three faults in one day had that root: a loaded clip that stayed a loading
clip in the app's state, a lost update (run: the Waveform Data page showed 2,
4 and 3 rows of 4), and an undo that removed from the engine a track the app
still held. A "store" draft then moved the seam to store-and-engine: the
engine still kept its own tracks and undo and wrote back, and a review named
four ways that write-back deletes things.

## The rule

**Every piece of state has one owner. Everything else subscribes to it and
changes it by asking the owner.** (Maintainer, 2026-11-13.) It goes into root
`CLAUDE.md` under "Code Conventions" with this work.

## What the code already has

- `PlayoutAdapter` is already a player that only receives: `setTracks`,
  `addTrack?`, `removeTrack?`, `updateTrack?`, the mixer setters, the transport
  calls (`packages/engine/src/types.ts`). It never writes tracks back.
- `PlaylistEngine` already runs with no adapter at all
  (`_adapter` may be null; `PlaylistEngine.ts:60`).
- Its clip operations are pure functions (`operations/clipOperations.ts`:
  `constrainClipDrag`, `constrainBoundaryTrim`, `splitClip`, `canSplitAt`).

What is wrong is who holds the tracks around it:

- The React provider builds a NEW `PlaylistEngine` on every full build
  (`WaveformPlaylistContext.tsx:904`) and feeds it from a `tracks` prop, so the
  tracks live in the app's state and in the engine, undo history is lost on
  every rebuild, and selection, loop, zoom, master volume and the mixer are
  carried over by hand (`:912-929`).
- dawcore keeps descriptors, a map of engine-shaped tracks and the engine's
  own tracks, and reconciles them (`daw-editor.ts:443-444`, `:1511-1557`,
  `:2658-2665`).

## Owners after this change

| State | Owner | How others reach it |
| --- | --- | --- |
| The tracks and clips, including clips still loading | the document | `subscribe` / `getTracks`; its methods |
| Mixer values of a track (`volume`, `muted`, `soloed`, `pan`) | the document (they are track fields) | the same |
| Undo and redo history, an open gesture | the document | `undo`, `redo`, `beginTransaction` … |
| Which sources are pending, loaded, failed; their buffers | the document's source loader | `document.sources` |
| Audio nodes, transport position, play state | the engine and its adapter | as today |
| Selection, loop, zoom, selected track, master volume | the engine (as today) | as today |
| A tempo map | the adapter (as today) | the engine hands conversions to the document |

## Goals

- One long-lived object owns the tracks and every change to them. The engine
  plays it and never writes tracks back.
- A clip switches from `LoadingClip` to `AudioClip` in the document the moment
  its source has loaded, for every reader at once.
- No whole-array callback from the library into app state.
- `PlaylistEngine`'s public API keeps working for dawcore unchanged.
- The adapters and the view's parts still see `AudioClip` only.

## Non-goals

- dawcore moving onto a shared document. The maintainer's picture is that
  `<daw-editor>` shares the CODE (a shared instance "could be interesting", not
  a target). This change keeps the document free of React and of anything
  provider-specific so that it can; a follow-up issue is filed when the
  interface is final and has to settle who wins between a document and
  dawcore's declarative DOM.
- View state (selection, loop, zoom, selected track, master volume) leaving
  the engine. It is still carried over by hand when React rebuilds an engine.
- Keeping the engine alive across a hidden `<Activity>` (#842). The document,
  its loaded buffers AND its undo history do survive, which removes most of
  what #842 lists.
- Serializable tracks (#836), a source timeout (#840), undoable mixer moves.
- Fixing #841 (a reschedule that clicks) and #838 (splitting a MIDI clip).

## Anti-goals

- No controlled mode beside the document: `tracks` and `onTracksChange` leave
  `WaveformPlaylistProvider`.
- No second stored copy of the tracks anywhere in the React packages.
- No engine method that changes tracks without going through the document.

## Approaches

1. **A document that owns the tracks and every change; the engine plays it
   (chosen by the maintainer).** All five DAWs looked at work this way: one
   owner, every edit through it, a gesture is one undo step with begin, end
   and abort (Ardour `HistoryOwner`, Nota's gesture rule, Zrythm's
   preview-then-commit, openDAW's `BoxEditing.modify` / `mark` / `checkpoint`),
   and the engine only receives (Nota's published graph, openDAW's
   `apply_updates`).
2. **A store beside an engine that keeps its own tracks and undo.** Rejected
   after review: the same two owners one level down.
3. **Make `PlaylistEngine` itself the long-lived object** (it is already
   headless-capable). Not chosen: it would also make transport and view state
   long-lived, and it changes the lifecycle the provider's rebuild logic
   (#675, #811) is written around. Extracting the document leaves that
   lifecycle as it is: a new engine is built around the same document.

## Decided by the maintainer

- The document (2026-11-13), and the rule.
- Carried over: a source added while the engine runs does not stop it; an
  arriving clip is applied in place whatever its position; no source timeout;
  a loading clip on a MIDI track is reported and never fetched; a dropped file
  that cannot be decoded is removed by the example pages and listed; the
  engine is disposed on every cleanup of the provider; recording does not
  start on a track that holds a clip still loading.

## My calls (for the maintainer to confirm or change)

1. **Mixer values are owned by the document.** They are not undo steps (as
   today), and an undo or redo no longer changes them: it restores structure
   and keeps each track's current mixer values. (Today a snapshot captures
   them, so an undo can put old values back into the engine;
   `PlaylistEngine.ts:852-854`.)
2. **Arriving audio is not an undo step and never clears the history.** It is
   written into the current tracks and into every snapshot the history holds.
   This reverses "arriving audio clears undo" from the first design and closes
   #837, because with one owner it is the simpler behaviour to build.
3. **A gesture is the document's transaction.** A trim changes the document on
   every pointer move inside an open transaction; the engine does not push
   track changes to the adapter while one is open, and pushes the net change
   at commit. `isDraggingRef`, the drag flag and previewing through app state
   go away. (This makes the earlier `isDraggingRef` choice moot: the ref is
   removed from `useEngineRefs()`.)
4. **The engine is built at once; "ready" waits for the first sources.** There
   is no first-load wait in front of the engine build any more. `isReady`,
   `waveform-playlist:ready` and `onReady` happen when the engine exists AND
   every source named at that moment has settled; Play does nothing before.
   What a user sees is what was decided (one "ready", rows shown while
   loading); what changes is that clips reach the adapter as they load.
5. **Track changes never rebuild the engine.** Adding, removing and updating a
   track are adapter calls, as dawcore already makes them. A full rebuild is
   left for what it is needed for: a new adapter (effects, sample rate,
   `createAdapter`).
6. **Loading clips cannot be edited** (moved, trimmed, split) until they have
   loaded; the operations refuse them as they refuse an unknown clip.
7. **Names:** `PlaylistDocument`, `createPlaylistDocument`, the provider prop
   `playlist`, `useCreatePlaylist(init)` to make one for a component and
   `usePlaylist()` to read the provider's.
8. The document lives in `@waveform-playlist/engine` (the operations are
   there, and dawcore already depends on it). `LoadSource`,
   `defaultLoadSource` and the sources value type move there from browser.

## The document (`@waveform-playlist/engine`)

```ts
export interface PlaylistDocument {
  // read
  getTracks(): readonly PlaylistTrack[]; // same array until something changes
  subscribe(listener: () => void): () => void;
  readonly tracksVersion: number; // structural changes
  readonly mixerVersion: number; // mixer changes

  // whole set (clears the history, as engine.setTracks does today)
  setTracks(tracks: readonly PlaylistTrack[]): void;

  // tracks
  addTrack(track: PlaylistTrack, options?: { undoable?: boolean }): void;
  removeTrack(trackId: string, options?: { undoable?: boolean }): void;
  updateTrack(
    trackId: string,
    next: PlaylistTrack | ((track: PlaylistTrack) => PlaylistTrack),
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
  readonly sources: ValueSource<PlaylistSourcesValue>;
  retry(src: ClipSource): void;
}

export function createPlaylistDocument(options?: {
  tracks?: readonly PlaylistTrack[];
  loadSource?: LoadSource;
  undoLimit?: number;
}): PlaylistDocument;
```

Rules (each gets a test; where a rule is today's engine behaviour the existing
engine test moves with it):

- **Immutable.** Every change replaces the tracks array and only the track and
  clip objects that changed. The mixer setters replace the track object (today
  they write in place, `PlaylistEngine.ts:761-785`). A snapshot is therefore a
  reference to an earlier array, not a copy.
- **Synchronous.** After any method returns, `getTracks()` is the new state
  and subscribers have been told once.
- **Validation first.** `assertTrackKind`, unique track ids and unique clip ids
  within a track are checked before anything changes; a failed check throws
  and leaves tracks, history and subscribers untouched (the #756 rule).
  `updateTrack` with an unknown id does nothing (today it pushes an undo step
  and calls the adapter; `PlaylistEngine.ts:282-304`).
- **History.** `addTrack`, `removeTrack`, `updateTrack`, `reorderTrack`,
  `moveClip`, `trimClip`, `splitClip` are undo steps unless `undoable: false`
  or a transaction is open. Inside a transaction no step is pushed; `commit`
  pushes one step for the whole gesture if anything changed, `abort` restores
  the state from before it. `undo` / `redo` with a transaction open abort it
  first (today they ignore it). `setTracks` clears the history and aborts an
  open transaction. Every history change notifies subscribers, so `canUndo` /
  `canRedo` are never stale (today `commitTransaction` and `clearHistory` emit
  nothing; `PlaylistEngine.ts:121-155`).
- **Undo restores structure, not the mix.** A restored track takes the
  `volume`, `muted`, `soloed` and `pan` of the current track with its id.
- **A listener that writes** during a notification is allowed; every listener
  is called after each change with the latest state readable through
  `getTracks()`.

### The time base

Clip positions carry `startTick` (authoritative) and `startSample` (derived),
and converting needs the sample rate and the tempo map, which belong to the
engine and its adapter. The document holds a time base it is GIVEN:

```ts
// engine-internal, not part of the public interface
setTimeBase(document, { sampleRate, secondsToTicks, ticksToSeconds }): void;
```

- Before an engine attaches: the engine's own defaults (48000 Hz, 120 bpm,
  960 ppqn; `PlaylistEngine.ts:58, 90-92`).
- When it is set or changes (an engine attaches, `setTempo`): clips without a
  `startTick` get one, and clips with one get their `startSample` re-derived.
  Not an undo step. The same re-derivation runs on every restored snapshot, so
  an undo after a tempo change no longer brings back positions from the old
  tempo (today it does; `PlaylistEngine.ts:927-943` against `:868-884`).
- `minDuration` for a trim or split is `floor(0.1 * sampleRate)` of the time
  base, as today (`:373`).

### Loading and the switch

- The document owns one `createSourceLoader`. After every change of the tracks
  it declares the sources they name (`provide` for a clip that carries `src`
  and `audioBuffer`, then `setWanted`), skipping loading clips on MIDI tracks
  (reported once through `sources`).
- When a source becomes `loaded`, the document replaces every `LoadingClip`
  naming it with its `AudioClip`: in the current tracks, in every snapshot of
  the undo and redo stacks, and in the snapshot of an open transaction. The
  conversion is the first design's (seconds to integer samples at the BUFFER's
  rate, same id; a duration past the end cut with a warning; an unusable clip
  left out with a warning). One notification. No undo step.
- A failed source changes no track; `sources` shows it; `retry` restarts it.
- A clip added for a source that is already loaded is resolved in the same
  call.
- Because snapshots are patched, no undo, redo or abort can bring back a
  loading clip for audio the document holds, or drop a clip because its audio
  arrived (the three history cases the review named).
- The decode context: `attachDecodeContext(document, getContext)` (internal),
  called by the engine when it has an adapter; detaching (engine disposed)
  suspends loads in flight and keeps what has loaded. While none is attached
  the document does not call `setWanted`, so nothing is fetched; `sources`
  shows the named sources as pending.

## `PlaylistEngine` on a document

```ts
new PlaylistEngine({ adapter, document?, … })
```

- Without `document` the engine creates its own. dawcore, the examples and
  every existing caller are unchanged.
- `_tracks`, `_undoStack`, `_redoStack`, the transaction fields,
  `_tracksVersion` and `_mixerVersion` leave the engine. Its track, clip,
  mixer, undo and transaction methods delegate to the document and keep their
  signatures and return values (`moveClip`'s and `trimClip`'s `skipAdapter`
  argument stays for dawcore).
- **Document to adapter.** The engine subscribes to the document. Each change
  carries what it was (`set`, `add`, `remove`, `update`, `reorder`, `restore`,
  `mixer`, with the track ids), and the engine makes the adapter call it makes
  today for that operation, in the same order relative to `statechange`
  (`add` → `adapter.addTrack?` else `setTracks`; `update` → `updateTrack?`;
  `reorder` → nothing; `restore` → `updateTrack` for the tracks that differ,
  now really only those, since snapshots share unchanged track objects).
  The adapter is given `AudioClip`s only: a track's loading clips are left out.
- **While a transaction is open** the engine makes no track call on the
  adapter. At commit it calls `updateTrack` once for each track the gesture
  changed; at abort it calls nothing. (`skipAdapter` during a move plus
  `updateTrack(id)` on drop is what dawcore does by hand today;
  `clip-pointer-handler.ts:263, 358`.)
- **`getState().tracks`** is the document's tracks without loading clips, the
  same array until something changes (today every `statechange`, including a
  selection or zoom change, copies every track; `PlaylistEngine.ts:179`).
  `statechange` is emitted when the document changes, as now.
- The engine sets the document's time base and decode context when it is
  constructed, and detaches both in `dispose()`. `removeTrack` clearing the
  selected track (`:251-253`) becomes the engine reacting to the change.
- One engine per document at a time; a second one attaching warns.

## The provider (`@waveform-playlist/browser`)

```tsx
const playlist = useCreatePlaylist(() => [audioTrack({ src: 'a.mp3', name: 'A' })]);
<WaveformPlaylistProvider playlist={playlist}>…</WaveformPlaylistProvider>
```

- Props removed: `tracks`, `onTracksChange`, `loadSource` (an option of
  `createPlaylistDocument`). Prop added: `playlist` (required).
- The loading effect loses everything about tracks: the comparison with the
  previous tracks, `incrementalTrackChange`, the "came from the engine" guard,
  the seed, the merge, the echo suppression, the first-load wait, the early
  adapter. It builds an adapter and an engine around `playlist` when the
  provider mounts and when something that needs a new adapter changes, and
  disposes them in its cleanup. The #675 rules (no disposed engine reachable,
  a queued play starts on the new engine) stay as they are.
- **Ready** (call 4): `isReady` is true when an engine is attached and no
  source the document names is pending. It turns true once per engine build;
  sources named later do not turn it false.
- The view derives from `playlist` through `useSyncExternalStore`: the tracks
  without loading clips plus a placeholder for each loading clip that has a
  `duration` or `waveformData` (the placeholder derivation and
  `ClipPeaks.isPlaceholder` of the first build stay). `usePlaylistTimeline()`
  keeps `tracks`, `peaksDataArray`, `duration`, `isReady`; `onTracksChange`
  leaves it.
- The mixer: `usePlaylistMixer().trackStates` is derived from the document's
  tracks (a selector on `mixerVersion`); the provider's own map by id and the
  seeding of tracks with it go. The four setters call the document.
- `useUndoRedo()` reads the document; undo history survives an engine rebuild
  and a hidden `<Activity>`.
- `usePlaylistSources()` keeps its value; it reads `playlist.sources`.
- Hooks: `useCreatePlaylist(init?)` (one document for the component's life),
  `usePlaylist()` (the provider's document; throws outside one),
  `usePlaylistTracks(playlist?)` (its tracks, by subscription).

### Drags, split, shortcuts

- `useClipDragHandlers` takes the document (from the provider) and loses its
  `tracks`, `onTracksChange` and `isDraggingRef` options.
  - Trim: `beginTransaction` at the start; `trimClip` with the pointer's delta
    on every move (each move is computed from the bounds captured at the
    start, as today); `commitTransaction` on release; `abortTransaction` on
    cancel.
  - Move: unchanged in shape (`beginTransaction`, one `moveClip` on drop,
    commit or abort).
- `useClipSplitting` and the keyboard shortcuts call the document.
- Reordering tracks calls `reorderTrack` as now.

### Recording

`useIntegratedRecording(playlist, …)` takes the document (the recording package
depends on engine through core types only; the plan confirms the dependency it
needs and that it stays free of browser). It adds its take with
`updateTrack(id, (track) => …)`. Because a loaded clip is an `AudioClip` in the
document, punch-in carves it. `startRecording` refuses, through the hook's
error state, when the armed track holds a `LoadingClip`, and says whether it
is still loading or failed.

The arm mute during a take is not a document change (it would be saved and
undone as the user's own mute): it is a playout override on the engine. The
plan names the method; today it is `engine.setTrackMute` with a restore
(`WaveformPlaylistContext.tsx:389-395`).

## What an app writes

```tsx
// before (main)
const { tracks, loading } = useAudioTracks(configs, { immediate: true });
const [state, setState] = useState(tracks);
useEffect(() => setState(tracks), [tracks]);
<WaveformPlaylistProvider tracks={state} onTracksChange={setState} deferEngineRebuild={loading}>

// after
const playlist = useCreatePlaylist(() => configs.map(audioTrack));
<WaveformPlaylistProvider playlist={playlist}>

playlist.addTrack(audioTrack({ src: file })); // a dropped file
playlist.removeTrack(id, { undoable: false }); // a file that failed to decode
const tracks = usePlaylistTracks(playlist); // read, anywhere
const stop = playlist.subscribe(() => save(playlist.getTracks())); // outside React
```

## Behaviour a consumer will notice (for the upgrade guide)

| Before (main) | After |
| --- | --- |
| `tracks` / `onTracksChange` props | `playlist` prop; edits need no wiring |
| `useAudioTracks`, `useDynamicTracks`, `deferEngineRebuild` | `audioTrack()` in the document |
| A page without `onTracksChange` reverts every edit and warns | edits stay |
| Removing a track, or replacing tracks, rebuilds the engine | an adapter call; playback of the other tracks goes on |
| Undo history is lost on every engine rebuild, and when a dropped file finishes loading | it is kept |
| Undo can put old volume, pan and mute values back | undo never changes the mix |
| A selection or zoom change hands `statechange` listeners freshly copied tracks | the same array until tracks change |
| `useClipDragHandlers({ tracks, onTracksChange, isDraggingRef, … })` | takes the document |
| `useEngineRefs().isDraggingRef` | removed |
| `useIntegratedRecording(tracks, setTracks, …)` | takes the document; refuses over a clip still loading |
| `engine.updateTrack(id, track)` with an unknown id pushes an undo step | does nothing |
| `engine.undo()` during a drag ignores the drag | aborts it first |

## What happens to the first build of PR 2

Branch `feat/812-2-provider-resolution` (not pushed).

| Piece | Fate |
| --- | --- |
| core: loader, types, `audioTrack` (PR 1, #839) | unchanged |
| `defaultLoadSource`, `LoadSource`, the sources value type | move to the engine package |
| the loading-clip conversion, warn-once, validation (`resolveTracks.ts`) | the conversion moves into the document; the placeholder derivation stays in browser |
| `incrementalTrackChange`, `mergeLoadingClips`, `unappliedClips`, `useMergedTracksChange`, `useSourceLoading`, `useEarlyAdapter`, `useDragFlag`, the echo suppression | go |
| `useDisposeEngineOnUnmount`, the duplicate-id warning (moves to the document), `useReportRejectedClips` | kept |
| `usePlaylistSources()` and its context | kept, fed by the document |
| placeholders not editable (`ClipPeaks.isPlaceholder`, `Clip`'s prop, export, controls) | kept; split's skip moves into the document's rule 6 |
| removal of the two hooks; the converted pages, stories, starter | kept; each page swaps `useState` and two props for a document |
| recording's index rule for loading clips | goes (a take is added through the document) |
| the provider tests | the first-load, arrival, failure, retry, unmount, StrictMode and `<Activity>` cases are re-expressed over a document; the guard, seed and merge cases go |

## PRs

1. #839 as it is.
2. **engine: extract the document, no behaviour change.** `PlaylistEngine`
   delegates to an internal `PlaylistDocument`; the engine's 232 tests, and
   the browser and dawcore suites, pass unchanged, and a new test file drives
   the document alone. The only code moved is bookkeeping; the rules above
   that CHANGE behaviour are not in this PR.
3. **engine: the document's own rules.** Immutable mixer writes, undo keeps
   the mix, history notifications, the unknown-id and transaction fixes, the
   time base, transaction-deferred adapter sync, loading and the switch with
   history patching, `document` as an engine option. Each behaviour change is
   listed with the dawcore path it touches, and dawcore's e2e runs.
4. **browser, recording, examples, docs:** the provider on the document.
5. midi.

## Tests that must exist

- Document alone: every rule above; the three history cases (an arrival, then
  abort; an arrival, then undo; a track added with a pending clip, undo, redo,
  then the arrival); two appends from two promise callbacks both land; nothing
  fetched before a decode context is attached; a re-attach restarts suspended
  loads and keeps buffers.
- Engine on a document: the adapter receives exactly today's calls for each
  operation (pin them first: no engine test covers the adapter calls of undo
  and redo today); no track call while a transaction is open; one
  `updateTrack` per changed track at commit; a second engine built on the same
  document after the first is disposed plays the same tracks with the history
  intact.
- Provider: one "ready" per build after the first sources settle; a file
  dropped while playing; a source that settles during a trim gesture, then
  release, then cancel; removal of a track during playback does not rebuild;
  unmount on every path; StrictMode; a hidden `<Activity>` keeps the history.
- e2e: Waveform Data with every peaks file delayed shows 4 rows of 4; a drop
  while playing; recording refused over a loading clip; punch-in over a clip
  that loaded and was never edited carves it; undo after an arrival keeps the
  arrived clip.

## Left to the builder

- The document's internals and the shape of a change description.
- How the engine keeps `statechange` ordering identical in PR 2.
- The placeholder derivation's cache.
- The test harness.

## Open, for the maintainer

- "My calls" 1 to 8.
- Whether one document may be attached to two engines at once (a React
  provider and a `<daw-editor>` on one page). Not built here; nothing in the
  interface assumes one attacher beyond the warning.
