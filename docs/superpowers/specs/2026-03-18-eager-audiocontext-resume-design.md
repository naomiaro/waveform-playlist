# Eager AudioContext Resume — Design Spec

**Date:** 2026-03-18
**Scope:** `@dawcore/components` (dawcore package only)
**Branch:** TBD

## Problem

Web browsers suspend `AudioContext` until a user gesture (click, keypress). Currently, `<daw-editor>` defers `engine.init()` — which calls `Tone.start()` to resume the context — to the first `play()` call. This adds ~200-500ms of latency on the first play press.

## Solution

Resume the `AudioContext` on the first user interaction within the editor (or a broader scope), before play is pressed. By the time the user clicks play, the context is already running and `engine.init()` resolves instantly.

**Critical:** Use `resumeGlobalAudioContext()` (raw context resume), NOT `Tone.start()`. `Tone.start()` adds ~2s latency on Safari if called redundantly.

## Components

### 1. `AudioResumeController`

**File:** `packages/dawcore/src/controllers/audio-resume-controller.ts`

**Type:** Lit reactive controller. Follows the pattern of `ViewportController` — constructor takes host + options, calls `host.addController(this)`, resolves target in `hostConnected()`.

**API:**

```typescript
class AudioResumeController implements ReactiveController {
  /** CSS selector, or 'document'. When undefined, controller is inert. */
  target?: string;

  constructor(host: ReactiveControllerHost & HTMLElement);
}
```

Standalone usage:

```typescript
class MyElement extends LitElement {
  private _audioResume = new AudioResumeController(this);

  connectedCallback() {
    super.connectedCallback();
    this._audioResume.target = 'document';
  }
}
```

**Target resolution (in `hostConnected()`):**

- **omitted / empty string** — listen on host element
- **`'document'`** — listen on `document`
- **any other string** — `document.querySelector(selector)`. Warn and fall back to host if not found.

**Listeners:** `pointerdown` + `keydown` with `{ once: true, capture: true }`.

- `capture: true` ensures resume fires before any other handler, so the context is already resuming by the time a play handler runs.
- `{ once: true }` auto-removes the fired listener.

**Handler shape:** A single shared handler function used for both event types. On first fire, it calls `resumeGlobalAudioContext()` (fire-and-forget, no await) and removes the other listener via `target.removeEventListener(otherEvent, handler, { capture: true })`. This ensures cross-listener cleanup works correctly.

**`hostDisconnected()`:** Removes both listeners if they haven't fired yet.

**Dynamic changes not supported.** Once listeners are attached in `hostConnected()`, changing the target has no effect. The resume only needs to happen once per page lifecycle.

**Export:** From `packages/dawcore/src/index.ts` for standalone consumer use. This is a new pattern (existing exports are elements + types only) but necessary for consumers who want to attach the controller to their own Lit elements without `<daw-editor>`.

### 2. `<daw-editor>` Integration

**Property:**

```typescript
@property({ attribute: 'eager-resume' })
eagerResume?: string;
```

When the attribute is absent, `eagerResume` is `undefined`. When present with no value (`<daw-editor eager-resume>`), Lit's String converter yields `""`. The controller checks `this.host.eagerResume !== undefined` (not a falsy check) to distinguish "not set" from "set to empty string."

**Behavior:** The controller is self-contained — it only reads from its constructor options, never from host properties. The editor creates it in the constructor and sets the `target` property on it. In `hostConnected()`, the controller reads `this.target` to resolve the listener target. When `target` is `undefined`, the controller skips listener attachment (inert).

The editor sets the controller's `target` from `eagerResume` in `willUpdate()`. Note: `hostConnected()` fires BEFORE `willUpdate()` in Lit's lifecycle, so the controller defers its work via `requestAnimationFrame` — by the time the rAF fires, `willUpdate()` has already set `target`.

This follows `ViewportController.scrollSelector` — a public property set by the host, read by the controller in `hostConnected()`.

**Attribute usage:**

```html
<!-- Listen on the editor element itself -->
<daw-editor eager-resume></daw-editor>

<!-- Listen on document (any interaction on the page) -->
<daw-editor eager-resume="document"></daw-editor>

<!-- Listen on a specific ancestor -->
<daw-editor eager-resume="#my-app"></daw-editor>
```

**File size budget:** `daw-editor.ts` is currently 793 lines (hard max: 800). The integration adds ~5 lines (import, property declaration, constructor line). This stays within budget. If future additions push past 800, the `loadFiles` extraction (noted in CLAUDE.md) should happen first.

## Testing

### `AudioResumeController` unit tests:

1. Calls `resumeGlobalAudioContext()` on first `pointerdown`
2. Calls `resumeGlobalAudioContext()` on first `keydown`
3. Only calls resume once (second event is no-op, listeners removed)
4. Removes listeners on `hostDisconnected()` before any event fires
5. Resolves CSS selector target via `document.querySelector()`
6. Falls back to host when selector doesn't match (with `console.warn`)
7. `target: 'document'` attaches to document
8. Skips listener attachment when target resolves to `undefined` (inert mode)

### `<daw-editor>` integration tests:

9. `eager-resume` attribute creates controller and attaches listeners
10. `eager-resume="document"` passes `'document'` as target
11. No controller listeners when `eager-resume` not set

**Mocking:** Mock `resumeGlobalAudioContext` from `@waveform-playlist/playout`.

## Files Changed

- **New:** `packages/dawcore/src/controllers/audio-resume-controller.ts`
- **New:** `packages/dawcore/src/__tests__/audio-resume-controller.test.ts`
- **Modified:** `packages/dawcore/src/elements/daw-editor.ts` — add `eagerResume` property + controller (~5 lines)
- **Modified:** `packages/dawcore/src/__tests__/daw-editor.test.ts` — integration tests
- **Modified:** `packages/dawcore/src/index.ts` — export `AudioResumeController`

## Non-Goals

- React browser package (`@waveform-playlist/browser`) — not in scope
- Changing `engine.init()` / `Tone.start()` behavior — the existing init path remains unchanged
- Automatic resume without user gesture — browsers require a gesture, this just moves it earlier
