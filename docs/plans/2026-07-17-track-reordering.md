# Vertical Track Reordering Implementation Plan (Issue #612)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drag-and-drop + move-up/down vertical track reordering across engine, React, and dawcore, per `docs/specs/2026-07-17-track-reordering-design.md`.

**Architecture:** `PlaylistEngine.reorderTrack(trackId, toIndex)` (undoable, no adapter call) is the single reorder operation. React rides the existing engine→`onTracksChange` mirror (no rebuild); drag via `@dnd-kit/react/sortable` inside the existing `DragDropProvider`. dawcore keeps DOM order as visual authority: file drop now synthesizes `<daw-track>` elements, the MutationObserver distinguishes moves from removals and syncs DOM→engine, and the statechange handler syncs engine→DOM for undo/redo.

**Tech Stack:** TypeScript, Lit, React 18, @dnd-kit 0.3.2 (installed; `sortable` subpath ships inside `@dnd-kit/react`), vitest, Playwright.

**dnd-kit reference source:** a local checkout lives at `/Users/naomiaro/Code/dnd-kit` — consult it (not guesses) for any @dnd-kit behavior question. Already verified there: `useSortable` works without a `DragDropProvider` (`useDragDropManager() ?? undefined` — drag inert, no throw); `OptimisticSortingPlugin` keeps `source.sortable.index` current during a drag and reverts it to `initialIndex` on cancel; per-source `modifiers` replace the provider's for that operation.

## Global Constraints

- Branch: `feature/track-reordering`. Never push to `main`.
- Boolean props/attributes default `false` (opt-in shorthand): React `trackReordering`, dawcore `track-reordering`.
- No mutation — immutable array updates everywhere (filter + slice spread, never `splice` on live state).
- `console.log`/`console.warn` string-only (never pass objects).
- Commit messages: `<type>: <description>`, no attribution footer, backticks never inside `git commit -m "…"` (use `git commit -F - << 'EOF'`).
- Run `pnpm lint` (repo root) before every commit. Unit tests run per-package: `cd packages/<pkg> && npx vitest run`. After engine changes, `pnpm --filter @waveform-playlist/engine build` before running browser/dawcore tests (they resolve engine via `dist/`).
- dawcore editor tests: copy `daw-editor-midi.test.ts:makeMockAdapter` for adapter mocks (must include `init`, `isPlaying`, `updateTrack`); append test editors to `document.body`; cleanup in `afterEach`.
- New engine API: minor bump (changeset in final task). dawcore is zerover — always `patch`.

---

### Task 1: Engine — `reorderTrack(trackId, toIndex)`

**Files:**
- Modify: `packages/engine/src/PlaylistEngine.ts` (insert after `removeTrack`, ~line 255)
- Test: `packages/engine/src/__tests__/PlaylistEngine.test.ts` (inside `describe('track management')`, after the removeTrack tests)
- Test: `packages/engine/src/__tests__/undo.test.ts` (new describe after `addTrack/removeTrack undo`)

**Interfaces:**
- Produces: `PlaylistEngine.reorderTrack(trackId: string, toIndex: number): void` — clamps `toIndex` to `[0, tracks.length-1]`; no-ops (no snapshot/version/event) on unknown id or already-at-index; pushes undo snapshot; bumps `tracksVersion`; emits `statechange`; **never calls the adapter**.

- [ ] **Step 1: Write failing tests in `PlaylistEngine.test.ts`**

Uses the file's existing `makeTrack(id, clips)` / `createMockAdapter()` helpers:

```typescript
  describe('reorderTrack', () => {
    it('moves a track to the target index', () => {
      const engine = new PlaylistEngine();
      engine.setTracks([makeTrack('a', []), makeTrack('b', []), makeTrack('c', [])]);
      engine.reorderTrack('a', 2);
      expect(engine.getState().tracks.map((t) => t.id)).toEqual(['b', 'c', 'a']);
      engine.reorderTrack('c', 0);
      expect(engine.getState().tracks.map((t) => t.id)).toEqual(['c', 'b', 'a']);
      engine.dispose();
    });

    it('clamps toIndex to the valid range', () => {
      const engine = new PlaylistEngine();
      engine.setTracks([makeTrack('a', []), makeTrack('b', [])]);
      engine.reorderTrack('a', 99);
      expect(engine.getState().tracks.map((t) => t.id)).toEqual(['b', 'a']);
      engine.reorderTrack('a', -5);
      expect(engine.getState().tracks.map((t) => t.id)).toEqual(['a', 'b']);
      engine.dispose();
    });

    it('is a no-op for unknown trackId (no event, no version bump)', () => {
      const engine = new PlaylistEngine();
      engine.setTracks([makeTrack('a', []), makeTrack('b', [])]);
      const before = engine.getState().tracksVersion;
      const listener = vi.fn();
      engine.on('statechange', listener);
      engine.reorderTrack('nope', 0);
      expect(listener).not.toHaveBeenCalled();
      expect(engine.getState().tracksVersion).toBe(before);
      engine.dispose();
    });

    it('is a no-op when already at the target index (no undo snapshot)', () => {
      const engine = new PlaylistEngine();
      engine.setTracks([makeTrack('a', []), makeTrack('b', [])]);
      engine.reorderTrack('a', 0);
      expect(engine.canUndo).toBe(false);
      engine.dispose();
    });

    it('bumps tracksVersion and emits statechange', () => {
      const engine = new PlaylistEngine();
      engine.setTracks([makeTrack('a', []), makeTrack('b', [])]);
      const before = engine.getState().tracksVersion;
      const listener = vi.fn();
      engine.on('statechange', listener);
      engine.reorderTrack('a', 1);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(engine.getState().tracksVersion).toBe(before + 1);
      engine.dispose();
    });

    it('never calls the adapter (order is not audible)', () => {
      const adapter = createMockAdapter();
      const engine = new PlaylistEngine();
      engine.setAdapter(adapter);
      engine.setTracks([makeTrack('a', []), makeTrack('b', [])]);
      const setTracksCalls = (adapter.setTracks as ReturnType<typeof vi.fn>).mock.calls.length;
      engine.reorderTrack('a', 1);
      expect((adapter.setTracks as ReturnType<typeof vi.fn>).mock.calls.length).toBe(setTracksCalls);
      engine.dispose();
    });
  });
```

Note: check how other tests in the file attach the adapter — if the constructor takes it (`new PlaylistEngine({ adapter })` or a different method name than `setAdapter`), copy that file's existing pattern from the addTrack adapter test (~line 144).

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/engine && npx vitest run -t 'reorderTrack'`
Expected: FAIL — `engine.reorderTrack is not a function`.

- [ ] **Step 3: Implement `reorderTrack` in `PlaylistEngine.ts`** (after `removeTrack`)

```typescript
  /**
   * Move a track to a new position in the track order. Purely organizational —
   * track order is not audible (adapter nodes are keyed by track id), so the
   * adapter is deliberately NOT called: a setTracks() here would rebuild
   * playout and interrupt playback for a visual-only change.
   */
  reorderTrack(trackId: string, toIndex: number): void {
    const fromIndex = this._tracks.findIndex((t) => t.id === trackId);
    if (fromIndex === -1) return;
    const clamped = Math.max(0, Math.min(toIndex, this._tracks.length - 1));
    if (clamped === fromIndex) return;
    this._pushUndoSnapshot();
    const track = this._tracks[fromIndex];
    const without = this._tracks.filter((t) => t.id !== trackId);
    this._tracks = [...without.slice(0, clamped), track, ...without.slice(clamped)];
    this._tracksVersion++;
    this._emitStateChange();
  }
