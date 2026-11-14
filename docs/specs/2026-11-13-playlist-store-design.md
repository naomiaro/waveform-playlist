# The playlist store: one owner of the tracks (#812, replaces the provider design of PR 2)

Status: design, not built. Statements about today's code were read from it or
from the reviews of the first build; what was run says so.

This document replaces "## The provider (PR 2)" of
`2026-11-13-provider-loads-sources-design.md`. That document's types, loader,
`audioTrack()` and its decisions about loading (first-load wait, a source added
later, undo, placeholders, MIDI) stay in force unless this one says otherwise.

## Why

The first build of PR 2 kept the provider controlled: the app owns `tracks` in
React state, the engine owns its own copy, and `onTracksChange` hands whole
arrays back. In one day that produced three faults with one root:

- A clip that had loaded stayed a loading clip in the app's state until an
  edit happened to come back. Anything working on the app's state (the
  recording hook, app code reading `durationSamples`) saw stale clips.
- A lost update (run in a browser: the Waveform Data page ended with 2, 4 and
  3 rows of 4): the provider echoed the app's own add with an array from the
  last render and overwrote an append queued in between.
- Undo removes from the engine a track the app still holds, when the app does
  not store what comes back.

A merge, a seed, a "keep it loading" helper, an "engine-held baseline" and an
echo suppression were written to keep the two owners in step. Each closed one
case.

## The rule this design applies

**Every piece of state has one owner. Everything else subscribes to it and
changes it by asking the owner.** (Maintainer, 2026-11-13.) It goes into root
`CLAUDE.md` under "Code Conventions" with this work, and the tracks are its
worked case in `packages/browser/CLAUDE.md`.

Owners in this design:

| State | Owner | Readers |
| --- | --- | --- |
| The tracks and their clips (the document) | the playlist store | the provider, the app, the recording hook |
| Which sources are pending, loaded, failed; their buffers | the store's source loader | `usePlaylistSources()`, the store itself |
| Audio nodes, transport, playback position | the engine and its adapter | the provider |
| Mixer state by track id, selection, zoom, loop | the provider (as today) | context hooks |
| Undo history | the engine (as today; see "Undo") | `useUndoRedo()` |

## Goals

- One owner of the tracks: a store created outside React. The app reads it by
  subscribing and changes it through the store.
- A clip switches from `LoadingClip` to `AudioClip` in the store at the moment
  its source has loaded, once, for every reader at the same time.
- No whole-array callback from the library into app state. Nothing to merge,
  nothing to echo, nothing to overwrite.
- The engine, the adapters, the peaks and the view's parts still see
  `AudioClip` only.

## Non-goals

