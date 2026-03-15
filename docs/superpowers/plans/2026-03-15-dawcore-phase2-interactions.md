# dawcore Phase 2: Interactions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-to-seek, track selection, file drop, and timeline selection to the dawcore editor — making it interactive beyond play/pause/stop.

**Architecture:** All interactions are mouse/pointer handlers on the editor's Shadow DOM `.timeline` div. They translate pixel coordinates to time (seconds) or track indices using `samplesPerPixel` and `sampleRate`, then delegate to `PlaylistEngine` methods (`seek`, `selectTrack`, `setSelection`). Visual feedback (selection overlay, track highlight) is rendered via Lit state. File drop uses the existing `_loadTrack` pipeline.

**Tech Stack:** Lit 3, PlaylistEngine API, native DOM pointer events

**Design Spec:** `docs/specs/web-components-migration.md` (Phase 2 section)

---

## Chunk 1: Click-to-Seek and Track Selection

### Task 1: Click-to-Seek

Click anywhere on the timeline to move the playhead to that position.

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`
- Create: `packages/dawcore/src/__tests__/daw-editor-interactions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dawcore/src/__tests__/daw-editor-interactions.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
  await import('../elements/daw-editor');
});

describe('DawEditorElement interactions', () => {
  it('pixelsToSeconds from core converts correctly', () => {
    // pixel 100, spp=1024, sr=48000 → (100 * 1024) / 48000 = 2.1333...
    expect(pixelsToSeconds(100, 1024, 48000)).toBeCloseTo(2.1333, 3);
  });

  it('pixelsToSeconds at origin is 0', () => {
    expect(pixelsToSeconds(0, 1024, 48000)).toBe(0);
  });
});
```

Note: add `import { pixelsToSeconds } from '@waveform-playlist/core';` at the top of the test file.

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-editor-interactions.test.ts`
Expected: PASS — `pixelsToSeconds` is already implemented in core

- [ ] **Step 3: Add click handler to daw-editor using `pixelsToSeconds` from core**

Add import to `daw-editor.ts`:
```typescript
import { createClipFromSeconds, createTrack, clipPixelWidth, pixelsToSeconds } from '@waveform-playlist/core';
```

Add the click handler:

```typescript
private _onTimelineClick = (e: MouseEvent) => {
  const timeline = this.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
  if (!timeline) return;
  const rect = timeline.getBoundingClientRect();
  const px = e.clientX - rect.left + timeline.scrollLeft;
  const time = pixelsToSeconds(px, this.samplesPerPixel, this._sampleRate);
  if (this._engine) {
    this._engine.seek(time);
    this._currentTime = time;
    this._stopPlayhead();
    // If playing, restart playhead animation from new position
    if (this._isPlaying) {
      this._startPlayhead();
    }
  }
  this.dispatchEvent(
    new CustomEvent('daw-seek', {
      bubbles: true,
      composed: true,
      detail: { time },
    })
  );
};
```

In `render()`, add the click handler to `.timeline`:

```typescript
<div
  class="timeline"
  style="width: ${Math.max(this._totalWidth, 100)}px;"
  data-playing=${this._isPlaying}
  @click=${this._onTimelineClick}
>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-editor-interactions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor-interactions.test.ts
git commit -m "feat(dawcore): add click-to-seek on timeline"
```

---

### Task 2: Track Selection

Click on a track row to select it. Selected track gets a visual highlight. Uses `engine.selectTrack(trackId)`.

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`
- Modify: `packages/dawcore/src/__tests__/daw-editor-interactions.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `daw-editor-interactions.test.ts`:

```typescript
describe('Track selection', () => {
  it('has selectedTrackId property defaulting to null', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.selectedTrackId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-editor-interactions.test.ts`
Expected: FAIL — `selectedTrackId` is undefined

- [ ] **Step 3: Add track selection state and click handler**

Add to `daw-editor.ts`:

State:
```typescript
@state() private _selectedTrackId: string | null = null;
```

Public accessor:
```typescript
get selectedTrackId(): string | null {
  return this._selectedTrackId;
}
```

In `_buildEngine()`, update the statechange handler to include selectedTrackId:
```typescript
engine.on('statechange', (engineState: any) => {
  this._isPlaying = engineState.isPlaying;
  this._duration = engineState.duration;
  this._selectedTrackId = engineState.selectedTrackId;
});
```

