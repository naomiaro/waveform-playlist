# Track Reorder Drag Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/specs/2026-07-25-track-reorder-drag-preview-design.md` (read it first).

**Goal:** During a track-reorder drag, the waveform column slot-snaps to the previewed order and displaced rows in BOTH columns slide (~150 ms) to make room; the dragged controls row is fully opaque with a lifted shadow; the dragged waveform row/lane carries `data-track-drag-source`; dawcore gets lane-preview parity.

**Architecture:** View-level preview only — a `trackDragPreview` context value set from dnd-kit's `onDragOver` and cleared on drag end/cancel; both columns render from a shared `computeTrackLayout` map with absolutely-positioned, transform-translated rows (DOM order never changes, so dnd-kit's `OptimisticSortingPlugin` splices are visually inert and the engine/undo history stay untouched until drop). dawcore mirrors the same transform-only principle inside its existing `TrackReorderHandler`.

**Tech Stack:** React 18/19 + styled-components (browser pkg), Lit (dawcore), vitest (jsdom for browser, happy-dom for dawcore), Playwright e2e.

## Global Constraints

- Transitions: `transform 150ms ease`; disabled under `@media (prefers-reduced-motion: reduce)` (React) / `matchMedia('(prefers-reduced-motion: reduce)').matches` (dawcore).
- Transition gating (React): active while a track drag is live and for a **200 ms trailing window** after it ends (so cancel-revert animates); outside that, layout changes apply instantly.
- Preview must be transform-only: **never** reorder DOM nodes or React children order mid-drag (reopens the #612 corruption class — see browser/CLAUDE.md "Track Reordering").
- Engine, `tracks`, `trackStates`, undo history untouched until the existing `onDragEnd` commit (`reorderTrack`).
- Dragged controls row: opacity `1` (was 0.85) + shadow `0 4px 12px rgba(0, 0, 0, 0.35)` while `isDragSource`.
- Emphasis attribute (exact name): `data-track-drag-source` on the dragged track's waveform row (React) and `.track-row` lane (dawcore); present only while the drag/preview is active.
- Repo rules: `pnpm lint` from root before every commit (0 errors required; ~416 warnings are pre-existing baseline); `pnpm typecheck` from root; browser unit tests `cd packages/browser && npx vitest run`; dawcore `cd packages/dawcore && npx vitest run`; after vitest across packages `pkill -f vitest` if `pgrep -f vitest` shows strays. Commit messages: conventional commits, no attribution footer, use `git commit -F -` heredoc when the message contains backticks.
- No new changeset needed: `.changeset/track-reordering.md` already covers `@waveform-playlist/browser` (minor) and `@dawcore/components` (patch).

---

### Task 1: Preview-order and layout-map utilities

**Files:**
- Create: `packages/browser/src/utils/trackOrderPreview.ts`
- Test: `packages/browser/src/utils/__tests__/trackOrderPreview.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (later tasks import these exact names from `../utils/trackOrderPreview` / `../../utils/trackOrderPreview`):
  - `interface TrackDragPreview { trackId: string; toIndex: number }`
  - `applyTrackOrderPreview<T extends { id: string }>(tracks: readonly T[], preview: TrackDragPreview | null): readonly T[]`
  - `interface TrackLayout { topById: Map<string, number>; totalHeight: number }`
  - `computeTrackLayout(orderedIds: readonly string[], heightById: ReadonlyMap<string, number>): TrackLayout`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/browser/src/utils/__tests__/trackOrderPreview.test.ts
import { describe, it, expect } from 'vitest';
import {
  applyTrackOrderPreview,
  computeTrackLayout,
  type TrackDragPreview,
} from '../trackOrderPreview';

const t = (id: string) => ({ id });
const tracks = [t('a'), t('b'), t('c'), t('d')];

describe('applyTrackOrderPreview', () => {
  it('returns the same array reference when preview is null', () => {
    expect(applyTrackOrderPreview(tracks, null)).toBe(tracks);
  });

  it('moves a track down', () => {
    const preview: TrackDragPreview = { trackId: 'a', toIndex: 2 };
    expect(applyTrackOrderPreview(tracks, preview).map((x) => x.id)).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
  });

  it('moves a track up', () => {
    const preview: TrackDragPreview = { trackId: 'd', toIndex: 0 };
    expect(applyTrackOrderPreview(tracks, preview).map((x) => x.id)).toEqual([
      'd',
      'a',
      'b',
      'c',
    ]);
  });

  it('is identity when toIndex equals the current index', () => {
    expect(applyTrackOrderPreview(tracks, { trackId: 'b', toIndex: 1 })).toBe(tracks);
  });

  it('is identity for an unknown trackId', () => {
    expect(applyTrackOrderPreview(tracks, { trackId: 'zzz', toIndex: 0 })).toBe(tracks);
  });

  it('clamps out-of-range toIndex into bounds', () => {
    expect(
      applyTrackOrderPreview(tracks, { trackId: 'a', toIndex: 99 }).map((x) => x.id)
    ).toEqual(['b', 'c', 'd', 'a']);
    expect(
      applyTrackOrderPreview(tracks, { trackId: 'c', toIndex: -5 }).map((x) => x.id)
    ).toEqual(['c', 'a', 'b', 'd']);
  });

  it('does not mutate the input array', () => {
    const before = tracks.slice();
    applyTrackOrderPreview(tracks, { trackId: 'a', toIndex: 3 });
    expect(tracks).toEqual(before);
  });
});

describe('computeTrackLayout', () => {
  it('computes cumulative tops and totalHeight for varying heights', () => {
    const heights = new Map([
      ['a', 100],
      ['b', 60],
      ['c', 140],
    ]);
    const layout = computeTrackLayout(['a', 'b', 'c'], heights);
    expect(layout.topById.get('a')).toBe(0);
    expect(layout.topById.get('b')).toBe(100);
    expect(layout.topById.get('c')).toBe(160);
    expect(layout.totalHeight).toBe(300);
  });

  it('reflects a previewed order (tops follow the order, heights follow the id)', () => {
    const heights = new Map([
      ['a', 100],
      ['b', 60],
      ['c', 140],
    ]);
    const layout = computeTrackLayout(['b', 'c', 'a'], heights);
    expect(layout.topById.get('b')).toBe(0);
    expect(layout.topById.get('c')).toBe(60);
    expect(layout.topById.get('a')).toBe(200);
    expect(layout.totalHeight).toBe(300);
  });

  it('treats ids with no height entry as height 0', () => {
    const layout = computeTrackLayout(['a', 'ghost', 'b'], new Map([['a', 50], ['b', 50]]));
    expect(layout.topById.get('ghost')).toBe(50);
    expect(layout.topById.get('b')).toBe(50);
    expect(layout.totalHeight).toBe(100);
  });

  it('empty input gives empty map and zero height', () => {
    const layout = computeTrackLayout([], new Map());
    expect(layout.topById.size).toBe(0);
    expect(layout.totalHeight).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd packages/browser && npx vitest run src/utils/__tests__/trackOrderPreview.test.ts`
Expected: FAIL — cannot resolve `../trackOrderPreview`.

- [ ] **Step 3: Implement**

```typescript
// packages/browser/src/utils/trackOrderPreview.ts
/**
 * Pure helpers for the track-reorder drag preview (see
 * docs/specs/2026-07-25-track-reorder-drag-preview-design.md).
 *
 * The preview is view-level only: it produces a DISPLAY order/geometry while
 * the engine's committed `tracks` order stays untouched until drop.
 */

export interface TrackDragPreview {
  trackId: string;
  toIndex: number;
}

/**
 * Returns the display order with the previewed track moved to `toIndex`.
 * Identity (same reference) when there is nothing to do — null preview,
 * unknown id, or an index that doesn't change the order.
 */
export function applyTrackOrderPreview<T extends { id: string }>(
  tracks: readonly T[],
  preview: TrackDragPreview | null
): readonly T[] {
  if (!preview) return tracks;
  const fromIndex = tracks.findIndex((t) => t.id === preview.trackId);
  if (fromIndex === -1) return tracks;
  const toIndex = Math.max(0, Math.min(tracks.length - 1, preview.toIndex));
  if (toIndex === fromIndex) return tracks;
  const next = tracks.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export interface TrackLayout {
  topById: Map<string, number>;
  totalHeight: number;
}

/**
 * Cumulative vertical layout for absolutely-positioned track rows. Both the
 * waveform column and the controls column render from the SAME layout so they
 * can never drift apart mid-preview. Ids missing from `heightById` contribute
 * height 0 (defensive; should not happen in practice).
 */
export function computeTrackLayout(
  orderedIds: readonly string[],
  heightById: ReadonlyMap<string, number>
): TrackLayout {
  const topById = new Map<string, number>();
  let top = 0;
  for (const id of orderedIds) {
    topById.set(id, top);
    top += heightById.get(id) ?? 0;
  }
  return { topById, totalHeight: top };
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `cd packages/browser && npx vitest run src/utils/__tests__/trackOrderPreview.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm lint   # require 0 errors
git add packages/browser/src/utils/trackOrderPreview.ts packages/browser/src/utils/__tests__/trackOrderPreview.test.ts
git commit -m "feat(browser): pure preview-order and track-layout helpers for reorder drag preview (#612)"
```

---

### Task 2: `useTrailingActive` hook (transition gating)

**Files:**
- Create: `packages/browser/src/hooks/useTrailingActive.ts`
- Test: `packages/browser/src/hooks/__tests__/useTrailingActive.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `useTrailingActive(active: boolean, trailingMs: number): boolean` — returns `true` while `active` is true AND for `trailingMs` after it goes false.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/browser/src/hooks/__tests__/useTrailingActive.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTrailingActive } from '../useTrailingActive';