```

- [ ] **Step 4: Write failing undo test in `undo.test.ts`** (this file's local helpers have DIFFERENT signatures: `makeClip(start, duration)`, `makeTrack([clips])`; `engine` comes from `beforeEach`)

```typescript
  describe('reorderTrack undo', () => {
    it('undo restores the previous order; redo re-applies it', () => {
      const t1 = makeTrack([makeClip(0, 48000)]);
      const t2 = makeTrack([makeClip(0, 24000)]);
      engine.setTracks([t1, t2]);
      const [idA, idB] = engine.getState().tracks.map((t) => t.id);

      engine.reorderTrack(idA, 1);
      expect(engine.getState().tracks.map((t) => t.id)).toEqual([idB, idA]);

      engine.undo();
      expect(engine.getState().tracks.map((t) => t.id)).toEqual([idA, idB]);

      engine.redo();
      expect(engine.getState().tracks.map((t) => t.id)).toEqual([idB, idA]);
    });
  });
```

- [ ] **Step 5: Run all engine tests**

Run: `cd packages/engine && npx vitest run`
Expected: ALL PASS (undo works via the existing snapshot machinery — no new undo code). Note: undo of a reorder goes through `_restoreTracks`'s existing incremental adapter path; a permutation-skip optimization there was considered and rejected (snapshots are copies, so reference-identity permutation detection is impossible; content-equality checks aren't worth it).

- [ ] **Step 6: Build engine (downstream packages resolve via dist/), lint, commit**

```bash
pnpm --filter @waveform-playlist/engine build && pnpm lint
git add packages/engine && git commit -m "feat(engine): reorderTrack operation with undo support (#612)"
```

---

### Task 2: ui-components — reorder icons

**Files:**
- Create: `packages/ui-components/src/components/TrackControls/GripIcon.tsx`
- Create: `packages/ui-components/src/components/TrackControls/MoveUpIcon.tsx`
- Create: `packages/ui-components/src/components/TrackControls/MoveDownIcon.tsx`
- Modify: `packages/ui-components/src/components/TrackControls/index.tsx` (barrel)
- Modify: `packages/ui-components/src/index.ts` (re-export — check how `CloseButton` etc. are exported and mirror it)

**Interfaces:**
- Produces: `GripIcon`, `MoveUpIcon`, `MoveDownIcon` — `React.FC<IconProps>` following the `VolumeUpIcon` phosphor pattern, exported from `@waveform-playlist/ui-components`.

- [ ] **Step 1: Create the three icon components** (phosphor icons, matching `VolumeUpIcon.tsx` exactly):

```typescript
// GripIcon.tsx
import React from 'react';
import { DotsSixVerticalIcon, type IconProps } from '@phosphor-icons/react';

export const GripIcon: React.FC<IconProps> = (props) => (
  <DotsSixVerticalIcon weight="bold" {...props} />
);
```

```typescript
// MoveUpIcon.tsx
import React from 'react';
import { CaretUpIcon, type IconProps } from '@phosphor-icons/react';

export const MoveUpIcon: React.FC<IconProps> = (props) => <CaretUpIcon weight="bold" {...props} />;
```

```typescript
// MoveDownIcon.tsx
import React from 'react';
import { CaretDownIcon, type IconProps } from '@phosphor-icons/react';

export const MoveDownIcon: React.FC<IconProps> = (props) => (
  <CaretDownIcon weight="bold" {...props} />
);
```

If `DotsSixVerticalIcon`/`CaretUpIcon`/`CaretDownIcon` don't exist under those names in the installed `@phosphor-icons/react`, check how `DotsIcon.tsx` imports its glyph (the package has both `X`-style and `XIcon`-style export aliases) and use the same alias style: `DotsSixVertical`, `CaretUp`, `CaretDown`.

- [ ] **Step 2: Add all three to the TrackControls barrel and the package root export, mirroring `DotsIcon`.**

- [ ] **Step 3: Verify with typecheck + build, commit**

```bash
pnpm --filter @waveform-playlist/ui-components build && pnpm lint
git add packages/ui-components && git commit -m "feat(ui-components): grip and move up/down icons for track reordering (#612)"
```

---

### Task 3: browser — `reorderTrack` provider control

**Files:**
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx`

**Interfaces:**
- Consumes: `engineRef.current.reorderTrack(trackId, toIndex)` (Task 1).
- Produces: `reorderTrack(trackId: string, toIndex: number): void` on `PlaylistControlsContextValue`, exposed via `usePlaylistControls()`.

Key insight (verified): the provider's `statechange` handler already mirrors engine track changes to the consumer (`onTracksChange(state.tracks)` at ~line 948) with `engineTracksRef.current = state.tracks`, so `loadAudio` skips the rebuild (`tracks === engineTracksRef.current`). The control therefore ONLY calls the engine — the reordered array flows back through the mirror. No React-side permutation code.

- [ ] **Step 1: Add to `PlaylistControlsContextValue`** (after `setTrackPan`, ~line 166):

```typescript
  /** Move a track to a new index in the vertical track order. Purely
   *  organizational — playback is not interrupted. The reordered tracks
   *  array flows back through onTracksChange. */
  reorderTrack: (trackId: string, toIndex: number) => void;
```