Track click handler:
```typescript
private _onTrackClick(trackId: string, e: MouseEvent) {
  // Select track, then let click-to-seek handle the timeline click
  if (this._engine) {
    this._engine.selectTrack(trackId);
  }
  this._selectedTrackId = trackId;
  this.dispatchEvent(
    new CustomEvent('daw-track-select', {
      bubbles: true,
      composed: true,
      detail: { trackId },
    })
  );
}
```

Update `render()` — add click handler and selected styling on track rows:
```typescript
${[...this._engineTracks.entries()].map(
  ([trackId, track]) => html`
    <div
      class="track-row ${trackId === this._selectedTrackId ? 'selected' : ''}"
      style="height: ${this.waveHeight}px;"
      @click=${(e: MouseEvent) => this._onTrackClick(trackId, e)}
    >
      ${track.clips.map((clip) => { /* existing clip rendering */ })}
    </div>
  `
)}
```

Add CSS for selected track:
```css
.track-row.selected {
  background: var(--daw-track-background, #16213e);
  outline: 1px solid var(--daw-selection-color, rgba(99, 199, 95, 0.3));
  outline-offset: -1px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-editor-interactions.test.ts`
Expected: PASS

- [ ] **Step 5: Verify in dev page, commit**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && pnpm typecheck`
Expected: PASS

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor-interactions.test.ts
git commit -m "feat(dawcore): add track selection with visual highlight"
```

---

## Chunk 2: File Drop

### Task 3: File Drop Support

Drag audio files onto the editor to create new tracks. Enabled via `file-drop` boolean attribute.

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`
- Modify: `packages/dawcore/src/__tests__/daw-editor-interactions.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `daw-editor-interactions.test.ts`:

```typescript
describe('File drop', () => {
  it('has file-drop attribute defaulting to false', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.fileDrop).toBe(false);
  });

  it('exposes loadFiles method', () => {
    const el = document.createElement('daw-editor') as any;
    expect(typeof el.loadFiles).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-editor-interactions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement file drop**

Add the `fileDrop` property:
```typescript
@property({ type: Boolean, attribute: 'file-drop' }) fileDrop = false;
```

Add drop zone state and CSS:
```typescript
@state() private _dragOver = false;
```

```css
:host([file-drop]) .timeline {
  transition: outline-color 0.15s;
}
:host([file-drop]) .timeline.drag-over {
  outline: 2px dashed var(--daw-selection-color, rgba(99, 199, 95, 0.3));
  outline-offset: -2px;
}
```

Add drag/drop handlers:
```typescript
private _onDragOver = (e: DragEvent) => {
  if (!this.fileDrop) return;
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
  this._dragOver = true;
};

private _onDragLeave = (e: DragEvent) => {
  // Only leave if actually leaving the timeline (not entering a child)
  const timeline = this.shadowRoot?.querySelector('.timeline');
  if (timeline && !timeline.contains(e.relatedTarget as Node)) {
    this._dragOver = false;
  }
};

private _onDrop = async (e: DragEvent) => {
  if (!this.fileDrop) return;
  e.preventDefault();
  this._dragOver = false;

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  await this.loadFiles(files);
};
```

Public `loadFiles()` method:
```typescript
async loadFiles(files: FileList | File[]): Promise<void> {
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    // Only accept audio files
    if (!file.type.startsWith('audio/')) {
      console.warn('[dawcore] Skipping non-audio file:', file.name);
      continue;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new OfflineAudioContext(1, 1, 44100);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Set sampleRate from first decoded buffer
      if (this._sampleRate === 48000 && audioBuffer.sampleRate !== 48000) {
        this._sampleRate = audioBuffer.sampleRate;
      }

      const clip = createClipFromSeconds({
        audioBuffer,
        startTime: 0,
        duration: audioBuffer.duration,
        offset: 0,
        gain: 1,
        name: file.name.replace(/\.\w+$/, ''),
        sampleRate: audioBuffer.sampleRate,
        sourceDuration: audioBuffer.duration,
      });

      this._generatePeaks(clip.id, audioBuffer);

      const trackId = crypto.randomUUID();
      const track = createTrack({
        name: file.name.replace(/\.\w+$/, ''),
        clips: [clip],
      });

      this._engineTracks = new Map(this._engineTracks).set(trackId, track);
      this._recomputeDuration();

      const engine = await this._ensureEngine();
      engine.setTracks([...this._engineTracks.values()]);

      this.dispatchEvent(
        new CustomEvent('daw-track-ready', {
          bubbles: true,
          composed: true,
          detail: { trackId },
        })
      );
    } catch (err) {
      console.warn('[dawcore] Failed to load dropped file:', file.name, err);
      this.dispatchEvent(
        new CustomEvent('daw-files-load-error', {
          bubbles: true,
          composed: true,
          detail: { file, error: err },
        })
      );
    }
  }
}
```

Update `render()` to add drag/drop handlers and class:
```typescript
<div
  class="timeline ${this._dragOver ? 'drag-over' : ''}"
  style="width: ${Math.max(this._totalWidth, 100)}px;"
  data-playing=${this._isPlaying}
  @click=${this._onTimelineClick}
  @dragover=${this._onDragOver}
  @dragleave=${this._onDragLeave}
  @drop=${this._onDrop}
