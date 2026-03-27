# UI Components Package (`@waveform-playlist/ui-components`)

## Theming System

**When to add to `theme` object:**

- Visual/styling properties (colors, backgrounds, borders)
- Properties users want to customize for aesthetic consistency

**When to use separate props:**

- Functional/behavioral properties (callbacks, data, configuration)
- Properties that control what is rendered or how it behaves

**Example:** All clip header colors in `theme`, but `showClipHeaders` as boolean prop.

**Implementation Pattern:**

1. Define theme interface in `src/wfpl-theme.ts`
2. Export `WaveformPlaylistTheme` interface and `defaultTheme`
3. Extend styled-components DefaultTheme via `src/styled.d.ts`
4. Components access theme via `props.theme.propertyName` in styled components
5. No color/styling props passed through component interfaces

**Type Safety:** Use `Partial<WaveformPlaylistTheme>` for theme props. Single source of truth in `wfpl-theme.ts`.

**Location:** `src/wfpl-theme.ts`, `src/styled.d.ts`

## Theme Provider Pattern

**Decision:** Use styled-components `ThemeProvider` at the `WaveformPlaylistProvider` level.

**Implementation:**

1. `WaveformPlaylistProvider` accepts `theme?: Partial<WaveformPlaylistTheme>`
2. Provider merges user theme with `defaultTheme`: `{ ...defaultTheme, ...userTheme }`
3. Provider wraps children with styled-components `<ThemeProvider theme={mergedTheme}>`
4. All child components access theme via `useTheme()` hook from `ui-components`
5. `Waveform` component does NOT accept its own theme prop - gets from context

**Usage Pattern:**

```typescript
// Application level
<WaveformPlaylistProvider tracks={tracks} theme={darkTheme}>
  <Waveform />  {/* Gets theme from context */}
</WaveformPlaylistProvider>
```

**Why NOT pass theme to Waveform:**

- Single source of truth - theme set once at provider level
- Automatic propagation to all styled components
- Prevents theme conflicts from multiple ThemeProviders
- Follows React context pattern

**Docusaurus Integration:**

- Use MutationObserver to detect `data-theme` attribute changes
- Switch between `defaultTheme` and `darkTheme` based on Docusaurus mode
- Example: `minimal-app.tsx` detects and responds to theme toggle

## Track Selection Styling

**Theme Properties:** `selectedWaveOutlineColor`, `selectedTrackControlsBackground`, `selectedClipHeaderBackgroundColor`

**Pattern:** `isSelected` prop flows: Waveform → Track → Clip → ClipHeader and SmartChannel. Selection shown via background colors, no borders.

## SpectrogramChannel Hook Stability

**Decision:** Use stable default references for LUT/scale and remove hook dependency suppression.

**Implementation:** `src/components/SpectrogramChannel.tsx`

- Hoisted stable defaults:
  - `DEFAULT_COLOR_LUT`
  - `LINEAR_FREQUENCY_SCALE`
- Updated effect dependencies to include worker/callback references explicitly
- Removed `react-hooks/exhaustive-deps` suppression

**Why:**

- Prevents unnecessary redraw/recompute caused by new inline default references each render
- Reduces stale-closure risk in worker canvas registration effect

## Canvas Drawing Timing (All Channel Components)

**Decision:** `useLayoutEffect` for canvas drawing (not `useEffect`) in Channel, PianoRollChannel, and SpectrogramChannel.

**Why:** `useEffect` runs after browser paint. Since canvas drawing calls `clearRect` first, users see one frame of blank canvas before the redraw. This causes visible flicker on initial load, zoom changes, and during recording (~60fps peak updates). Layout thrashing is not a concern because ClipContainer and channel Wrapper both set explicit `width`/`height` via `.attrs()` — the browser knows container dimensions before canvases mount.

## Canvas Draw Version Stamping

