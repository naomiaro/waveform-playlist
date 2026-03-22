# Dawcore Clip Interactions: Move, Trim, Split

**Date:** 2026-03-22
**Package:** `@waveform-playlist/dawcore`
**Dependencies:** `@waveform-playlist/engine` (clip operations already implemented)

## Overview

Add clip-level pointer interactions to `<daw-editor>`: drag headers to move clips, drag edge handles to trim, keyboard shortcut to split at playhead. All interactions are opt-in via boolean attributes.

The engine package already provides `moveClip()`, `trimClip()`, and `splitClip()` with full constraint logic (collision detection, bounds checking, minimum duration). This work wires those operations to pointer events and keyboard shortcuts in the dawcore web component layer.

## Attributes & Configuration

Two new boolean attributes on `<daw-editor>`, plus a configurable header height:

```html
<!-- Show clip headers (visual only) -->
<daw-editor clip-headers></daw-editor>

<!-- Custom header height (default 20px) -->
<daw-editor clip-headers clip-header-height="28"></daw-editor>

<!-- Enable move, trim, and split interactions -->
<daw-editor clip-headers clip-header-height="28" interactive-clips></daw-editor>
```

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `clip-headers` | boolean | `false` | Renders header bar on each clip showing track name |
| `clip-header-height` | number | `20` | Header height in pixels (matches existing dawcore default). Only meaningful when `clip-headers` is set |
| `interactive-clips` | boolean | `false` | Enables move (header drag), trim (edge drag), split (keyboard) |

**Rules:**
- `clip-headers` is purely visual — no interactions
- `interactive-clips` enables all three interactions. Move requires `clip-headers` (header is the drag handle). Trim handles appear on clip edges regardless of headers.
- Both are `@property({ type: Boolean, reflect: true })` on `<daw-editor>`
- `clip-header-height` is `@property({ type: Number, attribute: 'clip-header-height' })`

**Public API:**
- `splitAtPlayhead(): boolean` — Splits clip under playhead on selected track. Returns `true` if split succeeded.

**Keyboard:**
- `S` key triggers `splitAtPlayhead()` when `interactive-clips` is set and editor has focus

## Pointer Handler Architecture

The existing `PointerHandler` handles click-to-seek and drag-to-select on the timeline. Clip interactions extend it with hit detection.

### Hit Detection Zones (checked in order)

1. **Clip boundary edge** (8px from left/right edge of clip) → trim mode
2. **Clip header** (top `clipHeaderHeight` px of clip) → move mode
3. **Empty timeline space** → existing seek/select behavior (unchanged)

### How Hit Detection Works

The pointer handler's `onPointerDown` inspects `e.target` and `e.composedPath()` to determine which zone was hit. Clips are rendered as DOM elements with `data-clip-id`, `data-boundary-edge`, and `class="clip-header"` attributes, so identification is DOM-based rather than coordinate math.

### PointerEngineContract Extension

```typescript
interface PointerEngineContract {
  // existing
  setSelection(start: number, end: number): void;
  stop(): void;
  play(time: number): void;
  seek(time: number): void;
  selectTrack(trackId: string | null): void;

  // new for clip interactions
  moveClip(trackId: string, clipId: string, deltaSamples: number): void;
  trimClip(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): void;
}
```

### During Drag (Move/Trim)

- Convert pixel delta to sample delta: `deltaPx * samplesPerPixel`
- Call engine method on each `pointermove` (engine constrains internally)
- Engine emits `statechange` → Lit re-renders clip positions
- `setPointerCapture` for reliable tracking (already used for selection)
- 3px activation threshold before drag starts — extract the existing `DRAG_THRESHOLD = 3` from `pointer-handler.ts` into a shared constant so both handlers use the same value

## Custom Events

Three new result-only events added to `events.ts`. All bubble and are composed (cross shadow DOM), matching existing dawcore patterns.

```typescript
// After clip move drag completes
'daw-clip-move' → {
  trackId: string,
  clipId: string,
  deltaSamples: number        // Cumulative sample delta applied during drag
}

// After clip boundary trim drag completes
'daw-clip-trim' → {
  trackId: string,
  clipId: string,
  boundary: 'left' | 'right',
  deltaSamples: number        // Cumulative sample delta applied during drag
}

// After clip split succeeds
'daw-clip-split' → {
  trackId: string,
  originalClipId: string,
  leftClipId: string,
  rightClipId: string
}
```

**Dispatch rules:**
- `daw-clip-move` — on `pointerup` after move drag, only if position changed
- `daw-clip-trim` — on `pointerup` after trim drag, only if boundary changed
- `daw-clip-split` — after `splitAtPlayhead()` succeeds (keyboard or programmatic)
- Never dispatched for no-ops (constrained delta was 0, split validation failed)