- Moving undo into the store (#837 would follow from it; not now).
- Keeping the engine alive across a hidden `<Activity>` (#842). The store and
  its loaded buffers do survive it, which this design gets for free.
- A granular document with per-field transactions as openDAW has. The store
  holds immutable tracks and replaces what changed.
- Serializable tracks (#836). The store makes it easier; it is not built.
- dawcore using the store. The maintainer's picture (2026-11-13) is that
  `<daw-editor>` shares the store's CODE: it keeps three copies of its tracks
  today (`_tracks` descriptors, `_engineTracks`, the engine's) and reconciles
  them by hand. Sharing one store INSTANCE between a React provider and a
  `<daw-editor>` "could be interesting" and is not a target. So: the store
  stays free of React and of anything provider-specific, its one tie to audio
  is the decode context that the engine's owner attaches, and nothing in it may
  assume a single kind of attacher. A follow-up issue is filed when this
  interface is final; it has to settle who wins between the store and
  dawcore's declarative DOM (`<daw-clip src>` attributes).

## Anti-goals

- No controlled mode beside the store. `tracks` and `onTracksChange` are
  removed from `WaveformPlaylistProvider`, not kept as an alternative: a second
  way to own the tracks is the fault this design removes.
- No copy of the store's tracks in React state inside the library.
- No store method that takes a value computed from an earlier read without a
  functional form: every write can be expressed as `(previous) => next`.

## Approaches

1. **A store that owns the tracks (chosen by the maintainer).** openDAW's sync
   model at the size this library needs: one object, `subscribe` /
   `getSnapshot`, writes through methods; the same shape as `EffectsRack` and
   `ValueSource` in this codebase.
2. **Keep the controlled prop, switch the clip on load** through a per-clip
   event the app applies with a functional update. Two owners remain, and with
   them the merge and the undo fault.
3. **One clip type that never switches** (the app's clip always names its
   source, geometry in seconds). Clean, but it reverses the integer-samples
   decision for the app-side document and changes every consumer of a clip.
   Left to #836.

## Decided by the maintainer

- The store (2026-11-13). The rule above.
- Carried over from the first design and the build: `LoadingClip` in seconds,
  `AudioClip` with `src`, `audioTrack()`, `createSourceLoader`; only the tracks
  the provider's FIRST build sees wait for every source; a provider with no
  tracks builds at once and later sources arrive one by one; a source added
  while the engine runs does not stop it; an arriving clip is applied in place
  whatever its position; arriving audio clears the undo history (#837);
  the engine is disposed on every cleanup of the provider (#842); no source
  timeout (#840); `isDraggingRef` keeps its place and type; a loading clip on
  a MIDI track is reported and never fetched; a dropped file that cannot be
  decoded is removed by the example pages and listed.
- Recording does not start on a track that holds a clip still loading.

## My calls (for the maintainer to confirm or change)

1. The store is the only way to give the provider tracks (anti-goal 1).
2. The write API is one method, `setTracks(next | (previous) => next)`, which
   is what every converted example page already writes against React state.
   No `addTrack` / `removeTrack` / `updateClip` family: one way to write.
3. A convenience hook creates a store for a component:
   `usePlaylistStore(() => initialTracks)`.
4. Undo stays in the engine for now.
5. The store lives in core (`createPlaylistStore`), the React bindings in browser.
6. A failed source's clip stays a `LoadingClip` in the store (there is no audio
   to make an `AudioClip` from); `usePlaylistSources()` says which failed.
7. Names: `createPlaylistStore`, `PlaylistStore`, `usePlaylistStore`,
   `usePlaylistTracks`.

## The store (core)

```ts
export interface PlaylistStore {
  /** The tracks now. The same array until something changes. */
  getTracks(): readonly PlaylistTrack[];
  /** Call `listener` after every change. Returns the function that removes it. */
  subscribe(listener: () => void): () => void;
  /** Replace the tracks, or derive them from the current ones. */
  setTracks(
    next: readonly PlaylistTrack[] | ((previous: readonly PlaylistTrack[]) => readonly PlaylistTrack[])
  ): void;
  /** Loading status of every source the tracks name. `ValueSource` shape. */
  readonly sources: ValueSource<PlaylistSourcesValue>;
  /** Start a failed source again. */
  retry(src: ClipSource): void;
}

export function createPlaylistStore(options?: {
  tracks?: readonly PlaylistTrack[];
  loadSource?: LoadSource;
}): PlaylistStore;
```

- `subscribe` / `getTracks` fit `useSyncExternalStore`.
- `setTracks` is synchronous: `getTracks()` returns the new array on the next
  line. A functional update always sees the latest tracks, so two appends from
  two promise callbacks both land (the Waveform Data case).
- The store validates what it is given at this boundary: a non-array, a track
  without an `id`, duplicate track ids and a loading clip without `id` or
  `src` are reported (duplicate ids: one development warning, as now; the
  others throw), so a bad write fails where it is made.

### Loading and the switch

- The store owns one `createSourceLoader`. After every change of the tracks it
  declares the sources they name (`provide` for a clip that carries `src` and
  `audioBuffer`, then `setWanted`), skipping loading clips on MIDI tracks.
- When a source becomes `loaded`, the store replaces every `LoadingClip` that
  names it with its `AudioClip` (the conversion of the first design: seconds
  to integer samples at the BUFFER's rate, same id, `audioBuffer`, `src`, the
  display fields; a duration past the end cut with a warning; an unusable clip
  left out with a warning) and notifies subscribers once. Structural sharing:
  only the tracks that held such a clip are new objects; the others, and every
  other clip, keep their identity.
- A failed source changes no track. `sources` publishes the failure; `retry`
  restarts it.
- A clip removed while its source is pending: the load is aborted when no
  other clip names the source; a late result changes nothing.
- A `setTracks` that adds a loading clip for a source that is already loaded
  resolves it in the same call, so no reader ever sees a loading clip for audio
  the store holds.

### The decode context

The loader needs an `AudioContext`, which belongs to the engine's adapter. The
store has an internal attachment point (not part of the public interface,
exported from core under a name that says so, used by the provider):
`attachDecodeContext(store, getContext: () => Promise<BaseAudioContext>)`
returns a detach function. While nothing is attached, wanted sources stay
pending and nothing is fetched. On detach (the provider's cleanup) loads in
flight are suspended and loaded buffers are kept; the next attach starts the
suspended ones again. This is where the hidden-`<Activity>` and StrictMode
cases are handled, once.

The `loadSource` option of the store replaces the provider's `loadSource` prop.

## The provider (browser)

```tsx
const store = usePlaylistStore(() => [audioTrack({ src: 'a.mp3', name: 'A' })]);
<WaveformPlaylistProvider store={store}>…</WaveformPlaylistProvider>
```

- Props removed: `tracks`, `onTracksChange`, `loadSource`. Prop added: `store`
  (required). A change of the `store` prop's identity is a full rebuild and is
  warned about in development (it is almost always an accident).
- `usePlaylistStore(init?)` (browser, usable outside a provider): creates one
  store for the component's life (`useState(() => createPlaylistStore(…))`).
  An app that needs the store outside React calls `createPlaylistStore`
  itself, at module level or in its own state container.
- `usePlaylistTracks(store?)`: the store's tracks for a component, by
  `useSyncExternalStore`. Inside a provider the argument is optional (the
  provider's store, from context). `usePlaylistStore()` with no argument inside
  a provider returns the provider's store.
- `usePlaylistSources()` keeps its value and its meaning; it reads
  `store.sources`. Outside a provider: `useSyncExternalStore` on `store.sources`.
- `usePlaylistTimeline()` keeps `tracks` (now derived, below), `peaksDataArray`,
  `duration`, `isReady`. `onTracksChange` leaves that value.

### From the store to the view and the engine

The provider subscribes to the store (`useSyncExternalStore`) and derives, in
one pure function with a cache (what `resolveTracks` becomes, much smaller):

- `engineTracks`: the store's tracks without their loading clips. A track with
  no loading clip is the store's own object.
- `viewTracks`: the same, plus a placeholder `AudioClip` for each loading clip
  that has a `duration` or `waveformData`, and `placeholderIds`.

The engine effect is the one the first build ends with, on `engineTracks`:
the first-build wait, `incrementalTrackChange` (`added`, `filled` including a
track that gained a clip), the full build, the early adapter, the dispose on
unmount. What it loses: the "tracks came from the engine" guard, the seed, the
engine-held baseline, the merged callback and the echo suppression.

### From the engine back to the store

One internal function, `commitEngineTracks(engineTracks)`, called from the
engine's statechange when `tracksVersion` moved. It writes to the store with
ONE `setTracks((previous) => …)`: for each engine track, the engine's clips
plus the loading clips `previous` holds for that track id that are not among
them (a pending clip is unknown to the engine); tracks the engine no longer
has are removed; order is the engine's. While the provider applies a store
change TO the engine, statechanges are not committed back (one flag around the
application, as `suppressTracksMirrorRef` does today for fills).

The provider then receives its own store write through the subscription. It
recognises it without a guard: the derived `engineTracks` are, object for
object, what the engine reported, and the effect compares against that.

Edits therefore need no app wiring at all: a move, trim, split, undo or redo
lands in the store; a page that never stored `onTracksChange` (and was warned
"UI will revert") simply works.

### A trim drag

Today each pointer move of a trim writes copies of the view's tracks to the
app's state for visual feedback, and the release commits to the engine.
`useClipDragHandlers` keeps its `tracks` and `onTracksChange` options (it is a
public hook); `ClipInteractionProvider` passes it the provider's view tracks
and an internal preview writer. That writer puts the preview into the store
through the same merge as an engine commit (placeholders removed, loading
clips kept), flagged so the engine effect leaves it alone until the release
(`isDraggingRef`, as today). A source that loads during the drag switches its
clip in the store at once; the engine gets it on release (the drag flag's
release signal, as built).

Per move this publishes to the store's subscribers, as it writes app state
per move today. A preview layer that subscribers do not see (as annotations
have) is a later improvement, not part of this.

### Undo

Undo stays in the engine. Its snapshots hold engine tracks, so an undo or redo
comes back through `commitEngineTracks` like any edit, and pending loading
clips are kept by that merge. A track the app adds is an undo step in the
engine as today; Undo removes it from the engine and therefore from the store,
which is now simply correct: the app's view of the tracks IS the store.
Arriving audio clears the history, as decided (#837).

### Recording

`useIntegratedRecording()` no longer takes `tracks` and `setTracks`: it reads
the provider's store and writes with `store.setTracks((previous) => …)`.
Because a loaded clip is an `AudioClip` in the store, punch-in carves it like
any clip. `startRecording` refuses, through the hook's existing error state,
when the armed track holds a `LoadingClip` (still loading, or failed): the
message says which. `packages/recording` then needs the store from browser's
context; today it does not import browser: the plan settles whether the hook
takes the store as an argument (`useIntegratedRecording(store, …)`) or the
package gains the peer. Proposed: the argument, so the package stays as it is.

### MIDI (PR 3)

`loadMidiTracks(src, options)` as designed; the app does
`store.setTracks((previous) => [...previous, ...tracks])`.

## What an app writes

```tsx
// before (main)
const { tracks, loading } = useAudioTracks(configs, { immediate: true });
const [state, setState] = useState(tracks);
useEffect(() => setState(tracks), [tracks]);
<WaveformPlaylistProvider tracks={state} onTracksChange={setState} deferEngineRebuild={loading}>

// after
const store = usePlaylistStore(() => configs.map(audioTrack));
<WaveformPlaylistProvider store={store}>

// a dropped file
store.setTracks((previous) => [...previous, audioTrack({ src: file })]);

// reading the tracks (anywhere the store is in reach)
const tracks = usePlaylistTracks(store);

// persisting, outside React
const stop = store.subscribe(() => save(store.getTracks()));
```

## What happens to the first build of PR 2

Branch `feat/812-2-provider-resolution`, 30 commits, not pushed, not merged.

| Piece | Fate |
| --- | --- |
| core: loader, types, `audioTrack` (PR 1, #839) | unchanged |
| `defaultLoadSource`, `LoadSource` | kept (the store's default load) |
| `incrementalTrackChange` with the gained-clip case | kept |
| the conversion of a loading clip to an `AudioClip`, placeholders, warn-once, validation (`resolveTracks.ts`) | the conversion moves into the store (core); the placeholder derivation stays in browser; the cache by input object, the seed and the per-id identity reuse go |
| `useSourceLoading` | goes; the store owns the loader |
| `mergeLoadingClips` | kept in a smaller form inside `commitEngineTracks` |
| `useMergedTracksChange`, `unappliedClips.ts`, the engine-held baseline, the echo suppression (`91603812`) | go |
| `useEarlyAdapter`, `useDisposeEngineOnUnmount`, `useDragFlag`, `useWarnDuplicateTrackIds` (moves to the store), `useReportRejectedClips` | kept |
| `usePlaylistSources()` and its context | kept, fed by the store |
| placeholders not editable (`ClipPeaks.isPlaceholder`, `Clip`'s prop, split, export, controls) | kept |
| removal of `useAudioTracks` / `useDynamicTracks`; recording's index rule | kept; recording's signature changes again |
| the 13 converted pages, the stories, the starter | each changes `useState` + two props for a store; the loading and error children stay |
| the provider tests (about 60) | the harness changes from "tracks prop + setter" to a store; most cases keep their assertions |

Proposed route: continue on a new branch from the first build's head, so the
kept pieces and their tests carry over, and delete what goes in the same PR.

## PRs

1. #839 as it is (core loader, types, `audioTrack`).
2. core: `createPlaylistStore` with its tests (stacked on 1).
3. browser + recording + examples + docs: the provider on the store, the
   removals, the conversions (stacked on 2; this is the first build reworked).
4. midi: `loadMidiTracks`, the sweep.

## Behaviour a consumer will notice (for the upgrade guide)

| Before (main) | After |
| --- | --- |
| `tracks` / `onTracksChange` props | `store` prop; edits need no wiring |
| `useAudioTracks`, `useDynamicTracks`, `deferEngineRebuild` | `audioTrack()` in the store's tracks |
| The app's `tracks` state is the document | `store.getTracks()` / `usePlaylistTracks()`; an app that wants its own copy subscribes |
| A page without `onTracksChange` reverts every edit and warns | Edits stay |
| `useIntegratedRecording(tracks, setTracks, …)` | takes the store |
| Recording over audio that is still loading | refused, with a message |
| `usePlaylistTimeline().onTracksChange` | gone |

## Tests that must exist

- Store (core): every rule under "The store" and "Loading and the switch"; two
  functional appends from two promise callbacks both land; identity of
  untouched tracks and clips across a switch; a listener that writes during a
  notification; no fetch before a decode context is attached; detach and
  re-attach keep loaded buffers and restart suspended loads.
- Provider: the first build's provider cases re-expressed over a store
  (first-load wait, arrivals with no rebuild, drag with an arrival, failure and
  retry, unmount on every path, StrictMode, `<Activity>`), plus: an engine edit
  reaches `store.getTracks()` with pending loading clips kept; the provider's
  own store write causes no engine call; a store given to two providers in turn
  (unmount, mount) keeps its buffers and fetches nothing.
- e2e: the Waveform Data page shows 4 rows of 4 with every peaks file delayed
  (the lost update); a file dropped while playing; recording refused over a
  loading clip; punch-in over a clip that loaded and was never edited carves it.

## Left to the builder

- The shape of the store's internals and of the derivation cache.
- Whether `usePlaylistTracks` and `usePlaylistStore` are one file or two.
- How the test harness wraps a store.

## Open, for the maintainer

- "My calls" 1 to 7 above.
- Whether an app may hand ONE store to two providers at the same time (two
  views of one document). Proposed: not supported in this change (the decode
  context and the engine sync assume one provider); the store warns in
  development when a second attaches.