- [ ] **Step 2: Implement the callback in the provider body** (near the other track-control callbacks; model is `useUndoState`'s `undo`):

```typescript
  const reorderTrack = useCallback(
    (trackId: string, toIndex: number) => {
      if (!engineRef.current) {
        console.warn('[waveform-playlist] reorderTrack: engine not ready, call ignored');
        return;
      }
      engineRef.current.reorderTrack(trackId, toIndex);
    },
    [engineRef]
  );
```

- [ ] **Step 3: Add `reorderTrack` to BOTH context value `useMemo`s** (the controls memo ~line 1837 region and the legacy combined memo ~line 1873 region — grep for where `undo,` appears in each memo and its dependency array; add `reorderTrack` alongside in both value object AND deps).

- [ ] **Step 4: Verify + commit**

```bash
pnpm --filter @waveform-playlist/browser build && pnpm lint
git add packages/browser && git commit -m "feat(browser): reorderTrack control on usePlaylistControls (#612)"
```

---

### Task 4: browser — sortable track controls UI (`trackReordering` prop)

**Files:**
- Create: `packages/browser/src/components/SortableTrackControls.tsx`
- Modify: `packages/browser/src/components/PlaylistVisualization.tsx` (props interface ~line 75, controls-slot builder ~lines 472–580)
- Modify: `packages/browser/src/components/Waveform.tsx` (thread the prop)
- Modify: `packages/browser/src/index.tsx` (export `SortableTrackControls` for custom-controls consumers — mirror how other components are exported)

**Interfaces:**
- Consumes: `usePlaylistControls().reorderTrack` (Task 3); `GripIcon`/`MoveUpIcon`/`MoveDownIcon` (Task 2); `useSortable` from `@dnd-kit/react/sortable`; `RestrictToVerticalAxis` from `@dnd-kit/abstract/modifiers`.
- Produces: `<Waveform trackReordering />`; sortable source data shape `{ kind: 'track-reorder', trackId: string }` (Task 5 branches on `kind`); sortable `group: 'playlist-tracks'`, `type: 'track'`, `accept: ['track']`.

Verified dnd-kit v0.3.2 facts (do not re-litigate):
- `useSortable` input extends `DraggableInput & DroppableInput` + `{ index, group, target?, transition? }`; returns `{ ref, handleRef, isDragSource, ... }`.
- **Per-source `modifiers` REPLACE the provider's modifiers for that operation** (`@dnd-kit/abstract` PluginRegistry: `source?.modifiers ?? managerModifiers`) — so `modifiers: [RestrictToVerticalAxis]` on the sortable escapes `RestrictToHorizontalAxis`/`ClipCollisionModifier`/snap.
- `type: 'track'` + `accept: ['track']` keeps clip drags from interacting with track-row droppables.
- `RestrictToVerticalAxis` is exported from `@dnd-kit/abstract/modifiers`.

- [ ] **Step 1: Add explicit dependency entry.** In `packages/browser/package.json`, the `@dnd-kit/react ^0.3.0` dependency already exists — no change needed (the `sortable` subpath ships inside it). Verify with `ls node_modules/.pnpm/@dnd-kit+react@0.3.2*/node_modules/@dnd-kit/react/sortable.js`.

- [ ] **Step 2: Create `SortableTrackControls.tsx`** — render-prop wrapper isolating the hook:

```tsx
import React from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';

export interface SortableTrackControlsRenderProps {
  /** Attach to the slot wrapper element (the sortable item). */
  ref: (element: Element | null) => void;
  /** Attach to the drag grip element. */
  handleRef: (element: Element | null) => void;
  isDragSource: boolean;
}

export interface SortableTrackControlsProps {
  trackId: string;
  index: number;
  disabled?: boolean;
  children: (props: SortableTrackControlsRenderProps) => React.ReactNode;
}

/**
 * Registers a track-controls row as a vertical sortable item in the ambient
 * DragDropProvider (ClipInteractionProvider). The per-source modifiers
 * REPLACE the provider's clip modifiers for this operation, so track drags
 * are vertical-only and skip clip collision/snap. Data kind 'track-reorder'
 * is the discriminator the shared drag handlers branch on.
 */
export const SortableTrackControls: React.FC<SortableTrackControlsProps> = ({
  trackId,
  index,
  disabled = false,
  children,
}) => {
  const { ref, handleRef, isDragSource } = useSortable({
    id: `track-reorder-${trackId}`,
    index,
    group: 'playlist-tracks',
    type: 'track',
    accept: ['track'],
    data: { kind: 'track-reorder', trackId },
    modifiers: [RestrictToVerticalAxis],
    disabled,
  });
  return <>{children({ ref, handleRef, isDragSource })}</>;
};
```

- [ ] **Step 3: Add `trackReordering` to `PlaylistVisualizationProps`** (~line 75):

```typescript
  /** Enable vertical track reordering: a drag grip + move up/down buttons on
   *  each default track control panel. Drag requires ClipInteractionProvider
   *  (the ambient DragDropProvider); the buttons work regardless. Default: false. */
  trackReordering?: boolean;
```

Destructure it (default `false`) alongside `renderTrackControls` (~line 188). Get `reorderTrack` from the existing `usePlaylistControls()` destructuring in this component (add it to that destructure).

- [ ] **Step 4: Add the reorder affordances to the default controls block** (~lines 497–580). Restructure minimally: keep the existing `<Controls>…</Controls>` JSX exactly as is, but assign it to a local `defaultControls` variable built by a small helper so both branches share it. Concretely, replace

```tsx
        const trackControlContent = renderTrackControls ? (
          renderTrackControls(trackIndex)
        ) : (
          <Controls onClick={() => selectTrack(trackIndex)}>
```

with a structure where the default `<Controls>` receives two additions when `trackReordering` is true:

1. In the `<Header>`, next to the `TrackMenu` span (right side), a grip button (rendered only when `trackReordering`):

```tsx
                {trackReordering && (
                  <span style={{ position: 'absolute', right: spectrogram?.renderMenuItems ? 20 : 0, top: 0 }}>
                    <button
                      ref={gripRef as React.Ref<HTMLButtonElement>}
                      aria-label="Drag to reorder track"
                      title="Drag to reorder track"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'grab',
                        padding: '2px',
                        touchAction: 'none',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripIcon size={14} />
                    </button>
                  </span>
                )}
```

2. Immediately after the Mute/Solo `<ButtonGroup>`, a second `ButtonGroup` (only when `trackReordering`):

```tsx
              {trackReordering && (
                <ButtonGroup>
                  <Button
                    $variant="outline"
                    aria-label="Move track up"
                    disabled={trackIndex === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderTrack(track.id, trackIndex - 1);
                    }}
                  >
                    <MoveUpIcon size={12} />
                  </Button>
                  <Button
                    $variant="outline"
                    aria-label="Move track down"
                    disabled={trackIndex === peaksDataArray.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderTrack(track.id, trackIndex + 1);
                    }}
                  >
                    <MoveDownIcon size={12} />
                  </Button>
                </ButtonGroup>
              )}
```

`gripRef` is the `handleRef` from `SortableTrackControls` — thread it by extracting the default-controls JSX into a local function component `DefaultTrackControls` defined in the same file ABOVE `PlaylistVisualization` (props: everything the JSX closes over — `trackIndex`, `track`, `trackState`, `effectiveRenderMode`, `selectTrack`, `onRemoveTrack`, `setTrackMute`, `setTrackSolo`, `setTrackVolume`, `setTrackPan`, `spectrogram`, `setSettingsModalTrackId`, `trackReordering`, `reorderTrack`, `trackCount`, plus optional `gripRef?: (el: Element | null) => void`). This keeps hook counts stable and avoids duplicating the block. Then the slot builder becomes:

```tsx
        const trackControlContent = renderTrackControls ? (
          renderTrackControls(trackIndex)
        ) : trackReordering ? (
          <SortableTrackControls trackId={track.id} index={trackIndex}>
            {({ ref, handleRef, isDragSource }) => (
              <div
                ref={ref as React.Ref<HTMLDivElement>}
                style={{ height: '100%', opacity: isDragSource ? 0.85 : 1 }}
              >
                <DefaultTrackControls {...defaultControlProps} gripRef={handleRef} />
              </div>
            )}
          </SortableTrackControls>
        ) : (
          <DefaultTrackControls {...defaultControlProps} />
        );
```

where `defaultControlProps` is the locals object built just above. Import `GripIcon`, `MoveUpIcon`, `MoveDownIcon` from `@waveform-playlist/ui-components` alongside the existing TrackControls imports.

- [ ] **Step 5: Thread `trackReordering` through `Waveform.tsx`** — add `trackReordering?: boolean` to `WaveformProps` (with the same doc comment) and pass it to `<PlaylistVisualization trackReordering={trackReordering} …>` (~line 102).

- [ ] **Step 6: Verify + commit**

```bash
pnpm --filter @waveform-playlist/browser build && pnpm lint
git add packages/browser && git commit -m "feat(browser): sortable track controls with grip and move up/down buttons (#612)"
```

---

### Task 5: browser — drag handlers branch on `track-reorder`

**Files:**
- Modify: `packages/browser/src/components/ClipInteractionProvider.tsx`
- Modify: `packages/browser/src/hooks/useClipDragHandlers.ts` (guards only)

**Interfaces:**
- Consumes: data kind `'track-reorder'` + `trackId` (Task 4); `usePlaylistControls().reorderTrack` (Task 3); `source.sortable.{index, initialIndex}` (verified: `SortableDraggable` carries a `sortable` back-reference; `OptimisticSortingPlugin` keeps `index` current during the drag).

- [ ] **Step 1: Early-return guards in `useClipDragHandlers.ts`.** In each of `onDragStart`, `onDragMove`, `onDragEnd`, right after `const data = event.operation.source?.data as …` add `kind?: string` to the cast and:

```typescript
      if (!data || data.kind === 'track-reorder') return;
```

(The existing `if (!data) return` lines become this combined check. In `onDragEnd` the guard goes at the very top, before the `event.canceled` handling.)

- [ ] **Step 2: Commit reorders in `ClipInteractionProvider.tsx`.** Get `reorderTrack` from the existing `usePlaylistControls()` destructure (line 42). Wrap `onDragEnd`:

```tsx
  const handleDragEnd = React.useCallback(
    (event: Parameters<typeof onDragEnd>[0]) => {
      const data = event.operation.source?.data as
        | { kind?: string; trackId?: string }
        | undefined;
      if (data?.kind === 'track-reorder') {
        if (event.canceled || !data.trackId) return;
        const sortable = (
          event.operation.source as unknown as {
            sortable?: { index: number; initialIndex: number };
          }
        ).sortable;
        if (sortable && sortable.index !== sortable.initialIndex) {
          reorderTrack(data.trackId, sortable.index);
        }
        return;
      }
      onDragEnd(event);
    },
    [onDragEnd, reorderTrack]
  );
```

Pass `handleDragEnd` (not `onDragEnd`) to `<DragDropProvider onDragEnd={…}>`. Also update the existing `onDragStart` wrapper (line 100): its track-select logic reads `data.trackIndex` — add an early branch so a `track-reorder` source selects by id instead:

```tsx
      const data = event.operation?.source?.data as
        | { kind?: string; trackId?: string; trackIndex?: number }
        | undefined;
      if (data?.kind === 'track-reorder') {
        if (data.trackId) setSelectedTrackId(data.trackId);
        return; // clip handler guards also skip this kind
      }
```

(keep the existing trackIndex-based select + `handleDragStart(event)` call for clip drags).

- [ ] **Step 3: Verify + commit**

```bash
pnpm --filter @waveform-playlist/browser build && pnpm lint && cd packages/browser && npx vitest run && cd ../..
git add packages/browser && git commit -m "feat(browser): commit track reorders from sortable drag end (#612)"
```

---

### Task 6: dawcore — file drop routes through the element pipeline

**Files:**
- Modify: `packages/dawcore/src/interactions/file-loader.ts` (full rewrite, much smaller)
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (only if the `loadFiles` call site needs the host cast updated)
- Test: `packages/dawcore/src/__tests__/` — find the existing file-drop/loadFiles tests (`grep -rln "loadFiles" packages/dawcore/src/__tests__/`) and update; add the new element-synthesis test there.

**Interfaces:**
- Consumes: `editor.addTrack(config: TrackConfig): Promise<DawTrackElement>` (existing — builds a `<daw-track>`, appends, awaits `daw-track-ready`/`daw-track-error`).
- Produces: `loadFiles(host, files): Promise<LoadFilesResult>` — same `{ loaded: string[], failed: Array<{file, error}> }` contract; every dropped file now yields a real `<daw-track><daw-clip src=blobURL>` in the editor's light DOM.

- [ ] **Step 1: Write the failing test** (harness: copy the `makeEditor`/mock setup from the existing file-drop test file; if none exists, copy `daw-editor-programmatic.test.ts`'s setup — mocked adapter + `vi.spyOn(editor, '_fetchAndDecode')` resolving a stub AudioBuffer):

```typescript
  it('loadFiles creates a <daw-track> element per dropped file', async () => {
    const file = new File([new ArrayBuffer(8)], 'kick.wav', { type: 'audio/wav' });
    const result = await editor.loadFiles([file]);
    expect(result.loaded).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    const trackEls = editor.querySelectorAll('daw-track');
    expect(trackEls.length).toBe(1);
    expect(trackEls[0].getAttribute('name')).toBe('kick');
    expect(trackEls[0].querySelectorAll('daw-clip').length).toBe(1);
    // The engine knows the track under the same id
    expect(result.loaded[0]).toBe((trackEls[0] as DawTrackElement).trackId);
  });

  it('loadFiles rejects non-audio files without creating elements', async () => {
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const result = await editor.loadFiles([file]);
    expect(result.loaded).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(editor.querySelectorAll('daw-track').length).toBe(0);
  });
```

- [ ] **Step 2: Run to verify the first test fails** (no elements are created today).

Run: `cd packages/dawcore && npx vitest run -t 'loadFiles creates'`

- [ ] **Step 3: Rewrite `file-loader.ts`:**

```typescript
/**
 * File loading: routes dropped files through the same element pipeline as
 * editor.addTrack() — each file becomes a real `<daw-track><daw-clip>` in the
 * editor's light DOM, "as a fresh page load would have" (#612). The existing
 * daw-track-connected → _loadTrack pipeline does the fetch/decode.
 */

import type { DawTrackElement } from '../elements/daw-track';
import type { DawFilesLoadErrorDetail, LoadFilesResult } from '../events';
import type { TrackConfig } from '../types';

export interface FileLoaderHost {
  readonly isConnected: boolean;
  _audioCache: Map<string, Promise<AudioBuffer>>;
  addTrack(config: TrackConfig): Promise<DawTrackElement>;
  dispatchEvent(event: Event): boolean;
}

export async function loadFiles(
  host: FileLoaderHost,
  files: FileList | File[]
): Promise<LoadFilesResult> {
  if (!files) {
    console.warn('[dawcore] loadFiles called with null/undefined');
    return { loaded: [], failed: [] };
  }

  const fileArray = Array.from(files);
  const loaded: string[] = [];
  const failed: Array<{ file: File; error: unknown }> = [];

  const dispatchLoadError = (file: File, error: unknown) => {
    failed.push({ file, error });
    if (host.isConnected) {
      host.dispatchEvent(
        new CustomEvent<DawFilesLoadErrorDetail>('daw-files-load-error', {
          bubbles: true,
          composed: true,
          detail: { file, error },
        })
      );
    }
  };

  for (const file of fileArray) {
    // file.type can be '' for valid audio (.opus on some browsers) — only
    // reject explicitly non-audio MIME types.
    if (file.type && !file.type.startsWith('audio/')) {
      const error = new Error('Non-audio MIME type: ' + file.type);
      console.warn('[dawcore] Skipping non-audio file: ' + file.name + ' (' + file.type + ')');
      dispatchLoadError(file, error);
      continue;
    }

    const blobUrl = URL.createObjectURL(file);
    const name = file.name.replace(/\.\w+$/, '');
    try {
      // Sequential on purpose: preserves drop order as DOM/track order.
      const trackEl = await host.addTrack({ name, clips: [{ src: blobUrl, name }] });
      loaded.push(trackEl.trackId);
      // daw-track-ready was dispatched by the load pipeline — don't re-dispatch.
    } catch (err) {
      console.warn('[dawcore] Failed to load file: ' + file.name + ' — ' + String(err));
      dispatchLoadError(file, err);
    } finally {
      // The decode is complete either way; the blob URL and its cache entry
      // (keyed by a URL that will never be fetched again) are dead weight.
      URL.revokeObjectURL(blobUrl);
      host._audioCache.delete(blobUrl);
    }
  }

  return { loaded, failed };
}
```

Check `daw-editor.ts:2518` (`loadFiles(this, files)`) still typechecks — `<daw-editor>` satisfies the new smaller host interface structurally.

- [ ] **Step 4: Fix the fallout in existing file-drop tests.** The old tests may assert on `_engineTracks` contents / `daw-track-ready` dispatch counts / no-DOM behavior. Update assertions to the element-backed reality; keep the `{loaded, failed}` contract assertions unchanged. If existing tests stub `host._fetchAndDecode` on a plain-object host (not a real editor), rewrite them against a real `<daw-editor>` with the mocked adapter + `_fetchAndDecode` spy.

- [ ] **Step 5: Run the full dawcore suite, lint, commit**

```bash
cd packages/dawcore && npx vitest run && cd ../.. && pnpm lint
git add packages/dawcore && git commit -m "feat(dawcore): file drop creates daw-track elements via the addTrack pipeline (#612)"
```

---

### Task 7: dawcore — MutationObserver move detection + DOM→engine order sync

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`connectedCallback` observer ~line 1066; two `engine.setTracks` call sites at ~lines 1868 and 2260; new `_syncEngineOrderToDom` + `_inOrderSync` field)
- Test: `packages/dawcore/src/__tests__/daw-editor-reorder.test.ts` (new file)

**Interfaces:**
- Consumes: `engine.reorderTrack` (Task 1), `engine.beginTransaction()`/`commitTransaction()` (existing).
- Produces: `_syncEngineOrderToDom(): void` and `_inOrderSync: boolean` (Task 8 reads the flag); moving a `<daw-track>` element (consumer `insertBefore` OR editor-initiated) now reorders the engine instead of tearing the track down.

- [ ] **Step 1: Failing test — `insertBefore` is a move, not a removal:**

```typescript
  it('moving a <daw-track> element reorders the engine without teardown', async () => {
    // makeEditor: two loaded tracks (use editor.addTrack({ name, midi: { notes } })
    // for fetch-free loading — see daw-editor-layout.test.ts makeEditor pattern)
    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    const removedSpy = vi.fn();
    editor.addEventListener('daw-track-removed', removedSpy);

    editor.insertBefore(elB, elA); // consumer-initiated DOM reorder
    await vi.waitFor(() => {
      const order = editor.engine!.getState().tracks.map((t) => t.id);
      expect(order).toEqual([elB.trackId, elA.trackId]);
    });
    expect(removedSpy).not.toHaveBeenCalled();
    // Track state survived — buffers/descriptors intact
    expect(editor.tracks.map((t) => t.trackId)).toContain(elA.trackId);
  });
```

- [ ] **Step 2: Run to verify it fails** (today the move tears down + re-registers, and engine order never changes).

- [ ] **Step 3: Rewrite the observer callback** in `connectedCallback` — batch-collect first, then discriminate moves:

```typescript
    // Detect track + clip removal via MutationObserver (detached elements can't
    // bubble events). A node present in BOTH removedNodes and addedNodes within
    // one batch is a MOVE (insertBefore fires remove+insert) — treated as a
    // reorder, never a teardown (#612).
    this._childObserver = new MutationObserver((mutations) => {
      const removedTracks = new Map<string, DawTrackElement>();
      const removedClips = new Set<DawClipElement>();
      const addedTrackIds = new Set<string>();
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.tagName === 'DAW-TRACK') {
            addedTrackIds.add((node as DawTrackElement).trackId);
          }
          node.querySelectorAll?.('daw-track').forEach((t) => {
            addedTrackIds.add((t as DawTrackElement).trackId);
          });
        }
        for (const node of mutation.removedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.tagName === 'DAW-TRACK') {
            removedTracks.set((node as DawTrackElement).trackId, node as DawTrackElement);
          } else if (node.tagName === 'DAW-CLIP') {
            removedClips.add(node as DawClipElement);
          }
          node.querySelectorAll?.('daw-track').forEach((t) => {
            removedTracks.set((t as DawTrackElement).trackId, t as DawTrackElement);
          });
          node.querySelectorAll?.('daw-clip').forEach((c) => {
            removedClips.add(c as DawClipElement);
          });
        }
      }
      let orderMayHaveChanged = addedTrackIds.size > 0;
      for (const [trackId] of removedTracks) {
        if (addedTrackIds.has(trackId)) {
          orderMayHaveChanged = true; // move, not removal
          continue;
        }
        this._onTrackRemoved(trackId);
      }
      for (const clip of removedClips) {
        // A clip that moved with its track (or was re-slotted) is still connected.
        if (clip.isConnected) continue;
        this._onClipRemovedFromDom(clip);
      }
      if (orderMayHaveChanged) this._syncEngineOrderToDom();
    });
    this._childObserver.observe(this, { childList: true, subtree: true });
```

- [ ] **Step 4: Add the sync method + flag** (near `_getOrderedTracks`):

```typescript
  /** Guards the statechange handler's engine→DOM sync (Task: reorder #612)
   *  while the observer is pushing DOM order INTO the engine — the intermediate
   *  statechange emissions during the transaction would otherwise bounce
   *  half-applied orders back into the DOM. */
  _inOrderSync = false;

  /**
   * DOM → engine: make the engine's track order match the light-DOM
   * `<daw-track>` order. Single write path for reorders — editor-initiated
   * (buttons/drag move the element) and consumer-initiated (insertBefore)
   * mutations both land here via the MutationObserver. Element-less tracks
   * (undo-resurrected) keep their engine positions (stable sort).
   * Write-only-on-change: a no-op when orders already match, so the
   * engine→DOM direction (statechange handler) converges in one pass.
   */
  _syncEngineOrderToDom(): void {
    const engine = this._engine;
    if (!engine) return;
    const domOrder = [...this.querySelectorAll('daw-track')].map(
      (el) => (el as DawTrackElement).trackId
    );
    const engineIds = engine.getState().tracks.map((t) => t.id);
    const target = [...engineIds].sort((a, b) => {
      const ai = domOrder.indexOf(a);
      const bi = domOrder.indexOf(b);
      if (ai === -1 || bi === -1) return 0; // element-less: keep relative position
      return ai - bi;
    });
    if (target.every((id, i) => id === engineIds[i])) return;
    this._inOrderSync = true;
    try {
      engine.beginTransaction(); // one undo step for the whole permutation
      const current = [...engineIds];
      for (let i = 0; i < target.length; i++) {
        if (current[i] === target[i]) continue;
        engine.reorderTrack(target[i], i);
        const from = current.indexOf(target[i]);
        current.splice(from, 1);
        current.splice(i, 0, target[i]);
      }
      engine.commitTransaction();
    } finally {
      this._inOrderSync = false;
    }
    this.requestUpdate();
  }
```

(`current` is a local working copy — mutating it is fine; engine state stays immutable.)

- [ ] **Step 5: Make engine order match DOM order from the start.** Both `engine.setTracks([...this._engineTracks.values()])` call sites (~lines 1868 and 2260) pass Map-insertion (load-completion) order, which can differ from DOM order when decodes finish out of order. Change BOTH to:

```typescript
    engine.setTracks(this._getOrderedTracks().map(([, track]) => track));
```

Add a test: register two tracks, hold the FIRST track's decode mid-flight with a deferred `mockImplementationOnce` (the standard seam from dawcore CLAUDE.md) so the second finishes first, then assert `engine.getState().tracks` order matches DOM order.

- [ ] **Step 6: Run dawcore suite; fix any test that asserted Map-insertion engine order; lint; commit**

```bash
cd packages/dawcore && npx vitest run && cd ../.. && pnpm lint
git add packages/dawcore && git commit -m "feat(dawcore): observer move detection and DOM-to-engine track order sync (#612)"
```

---

### Task 8: dawcore — engine→DOM sync (undo/redo) + public `reorderTrack` + `daw-track-reorder` event

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (statechange handler ~line 2426 `structuralChange` branch; new `_syncDomToEngineOrder`, `reorderTrack`, `_onTrackReorder`; `connectedCallback` listener)
- Modify: `packages/dawcore/src/events.ts`
- Test: `packages/dawcore/src/__tests__/daw-editor-reorder.test.ts` (extend)

**Interfaces:**
- Consumes: `_inOrderSync` + `_syncEngineOrderToDom` (Task 7).
- Produces: `editor.reorderTrack(trackId: string, toIndex: number): void` (public); `DawTrackReorderDetail { trackId: string; fromIndex: number; toIndex: number }` + `'daw-track-reorder'` in `DawEventMap`; Task 9's buttons dispatch this event.

- [ ] **Step 1: Event types in `events.ts`** (next to `DawEffectReorderDetail`):

```typescript
export interface DawTrackReorderDetail {
  trackId: string;
  fromIndex: number;
  toIndex: number;
}

export interface DawTrackReorderGrabDetail {
  trackId: string;
  pointerEvent: PointerEvent;
  gripElement: HTMLElement;
}
```

and in `DawEventMap` (next to `'daw-effect-reorder'`):

```typescript
  'daw-track-reorder': CustomEvent<DawTrackReorderDetail>;
  'daw-track-reorder-grab': CustomEvent<DawTrackReorderGrabDetail>;
```

- [ ] **Step 2: Failing test — undo of a DOM reorder restores DOM order:**

```typescript
  it('undo after a reorder moves the <daw-track> elements back', async () => {
    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    editor.reorderTrack(elB.trackId, 0);
    await vi.waitFor(() => {
      expect([...editor.querySelectorAll('daw-track')][0]).toBe(elB);
    });
    editor.engine!.undo();
    await vi.waitFor(() => {
      expect([...editor.querySelectorAll('daw-track')][0]).toBe(elA);
      expect(editor.engine!.getState().tracks[0].id).toBe(elA.trackId);
    });
  });
```

- [ ] **Step 3: Public `reorderTrack` + event handler** (near `removeTrack`, ~line 2624):

```typescript
  /**
   * Move a track to a new position in the vertical order (0-based index among
   * `<daw-track>` elements). Element-backed tracks move their DOM element —
   * the MutationObserver syncs the engine (single write path). Element-less
   * tracks (undo-resurrected) reorder the engine directly.
   */
  reorderTrack(trackId: string, toIndex: number): void {
    const el = this._trackElements.get(trackId);
    if (el) {
      const els = [...this.querySelectorAll('daw-track')] as DawTrackElement[];
      const from = els.indexOf(el);
      if (from === -1) return;
      const clamped = Math.max(0, Math.min(toIndex, els.length - 1));
      if (from === clamped) return;
      const anchor = els[clamped];
      if (clamped > from) anchor.after(el);
      else anchor.before(el);
    } else if (this._engine) {
      this._engine.reorderTrack(trackId, toIndex);
      this.requestUpdate();
    }
  }

  private _onTrackReorder = (e: CustomEvent<DawTrackReorderDetail>) => {
    this.reorderTrack(e.detail.trackId, e.detail.toIndex);
  };
```

Register in `connectedCallback` (with the other listeners): `this.addEventListener('daw-track-reorder', this._onTrackReorder as EventListener);` and remove in `disconnectedCallback` alongside the others.

- [ ] **Step 4: Engine→DOM sync in the statechange handler.** Inside the `if (structuralChange) {` block (~line 2426), FIRST line:

```typescript
        // Engine-initiated order changes (undo/redo of a reorder) move the
        // DOM to match; guarded so the observer's own DOM→engine sync (which
        // emits intermediate statechanges mid-transaction) can't bounce
        // half-applied orders back into the DOM (#612).
        if (!this._inOrderSync) {
          this._syncDomToEngineOrder(engineState.tracks);
        }
```

and the method:

```typescript
  /**
   * Engine → DOM: after an engine-initiated order change (undo/redo), move
   * `<daw-track>` elements to match engine order. The resulting mutations fire
   * the observer's _syncEngineOrderToDom, which finds the orders equal and
   * no-ops — converges in one pass (write-only-on-change).
   */
  _syncDomToEngineOrder(tracks: ClipTrack[]): void {
    const els = [...this.querySelectorAll('daw-track')] as DawTrackElement[];
    if (els.length < 2) return;
    const byId = new Map(els.map((el) => [el.trackId, el]));
    const desired = tracks
      .map((t) => byId.get(t.id))
      .filter((el): el is DawTrackElement => el != null);
    if (desired.every((el, i) => el === els[i])) return;
    // Anchor the first desired element, then chain the rest after it in order.
    if (els[0] !== desired[0]) els[0].before(desired[0]);
    for (let i = 1; i < desired.length; i++) {
      if (desired[i - 1].nextElementSibling !== desired[i]) desired[i - 1].after(desired[i]);
    }
  }
```

(Non-`daw-track` siblings like `<daw-keyboard-shortcuts>` may end up before/after the block — only relative `daw-track` order matters to `_getOrderedTracks`. The `nextElementSibling` check keeps already-adjacent pairs untouched; interleaved foreign elements make it re-anchor, which is harmless.)

- [ ] **Step 5: Loop-safety test:**

```typescript
  it('reorder sync converges — no ping-pong between observer and statechange', async () => {
    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    const reorderSpy = vi.spyOn(editor.engine!, 'reorderTrack');
    editor.reorderTrack(elB.trackId, 0);
    await vi.waitFor(() => {
      expect(editor.engine!.getState().tracks[0].id).toBe(elB.trackId);
    });
    const calls = reorderSpy.mock.calls.length;
    await new Promise((r) => setTimeout(r, 50));
    expect(reorderSpy.mock.calls.length).toBe(calls); // settled, no further churn
  });
```

- [ ] **Step 6: Run, lint, commit**

```bash
cd packages/dawcore && npx vitest run && cd ../.. && pnpm lint
git add packages/dawcore && git commit -m "feat(dawcore): editor reorderTrack, daw-track-reorder event, engine-to-DOM undo sync (#612)"
```

---

### Task 9: dawcore — `<daw-track-controls>` grip + move buttons, `track-reordering` attribute

**Files:**
- Modify: `packages/dawcore/src/elements/daw-track-controls.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (property + template threading)
- Test: `packages/dawcore/src/__tests__/daw-track-controls.test.ts` (or the file that currently tests this element — `grep -rln "daw-track-controls" packages/dawcore/src/__tests__/`)

**Interfaces:**
- Consumes: `DawTrackReorderDetail` / `DawTrackReorderGrabDetail` (Task 8).
- Produces: `<daw-editor track-reordering>` (`trackReordering` property); `daw-track-controls` props `reorderable: boolean`, `trackIndex: number`, `trackCount: number`; dispatches `daw-track-reorder` (buttons) and `daw-track-reorder-grab` (grip pointerdown, with `gripElement` for pointer capture — Task 10).

- [ ] **Step 1: Failing tests** (happy-dom; shadow-DOM queries):

```typescript
  it('reorderable renders grip and move buttons; buttons dispatch daw-track-reorder', async () => {
    const el = document.createElement('daw-track-controls') as DawTrackControlsElement;
    el.trackId = 't1';
    el.reorderable = true;
    el.trackIndex = 1;
    el.trackCount = 3;
    document.body.appendChild(el);
    await el.updateComplete;
    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-reorder', ((e: CustomEvent) => {
      events.push(e);
    }) as EventListener);
    const up = el.shadowRoot!.querySelector('.reorder-up') as HTMLButtonElement;
    const down = el.shadowRoot!.querySelector('.reorder-down') as HTMLButtonElement;
    up.click();
    down.click();
    expect(events.map((e) => e.detail)).toEqual([
      { trackId: 't1', fromIndex: 1, toIndex: 0 },
      { trackId: 't1', fromIndex: 1, toIndex: 2 },
    ]);
    el.remove();
  });

  it('move up is disabled at index 0, move down at the last index', async () => {
    // trackIndex 0 → .reorder-up disabled; trackIndex trackCount-1 → .reorder-down disabled
  });

  it('non-reorderable renders no grip/buttons', async () => {
    // default reorderable=false → shadowRoot has no .grip/.reorder-up/.reorder-down
  });
