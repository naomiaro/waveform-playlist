---
name: react-patterns
description: Use when writing or reviewing React code in packages/ - an effect and its cleanup, a ref written from an effect, a context read, a store or useSyncExternalStore selector, a provider value, hook-owned state, StrictMode, Fast Refresh or Activity behaviour, render counts of a view, or a dnd-kit handler.
---

# React patterns learned in this codebase

The conventions (React 19, `use()`, one source per option, boolean props) are in root `CLAUDE.md`; state that has more than one place is the skill `state-ownership`.

## Effects and refs

- **An effect with several return paths has a cleanup only on the paths that return one.** When a run leaves through an early `return;`, the previous run's cleanup has already run and nothing replaces it, so a resource released only in the cleanup of one path is not released on unmount (#811: the provider's loading effect disposed the engine only on its full-build path). The fix is a second effect, `useEffect(() => release, [stableRelease])`, whose cleanup runs only on an unmount, a StrictMode remount, Fast Refresh or an `<Activity>` hide; after the last three every early-return path of the first effect must notice the resource is gone and rebuild it. To see it: a fake adapter through `createAdapter` whose `dispose()` counts, a full build, one track appended, unmount (0 calls; 1 without the append). When an effect gains an early return, ask what the path that returns a cleanup releases.
- **A store owned by a hook must not be cleared in an effect cleanup.** React runs the same cleanup for an unmount, a StrictMode remount, Fast Refresh and a hidden `<Activity>`. Release real resources when the store is garbage-collected (`FinalizationRegistry`; the held value must not reference the store) and through an explicit clear method. To check the collection path for real: Chromium with `--js-flags=--expose-gc`, navigate in-app so the component unmounts, call `gc()` and watch for the dispose (probe `probes/gc679.cjs`).
- **An effect written for "when the prop changes" also runs when nothing changed.** `useLayoutEffect(() => { ref.current = prop }, [prop])` runs again with the same prop on a StrictMode remount and when a hidden `<Activity>` is revealed, and it runs after a child's layout effect of the same commit; on #688 part 2 each of those put the prop's value back over one the user had chosen (third review round). Keep the last value applied in a second ref and return when it is unchanged. Compare a prop during render with `Object.is`: with `!==` a `NaN` prop set state on every render ("Too many re-renders").
- **An `<Activity>` reveal runs each effect's LATEST `create`, also when its dependencies did not change** (React keeps the newest closure without marking it to run). The early-return path a reveal takes is the one of the last render before the hide. In a test, make the triggering update and the hide in one `act()`, or that path is never reached (#811: the clip-operation guard's mutant survived until they were).
- **A child's layout effect runs before React attaches its parent's ref.** `useTrackReorderHandle` hands the slot's element (owned by the controls part) to dnd-kit; in a layout effect the element was still null and no drag started. Register a parent-owned element from a child in a passive effect.
- **A guard read from React state does not cover the async start of the thing it guards.** `useIntegratedRecording.startRecording()` first refused a second call with `isRecordingRef.current`, a mirror of state that turns true one render AFTER the startup awaits finish, so a second call during the startup still overwrote what the first had captured (#756, found in the third review round). An async operation that must not overlap itself needs a ref set synchronously on entry and cleared in a `finally`, as well as the state mirror.
- **Direct DOM writes and React's diff:** a component that writes styles or attributes itself (a subscription, as `SegmentedVUMeter` does for a live meter) must not assume React will correct them on the next render. React writes only what differs from ITS previous render, not from the DOM, so a prop change that renders the same values as last time leaves whatever was written in between. Remount (a `key`) when the writer goes away, and redraw after each commit while it is attached; test by rendering once at the current value, changing the DOM by hand, and rendering again.

## Contexts, stores and renders

- **Selectors over a store keep a parent quiet:** `useSyncExternalStore(subscribe, () => store.getSnapshot().someNumber)` re-renders only when the number changes, however often the store publishes. That is how the visualization shell follows a recording (channel count, a timeline end that moves in 10-second steps) without rendering per frame (#695). The selector must return a primitive or a cached object.
- **A context read for one field subscribes to every field.** Two parts of the view called `usePlaylistTimeline()` for `tracks`; the value also carries `isReady` and `onTracksChange`, so they rendered for those too (#685 review). Before a component reads a provider value, list everything that changes it. To find which context changed in a test: temporary children that each call one hook and count their renders (`const M = () => { usePlaylistMixer(); n.mixer++; return null; }`). It showed the "extra" render a reviewer attributed to the timeline was the mixer, and present on `main`.
- **A value needed only inside an event handler is not a reason to subscribe the view.** `useSelectionDrag` needs the automatic-scroll setting at the release; calling `usePlaylistSettings()` in the view rendered it on every toggle, and the #768 render-count test failed. A memoized child that renders nothing follows the setting and writes a ref in a layout effect (`AutomaticScrollFlag`); the handler reads the ref. Cost: that one component per toggle.
- **A composition that hands its root module-level elements costs nothing on a parent render.** `const TRACKS = <WaveformTracks />` outside the component: a render of `<Waveform />` gives the root the same element objects, and React skips even the unmemoized tracks part (#685 part 3: trim per move 93 to 89 on multi-clip). Elements written inline in the composition are new each time.
- **Count the component layers a design adds before promising render counts.** For #685 "equal or better on every action" was wrong on the first build: each part was a wrapper around the component that draws, so a zoom rendered up to 6 components more. Folding the wrappers into those components left 1 to 3. Say "+N on whole-view renders" in the design.
- **A render of a view root alone is about 15 components, not 1** (the root, `Playlist` and its styled elements). On #685 part 2 "the root renders once more on a selection" was approved as +1 and withdrawn before building. Count the frame under the root before quoting a cost.
- **Module state that two copies of a package must share goes on `globalThis` under a versioned `Symbol.for` key** (core's effect registry, #679). `browser` pins core exactly, so an app whose own core version differs installs two copies; a module-level `Map` in each is two registries. Test it with `vi.resetModules()` and a second `import()`.

## dnd-kit and odds

- **dnd-kit can send a `dragover` after the `dragend` of a canceled drag.** It set the reorder preview again for good (Escape mid-drag, 6 of 6 e2e runs on #687). A handler that publishes drag state checks that a drag is in progress (#796 tracks the dnd-kit workarounds).
- **A function handed to `Array.prototype.map` gets the index as its second argument.** `states.map(apply)` with `apply(tracks, isCurrent = false)` would have read index 1 as `true`. Give such a function one parameter, or return two named functions (`{ current, stored }` in `arrangement/sources.ts`).

## From the browser package

### Derived State Sync: setState During Render, Not useEffect

**Problem:** Syncing `useMemo` output to `useState` via `useEffect` causes a 1-render lag. If another prop (e.g., `deferEngineRebuild`) changes in a separate React batch, downstream consumers see stale state and re-run effects (double engine rebuild).

**Fix:** Use synchronous setState-during-render (React's "getDerivedStateFromProps" pattern):

```typescript
const derived = useMemo(() => compute(input), [input]);
const [state, setState] = useState(derived);
const prevRef = useRef(derived);
if (derived !== prevRef.current) {
  prevRef.current = derived;
  setState(derived);
}
```

**When:** Any time derived state feeds into `WaveformPlaylistProvider` props alongside other props that may change in separate batches.

### Hook Isolation for Render Props

**Problem:** Calling a render prop function (e.g., `renderPlayhead({...})`) directly in a conditional branch merges its hooks into the parent's hook count. If the prop toggles, React throws "Rendered more hooks than during the previous render."

**Fix:** Wrap in a dedicated component that always calls the render prop, isolating its hooks in its own component boundary. Applied in `VisualizationOverlays.tsx` (`CustomPlayhead`, inside `WaveformPlayhead`), which both views render.

**No stub refs:** until #688 part 3 the MediaElement view passed `ZERO_REF` placeholders for the engine refs in `PlayheadProps`. Those props are gone; `PlayheadProps` holds only what both providers have.

### Debugging State Changes with console.trace

**Technique:** Wrap `useState` setter with a traced version to pinpoint which code path modifies state. Useful for controlled state like `tracks` where multiple sources (`onTracksChange`, recording hooks, file drops) can call `setTracks`.

```typescript
const [state, setStateRaw] = useState(initial);
const setState = useCallback((v) => {
  console.log('[Component] setState: ' + summarize(v));
  console.trace('[Component] setState trace');
  setStateRaw(v);
}, []);
```

### React Hook Patterns (cross-cutting)

- **Derive Render Guards from Props, Not Effect State** — Don't use effect-set state (e.g., `isReady`, `trackStates`) in render guards. Effect state lags props by one+ renders, causing content to flash/disappear. Compute values synchronously from props instead.
- **Copy Refs in useEffect Body** — When accessing a ref in `useEffect` cleanup, copy `.current` to a local variable inside the effect body. ESLint's `react-hooks/exhaustive-deps` rule flags refs that may change between render and cleanup. **Exception:** for `[]` deps effects (mount/unmount only), refs are null at mount — copying captures null forever; read refs directly inside the cleanup function instead.
- **Refs from Custom Hooks in Dep Arrays** — When a `useRef` is returned from a custom hook, ESLint's `exhaustive-deps` can't trace its stability. Include it in the dep array (harmless, never triggers) rather than `eslint-disable-next-line` which would mask real missing dependencies.
- **Render-Phase Guards ≠ Effect Dependencies** — Derived booleans computed during render (e.g., `isEngineTracks = tracks === engineTracksRef.current`) that are read inside effect bodies as guards should NOT be in the effect's dep array. They flip between renders, causing spurious re-runs. Read them inside the effect body; depend only on the source data (`tracks`). When the same guard also needs to be visible to the _previous_ effect's cleanup, store it in a ref during render.
- **Gate Provider Behind Async Readiness** — When multiple async resources must load before rendering (e.g., MIDI tracks + SoundFont), gate the `WaveformPlaylistProvider` mount behind all resources being ready. Prevents double engine rebuilds. Check both the loading flag AND `tracks.length > 0` since hooks can briefly report `loading: false` with empty data.
- **Provider Child Effects and playoutRef Timing** — React runs child effects before parent effects. A child component's `useEffect` accessing `playoutRef.current` will find `null` on first run. Under the MediaElement provider add `isReady` (from `useMediaElementTrack()`) as a dependency: it turns true when the player exists and its media has loaded. (`duration` was that signal until #688; it no longer changes.)