`Channel.tsx` stamps each canvas with `canvas.dataset.drawVersion` after drawing. The `useLayoutEffect` skips canvases whose stamp matches the current `drawVersion` fingerprint (derived from data, bits, colors, dimensions, drawMode). Only newly mounted canvases (no stamp) or canvases after a parameter change (stamp mismatch) get redrawn. Without this, changing `visibleChunkIndices` redraws ALL mounted chunks — causing 23ms+ spikes with multiple tracks at fine zoom.

## Horizontal Virtual Scrolling (Phase 4)

**Decision:** Viewport-aware canvas rendering — only mount canvas chunks visible in the scroll container + buffer.

**Implementation:**

- `ScrollViewportContext` in `src/contexts/ScrollViewport.tsx`
- `ScrollViewportProvider` wraps content inside `Playlist.tsx`, observes `Wrapper` scroll element
- `useScrollViewport()` returns `{ scrollLeft, containerWidth, visibleStart, visibleEnd }` or `null`
- Buffer: 1.5x viewport width on each side
- RAF-throttled scroll listener + ResizeObserver

**Components affected:**

- `TimeScale` — chunked into 1000px canvases (was single canvas, crashed with long files)
- `Channel` — absolute positioning, only renders visible chunks
- `SpectrogramChannel` — only mounts visible chunks (biggest memory win)
- All use absolute positioning (`left: chunkIndex * 1000px`) instead of `float: left`

**Shared hooks:**

- `useVisibleChunkIndices(totalWidth, chunkWidth, originX?)` — returns memoized array of visible chunk indices. `originX` converts local chunk coords to global viewport space (required for clips not at position 0). Uses string-key comparison internally for re-render gating. Exported from `ui-components`.
- `useChunkedCanvasRefs()` — callback ref + Map storage + stale cleanup for chunked canvases. Internal only (not exported from package public API). Uses `Map<number, HTMLCanvasElement>` instead of sparse arrays.

**Clip coordinate space:** `ClipViewportOriginProvider` in `src/contexts/ClipViewportOrigin.tsx` supplies the clip's pixel `left` offset to descendant `Channel`/`SpectrogramChannel` components. Wrapped around `ChannelsWrapper` in `Clip.tsx`. Defaults to `0` for non-clip consumers (e.g., `TimeScale`).

**Backwards compatibility:** `useScrollViewport()` returns `null` without provider. All components default to rendering everything when viewport is `null`.

**Overscan buffer contract:** The 1.5× container-width buffer in `ScrollViewportProvider` is a contract — `SpectrogramProvider.getVisibleChunkRange()` depends on matching this exact buffer size. If changed, update both.

## @dnd-kit Feedback Plugin Per-Entity Config

**Pattern:** `useDraggable({ feedback: 'none' })` disables the Feedback plugin for that draggable — no fixed positioning, no CSS translate, no placeholder, no drop animation. Used on boundary trim handles where React state provides visual feedback.

**Type chain:** `UseDraggableInput` extends `Omit<DraggableInput, 'handle' | 'element'>` where `DraggableInput` is from `@dnd-kit/dom` (includes `feedback?: FeedbackType`). The `plugins` property does NOT exist on `useDraggable` in v0.3.2.

**Applied in:** `Clip.tsx` (left/right boundary draggables), `AnnotationBox.tsx` (start/end boundary draggables).

## Bar Width Peak Aggregation (Channel.tsx)

**Invariant:** When `barWidth + barGap > 1` (step > 1), each bar must aggregate ALL peaks in its range using min-of-mins / max-of-maxes. Never sample a single peak per bar — skipping intermediate peaks loses amplitude data, causing zoom-dependent visual inconsistency.

**Performance:** When `step === 1` (the common case), the aggregation loop body never executes — zero overhead.

**Implementation:** Peak rendering math is extracted into pure functions in `src/utils/peakRendering.ts` (`aggregatePeaks`, `calculateBarRects`, `calculateFirstBarPosition`), tested in `src/__tests__/peakRendering.test.ts` (22 tests). Channel.tsx imports and calls these helpers in its `useLayoutEffect`.