```

- [ ] **Step 2: Implement in `daw-track-controls.ts`.** New properties:

```typescript
  /** Show the reorder grip + move up/down buttons (set by the editor from
   *  its track-reordering attribute). */
  @property({ type: Boolean, attribute: false }) reorderable = false;
  @property({ type: Number, attribute: false }) trackIndex = 0;
  @property({ type: Number, attribute: false }) trackCount = 1;
```

Handlers (import both detail types from `../events`):

```typescript
  private _dispatchReorder(toIndex: number) {
    if (!this.trackId) return;
    this.dispatchEvent(
      new CustomEvent<DawTrackReorderDetail>('daw-track-reorder', {
        bubbles: true,
        composed: true,
        detail: { trackId: this.trackId, fromIndex: this.trackIndex, toIndex },
      })
    );
  }

  private _onMoveUp = () => this._dispatchReorder(this.trackIndex - 1);
  private _onMoveDown = () => this._dispatchReorder(this.trackIndex + 1);

  private _onGripPointerDown = (e: PointerEvent) => {
    if (!this.trackId) return;
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent<DawTrackReorderGrabDetail>('daw-track-reorder-grab', {
        bubbles: true,
        composed: true,
        detail: {
          trackId: this.trackId,
          pointerEvent: e,
          gripElement: e.currentTarget as HTMLElement,
        },
      })
    );
  };