**Future consideration:** Granular lifecycle events (`daw-clip-move-start`, `daw-clip-move`, `daw-clip-move-end`) were considered and deferred. Add if consumers need real-time feedback during drag (snap indicators, external UI sync, cancellation).

## Rendering Changes

Updated clip rendering in `<daw-editor>` template:

```html
<div class="clip-container"
     data-clip-id="${clipId}"
     style="left:${leftPx}px; width:${widthPx}px;">

  <!-- Header (only when clip-headers) -->
  <div class="clip-header"
       style="height:${clipHeaderHeight}px; cursor:grab;"
       data-clip-id="${clipId}"
       data-track-id="${trackId}">
    <span class="clip-header-name">${clipName}</span>
  </div>

  <!-- Waveform channels (top offset by header height) -->
  <daw-waveform style="top:${clipHeaderHeight}px;" ...></daw-waveform>

  <!-- Boundary edges (only when interactive-clips) -->
  <div class="clip-boundary"
       data-boundary-edge="left"
       data-clip-id="${clipId}"
       data-track-id="${trackId}"
       style="left:0; width:8px; cursor:col-resize;">
  </div>
  <div class="clip-boundary"
       data-boundary-edge="right"
       data-clip-id="${clipId}"
       data-track-id="${trackId}"
       style="right:0; width:8px; cursor:col-resize;">
  </div>
</div>
```

### Styling

- `.clip-header` — background from theme, monospace font, text-overflow ellipsis
- `.clip-boundary` — transparent by default, `rgba(255,255,255,0.2)` background + 2px border on `:hover`, stronger highlight during drag via `.dragging` class
- `.clip-header:active` — cursor changes to `grabbing`
- Boundary edges are `position: absolute`, full height, `z-index: 2` (above waveform)

### Waveform Height Adjustment

When `clip-headers` is set, each channel's available height is reduced by `clipHeaderHeight`:
`channelHeight = (trackHeight - clipHeaderHeight) / numChannels`

## Split Implementation

### Keyboard Handling

- `<daw-editor>` adds `keydown` listener on itself (not document) when `interactive-clips` is set
- `S` key calls `splitAtPlayhead()`
- Editor must have focus — no global key capture

### `splitAtPlayhead()` Logic

1. Guard: `_engine` must exist, must have a `selectedTrackId`
2. Get current playhead time in samples: `Math.round(currentTime * effectiveSampleRate)`
3. Find the clip on the selected track that contains that sample position
4. Snapshot the track's clip IDs before split: `beforeIds = new Set(track.clips.map(c => c.id))`
5. Call `engine.splitClip(trackId, clipId, atSample)` — engine validates internally via `canSplitAt()` and no-ops if invalid
6. Read updated track from `engine.getState().tracks` and find the two new clip IDs not in `beforeIds`
7. If no new IDs found (engine no-opped), return `false`
8. Engine emits `statechange` → Lit re-renders with two clips replacing the original
9. Dispatch `daw-clip-split` event with the discovered `leftClipId` and `rightClipId` (left = lower `startSample`)
10. Return `true`

**Note:** `engine.splitClip()` returns `void` — the new clip IDs are discovered by diffing track state before and after the call. The engine's `splitClipOp` always produces exactly two new clips replacing the original, so the diff yields exactly two new IDs.

### Edge Cases (return `false`, no event)

- Playhead not within any clip
- Split would create a clip shorter than 0.1s
- No selected track
- No engine

## File Organization

### New Files

| File | Purpose |
|------|---------|
| `interactions/clip-pointer-handler.ts` | Clip-specific pointer logic: hit detection, move drag, trim drag |
| `__tests__/clip-pointer-handler.test.ts` | Move drag, trim drag, hit detection, threshold, constraint delegation |
| `__tests__/daw-editor-clip-interactions.test.ts` | Integration: attributes, split keyboard, events |

### Modified Files

| File | Changes |
|------|---------|
| `elements/daw-editor.ts` | New attributes, `splitAtPlayhead()`, keyboard listener, updated clip template |
| `interactions/pointer-handler.ts` | Hit zone check, delegate to clip handler for headers/boundaries |
| `events.ts` | Three new event types with typed detail interfaces |
| `types.ts` | `PointerEngineContract` extended with `moveClip`, `trimClip` |
| `styles/` | New styles for `.clip-header`, `.clip-boundary` |
| `__tests__/pointer-handler.test.ts` | Verify clip targets bypass seek/select |

### Estimated Scope

- ~400-500 lines new code (clip handler + rendering)
- ~100-150 lines modifications to existing files
- ~300-400 lines tests