## PianoRollChannel (MIDI Visualization)

**Decision:** Canvas-based MIDI note rendering as a third rendering mode alongside waveform and spectrogram.

**Pattern:** Follows `Channel.tsx` exactly — chunked canvases via `useVisibleChunkIndices` + `useChunkedCanvasRefs` + `useClipViewportOrigin`. Same styled-components `.attrs()` pattern for frequently changing props.

**Props:** `midiNotes`, `sampleRate`, `clipOffsetSeconds` flow through `SmartChannel` (which branches on `renderMode === 'piano-roll'`).

**Note rendering:** Velocity maps to opacity (0.3–1.0), pitch range auto-fits to actual data (not full 0-127), minimum 2px note width/height.

**Theme colors:** `pianoRollNoteColor`, `pianoRollSelectedNoteColor`, `pianoRollBackgroundColor` in `WaveformPlaylistTheme`.

**Location:** `src/components/PianoRollChannel.tsx`

## Controls Outside Scroll Container

**Decision:** Track controls render in a fixed-width `ControlsColumn` outside the scroll area, not inside it.

**Layout:** `Wrapper (display: flex)` → `ControlsColumn (flex-shrink: 0)` + `ScrollArea (overflow-x: auto, flex: 1)`. Only the waveform/timescale area scrolls.

**Why:** Sticky-positioned controls inside `overflow-x: auto` caused browsers to set non-zero `scrollLeft` during layout recalculation when React rendered wide content.

**Scroll anchoring fix:** `ScrollArea` uses `overflow-anchor: none` to prevent browsers from adjusting scroll position when content size changes (e.g., 13 MIDI tracks rendering ~12,000px of wide content). Pure CSS, no JS event listeners.

**Props:** `Playlist` accepts `trackControlsSlots?: React.ReactNode[]` and `timescaleGapHeight?: number`. Track is channels-only (no controls rendering).

**Implications:** No `controlsOffset` or `controlWidth` in click handlers, playhead positioning, selection, auto-scroll, or zoom calculations. `Playhead.controlsOffset` is deprecated (always 0).

## Deferred Viewport Store Notifications (React 19 Compatibility)

**Problem:** `ViewportStore` uses `useSyncExternalStore`. During playback with auto-scroll and many tracks, React 19's concurrent rendering time-slices across frames. If the store notifies listeners while React's previous render is still yielded (`workInProgressRoot` is set), React throws "Should not already be working" in dev mode.

**Fix:** `ViewportStore.update()` defers listener notification by one frame via `requestAnimationFrame`. `cancelPendingNotification()` called in provider cleanup. Located in `src/contexts/ScrollViewport.tsx`.

## will-change CSS Budget (Firefox)

Firefox enforces a `will-change` memory budget of 3× document surface area. Only use `will-change` on elements that actively animate (playheads, progress overlays). Static elements like canvas chunks and backgrounds should NOT have `will-change` — they already get GPU compositing from `transform: translateZ(0)` without triggering the budget.

## TrackMenu Portal Positioning

**Pattern:** `position: fixed` dropdown portaled to `document.body`, repositioned on scroll.

- Opens to the **right** of the trigger button (not below) since controls column is narrow
- Falls back to left if viewport edge reached
- `window.addEventListener('scroll', handler, true)` — capture phase catches scrolls from any ancestor, not just window
- `requestAnimationFrame` after open for position refinement (dropdown ref is null on first render)
- **Never put function-derived `items` in effect deps** — `itemsProp(close)` creates a new array each render, causing infinite `setState` → render → effect loops
- Escape key closes the menu

## FileDropZone Hidden Input Pattern

For programmatic `.click()` on file inputs, use `opacity: 0; width: 0; height: 0; pointer-events: none;` — NOT `clip: rect(0,0,0,0)` or `display: none`. Add `onClick={(e) => e.stopPropagation()}` on the input to prevent event bubbling back to the Zone's click handler.