>
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-editor-interactions.test.ts`
Expected: PASS

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && pnpm typecheck`
Expected: PASS

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor-interactions.test.ts
git commit -m "feat(dawcore): add file drop support with loadFiles() method"
```

---

## Chunk 3: Timeline Selection

### Task 4: Selection Overlay Element

A visual overlay showing the selected region. Receives start/end pixel positions.

**Files:**
- Create: `packages/dawcore/src/elements/daw-selection.ts`
- Create: `packages/dawcore/src/__tests__/daw-selection.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dawcore/src/__tests__/daw-selection.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-selection');
});

describe('DawSelectionElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-selection')).toBeDefined();
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-selection') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('has default start and end of 0', () => {
    const el = document.createElement('daw-selection') as any;
    expect(el.startPx).toBe(0);
    expect(el.endPx).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-selection.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the selection element**

```typescript
// packages/dawcore/src/elements/daw-selection.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('daw-selection')
export class DawSelectionElement extends LitElement {
  @property({ type: Number, attribute: false }) startPx = 0;
  @property({ type: Number, attribute: false }) endPx = 0;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      pointer-events: none;
      z-index: 5;
    }
    div {
      position: absolute;
      top: 0;
      bottom: 0;
      background: var(--daw-selection-color, rgba(99, 199, 95, 0.3));
    }
  `;

  render() {
    const left = Math.min(this.startPx, this.endPx);
    const width = Math.abs(this.endPx - this.startPx);
    if (width === 0) return html``;
    return html`<div style="left: ${left}px; width: ${width}px;"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-selection': DawSelectionElement;
  }
}
```

- [ ] **Step 4: Add to index.ts**

```typescript
import './elements/daw-selection';
export { DawSelectionElement } from './elements/daw-selection';
```

- [ ] **Step 5: Run test, commit**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-selection.test.ts`
Expected: PASS

```bash
git add packages/dawcore/src/elements/daw-selection.ts packages/dawcore/src/__tests__/daw-selection.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-selection overlay element"
```

---

### Task 5: Wire Selection into Editor

Click + drag on the timeline to create a selection region. Uses `engine.setSelection()`.

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`
- Modify: `packages/dawcore/src/__tests__/daw-editor-interactions.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `daw-editor-interactions.test.ts`:

```typescript
describe('Selection', () => {
  it('has selection property defaulting to null', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.selection).toBeNull();
  });

  it('has setSelection method', () => {
    const el = document.createElement('daw-editor') as any;
    expect(typeof el.setSelection).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Implement selection interaction**

Add selection state:
```typescript
@state() private _selectionStart = 0;
@state() private _selectionEnd = 0;
private _isDragging = false;
private _dragStartPx = 0;
```

Public accessor:
```typescript
get selection(): { start: number; end: number } | null {
  if (this._selectionStart === 0 && this._selectionEnd === 0) return null;
  return {
    start: Math.min(this._selectionStart, this._selectionEnd),
    end: Math.max(this._selectionStart, this._selectionEnd),
  };
}

setSelection(start: number, end: number) {
  this._selectionStart = start;
  this._selectionEnd = end;
  if (this._engine) {
    this._engine.setSelection(start, end);
  }
  this.dispatchEvent(
    new CustomEvent('daw-selection', {
      bubbles: true,
      composed: true,
      detail: { start: Math.min(start, end), end: Math.max(start, end) },
    })
  );
}
```

Replace the simple click handler with pointer events for click vs drag detection:
```typescript
private _onPointerDown = (e: PointerEvent) => {
  const timeline = this.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
  if (!timeline) return;

  const rect = timeline.getBoundingClientRect();
  this._dragStartPx = e.clientX - rect.left + timeline.scrollLeft;
  this._isDragging = false;

  timeline.setPointerCapture(e.pointerId);
  timeline.addEventListener('pointermove', this._onPointerMove);
  timeline.addEventListener('pointerup', this._onPointerUp);
};

private _onPointerMove = (e: PointerEvent) => {
  const timeline = this.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
  if (!timeline) return;

  const rect = timeline.getBoundingClientRect();
  const currentPx = e.clientX - rect.left + timeline.scrollLeft;

  // Start drag after 3px threshold
  if (!this._isDragging && Math.abs(currentPx - this._dragStartPx) > 3) {
    this._isDragging = true;
  }

  if (this._isDragging) {
    const startTime = pixelsToSeconds(this._dragStartPx, this.samplesPerPixel, this._sampleRate);
    const endTime = pixelsToSeconds(currentPx, this.samplesPerPixel, this._sampleRate);
    this._selectionStart = Math.min(startTime, endTime);
    this._selectionEnd = Math.max(startTime, endTime);
  }
};

private _onPointerUp = (e: PointerEvent) => {
  const timeline = this.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
  if (!timeline) return;

  timeline.releasePointerCapture(e.pointerId);
  timeline.removeEventListener('pointermove', this._onPointerMove);
  timeline.removeEventListener('pointerup', this._onPointerUp);

  if (this._isDragging) {
    // Finalize selection
    if (this._engine) {
      this._engine.setSelection(this._selectionStart, this._selectionEnd);
    }
    this.dispatchEvent(
      new CustomEvent('daw-selection', {
        bubbles: true,
        composed: true,
        detail: { start: this._selectionStart, end: this._selectionEnd },
      })
    );
  } else {
    // Click — seek to position, clear selection
    const rect = timeline.getBoundingClientRect();
    const px = e.clientX - rect.left + timeline.scrollLeft;
    const time = pixelsToSeconds(px, this.samplesPerPixel, this._sampleRate);
    this._selectionStart = 0;
    this._selectionEnd = 0;
    if (this._engine) {
      this._engine.seek(time);
      this._engine.setSelection(0, 0);
    }
    this._currentTime = time;
    this._stopPlayhead();
    if (this._isPlaying) {
      this._startPlayhead();
    }
    this.dispatchEvent(
      new CustomEvent('daw-seek', {
        bubbles: true,
        composed: true,
        detail: { time },
      })
    );
  }
  this._isDragging = false;
};
```

Update `render()` — replace `@click` with `@pointerdown`, add selection overlay:
```typescript
<div
  class="timeline ${this._dragOver ? 'drag-over' : ''}"
  style="width: ${Math.max(this._totalWidth, 100)}px;"
  data-playing=${this._isPlaying}
  @pointerdown=${this._onPointerDown}
  @dragover=${this._onDragOver}
  @dragleave=${this._onDragLeave}
  @drop=${this._onDrop}
>
  <daw-selection
    .startPx=${(this._selectionStart * this._sampleRate) / this.samplesPerPixel}
    .endPx=${(this._selectionEnd * this._sampleRate) / this.samplesPerPixel}
  ></daw-selection>
  ${/* rest of existing render */}
```

Add CSS for cursor:
```css
.timeline {
  position: relative;
  min-height: 50px;
  cursor: text;
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run`
Expected: All tests PASS

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && pnpm typecheck`
Expected: PASS

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor-interactions.test.ts
git commit -m "feat(dawcore): add click-drag selection with visual overlay"
```

---

### Task 6: Update Dev Page and Final Verification

Update the dev page to demo all new interactions and verify everything works.

**Files:**
- Modify: `packages/dawcore/dev/index.html`

- [ ] **Step 1: Update dev page**

Enable `file-drop` on the editor and add event logging:

```html
<daw-editor id="editor" samples-per-pixel="1024" wave-height="128" timescale file-drop>
  <daw-track src="/media/audio/sonnet.mp3" name="Track 1"></daw-track>
  <daw-track src="/media/audio/sonnet.mp3" name="Track 2"></daw-track>
</daw-editor>
```

Add a script block to log events for debugging:
```html
<script type="module">
  const editor = document.getElementById('editor');
  editor.addEventListener('daw-seek', (e) => console.log('seek:', e.detail));
  editor.addEventListener('daw-track-select', (e) => console.log('track-select:', e.detail));
  editor.addEventListener('daw-selection', (e) => console.log('selection:', e.detail));
  editor.addEventListener('daw-track-ready', (e) => console.log('track-ready:', e.detail));
</script>
```

- [ ] **Step 2: Run full build**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Run all tests**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Run lint**

Run: `cd /Users/naomiaro/Code/waveform-playlist && pnpm lint`
Expected: 0 errors. Fix formatting with `pnpm format` if needed.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/dev/index.html
git commit -m "feat(dawcore): update dev page with file-drop and interaction events"
```