describe('useTrailingActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(async () => {
    // React 19 teardown flake guard: cleanup inside act
    await act(async () => {
      cleanup();
    });
    vi.useRealTimers();
  });

  it('is false initially when inactive', () => {
    const { result } = renderHook(() => useTrailingActive(false, 200));
    expect(result.current).toBe(false);
  });

  it('is true immediately when active', () => {
    const { result } = renderHook(({ a }) => useTrailingActive(a, 200), {
      initialProps: { a: true },
    });
    expect(result.current).toBe(true);
  });

  it('stays true for trailingMs after deactivation, then goes false', () => {
    const { result, rerender } = renderHook(({ a }) => useTrailingActive(a, 200), {
      initialProps: { a: true },
    });
    rerender({ a: false });
    expect(result.current).toBe(true); // trailing window
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('re-activation during the trailing window cancels the pending deactivation', () => {
    const { result, rerender } = renderHook(({ a }) => useTrailingActive(a, 200), {
      initialProps: { a: true },
    });
    rerender({ a: false });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ a: true });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd packages/browser && npx vitest run src/hooks/__tests__/useTrailingActive.test.tsx`
Expected: FAIL — cannot resolve `../useTrailingActive`.

- [ ] **Step 3: Implement**

```typescript
// packages/browser/src/hooks/useTrailingActive.ts
import { useEffect, useState } from 'react';

/**
 * True while `active` is true and for `trailingMs` after it turns false.
 * Used to keep the track-reorder transform transition enabled through the
 * cancel-revert animation (see the drag-preview spec) without animating
 * unrelated layout changes outside a drag.
 */
export function useTrailingActive(active: boolean, trailingMs: number): boolean {
  const [trailing, setTrailing] = useState(active);
  useEffect(() => {
    if (active) {
      setTrailing(true);
      return undefined;
    }
    const timer = setTimeout(() => setTrailing(false), trailingMs);
    return () => clearTimeout(timer);
  }, [active, trailingMs]);
  return trailing || active;
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `cd packages/browser && npx vitest run src/hooks/__tests__/useTrailingActive.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm lint
git add packages/browser/src/hooks/useTrailingActive.ts packages/browser/src/hooks/__tests__/useTrailingActive.test.tsx
git commit -m "feat(browser): useTrailingActive hook for drag-preview transition gating (#612)"
```

---

### Task 3: Context plumbing for `trackDragPreview`

**Files:**
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx`
  - `PlaylistControlsContextValue` interface (near line 177, beside `bumpTrackReorderEpoch`)
  - `PlaylistDataContextValue` interface (near line 258, beside `trackReorderEpoch`)
  - provider state (near line 434, beside `trackReorderEpoch` state)
  - the two `useMemo` context values that include `bumpTrackReorderEpoch` (~1882/1935) and `trackReorderEpoch` (~1984/2011)

**Interfaces:**
- Consumes: `TrackDragPreview` type from Task 1 (`import type { TrackDragPreview } from './utils/trackOrderPreview';` — also re-export it from this file's exports for consumers: `export type { TrackDragPreview };`).
- Produces:
  - `usePlaylistData().trackDragPreview: TrackDragPreview | null`
  - `usePlaylistControls().setTrackDragPreview: React.Dispatch<React.SetStateAction<TrackDragPreview | null>>`

- [ ] **Step 1: Add the state**

Next to the `trackReorderEpoch` state (~line 434):

```typescript
// Live track-reorder drag preview (view-level only; see
// docs/specs/2026-07-25-track-reorder-drag-preview-design.md and the
// "Track Reordering" section of packages/browser/CLAUDE.md). Set by
// ClipInteractionProvider's onDragOver, cleared on drag end/cancel.
// The engine's committed order is untouched until drop.
const [trackDragPreview, setTrackDragPreview] = useState<TrackDragPreview | null>(null);
```

- [ ] **Step 2: Extend the interfaces**

In `PlaylistControlsContextValue` (after `bumpTrackReorderEpoch`):

```typescript
/** INTERNAL wiring for ClipInteractionProvider: publishes/clears the live
 *  track-reorder drag preview. Custom drag integrations may call it, but
 *  most consumers only ever READ trackDragPreview from usePlaylistData(). */
setTrackDragPreview: React.Dispatch<React.SetStateAction<TrackDragPreview | null>>;
```

In `PlaylistDataContextValue` (after `trackReorderEpoch`):

```typescript
/** Non-null while a track-reorder drag is live: the dragged track and the
 *  index it would drop at. Both playlist columns derive their display
 *  layout from it; custom renderTrackControls consumers can read it to
 *  mirror the preview in their own UI. */
trackDragPreview: TrackDragPreview | null;
```

- [ ] **Step 3: Thread through the context values**

Add `setTrackDragPreview` to the controls `useMemo` value AND its dependency array (both occurrences that contain `bumpTrackReorderEpoch` — the `useState` setter is referentially stable, so adding it to deps is inert). Add `trackDragPreview` to the data `useMemo` value AND its dependency array (both occurrences that contain `trackReorderEpoch`).

- [ ] **Step 4: Verify types and existing tests**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm typecheck
cd packages/browser && npx vitest run
```
Expected: typecheck clean; all existing browser tests still pass (context gained a field; nothing consumed it yet).

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm lint
git add packages/browser/src/WaveformPlaylistContext.tsx
git commit -m "feat(browser): trackDragPreview context state for reorder drag preview (#612)"
```

---

### Task 4: Publish the preview from drag events

**Files:**
- Modify: `packages/browser/src/components/ClipInteractionProvider.tsx` (destructure ~line 42, dragEnd branch ~lines 120-147, `DragDropProvider` props ~line 180)

**Interfaces:**
- Consumes: `setTrackDragPreview` from Task 3.
- Produces: runtime behavior only — `trackDragPreview` is non-null (with live `toIndex`) between the first boundary crossing and drag end/cancel.

- [ ] **Step 1: Wire `onDragOver`**

Add `setTrackDragPreview` to the `usePlaylistControls()` destructure, then add above `handleDragEnd`:

```typescript
// Publish the live track-reorder preview. dnd-kit fires dragover on every
// collision change; OptimisticSortingPlugin has already updated
// source.sortable.index by then. Functional set with an equality guard so
// repeated dragovers at the same index don't re-render the playlist.
const handleDragOver = React.useCallback(
  (event: { operation: { source?: { data?: unknown } | null } }) => {
    const data = event.operation.source?.data as
      | { kind?: string; trackId?: string }
      | undefined;
    if (data?.kind !== 'track-reorder' || !data.trackId) return;
    const sortable = (
      event.operation.source as unknown as {
        sortable?: { index: number; initialIndex: number };
      }
    ).sortable;
    if (!sortable) return;
    const trackId = data.trackId;
    const toIndex = sortable.index;
    setTrackDragPreview((prev) =>
      prev && prev.trackId === trackId && prev.toIndex === toIndex
        ? prev
        : { trackId, toIndex }
    );
  },
  [setTrackDragPreview]
);
```

- [ ] **Step 2: Clear on drag end (commit AND cancel)**

In `handleDragEnd`'s `track-reorder` branch, immediately after `bumpTrackReorderEpoch();` (i.e., BEFORE the `if (event.canceled || !data.trackId) return;` early return so cancel also clears):

```typescript
// Clear the preview in the same handler that commits: React batches this
// with reorderTrack's state updates, so the columns go straight from
// previewed layout to committed layout with no intermediate frame.
setTrackDragPreview(null);
```

Add `setTrackDragPreview` to `handleDragEnd`'s dependency array.

- [ ] **Step 3: Pass the handler to the provider**

```tsx
<DragDropProvider
  sensors={sensors}
  onDragStart={onDragStart}
  onDragMove={onDragMove}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
  modifiers={modifiers}
  plugins={noDropAnimationPlugins}
>
```

If TypeScript rejects the hand-written event parameter type, use `Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragOver']>>[0]` as the parameter type instead — do not `any`-cast the whole handler.

- [ ] **Step 4: Verify**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm typecheck && pnpm lint
cd packages/browser && npx vitest run
```
Expected: all clean/green. (Behavioral coverage lands with the e2e in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add packages/browser/src/components/ClipInteractionProvider.tsx
git commit -m "feat(browser): publish live track-reorder preview from onDragOver (#612)"
```

---

### Task 5: Layout-map rendering in PlaylistVisualization

**Files:**
- Modify: `packages/browser/src/components/PlaylistVisualization.tsx`
  - `ControlSlot` styled component (lines 63-80)
  - controls-slots build (lines 630-705, incl. sortable wrapper 676-685)
  - waveform track rows (lines 764-945: the `peaksDataArray.map` rendering `TrackComponent`)

**Interfaces:**
- Consumes: `applyTrackOrderPreview`, `computeTrackLayout` (Task 1); `useTrailingActive` (Task 2); `trackDragPreview` via `usePlaylistData()` (Task 3).
- Produces: DOM contract for e2e — every waveform row wrapper has `data-track-id="<id>"`; the dragged track's wrapper additionally has `data-track-drag-source="true"` while the preview is active; rows in both columns are absolutely positioned via `transform: translateY(...)`.

- [ ] **Step 1: Add styled components** (near `ControlSlot`)

```typescript
/** Drop-shadow for the floating (fully opaque) drag-source controls row. */
const DRAG_SOURCE_SHADOW = '0 4px 12px rgba(0, 0, 0, 0.35)';

interface PositionedRowProps {
  readonly $top: number;
  readonly $animate: boolean;
}

/**
 * Shared relative container for absolutely-positioned track rows. Explicit
 * height because absolute children don't size their parent.
 */
const TracksLayout = styled.div.attrs<{ $height: number }>((props) => ({
  style: { height: `${props.$height}px` },
}))<{ $height: number }>`
  position: relative;
`;

/**
 * Positions one waveform track row from the shared layout map. Transform
 * (not top) so position changes composite; transition only while a track
 * drag is active (+trailing window) so unrelated layout changes stay
 * instant. See docs/specs/2026-07-25-track-reorder-drag-preview-design.md.
 */
const TrackRowPositioner = styled.div.attrs<PositionedRowProps>((props) => ({
  style: { transform: `translateY(${props.$top}px)` },
}))<PositionedRowProps>`
  position: absolute;
  left: 0;
  right: 0;
  ${(props) => props.$animate && 'transition: transform 150ms ease;'}
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
```

And extend `ControlSlot` to the same positioning model (replace its current definition; keep the existing background/selection styling):

```typescript
interface ControlSlotProps {
  readonly $height: number;
  readonly $top: number;
  readonly $animate: boolean;
  readonly $isSelected?: boolean;
}

const ControlSlot = styled.div.attrs<ControlSlotProps>((props) => ({
  style: {
    height: `${props.$height}px`,
    transform: `translateY(${props.$top}px)`,
  },
}))<ControlSlotProps>`
  position: absolute;
  left: 0;
  right: 0;
  overflow: hidden;
  pointer-events: auto;
  background: ${(props) => props.theme.surfaceColor};
  transition: background 0.15s ease-in-out;
  ${(props) =>
    props.$animate && 'transition: transform 150ms ease, background 0.15s ease-in-out;'}
  @media (prefers-reduced-motion: reduce) {
    transition: background 0.15s ease-in-out;
  }
  ${(props) => props.$isSelected && `background: ${props.theme.selectedTrackControlsBackground};`}
`;
```

- [ ] **Step 2: Compute the shared layout** (in the component body, before the controls-slots build)

Add `trackDragPreview` to the existing `usePlaylistData()` destructure. Then:

```typescript
// Shared vertical layout for BOTH columns (waveform rows + control slots).
// Heights use the existing slot formula; order applies the live drag
// preview so both columns slide together. Hoisted from the per-slot
// computation so the two columns can never disagree.
const trackHeightById = useMemo(() => {
  const m = new Map<string, number>();
  peaksDataArray.forEach((trackClipPeaks, trackIndex) => {
    const track = tracks[trackIndex];
    if (!track) return;
    const maxChannels = getTrackChannelCount(trackClipPeaks, recordingState, track.id, mono);
    m.set(track.id, waveHeight * maxChannels + (showClipHeaders ? CLIP_HEADER_HEIGHT : 0));
  });
  return m;
}, [peaksDataArray, tracks, recordingState, mono, waveHeight, showClipHeaders]);

const displayOrderIds = useMemo(
  () => applyTrackOrderPreview(tracks, trackDragPreview).map((t) => t.id),
  [tracks, trackDragPreview]
);

const trackLayout = useMemo(
  () => computeTrackLayout(displayOrderIds, trackHeightById),
  [displayOrderIds, trackHeightById]
);

const animateTrackLayout = useTrailingActive(trackDragPreview !== null, 200);
```

Inside the controls-slots map, replace the local `slotHeight` computation with `const slotHeight = trackHeightById.get(track.id) ?? 0;` (delete the now-duplicated `maxChannels`/height lines there).

- [ ] **Step 3: Rewire the controls column**

Each `ControlSlot` gains the new props (key and children unchanged):

```tsx
<ControlSlot
  key={`${track.id}-${trackReorderEpoch}`}
  $height={slotHeight}
  $top={trackLayout.topById.get(track.id) ?? 0}
  $animate={animateTrackLayout}
  $isSelected={track.id === selectedTrackId}
>
```

Wrap the whole slots array in a single positioned container so the column keeps its height (the `trackControlsSlots` variable currently holds the mapped array; wrap it):

```tsx
const trackControlsSlots = controls.show
  ? [
      <TracksLayout key="control-slots-layout" $height={trackLayout.totalHeight}>
        {peaksDataArray.map(/* ...existing slot mapping... */)}
      </TracksLayout>,
    ]
  : undefined;
```

In the sortable wrapper (currently `style={{ height: '100%', opacity: isDragSource ? 0.85 : 1 }}`), make it opaque and lifted:

```tsx
<div
  ref={ref as React.Ref<HTMLDivElement>}
  style={{ height: '100%', boxShadow: isDragSource ? DRAG_SOURCE_SHADOW : undefined }}
>
```

- [ ] **Step 4: Rewire the waveform column**

Wrap the `peaksDataArray.map(...)` rows (the `TrackComponent` elements inside `<Playlist>`'s children) in the shared container and per-row positioners. Structure (key moves to the positioner):

```tsx
<TracksLayout $height={trackLayout.totalHeight}>
  {peaksDataArray.map((trackClipPeaks, trackIndex) => {
    const track = tracks[trackIndex];
    if (!track) return null;
    /* ...existing effectiveRenderMode / maxChannels computation unchanged... */
    return (
      <TrackRowPositioner
        key={track.id}
        $top={trackLayout.topById.get(track.id) ?? 0}
        $animate={animateTrackLayout}
        data-track-id={track.id}
        data-track-drag-source={trackDragPreview?.trackId === track.id ? 'true' : undefined}
      >
        <TrackComponent /* ...all existing props, but NO key... */>
          {/* existing children unchanged */}
        </TrackComponent>
      </TrackRowPositioner>
    );
  })}
</TracksLayout>
```

DOM order of rows/slots stays the committed `tracks` order — only transforms change (Global Constraints).

- [ ] **Step 5: Verify against existing suites**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm typecheck && pnpm lint
cd packages/browser && npx vitest run
cd /Users/naomiaro/Code/waveform-playlist && PORT=3287 npx playwright test e2e/track-reorder.spec.ts
```
Expected: all green (a Docusaurus dev server must be running on 3287: `cd website && pnpm exec docusaurus start --port 3287 --no-open`; `reuseExistingServer` is true). The existing drag e2e exercising commit + mixer identity + popover visibility must still pass with the new layout.

- [ ] **Step 6: Commit**

```bash
git add packages/browser/src/components/PlaylistVisualization.tsx
git commit -F - << 'EOF'
feat(browser): slot-snap drag preview via shared track layout map (#612)

Both playlist columns render from one computeTrackLayout map with
absolutely-positioned, transform-translated rows. During a track-reorder
drag the layout follows trackDragPreview, so the dragged waveform
slot-snaps and displaced rows slide (150ms, reduced-motion aware) in both
columns; DOM order never changes mid-drag. Drag source row is opaque with
a lifted shadow; dragged waveform row carries data-track-drag-source.
EOF
```

---

### Task 6: React e2e — preview order, emphasis, Escape revert

**Files:**
- Modify: `e2e/track-reorder.spec.ts`

**Interfaces:**
- Consumes: DOM contract from Task 5 (`data-track-id` wrappers, `data-track-drag-source`), preview lifecycle from Task 4.
- Produces: regression coverage; no code interfaces.

- [ ] **Step 1: Extend the existing drag test's mid-drag section**

In `drag reorders both track order and mixer identity (name follows)`, right after the existing mid-drag popover assertion (before `await page.mouse.up();`):

```typescript
// Slot-snap preview: after crossing the boundary the WAVEFORM column
// already shows the previewed order (rect-top order of the row wrappers),
// and the dragged row carries the emphasis attribute.
const midDragWaveformOrder = await page.evaluate(() =>
  [...document.querySelectorAll('[data-track-id]')]
    .filter((el) => el.parentElement?.matches('[data-scroll-container] *'))
    .map((el) => ({
      id: el.getAttribute('data-track-id'),
      top: el.getBoundingClientRect().top,
      isDragSource: el.hasAttribute('data-track-drag-source'),
    }))
    .sort((a, b) => a.top - b.top)
);
expect(midDragWaveformOrder[0]?.id).toBe(before.ids[1]);
expect(midDragWaveformOrder[1]?.id).toBe(before.ids[0]);
expect(midDragWaveformOrder[1]?.isDragSource).toBe(true);
expect(midDragWaveformOrder.filter((r) => r.isDragSource)).toHaveLength(1);
```

After the drop assertions, add an emphasis-cleared check:

```typescript
await expect(page.locator('[data-track-drag-source]')).toHaveCount(0);
```

- [ ] **Step 2: Add an Escape-revert test**

```typescript
test('Escape mid-drag reverts the preview in both columns', async ({ page }) => {
  const readIds = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-clip-container]')]
        .map((c) => ({ id: c.getAttribute('data-track-id'), top: c.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top)
        .map((r) => r.id)
    );
  const before = await readIds();

  const grips = page.locator('button[aria-label="Drag to reorder track"]');
  const box0 = await grips.nth(0).boundingBox();
  const box1 = await grips.nth(1).boundingBox();
  if (!box0 || !box1) throw new Error('Grip elements not laid out');
  const startY = box0.y + box0.height / 2;
  const endY = box1.y + box1.height / 2;
  await page.mouse.move(box0.x + box0.width / 2, startY);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(box0.x + box0.width / 2, startY + ((endY - startY) * i) / 15);
    await page.waitForTimeout(60);
  }
  // Preview active: order swapped, emphasis present
  await expect(async () => {
    const mid = await readIds();
    expect(mid[0]).toBe(before[1]);
  }).toPass({ timeout: 5000 });
  await expect(page.locator('[data-track-drag-source]')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await page.mouse.up();

  // Reverted: original order, no emphasis, no commit
  await expect(async () => {
    expect(await readIds()).toEqual(before);
  }).toPass({ timeout: 5000 });
  await expect(page.locator('[data-track-drag-source]')).toHaveCount(0);
});
```

- [ ] **Step 3: Run and verify PASS**

Run: `PORT=3287 npx playwright test e2e/track-reorder.spec.ts` (dev server on 3287 as in Task 5).
Expected: all tests pass.

- [ ] **Step 4: Sabotage check (prove the assertions bite)**

Temporarily comment out the `onDragOver={handleDragOver}` line in `ClipInteractionProvider.tsx`, wait ~3s for the dev server to hot-reload, re-run the spec. Expected: the new mid-drag assertions FAIL (no preview ever published). Restore the line, wait, re-run. Expected: PASS. Do not commit the sabotage.

- [ ] **Step 5: Commit**

```bash
git add e2e/track-reorder.spec.ts
git commit -m "test(e2e): mid-drag slot-snap preview, emphasis attr, and Escape revert (#612)"
```

---

### Task 7: dawcore lane parity in TrackReorderHandler

**Files:**
- Modify: `packages/dawcore/src/interactions/track-reorder-handler.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (styles block, near the `.track-row.selected` rule at ~line 860)
- Test: `packages/dawcore/src/__tests__/track-reorder-handler.test.ts`

**Interfaces:**
- Consumes: existing handler internals (`_rows`, `_fromIndex`, `_targetIndex`, `_cleanup`); daw-editor shadow DOM (`.timeline .track-row[data-track-id]`).
- Produces: during a drag — displaced `.track-row` lanes carry `translateY(±draggedLaneHeight)` transforms; the dragged lane slot-snaps (`translateY(targetTop − originTop)`), has `data-track-drag-source` and `z-index: 10`; all lane/row styles cleared by `_cleanup()`.

- [ ] **Step 1: Write the failing tests**

Extend `makeHost` so its fake shadow root also serves a timeline with lanes, and add a lane factory:

```typescript
function makeLane(trackId: string, top: number, height: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'track-row';
  el.setAttribute('data-track-id', trackId);
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 500,
    width: 500,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
  return el;
}

function makeHost(rows: HTMLElement[], lanes: HTMLElement[] = []): TrackReorderHost {
  const column = document.createElement('div');
  column.className = 'controls-column';
  rows.forEach((r) => column.appendChild(r));
  const timeline = document.createElement('div');
  timeline.className = 'timeline';
  lanes.forEach((l) => timeline.appendChild(l));
  return {
    isConnected: true,
    reorderTrack: vi.fn(),
    shadowRoot: {
      querySelector: (sel: string) =>
        sel === '.controls-column' ? column : sel === '.timeline' ? timeline : null,
    } as unknown as ShadowRoot,
  };
}
```

Update every existing `makeHost(rows)` call site — the default `lanes = []` keeps them compiling — then add (reuse the file's existing grab/move helpers; if it has none, mirror how the existing tests construct `PointerEvent`s):

```typescript
describe('lane preview parity', () => {
  it('shifts displaced lanes and slot-snaps the dragged lane on pointermove', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80), makeRow('c', 160, 80)];
    const lanes = [makeLane('a', 0, 120), makeLane('b', 120, 120), makeLane('c', 240, 120)];
    const host = makeHost(rows, lanes);
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('div');
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    // past row b's midpoint (rows drive collision, at 120)
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 130 }));
    // displaced lane b shifts up by dragged LANE height (120, not row height 80)
    expect(lanes[1].style.transform).toBe('translateY(-120px)');
    expect(lanes[2].style.transform).toBe('');
    // dragged lane slot-snaps to lane b's slot: (120 + 120) - (0 + 120) = 120
    expect(lanes[0].style.transform).toBe('translateY(120px)');
    expect(lanes[0].getAttribute('data-track-drag-source')).not.toBeNull();
    expect(lanes[0].style.zIndex).toBe('10');
  });

  it('cleanup on pointerup clears all lane styles and the emphasis attribute', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80)];
    const lanes = [makeLane('a', 0, 100), makeLane('b', 100, 100)];
    const host = makeHost(rows, lanes);
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('div');
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 140 }));
    grip.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 140 }));
    for (const lane of lanes) {
      expect(lane.style.transform).toBe('');
      expect(lane.style.transition).toBe('');
      expect(lane.style.zIndex).toBe('');
      expect(lane.getAttribute('data-track-drag-source')).toBeNull();
    }
  });

  it('missing lanes (no timeline) degrade to rows-only behavior', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80)];
    const host = makeHost(rows); // no lanes
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('div');
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 140 }));
    expect(rows[1].style.transform).toBe('translateY(-80px)');
    grip.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 140 }));
    expect(host.reorderTrack).toHaveBeenCalledWith('a', 1);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd packages/dawcore && npx vitest run src/__tests__/track-reorder-handler.test.ts`
Expected: new tests FAIL (no lane transforms yet); existing tests PASS.

- [ ] **Step 3: Implement in `track-reorder-handler.ts`**

Add state and a reduced-motion helper:

```typescript
private _lanes: (RowInfo | null)[] = []; // aligned with _rows indices; null = lane not found