```

Template — in `.header`, before the name span:

```typescript
        ${this.reorderable
          ? html`<button
              class="grip"
              title="Drag to reorder track"
              aria-label="Drag to reorder track"
              @pointerdown=${this._onGripPointerDown}
            >
              ⠿
            </button>`
          : ''}
```

and after the Mute/Solo buttons inside `.buttons`:

```typescript
        ${this.reorderable
          ? html`<button
              class="btn reorder-up"
              title="Move track up"
              aria-label="Move track up"
              ?disabled=${this.trackIndex <= 0}
              @click=${this._onMoveUp}
            >
              ▲
            </button>
            <button
              class="btn reorder-down"
              title="Move track down"
              aria-label="Move track down"
              ?disabled=${this.trackIndex >= this.trackCount - 1}
              @click=${this._onMoveDown}
            >
              ▼
            </button>`
          : ''}
```

CSS additions in `static styles`:

```css
    .grip {
      background: none;
      border: none;
      color: var(--daw-controls-text, #c49a6c);
      cursor: grab;
      padding: 0 2px;
      font-size: 12px;
      line-height: 1;
      opacity: 0.4;
      touch-action: none;
    }
    .grip:hover {
      opacity: 1;
    }
    .btn:disabled {
      opacity: 0.3;
      cursor: default;
    }
```

(`touch-action: none` is REQUIRED — without it, touch drags scroll the page instead of firing pointermove.)

- [ ] **Step 3: Editor property + threading.** In `daw-editor.ts`:

```typescript
  /** Enable vertical track reordering UI: grip + move up/down buttons on each
   *  track's controls. Reordering is purely organizational. */
  @property({ type: Boolean, attribute: 'track-reordering' }) trackReordering = false;
```

In the `render()` controls-column map (~line 3381), thread the props (the map callback needs the index — change `(t) =>` to `(t, i) =>`):

```typescript
                ${orderedTracks.map(
                  (t, i) => html`
                    <daw-track-controls
                      style="height: ${t.trackHeight}px;"
                      .trackId=${t.trackId}
                      .trackName=${t.descriptor?.name ?? 'Untitled'}
                      .volume=${t.descriptor?.volume ?? 1}
                      .pan=${t.descriptor?.pan ?? 0}
                      .muted=${t.descriptor?.muted ?? false}
                      .soloed=${t.descriptor?.soloed ?? false}
                      .reorderable=${this.trackReordering}
                      .trackIndex=${i}
                      .trackCount=${orderedTracks.length}
                    ></daw-track-controls>
                  `
                )}
```

- [ ] **Step 4: Editor-level test** — `<daw-editor track-reordering>` + two tracks: click a rendered `.reorder-down` button (shadow-piercing: `editor.shadowRoot.querySelector('daw-track-controls')!.shadowRoot!.querySelector('.reorder-down')`, clicking the inner button per the shadow-click gotcha) → `await vi.waitFor` engine order changed AND DOM element order changed.

- [ ] **Step 5: Run, lint, commit**

```bash
cd packages/dawcore && npx vitest run && cd ../.. && pnpm lint
git add packages/dawcore && git commit -m "feat(dawcore): track-reordering attribute with grip and move buttons (#612)"
```

---

### Task 10: dawcore — pointer drag handler

**Files:**
- Create: `packages/dawcore/src/interactions/track-reorder-handler.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (instantiate + wire grab event)
- Test: `packages/dawcore/src/__tests__/track-reorder-handler.test.ts` (new)

**Interfaces:**
- Consumes: `daw-track-reorder-grab` detail (Task 9); `host.reorderTrack` (Task 8).
- Produces: `TrackReorderHandler` class + `TrackReorderHost` interface.

- [ ] **Step 1: Failing unit tests** (drive the handler directly with a mock host + fake rows; synthetic PointerEvents CAN drive this handler — it wraps `setPointerCapture` in try/catch per the codebase rule):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TrackReorderHandler, type TrackReorderHost } from '../interactions/track-reorder-handler';