## Important Patterns (UI-Specific)

- **Stable React Keys for Tracks/Clips** - Always use `track.id` / `clip.clipId` as React keys, never array indices. Index-based keys cause DOM reuse on removal, breaking `transferControlToOffscreen()` (can only be called once per canvas) and causing stale OffscreenCanvas references.
- **Per-Track Maps Must Use Track ID** - Any `Map` storing per-track overrides (render modes, configs) must be keyed by `track.id` (string), not array index. Index keys break when tracks are added/removed.
- **Canvas Cleanup on Chunk Changes** - `useChunkedCanvasRefs` runs cleanup on every render (no dependency array) because the virtualizer can unmount canvases between any render. SpectrogramChannel's worker registration effect uses `visibleChunkIndices` as a dependency so it re-runs when chunks mount/unmount, cleaning stale registrations and transferring new canvases in a single pass.
- **Virtual Scrolling Chunk Offsets** - Canvas registries may contain non-consecutive chunks (e.g., chunks 50-55). Use `extractChunkNumber(canvasId)` to get the real chunk index — never compute offsets by summing widths from array index 0.
- **Multi-Channel Rendering Fairness** - Render visible chunks for ALL channels before background batches. Sequential per-channel rendering causes channel starvation when generation aborts interrupt background work.

## Beats & Bars Timescale

**Architecture:** TimeScale is a pure tick renderer — accepts only `PrecomputedTickData` (`{ widthX, canvasInfo: Map<pixel, height>, timeMarkersWithPositions }`). SmartScale is the presentation layer that computes tick data for both modes.

**Two modes in SmartScale:**
- **Beats & bars:** PPQN 192 integer math (matching Tone.js). Iterates by beat ticks, converts to samples → pixels. Labels use `ticksToBarBeatLabel()`.
- **Temporal:** Uses `timeinfo` map (zoom threshold → marker/bigStep/smallStep in ms). Iterates in pixel space, converts counter to labels via `formatTime()`.

**Why integer PPQN math:** Millisecond-based modular arithmetic (`counter % marker === 0`) breaks with non-integer beat durations (e.g., 119 BPM = 504.20ms/beat — modulo never hits 0). Integer tick space avoids this entirely.

**Key exports:** `getScaleInfo(samplesPerPixel)` returns `{ marker, bigStep, smallStep }` — used by SmartScale (temporal tick computation) and by consumers to derive `gridSamples` for `SnapToGridModifier`.

**BeatsAndBarsProvider:** Optional context (`useBeatsAndBars()` returns `null` when absent). Provides `bpm`, `timeSignature`, `snapTo`, `scaleMode`, derived `ticksPerBeat`, `ticksPerBar`. `scaleMode` (`'beats' | 'temporal'`, default `'beats'`) controls which timescale SmartScale renders — mount the provider once and switch modes via prop instead of mount/unmount.

**`formatTime` and `TimeStamp`:** Live in SmartScale (presentation concern), not TimeScale (pure renderer).

## Clip Draggable Data Shape

All three draggables in `Clip.tsx` include `startSample` and `durationSamples` in their `data` object (alongside `clipId`, `trackIndex`, `clipIndex`, and optional `boundary`). This allows modifiers like `SnapToGridModifier` to compute absolute timeline positions for grid snapping.

## SegmentedVUMeter Color Stops

**Above-0 dB support:** `dBRange` defaults to `[-50, 5]`. Output meters can exceed 0 dB when mixed tracks sum hot. Input meters (microphone) are clamped to 0 dB by the audio driver. Default color stops include `{ dB: 2, color: '#ff0000' }` as an "over" indicator for output signals. Red zone starts at -1 dB.

## SegmentedVUMeter Theming

**Decision:** Transparent background, no padding/border-radius — consumers control container styling. `labelColor` prop (not theme) controls scale/channel label color for light/dark mode. Inactive segments use `rgba(128, 128, 128, 0.2)` to work on any background. Use transient `$props` for color, not CSS variables.
