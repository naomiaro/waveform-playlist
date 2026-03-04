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

## @dnd-kit Feedback Plugin Per-Entity Config

**Pattern:** `useDraggable({ feedback: 'none' })` disables the Feedback plugin for that draggable — no fixed positioning, no CSS translate, no placeholder, no drop animation. Used on boundary trim handles where React state provides visual feedback.

**Type chain:** `UseDraggableInput` extends `Omit<DraggableInput, 'handle' | 'element'>` where `DraggableInput` is from `@dnd-kit/dom` (includes `feedback?: FeedbackType`). The `plugins` property does NOT exist on `useDraggable` in v0.3.2.

**Applied in:** `Clip.tsx` (left/right boundary draggables), `AnnotationBox.tsx` (start/end boundary draggables).

## Bar Width Peak Aggregation (Channel.tsx)

**Invariant:** When `barWidth + barGap > 1` (step > 1), each bar must aggregate ALL peaks in its range using min-of-mins / max-of-maxes. Never sample a single peak per bar — skipping intermediate peaks loses amplitude data, causing zoom-dependent visual inconsistency.

**Performance:** When `step === 1` (the common case), the aggregation loop body never executes — zero overhead.

**Implementation:** Peak rendering math is extracted into pure functions in `src/utils/peakRendering.ts` (`aggregatePeaks`, `calculateBarRects`, `calculateFirstBarPosition`), tested in `src/__tests__/peakRendering.test.ts` (22 tests). Channel.tsx imports and calls these helpers in its `useLayoutEffect`.

## Important Patterns (UI-Specific)

- **Stable React Keys for Tracks/Clips** - Always use `track.id` / `clip.clipId` as React keys, never array indices. Index-based keys cause DOM reuse on removal, breaking `transferControlToOffscreen()` (can only be called once per canvas) and causing stale OffscreenCanvas references.
- **Per-Track Maps Must Use Track ID** - Any `Map` storing per-track overrides (render modes, configs) must be keyed by `track.id` (string), not array index. Index keys break when tracks are added/removed.
- **Canvas Cleanup on Chunk Changes** - `useChunkedCanvasRefs` runs cleanup on every render (no dependency array) because the virtualizer can unmount canvases between any render. SpectrogramChannel's worker registration effect uses `visibleChunkIndices` as a dependency so it re-runs when chunks mount/unmount, cleaning stale registrations and transferring new canvases in a single pass.
- **Virtual Scrolling Chunk Offsets** - Canvas registries may contain non-consecutive chunks (e.g., chunks 50-55). Use `extractChunkNumber(canvasId)` to get the real chunk index — never compute offsets by summing widths from array index 0.
- **Multi-Channel Rendering Fairness** - Render visible chunks for ALL channels before background batches. Sequential per-channel rendering causes channel starvation when generation aborts interrupt background work.