function makeRow(trackId: string, top: number, height: number): HTMLElement {
  const el = document.createElement('daw-track-controls');
  (el as HTMLElement & { trackId: string }).trackId = trackId;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
  return el;
}

function makeHost(rows: HTMLElement[]): TrackReorderHost {
  const column = document.createElement('div');
  column.className = 'controls-column';
  rows.forEach((r) => column.appendChild(r));
  const shadow = document.createElement('div');
  shadow.appendChild(column);
  return {
    isConnected: true,
    reorderTrack: vi.fn(),
    shadowRoot: {
      querySelector: (sel: string) => (sel === '.controls-column' ? column : null),
    } as unknown as ShadowRoot,
  };
}

describe('TrackReorderHandler', () => {
  it('commits the reorder on pointerup past the next row midpoint', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80), makeRow('c', 160, 80)];
    const host = makeHost(rows);
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('button');
    rows[0].appendChild(grip);
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 130 }));
    grip.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 130 }));
    expect(host.reorderTrack).toHaveBeenCalledWith('a', 1);
  });

  it('pointercancel reverts without committing and clears transforms', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80)];
    const host = makeHost(rows);
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('button');
    rows[0].appendChild(grip);
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 130 }));
    expect(rows[0].style.transform).not.toBe('');
    grip.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    expect(host.reorderTrack).not.toHaveBeenCalled();
    expect(rows[0].style.transform).toBe('');
    expect(rows[1].style.transform).toBe('');
  });

  it('ignores pointermove from a different pointerId (palm rejection)', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80)];
    const host = makeHost(rows);
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('button');
    rows[0].appendChild(grip);
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientY: 130 }));
    grip.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 40 }));
    expect(host.reorderTrack).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `track-reorder-handler.ts`:**