private static _reducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
```

In `onGrab`, after `this._rows` is built and `_fromIndex` validated (keep the existing early-return order), snapshot lanes and arm transitions:

```typescript
// Waveform-lane parity (drag-preview spec): snapshot the shadow timeline's
// .track-row lanes by trackId. Transform-only mirroring — lane DOM order
// never changes, so the editor's MutationObserver order-sync never fires.
const timeline = this._host.shadowRoot?.querySelector('.timeline');
const laneEls = timeline
  ? ([...timeline.querySelectorAll('.track-row')] as HTMLElement[])
  : [];
this._lanes = this._rows.map((r) => {
  const el = laneEls.find((l) => l.getAttribute('data-track-id') === r.trackId) ?? null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { el, top: rect.top, height: rect.height, trackId: r.trackId };
});

const draggedLane = this._lanes[this._fromIndex];
if (draggedLane) {
  draggedLane.el.setAttribute('data-track-drag-source', '');
  draggedLane.el.style.zIndex = '10';
  draggedLane.el.style.position = 'relative';
}
if (!TrackReorderHandler._reducedMotion()) {
  // Displaced rows and ALL lanes animate; the dragged CONTROLS row does not
  // (it pixel-follows the pointer, a transition would make it lag).
  for (let i = 0; i < this._rows.length; i++) {
    if (i !== this._fromIndex) this._rows[i].el.style.transition = 'transform 150ms ease';
    const lane = this._lanes[i];
    if (lane) lane.el.style.transition = 'transform 150ms ease';
  }
}
```

In `_onPointerMove`, after the existing displaced-row shift loop, mirror to lanes (lane shifts use LANE heights — they can differ from controls-row heights):

```typescript
// Mirror the preview onto the waveform lanes.
const draggedLaneInfo = this._lanes[this._fromIndex];
for (let i = 0; i < this._lanes.length; i++) {
  const lane = this._lanes[i];
  if (!lane || !draggedLaneInfo) continue;
  if (i === this._fromIndex) {
    // Slot-snap the dragged lane to the target slot (not pixel-follow).
    let offset = 0;
    const targetLane = this._lanes[target];
    if (targetLane && target > this._fromIndex) {
      offset = targetLane.top + targetLane.height - (draggedLaneInfo.top + draggedLaneInfo.height);
    } else if (targetLane && target < this._fromIndex) {
      offset = targetLane.top - draggedLaneInfo.top;
    }
    lane.el.style.transform = offset === 0 ? '' : 'translateY(' + offset + 'px)';
    continue;
  }
  let shift = 0;
  if (i > this._fromIndex && i <= target) shift = -draggedLaneInfo.height;
  else if (i < this._fromIndex && i >= target) shift = draggedLaneInfo.height;
  lane.el.style.transform = shift === 0 ? '' : 'translateY(' + shift + 'px)';
}
```

In `_cleanup()`, extend the reset loop (rows also need their transition cleared) and reset lanes:

```typescript
for (const row of this._rows) {
  row.el.style.transform = '';
  row.el.style.zIndex = '';
  row.el.style.position = '';
  row.el.style.transition = '';
}
for (const lane of this._lanes) {
  if (!lane) continue;
  lane.el.style.transform = '';
  lane.el.style.transition = '';
  lane.el.style.zIndex = '';
  lane.el.style.position = '';
  lane.el.removeAttribute('data-track-drag-source');
}
this._lanes = [];
```

- [ ] **Step 4: Add the emphasis style in `daw-editor.ts`**

Next to the `.track-row.selected` rule (~line 860):

```css
.track-row[data-track-drag-source] {
  background: rgba(99, 199, 95, 0.08);
}
```

- [ ] **Step 5: Run to verify PASS**

```bash
cd packages/dawcore && npx vitest run
cd packages/dawcore && npx tsc --noEmit
```
Expected: all dawcore tests pass (per-package typecheck is the dawcore convention).

- [ ] **Step 6: Lint + commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm lint
git add packages/dawcore/src/interactions/track-reorder-handler.ts packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/track-reorder-handler.test.ts
git commit -F - << 'EOF'
feat(dawcore): waveform-lane preview parity for track-reorder drags (#612)

TrackReorderHandler mirrors its shift map onto the shadow timeline's
.track-row lanes: displaced lanes slide by the dragged lane height, the
dragged lane slot-snaps to the target slot with data-track-drag-source
emphasis; 150ms transitions (reduced-motion aware) on displaced rows and
lanes. Transform-only, so the DOM-to-engine order sync never fires
mid-drag; cleanup and editor-disconnect cancel clear everything.
EOF
```

