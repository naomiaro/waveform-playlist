# Track loading: a clip names its audio and the provider loads it (#812)

Status: design, not built. Nothing here has been prototyped; statements about
today's code were read from it, not run, unless they say otherwise.

## Why

`WaveformPlaylistProvider` is controlled: the app owns `tracks` and gets edits
back through `onTracksChange`. `useAudioTracks`, `useDynamicTracks` and
`useMidiTracks` each own a second list of tracks, and six pages copy that list
into their own state in an effect. Two owners: every new list from the hook
overwrites what the app changed in between. `useAudioTracks` also loops on an
inline configs array (measured in the issue: more than 500 renders).

The fix is to remove the second owner, not to repair it.

## Goals

- The app keeps ONE `tracks` state. A clip names its audio; the provider loads it.
- `AudioClip` keeps its required integer-sample fields. No reader of
  `durationSamples` or `startSample` gets a "not loaded yet" branch.
- A buffer arriving never changes the app's `tracks` and never calls
  `onTracksChange`.
- The engine, the adapters, the peaks and every context value see `AudioClip` only.
- A track the app did not touch keeps its object identity across renders, so
  the provider's incremental paths keep working (the #752 lesson).

## Non-goals

- Serializable tracks (the app's state holding keys and no buffers): #836.
- dawcore using the loader. It is written so that it could.
- `MediaElementPlaylistProvider`: it has its own `source` and does not change.
  The plan confirms that nothing it shares changes.

## Anti-goals

- No compatibility shims, no deprecated aliases, no hook kept under an old name
  (this major may break the API; every break gets an upgrade-guide entry).
- No second source for anything: no prop beside a context, no loading hook that
  also returns tracks.
- No store cleared in an effect cleanup. Loaded buffers survive a StrictMode
  remount, Fast Refresh and a hidden `<Activity>`.

## Approaches

1. **Resolve during render, in the provider (chosen).** The provider reads the
   loader with `useSyncExternalStore` and derives resolved tracks from the
   `tracks` prop in a pure function with a cache, as `derivePeaks` does for
   peaks. One render per source that settles, no state copied in an effect.
2. **Resolve in an effect that sets state.** One extra render per change, and
   for one committed render the new `tracks` is paired with the previous
   resolution: the stale-pairing bug the issue lists for `useAudioTracks`.
3. **The engine accepts loading clips.** Puts "not loaded yet" into the engine,
   both adapters and dawcore. The issue rules it out.
4. **A wrapper component above the unchanged provider.** A second component
   that owns the loader and passes resolved tracks down. It works, but
   `onTracksChange` then has to be translated in two places and the status
   hook lives outside the provider. Not chosen.

There is one sensible way (1); the maintainer set its direction in the issue.

## Decided by the maintainer

- Direction as in the issue (2026-11-13): two clip types, the provider owns one
  loader, the three hooks are removed, MIDI becomes an awaited function.
- First load: the engine gets its tracks once every source has settled, in one
  step (the issue's answer A). A failed source counts as settled.
- **A resolved clip carries its buffer AND its source key** (choice b,
  2026-11-13): `AudioClip` gains an optional `src`.
- **A source added while the engine runs does not stop it** (choice a,
  2026-11-13): the new track enters empty at once and gets its clip when the
  decode finishes, with no rebuild. A loading clip with a `duration` is drawn
  as a placeholder meanwhile, so the timeline can grow before the track sounds.
- **Audio that arrives clears the undo history, as today** (choice a,
  2026-11-13): every application of an arrived source to a running engine (a
  `filled` track, in both the old and the extended case) ends with
  `engine.clearHistory()` and the `onUndoEngineState` call that follows it
  today. Making arrivals invisible to undo is #837.
- Carried over from the issue: one fetch and decode per source key; a failed
  source stays failed (no automatic retry); a cleanup aborts in-flight work and
  the setup asks again; sources nothing names are dropped; mixer fields on a
  track are starting values (docs only).

## My calls (not yet confirmed one by one; listed for the maintainer)

- Names: `LoadingClip`, `src: string | Blob`, `isLoadingClip()`, `PlaylistTrack`,
  `audioTrack()`, `createSourceLoader`, `usePlaylistSources()`, `loadSource`,
  `loadMidiTracks()`.
- `isLoadingClip(clip)` tests for a missing `sampleRate`. No `kind` field.
- A provider prop `loadSource` for custom loading.
- An explicit `retry(src)` on the status hook.
- `deferEngineRebuild` is removed. Its uses are the pages fed by the hooks that
  go away, `BeatsAndBarsExample` (its own fetch loop and buffer map, copied to
  state in an effect: converted in PR 2 like the six pages; the plan reads how
  it positions clips first) and three unit tests, which are rewritten over
  loading clips.
- `play()` during the first-load wait does nothing (under "What the engine
  effect does").
- The loader is declarative (`setWanted` / `suspend` / `provide`), with one owner.
- `useIntegratedRecording(tracks, setTracks)` in `@waveform-playlist/recording`
  is retyped to `PlaylistTrack[]` in PR 2 (it receives the app's state); a
  break in that package, with a changeset and an upgrade entry.
- The pending-clip merge in `onTracksChange` (below).
- Three PRs (below), each with its own docs.

## The types (core)

```ts
/** What a loading clip names. A string is a URL; a Blob or File is keyed by identity. */
export type ClipSource = string | Blob;

/** A clip whose audio is not loaded yet. Times in seconds. */
export interface LoadingClip {
  id: string;
  src: ClipSource;
  start?: number; // on the timeline, default 0
  duration?: number; // default: the whole source from `offset`
  offset?: number; // into the source, default 0
  name?: string;
  gain?: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
  color?: string;
  waveformData?: WaveformDataObject;
}

export interface AudioClip {
  // unchanged, plus:
  /** The source this clip was loaded from, when the provider loaded it. */
  src?: ClipSource;
}

/** What the app's state holds and the provider's `tracks` prop takes. */
export type PlaylistTrack = Omit<ClipTrack, 'clips'> & {
  clips: (AudioClip | LoadingClip)[];
};

export function isLoadingClip(clip: AudioClip | LoadingClip): clip is LoadingClip;
```

- `ClipTrack` (clips: `AudioClip[]`) stays the type of the engine, the adapters
  and `usePlaylistTimeline().tracks`. A `ClipTrack` is assignable to
  `PlaylistTrack`.
- A loading clip is valid on an audio track only. On a MIDI track the provider
  reports it through `onError` and leaves it out.
- **Breaking for TypeScript apps:** `onTracksChange` is
  `(tracks: PlaylistTrack[]) => void`. An app with `useState<ClipTrack[]>` and
  `onTracksChange={setTracks}` no longer compiles; it changes the state's type.
  Upgrade-guide entry.
- `audioTrack(options)` in core: a plain function that returns a
  `PlaylistTrack` with one clip. Options are the track fields (`id`, `name`,
  `muted`, `soloed`, `volume`, `pan`, `color`, `renderMode`,
  `spectrogramConfig`, `spectrogramColorMap`) and the clip fields (`src`,
  `start`, `duration`, `offset`, `fadeIn`, `fadeOut`, `waveformData`,
  `clipId`). With `src` it builds a loading clip. With `audioBuffer`, or with
  `waveformData` and no `src`, it builds an `AudioClip` at once
  (`createClipFromSeconds`), which is what `useAudioTracks` did for those two
  cases. With none of the three it throws. Ids are generated when not given;
  the app calls it once (module level, a `useState` initializer or an event
  handler), never in render.

## The loader (core, PR 1)

`createSourceLoader` in `packages/core/src`, framework-free, no React.

```ts
export type SourceState<V> =
  | { status: 'pending' }
  | { status: 'loaded'; value: V }
  | { status: 'failed'; error: Error };

export interface SourceLoader<K, V> {
  /** Declare the whole set of keys that are wanted now. */
  setWanted(keys: Iterable<K>): void;
  /** Abort every load in flight. Wanted keys and loaded values are kept. */
  suspend(): void;
  /** Record a value the caller already holds as loaded. */
  provide(key: K, value: V): void;
  /** Start a failed key again. A no-op for any other state. */
  retry(key: K): void;
  /** `ValueSource` shape: a new Map object on every change. */
  subscribe(listener: (states: ReadonlyMap<K, SourceState<V>>) => void): () => void;
  getSnapshot(): ReadonlyMap<K, SourceState<V>>;
}

export function createSourceLoader<K, V>(options: {
  load: (key: K, signal: AbortSignal) => Promise<V>;
}): SourceLoader<K, V>;
```

The loader has one owner that declares what it wants; there is no request
counting. (A first draft counted requests and dropped a key when its last
request was withdrawn; the builder check showed that a hidden `<Activity>`,
whose cleanup is followed by no setup, would then drop every buffer.)

Rules, each with a test:

- `setWanted(keys)`: a key that is new starts one `load`; a wanted key whose
  load was suspended starts again; a key no longer in the set is dropped (a
  pending load aborted, a loaded value or a failure forgotten). A key that is
  loaded or failed and still wanted is left alone. It also ends the suspended
  state. It publishes only when the snapshot changes: restarting suspended
  keys, which were and stay `pending`, publishes nothing (unless a restarted
  `load` throws at once, which is a change to `failed`).
- `suspend()`: aborts pending loads and nothing else; it publishes nothing.
  The keys stay `pending` in the snapshot and start again at the next
  `setWanted`. The owner calls it from an effect cleanup; it must never forget
  a loaded value.
- `retry(key)` while suspended starts nothing (nothing would abort that load):
  the key becomes `pending`, published, and the next `setWanted` that still
  wants it starts it.
- `load` may return a plain value instead of a promise; the key becomes
  `loaded` with it. A `load` that throws synchronously is `failed`.
- `provide(key, value)`: the key becomes `loaded` with that value; a load in
  flight for it is aborted. A no-op for a key that is already loaded. The key
  is still dropped by a later `setWanted` that leaves it out.
- A rejection with `name === 'AbortError'` of a load the loader itself aborted
  is never recorded as `failed`. The same rejection from a load whose signal
  was not aborted (a custom load function's own abort) is a failure: left
  pending it would hold back the first build for good.
- A late result of an aborted or dropped load is ignored (compare a per-load
  token, not a flag that must be reset).
- A failed key stays failed until `retry(key)`.
- `getSnapshot()` returns the same Map until something changes.
- Keys are compared as Map keys: strings by value, objects by identity.

## The provider (PR 2)

### Resolution

A pure function in `packages/browser/src/utils/resolveTracks.ts`, called in a
`useMemo` over the `tracks` prop, the loader's snapshot and the context sample
rate, with the previous pass as its cache (the `derivePeaks` pattern). It
returns two lists of `ClipTrack`:

- **`viewTracks`**: every track; a loaded clip resolved; a pending or failed
  loading clip with a `duration` or `waveformData` as a placeholder `AudioClip`
  (no `audioBuffer`, provisional conversion at the current sample rate, or the
  waveform data's rate and length when given); a pending or failed loading clip
  with neither left out. This is what `usePlaylistTimeline().tracks`, the
  peaks, `duration` and the mixer derive from.
- **`engineTracks`**: the same without placeholders. This is what the engine
  effect compares and applies.

Resolving a loading clip: one conversion from seconds to integer samples at the
BUFFER's rate, through `createClip` (not `createClipFromSeconds` round trips).
The clip keeps the loading clip's `id`, and gets `audioBuffer`, `src` and the
loading clip's other fields. `duration` missing means the buffer's length from
`offset`; a `duration` past the end of the buffer is cut to it, with a warning
naming the clip.

Identity rules (tests assert each):

- A resolved clip is cached per loading-clip object and buffer.
- A track with no loading clip is returned as the same object in both lists.
- A resolved track is cached per input track object and the states of the
  sources it names: the same input and the same states give the same object.
- When both lists equal the previous pass element by element, the previous
  arrays are returned.

### What the engine effect does

The effect keeps its structure and depends on `engineTracks` where it depended
on `tracks`.

- **Only the tracks the provider is mounted with wait for everything**
  (maintainer, 2026-11-13: files dropped on an empty timeline keep playing one
  by one, as `useDynamicTracks` does today). While the provider has not
  completed its first build and any source named by `tracks` is pending, no
  tracks are applied (this replaces `deferEngineRebuild`). When all have
  settled, one full build. `isReady`, the `waveform-playlist:ready` event and
  `onReady` come from that build, as today. A `play()` during the wait does
  nothing, as today under `deferEngineRebuild` (the effect returns before a
  build is in flight). A provider mounted with NO tracks builds its engine for
  an empty timeline at once, as today, and has no wait at all: every source
  named later arrives on its own (next bullets). Consequence: an app that
  mounts empty and sets a whole song later gets its tracks one by one, each
  playable as it finishes. There is no timeout: a download that stalls without
  failing holds back the first build until the app removes the clip or its
  `loadSource` rejects.
- **A source that settles during a trim drag** (`isDraggingRef`) is applied
  after the release, not lost: the effect's drag branch must not record the
  new `engineTracks` as already applied. Test: a decode that finishes mid-drag
  sounds after the release, with no rebuild.
- **After the first build**, a source that settles changes `engineTracks`, and
  `incrementalTrackChange` decides, as today. It is extended by one case: a
  track whose previous clips are all still present as the same objects and
  which gained clips is `filled` (today: only a track that had no clips). That
  covers a second clip arriving on a track that already has one. Whether
  `engine.updateTrack` on a track with clips that are playing is inaudible is
  NOT known: the plan includes a browser check during playback, and if it is
  audible the maintainer is told before anything is built around it.
- A new track whose clips are all pending enters at once as a track with no
  clips (an `added` track), and is `filled` later.
- **A later full rebuild** (a track removed, tracks replaced wholesale) builds
  from `engineTracks` as it is; clips still pending are absent and arrive
  through the incremental path. Only the first build waits for everything.
  Consequence: replacing every track at once after the first load shows the
  tracks one by one, not in one step.
- A failed source: its clip is absent from the engine; the placeholder, when
  there is one, stays drawn. `onError` is called once per failed source.
- The "clip has no audio data or waveform data" warning skips placeholders.

### The decode context

The decode needs the adapter's `AudioContext`, which today exists only inside
the full build. The provider therefore obtains the context before any source is
decoded, and the loader's `load` awaits it:

- with `createAdapter`: the adapter's `audioContext`. `createAdapter` must not
  be called more often than builds happen (no throwaway adapter for its
  context): the adapter created for the context is the one the first build uses.
- default engine: through the dynamic import of `@waveform-playlist/playout`
  (with `configureGlobalContext({ sampleRate })` applied first, as
  `resolvePlayoutAdapter` does).

How the build is restructured to do this is the builder's, within these limits:
the provider's static import graph stays free of `tone` and playout
(`staticEngineImports.test.ts`, `coreBarrelEngineFree.test.ts`), the #675 rules
hold (no disposed engine reachable, a queued play starts on the new engine),
and an unmount before the context arrives disposes what was created (#811).

The default `load`: for a string, `fetch(src, { signal })`, a thrown error for
a response that is not `ok`, then `decodeAudioData`; for a Blob,
`arrayBuffer()` then `decodeAudioData`; `signal.throwIfAborted()` after each
await. It lives in the core graph of the browser package, not under `/tone`.

`loadSource` prop: `(src, { signal, audioContext }) => Promise<AudioBuffer>`,
used in place of the default. Read through a ref: its identity is not a
dependency of anything.

### Which sources are requested

An effect over the set of sources `tracks` names tells the loader. "Names" counts loading clips AND resolved clips that carry `src`, so a
source stays in the loader while any clip of it is in the app's state. The
effect body calls `loader.setWanted(names)` and its cleanup calls
`loader.suspend()`. The loader itself lives in a ref created once per provider
instance and is never cleared by a cleanup.

A clip in the `tracks` prop that carries both `src` and `audioBuffer` (handed
back earlier, restored by an undo, kept by the app across a remount of the
provider) is given to the loader with `provide(src, audioBuffer)` before
`setWanted`: nothing is fetched for it, it never holds back a build, and the
status hook shows it as loaded. A later loading clip naming the same source
resolves from that buffer.

### `onTracksChange`

Everything that reaches the app's `onTracksChange` goes through one merge: the
engine's statechange, AND the `onTracksChange` in the `usePlaylistTimeline()`
value, which `useClipDragHandlers` calls on every move of a trim and on a
cancel with copies of the view's tracks (`useClipDragHandlers.ts:272`, `:310`).

The merge, per track: placeholder clips are removed; then every loading clip of
that track in the latest `tracks` prop whose `id` is not among the remaining
clips is put back, after them, in its order. The test is the clip's id, not
its source's status: a clip whose source has loaded but which the engine does
not hold yet (it settled during a drag) stays a loading clip in the app's
state and enters the engine through the normal path. A track with nothing
removed and nothing put back is handed on as the same object.

- The merged array is what is stored in `engineTracksRef`, so the "tracks came
  from the engine" guard still recognises it when it returns as the prop.
- The resolution cache is seeded so that a merged track resolves to the
  engine's track object for `engineTracks`: no rebuild, no `filled`.
- Without the merge, a trim on one track while another loads would drop the
  loading track from the app's state.
- After an edit the app's state holds resolved `AudioClip`s (with `audioBuffer`
  and `src`) for every loaded clip, and loading clips for the rest.

### Loading status

A new context served by `WaveformPlaylistProvider` only (added to the
MediaElement provider's blocked list, to the table in
`packages/browser/CLAUDE.md` and to `contextSplitByChangeRate.test.tsx`):

```ts
usePlaylistSources(): {
  sources: ReadonlyMap<ClipSource, { status: 'pending' | 'loaded' | 'failed'; error?: Error }>;
  pendingCount: number;
  failedCount: number;
  isLoading: boolean; // pendingCount > 0
  retry: (src: ClipSource) => void;
}
```

It changes when a source is requested, settles or is dropped. Nothing in the
view reads it; `isReady` stays in `usePlaylistTimeline()`.

### Placeholders are not editable

A placeholder is not in the engine. The plan reads every clip handler (drag,
trim, split, the keyboard shortcuts, fades) for what it does with a clip id the
engine does not know, and makes each a no-op for a placeholder. A track whose
clips are all placeholders has its controls disabled as a loading track does
today (`trackControlsDisabledWhileLoading.test.tsx`).

### Removed in PR 2

`useAudioTracks`, `AudioTrackConfig`, `UseAudioTracksOptions`,
`useDynamicTracks`, `TrackSource`, `TrackLoadError`, `UseDynamicTracksReturn`,
`buildTrackFromConfig`, the provider's `deferEngineRebuild` prop. Every example
component, story and doc page that uses them is converted in this PR (the list
is in the issue under "Doc surfaces"), the six pages that copy tracks in an
effect first. A dropped file becomes
`setTracks((prev) => [...prev, audioTrack({ src: file, name })])`.

## MIDI (PR 3)

`loadMidiTracks(src, options)` in `@waveform-playlist/midi`: an async function
over `parseMidiUrl` / `parseMidiFile` from `@dawcore/midi`, returning
`ClipTrack[]`. `src` is a URL, a `File` or a `Blob`; options are `sampleRate`
(required, as today), `flatten`, `start`, `duration`, `name`, `signal`. Track
and clip ids come from that one call. The app awaits it and appends, in an
effect with an abort or in an event handler. `useMidiTracks`,
`MidiTrackConfig`, `UseMidiTracksOptions`, `UseMidiTracksReturn` and
`midiConfigsEqual` are removed. Pre-parsed notes need no function: the app
builds the clip with `createClipFromSeconds({ midiNotes })`.

## Docs

Each PR updates what it touches, in the same PR: the guides and API pages, the
upgrade guide (a removal table for the three hooks and `deferEngineRebuild`,
the loading clip, `PlaylistTrack`, `usePlaylistSources`), `llm-reference.md`,
`llms.txt`, the package READMEs, the root README, the package notes. PR 3 ends
with a sweep: `git grep` for every removed name over the whole repository must
find only the upgrade guide.

## PRs

1. core: `createSourceLoader`, the types, `isLoadingClip`, `audioTrack`, tests.
2. browser: resolution, the engine effect, `onTracksChange` merge, status hook,
   `loadSource`, removals, examples, docs. Stacked on 1.
3. midi: `loadMidiTracks`, removals, MIDI examples and docs, the sweep.
   Stacked on 2.

## Tests that must exist (beyond the per-rule unit tests above)

- An inline `tracks` array of loading clips in a re-rendering parent: one fetch
  per source, a bounded render count (the issue's loop, as a regression test).
- Two clips naming one URL: one fetch, one shared `AudioBuffer`.
- StrictMode (`renderHook(..., { wrapper: StrictMode })` or a mounted
  provider): sources load, nothing is fetched twice.
- A trim on a loaded track while another track's source is pending: the
  loading clip is still in what `onTracksChange` hands back, and no rebuild
  happens (count `waveform-playlist:ready` events).
- A file dropped while playing (e2e): playback goes on, no rebuild, the new
  track sounds after its decode.
- First load with one failing source: one build, the others play, the status
  hook reports the failure, `retry` loads it and it enters without a rebuild.
- Every new regression test is seen to fail with its guarded line broken.

## Left to the builder

- File layout, internal names, the shape of the resolution cache.
- How the build is restructured to have the context early (limits above).
- The order of pending clips relative to engine clips inside a merged track,
  as long as it is stable.
- Wording of warnings and errors.

## Measured, and decided

- **`engine.updateTrack` on a playing track** (run 2026-11-13, headless
  Chromium, `examples/dawcore-tone`, raw output samples against a control):
  adding a clip LATER than the track's existing clips is bit-identical to the
  control (15 of 15; the other tracks 5 of 5). Adding a clip EARLIER than the
  track's first clip, which makes the Tone adapter reschedule every clip of
  the track, disturbed playback in 6 of 25 runs (4 clicks of 2.7 to 5.3 ms; 2
  runs where that track stays 128 samples late until stop), 0 of 24 in the
  control. The adapter behaviour is #841.
- **Maintainer, 2026-11-13: update the track in place in that case too**
  (choice a), not a full rebuild. The extended `filled` case applies whatever
  the position of the clip that arrived.
- `src` survives split, trim, move, track updates, undo and redo (PR 1: split
  was fixed, the others have tests).

## Decided during the build (maintainer, 2026-11-13)

- **`isDraggingRef` keeps its place and its type** (choice a). The provider
  creates it with a `current` setter that tells it when a trim drag ends, so a
  clip that arrived during the drag is applied after a release that changed
  nothing. No new option on `useClipDragHandlers`. The upgrade guide says that
  the object must be passed on as it is, not copied.
- **The engine is disposed on every cleanup of the provider** (choice
  "dispose"): a real unmount, a hidden `<Activity>` and a Fast Refresh alike.
  A provider that is hidden and revealed builds a new engine: undo history is
  lost, audio stops while hidden and resumes on reveal, and
  `waveform-playlist:ready` and `onReady` fire again. Keeping the engine across
  a hide is #842.
- **An engine track keeps its identity while nothing the engine sees changed**
  (my ruling, told to the maintainer): the same clip objects and equal other
  fields, also for a new input track object. A copy of a track with identical
  content no longer rebuilds the engine.
- **A loading clip on a MIDI track** is reported through `onError`, never
  fetched, and does not hold back the first build.
- **No source timeout** (#840). The docs show the app-side way
  (`AbortSignal.timeout` in its own `loadSource`).
- **The loader is wired with one effect that follows `tracks`** (`provide`,
  then `setWanted`) and one cleanup that calls `suspend()`; the section "Which
  sources are requested" above describes an earlier shape.

