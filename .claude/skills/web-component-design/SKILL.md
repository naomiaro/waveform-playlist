---
name: web-component-design
description: Use when designing or changing a custom element in packages/ (dawcore's <daw-editor>, <daw-track>, <daw-clip> and the others) - an attribute, a property, what its children mean, connect/disconnect/move behaviour, what an undo or a swap does to the page, cancellation with AbortSignal, or a test of any of these.
---

# Web component design

The rule for this codebase's data elements is in `packages/dawcore/CLAUDE.md` ("As close to the native DOM as possible"); the full lifecycle table is `docs/specs/web-components-migration.md`, "Element Lifecycle: Declaration and Live State". This skill is how to design the next one. Read the modern-web-guidance `custom-elements` guide too.

## Declaration and live state

- **The markup is the page's declaration; live state is read through properties.** The library writes no attribute and moves no element; an element's position is declaration like its attributes. A page action (a property set, an attribute change, a DOM move) is a request; what happens after it (an Undo, a Redo, a refusal, a swap) shows in the live state, never in the DOM. On #919 an element put-back and an element that followed Undo were built and withdrawn for breaking this; a framework that renders the children would fight either.
- **Pick the native precedent before the behaviour, and check where precedents disagree.** `<input value>` / `input.value` (attribute is the default, property is live), `<option>.index` (position as a property), `<video>` + `<source>` + `srcObject` (children declare, a handed-in object replaces them while set), `<track>` (removing or moving the element removes or moves what it declared). `<source>` and `<track>` disagree on removal (a removed `<source>` keeps playing): say which one you follow and why (#919 followed `<track>`: a clip element lasts as long as its clip).
- **Link a child to its data by id, not by parent.** After an Undo of a move the element sits in another parent; linked by parent it reads "detached" while its data plays.

## Ask these before building (each was a separate ruling on #919)

For each state an element can be in (pending, live, detached, the container swapped out), what happens when the page: adds a child; removes it; moves it to another parent, to a parent that is not live yet, to one of the wrong kind; moves the parent out and back; and what an Undo and a Redo of each do to the page. Put the whole matrix to the maintainer at once; a ruling on one operation is a question about its siblings (the same situation for every other call).

## Moves

- **`connectedMoveCallback` must announce the new place.** With it defined, `Node.moveBefore()` runs it instead of disconnect + connect. If the container learns of children from their connected events (and of removals from a MutationObserver, which still sees the move), an empty hook makes a move into another parent, or back into the container, invisible. Share one `_announceConnected()` between both callbacks:

  ```ts
  connectedCallback() {
    super.connectedCallback();
    this._announceConnected();
  }
  connectedMoveCallback(): void {
    this._announceConnected();
  }
  ```

- happy-dom has no `moveBefore`: test the real API in Chromium.

## Cancellation (AbortSignal)

- **One AbortController per lifetime** (a connection, a gesture, a target, the resource the container currently plays), every listener of it registered with `{ signal }`, one `abort()` where the lifetime ends. A reconnect makes a new controller: an aborted signal cannot be reused. Keep `capture`/`passive` in the options.
- **Per resource, not per container:** key the controller by the thing that can be swapped out, so a swap ends only the waits of the one leaving.
- **Reject with `signal.reason` as it is** (as `fetch()` does), and never tell success from failure by truthiness: `abort('')`, `abort(0)`, `abort(null)` are reasons. Use a marker for success.
- A signal already aborted rejects at once and changes nothing; combine a caller's signal with your own with `AbortSignal.any`. Say what an aborted call leaves behind (here: nothing, no undo step; a Redo list its arrival cleared stays cleared).

## Testing elements

- **happy-dom 21 is loose with `{ signal }`:** it adds a listener for an already aborted signal and removes it without the capture flag, so a forgotten controller renewal passes behaviour tests. Count listeners (`packages/dawcore/src/__tests__/helpers/listener-probe.ts`) and check a reparent in Chromium. It has no `attachInternals` (stub it for `:state()`).
- **Run lifecycle claims in a real browser before writing them:** reparent the container (remove, append, a new adapter), move children with `moveBefore()`, and use the controls afterwards. An ad-hoc Playwright script against an example server is enough (skill `browser-probes`).
- **An e2e assertion must be able to see the bug.** A custom state that is refreshed only when the data changes does not move on a refused request; read a live property instead (move the data first so the property and the attribute differ). Break the guarded line under the dev server and see the test fail before trusting it.