---

### Task 8: dawcore live-browser verification + docs sync + final sweeps

**Files:**
- Modify: `packages/browser/CLAUDE.md` ("Track Reordering" section)
- Modify: `packages/dawcore/CLAUDE.md` (track reordering notes)
- Modify: `website/docs/llm-reference.md` (context interfaces), `website/docs/api/hooks.md` (`usePlaylistData` table)

**Interfaces:** none produced; documents Tasks 1-7.

- [ ] **Step 1: Live-check dawcore in a real browser**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm exec vite --config examples/dawcore-native/vite.config.ts --port 5233
```
Drive with Playwright MCP (or headed): open `http://localhost:5233/`, real-mouse drag a grip past the next row, screenshot mid-drag. Expected: displaced lanes shifted, dragged lane slot-snapped with the green tint, everything reverts on Escape-free pointerup at origin. Kill the server after.

- [ ] **Step 2: Docs updates**

- `packages/browser/CLAUDE.md` → "Track Reordering": add a paragraph — both columns render from `computeTrackLayout` with absolutely-positioned transform-translated rows; `trackDragPreview` (set by `ClipInteractionProvider.onDragOver`, cleared on end/cancel) drives the slot-snap preview; transitions gated by `useTrailingActive(preview !== null, 200)`; DOM order never changes mid-drag (OptimisticSorting splices now visually inert but epoch remount + popover healer still required); custom `renderTrackControls` consumers can read `trackDragPreview` from `usePlaylistData()`.
- `packages/dawcore/CLAUDE.md`: note the lane mirroring + `data-track-drag-source` styling hook in `TrackReorderHandler`.
- `website/docs/llm-reference.md`: add `trackDragPreview: TrackDragPreview | null` to the `usePlaylistData` interface listing and the `TrackDragPreview` type.
- `website/docs/api/hooks.md`: add the `trackDragPreview` row to the `usePlaylistData` context value table.
- Verify docs render: `pnpm --filter website build` (CSS calc warnings are pre-existing).