```typescript
/**
 * Vertical track-reorder drag for the controls column. Follows the
 * pointer-handler host pattern: pointerdown on the grip (surfaced from
 * <daw-track-controls>' shadow DOM via daw-track-reorder-grab) +
 * setPointerCapture, Y-midpoint hit testing against control rows, translate
 * preview, commit on pointerup, revert on pointercancel. Covers mouse,
 * touch, and pen uniformly.
 */

export interface TrackReorderHost {
  readonly isConnected: boolean;
  shadowRoot: ShadowRoot | null;
  reorderTrack(trackId: string, toIndex: number): void;
}

interface RowInfo {
  el: HTMLElement;
  top: number;
  height: number;
  trackId: string;
}

export class TrackReorderHandler {
  private _host: TrackReorderHost;
  private _trackId: string | null = null;
  private _pointerId = -1;
  private _startY = 0;
  private _rows: RowInfo[] = [];
  private _fromIndex = 0;
  private _targetIndex = 0;
  private _gripEl: HTMLElement | null = null;

  constructor(host: TrackReorderHost) {
    this._host = host;
  }

  onGrab = (trackId: string, e: PointerEvent, gripEl: HTMLElement): void => {
    if (this._trackId !== null) return; // one drag at a time
    const column = this._host.shadowRoot?.querySelector('.controls-column');
    if (!column) return;
    const rows = [...column.querySelectorAll('daw-track-controls')] as HTMLElement[];
    this._rows = rows.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        el,
        top: rect.top,
        height: rect.height,
        trackId: (el as HTMLElement & { trackId: string | null }).trackId ?? '',
      };
    });
    this._fromIndex = this._rows.findIndex((r) => r.trackId === trackId);
    if (this._fromIndex === -1) {
      this._rows = [];
      return;
    }
    this._trackId = trackId;
    this._targetIndex = this._fromIndex;
    this._pointerId = e.pointerId;
    this._startY = e.clientY;
    this._gripEl = gripEl;
    try {
      gripEl.setPointerCapture(e.pointerId);
    } catch {
      // Fabricated pointerIds (tests) can't be captured — listeners still work.
    }
    gripEl.addEventListener('pointermove', this._onPointerMove);
    gripEl.addEventListener('pointerup', this._onPointerUp);
    gripEl.addEventListener('pointercancel', this._onPointerCancel);
  };

  private _onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this._pointerId || this._trackId === null) return;
    const dragged = this._rows[this._fromIndex];
    const dy = e.clientY - this._startY;
    dragged.el.style.transform = 'translateY(' + dy + 'px)';
    dragged.el.style.zIndex = '10';
    dragged.el.style.position = 'relative';

    // Target slot: crossing another row's midpoint claims its slot.
    let target = this._fromIndex;
    for (let i = 0; i < this._rows.length; i++) {
      if (i === this._fromIndex) continue;
      const mid = this._rows[i].top + this._rows[i].height / 2;
      if (i < this._fromIndex && e.clientY < mid) {
        target = i;
        break;
      }
      if (i > this._fromIndex && e.clientY > mid) {
        target = i;
      }
    }
    this._targetIndex = target;

    // Shift displaced rows out of the way.
    for (let i = 0; i < this._rows.length; i++) {
      if (i === this._fromIndex) continue;
      const row = this._rows[i];
      let shift = 0;
      if (i > this._fromIndex && i <= target) shift = -dragged.height;
      else if (i < this._fromIndex && i >= target) shift = dragged.height;
      row.el.style.transform = shift === 0 ? '' : 'translateY(' + shift + 'px)';
    }
  };

  private _onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this._pointerId || this._trackId === null) return;
    const trackId = this._trackId;
    const target = this._targetIndex;
    const from = this._fromIndex;
    this._cleanup();
    if (target !== from) {
      this._host.reorderTrack(trackId, target);
    }
  };

  private _onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this._pointerId) return;
    this._cleanup();
  };

  private _cleanup(): void {
    for (const row of this._rows) {
      row.el.style.transform = '';
      row.el.style.zIndex = '';
      row.el.style.position = '';
    }
    const grip = this._gripEl;
    if (grip) {
      grip.removeEventListener('pointermove', this._onPointerMove);
      grip.removeEventListener('pointerup', this._onPointerUp);
      grip.removeEventListener('pointercancel', this._onPointerCancel);
      try {
        grip.releasePointerCapture(this._pointerId);
      } catch {
        // already released / fabricated pointerId
      }
    }
    this._gripEl = null;
    this._trackId = null;
    this._pointerId = -1;
    this._rows = [];
  }
}
```