- [ ] **Step 3: Full verification sweeps**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm lint && pnpm typecheck
cd packages/browser && npx vitest run
cd ../dawcore && npx vitest run
cd /Users/naomiaro/Code/waveform-playlist && pnpm test   # FULL Playwright suite (repo rule: only full runs are valid)
pgrep -f vitest && pkill -f vitest || true
```
Expected: lint 0 errors; typecheck clean; unit suites green; full e2e green (known `effects.spec.ts` intra-run readiness flakes vary between runs — a real regression fails the same tests every run).

- [ ] **Step 4: Commit docs**

```bash
git add packages/browser/CLAUDE.md packages/dawcore/CLAUDE.md website/docs/llm-reference.md website/docs/api/hooks.md
git commit -m "docs: track reorder drag preview — layout map, trackDragPreview context, dawcore lane parity (#612)"
```

- [ ] **Step 5: Remove the working spec + plan** (repo rule: PR description is the durable record — do this only when the whole feature is confirmed done and reviewed)

```bash
git rm docs/specs/2026-07-25-track-reorder-drag-preview-design.md docs/plans/2026-07-25-track-reorder-drag-preview.md
git commit -m "docs: remove drag-preview working spec and plan (PR carries the record)"
```

---

## Self-Review Notes

- Spec §1 (preview plumbing) → Tasks 3-4; §2′ (layout map both columns) → Tasks 1, 5; §3 (opaque + shadow + emphasis + no-insertion-line) → Task 5 (emphasis attr, shadow, opacity) — the waveform tint itself comes free because `onDragStart` already selects the dragged track (selection tint), with `data-track-drag-source` as the explicit hook/assertable marker; §4 (dawcore) → Task 7; testing section → Tasks 1, 2, 6, 7 (the spec's "preview lifecycle unit test in ClipInteractionProvider" is covered by Task 6's e2e + sabotage check instead of a jsdom provider mount, per the repo's test-the-seam convention); dawcore e2e parity is covered by Task 7's unit tests + Task 8's live-browser check (the dawcore-native Playwright specs require a manually-started Vite server per `e2e/dawcore-spectrogram.spec.ts`'s convention — adding one is optional and out of scope).
- Names cross-checked: `TrackDragPreview`, `applyTrackOrderPreview`, `computeTrackLayout`, `TrackLayout.topById/totalHeight`, `useTrailingActive`, `trackDragPreview`, `setTrackDragPreview`, `TracksLayout`, `TrackRowPositioner`, `DRAG_SOURCE_SHADOW`, `data-track-drag-source`, `_lanes` are used consistently across tasks.
- `PositionedRowProps.$animate` in a template literal (not `.attrs`) is deliberate: it's a two-value boolean (two generated classes), not a frequently-changing value.