- [ ] **Step 3: Wire in `daw-editor.ts`:** field `private _trackReorderDrag = new TrackReorderHandler(this);` (the editor satisfies `TrackReorderHost` — it has `isConnected`, `shadowRoot`, `reorderTrack`); listener in `connectedCallback`:

```typescript
    this.addEventListener('daw-track-reorder-grab', ((e: CustomEvent<DawTrackReorderGrabDetail>) => {
      if (!this.trackReordering) return;
      this._trackReorderDrag.onGrab(e.detail.trackId, e.detail.pointerEvent, e.detail.gripElement);
    }) as EventListener);
```

(extract to a named `_onTrackReorderGrab` arrow field like the other handlers, and remove it in `disconnectedCallback`).

- [ ] **Step 4: Run, lint, commit**

```bash
cd packages/dawcore && npx vitest run && cd ../.. && pnpm lint
git add packages/dawcore && git commit -m "feat(dawcore): pointer-drag track reordering handler (#612)"
```

---

### Task 11: Examples + e2e

**Files:**
- Modify: the website example page behind `e2e/stem-tracks.spec.ts` (`page.goto(baseURL + '/examples/stem-tracks')` → find it: `grep -rln "stem" website/src/pages/examples/`) — add `trackReordering` to its `<Waveform>` and wrap with `ClipInteractionProvider` if not already
- Modify: `examples/dawcore-native/index.html` (add `track-reordering` to the `<daw-editor>`)
- Create: `e2e/track-reorder.spec.ts`

**Interfaces:**
- Consumes: everything above, end to end.

- [ ] **Step 1: Enable the prop on the stem-tracks example page** (and the dawcore-native example attribute).

- [ ] **Step 2: Write `e2e/track-reorder.spec.ts`** — button-driven (robust in CI; drag simulation of dnd-kit is flake-prone, deliberately skipped):

```typescript
import { test, expect } from '@playwright/test';

test.describe('Track Reordering', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/stem-tracks`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test('move down button swaps track order', async ({ page }) => {
    const names = page.locator('[data-testid], .controls, [class*="Controls"]');
    // Capture the first track's visible name from the first controls panel
    const firstPanelName = await page
      .locator('button[aria-label="Move track down"]')
      .first()
      .evaluate((btn) => btn.closest('div')!.parentElement!.textContent);

    await page.getByRole('button', { name: 'Move track down' }).first().click();

    await expect(async () => {
      const nowSecondName = await page
        .locator('button[aria-label="Move track down"]')
        .nth(1)
        .evaluate((btn) => btn.closest('div')!.parentElement!.textContent);
      expect(nowSecondName).toBe(firstPanelName);
    }).toPass({ timeout: 5000 });
  });

  test('move up is disabled on the first track, move down on the last', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Move track up' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Move track down' }).last()).toBeDisabled();
  });
});
```

Adjust the name-capture locator to the page's real DOM once running (`page.locator` against the track-name span inside the same Controls panel is the intent — the implementer should inspect the rendered markup and target the name span directly, keeping the auto-retrying `toPass` wrapper).

- [ ] **Step 3: Run the FULL e2e suite** (standalone spec runs race the cold dev server — only full runs are valid):

```bash
pnpm build && pnpm test
```

Expected: new spec passes; pre-existing `effects.spec.ts` readiness flakes are known and vary between runs (a real regression fails identically every time).

- [ ] **Step 4: Commit**

```bash
git add website examples e2e && git commit -m "feat: enable track reordering on stem-tracks and dawcore-native examples with e2e coverage (#612)"
```

---

### Task 12: Docs sweep, changeset, final verification

**Files:**
- Modify: `website/docs/llm-reference.md` (`PlaylistControlsContextValue.reorderTrack`, `Waveform.trackReordering`), `website/static/llms.txt` (feature mention), `website/docs/api/hooks.md` (controls interface), the `Waveform`/provider API doc pages, `packages/dawcore/COMPONENTS.md` (+ `<daw-editor track-reordering>` attribute, `daw-track-reorder` event), `packages/dawcore/CLAUDE.md` (element entries: daw-editor attribute, daw-track-controls props, events, new interaction handler), `docs/specs/web-components-migration.md` attribute tables, root `README.md` only if a new demo page was added (Task 11 reused existing pages — check).
- Create: `.changeset/*.md` via `pnpm changeset`.

- [ ] **Step 1: Docs sweep** per the CLAUDE.md keep-in-sync checklist above. Cross-check every signature against the source interfaces (doc drift rule).

- [ ] **Step 2: Changeset** — `pnpm changeset` selecting: `@waveform-playlist/engine` **minor** (new public API), `@waveform-playlist/browser` **minor**, `@waveform-playlist/ui-components` **minor**, `@dawcore/components` **patch** (zerover — never minor). Summary: "Vertical track reordering (#612): engine reorderTrack, React sortable + move buttons, dawcore drag + buttons with DOM/engine order sync."

- [ ] **Step 3: Full verification**

```bash
pnpm build && pnpm typecheck && pnpm lint
cd packages/engine && npx vitest run && cd ../..
cd packages/browser && npx vitest run && cd ../..
cd packages/ui-components && npx vitest run && cd ../..
cd packages/dawcore && npx vitest run && cd ../..
pnpm test
pkill -f vitest || true
```

Expected: all green (typecheck is first-fail — re-run the FULL sweep after fixing any package).

- [ ] **Step 4: Manual browser smoke** — `pnpm --filter website start` (React: drag a track by the grip, use the buttons, undo/redo) and `pnpm example:dawcore-native` (same in dawcore; also drop a file and confirm a `<daw-track>` element appears and is reorderable). Lit dev-mode "scheduled an update" warnings only surface here — check the console.

- [ ] **Step 5: Commit docs + changeset**

```bash
git add -A && git commit -m "docs: track reordering API docs and changeset (#612)"
```

**Before the PR merges** (at finishing time, not now): `git rm docs/specs/2026-07-17-track-reordering-design.md docs/plans/2026-07-17-track-reordering.md` — the PR description carries the durable record.
