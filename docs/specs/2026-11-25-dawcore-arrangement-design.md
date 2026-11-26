# `<daw-editor>` on the arrangement (#848)

Issue #848 has three parts: `<daw-editor>` sharing the arrangement code, who
wins between the arrangement and the declarative DOM, and Undo pressed during
a drag. This document settles all three. The maintainer's answers in the
design conversation of 2026-11-25 are marked **(decided)**; the rest are the
author's calls, marked **(call)**, open to correction.

## Why

The arrangement (`createArrangement`, `@waveform-playlist/engine`) is since
#812 the one owner of the tracks, the clips, the mix, the undo history and
loading, for the React editor. `<daw-editor>` builds a `PlaylistEngine` with a
private arrangement and keeps its own copies next to it, kept in step by
reconcilers. Each load ends in `engine.setTracks`, which wipes the undo
history, mixer steps included.

After this work an app, or an AI agent, drives `<daw-editor>` through one
object: it creates an arrangement, hands it to the editor, and reads and
changes the tracks, the mix, undo and loading on it, without knowing about
elements **(decided: "apps can hand in an arrangement - this seems a useful
path for AI agents")**. The editor plays and draws the arrangement and changes
it only through its methods.

The elements follow one rule: **as close to the native DOM as possible
(decided).** The markup is the starting declaration, like `<input value>`;
live state is read from properties, like `input.value`.

## Goals

- One owner for every piece of track state: the arrangement (owner table below).
- `editor.arrangement` can be handed in by the app, or the editor makes its own.
- Loading never clears the undo history.
- Undo and redo do nothing while a drag is in progress, in both editors;
  Escape cancels a drag in `<daw-editor>` (decided).
- `<daw-track>` / `<daw-clip>` behave like native form controls: attributes
  are what the page declared, properties are live (decided).

## Non-goals

- A shared arrangement INSTANCE between a `<daw-editor>` and a React provider
  at the same time (one engine per arrangement; a second attach warns).
- Elements created for tracks that have none (decided: no element is created).
- An element taking over an existing arrangement track by id
  (`<daw-track id="drums">` adopting a restored track). A later addition.
- `editor.toHTML()` (markup from the arrangement's current state). Mentioned
  as the way to copy the current state without writing the page's DOM; not
  part of this work.
- Undo of annotation edits: annotations are not in the arrangement's history
  in either editor, so rule a) does not apply to the annotation drag. Escape
  does.

## Anti-goals

- A guard, flag or merge between two stored copies. If a design step needs
  one, a second owner is left.
- The editor writing attributes or moving its children. That fights a
  framework that renders the `<daw-track>` children (decided: the markup is
  the starting declaration, track order included).

## Owner table

Read from `packages/dawcore/src/elements/daw-editor.ts` (line numbers at
`0ede9207`), `packages/dawcore/src/types.ts`, `daw-track.ts`, `daw-clip.ts`
and `packages/engine/src/arrangement/types.ts`.

| State | Stored where today (every place) | Who writes each place | Owner after | How others change it |
| --- | --- | --- | --- | --- |
| Tracks and their order | engine's private arrangement; `_tracks` Map (insertion order, sorted by DOM position in `_getOrderedTracks`); `_engineTracks` Map (`:475`); `<daw-track>` DOM order | arrangement: engine calls; `_tracks`: `_onTrackConnected`, `_reconcileDescriptorsWithEngineTracks`; `_engineTracks`: `_loadTrack`, statechange handler (`:2747`), recording, `_applyClipUpdate`; DOM order: `_syncDomToEngineOrder` | the arrangement | `addTrack` / `removeTrack` / `reorderTrack` on the arrangement; the editor draws `getTracks()` order |
| Clip geometry (start, duration, offset, gain, fades, name) | arrangement; `_engineTracks`; clip descriptors in `_tracks` (written when a clip is appended late, `:1891`, and removed, `:2266`); `<daw-clip>` Lit properties | arrangement: drags, `editor.updateClip`; descriptors: recording; Lit properties: attribute parse, `updateClip` | the arrangement | `moveClip` / `trimClip` / `splitClip` / `updateTrack`; `<daw-clip>` properties become getters over it |
| Mix (volume, pan, muted, soloed) | arrangement (since #843); `_seedMix` (`:474`) while a track loads; `<daw-track>` Lit properties | arrangement: `_writeMix`; seed: `_writeMix` before the engine holds the track; Lit properties: attribute parse, `editor.updateTrack` | the arrangement | mixer setters; `<daw-track>` properties become getters over it; `_seedMix` goes |
| Loading status | `_loadingTracks` Set; `_audioCache` (promises by src); `_clipBuffers`; arrangement `sources` (unused by dawcore) | `_loadTrack`, `_fetchAndDecode` | the arrangement (`sources`, its `loadSource`) | `retry(src)`; the editor reads `sources` and the loaded clips' `audioBuffer` |
| Undo history | arrangement, cleared by every `engine.setTracks` (`:2590`) | arrangement | the arrangement, never cleared by loading | `undo` / `redo` / `clearHistory` |
| Decoded audio | `_audioCache`, `_clipBuffers`, the engine clips' `audioBuffer` | `_fetchAndDecode`, `_loadTrack` | the arrangement's loaded clips | read only |
| `.dat` peaks preview | `_peaksCache`, `_peaksData`, the preview track in `_engineTracks` (`:2466`) | `_loadTrack` | the editor's render cache, keyed by clip id; the preview track goes | one-way: drawn while the clip is a `LoadingClip`, dropped when it loads |
| Editor-only per track: render mode, spectrogram config, effects chain, element reference, a clip's `peaks-src` | descriptor fields in `_tracks`, `EffectsManager` | the editor | the editor (no copy elsewhere) | as today; keyed by track id |
| A drag in progress | each handler's own fields (`ClipPointerHandler`, `TrackReorderHandler`, `AnnotationDragHandler`; React: dnd-kit drag state) | the handler | the handler | `undo()` / `redo()` ask it; Escape ends it |

What remains a second place, and why it is not one: the editor's peak caches
and the per-track descriptor fields hold what the arrangement does not
(render mode, effects, element references), written by the editor alone and
never written back. Attributes are the page's declaration: the editor reads
them, never writes them, and they are not a copy of the arrangement.

## Approaches

**Delivery (decided: A).**

- **A) Three PRs, in order.** (1) undo during a drag and Escape, both
  editors; (2) normal engine import, the arrangement from construction,
  loading through it; (3) `editor.arrangement` handed in, live element
  properties, the remaining copies removed. Each reviewable on its own; the
  editor works between them.
- B) One PR. No half-moved state, but most of a 4000-line file in one review,
  and one review finding holds up all of it.

**Loading (one sensible way): the arrangement does all of it.** A handed-in
arrangement comes with the app's `loadSource`, so the editor cannot plug its
own decode cache in. The editor stops fetching audio; it reads the loaded
clips' `audioBuffer`. Rejected: the editor passing its `_fetchAndDecode` as
`loadSource` (works only for an arrangement the editor makes).

**Engine import (decided).** `@waveform-playlist/engine` is a required peer
of dawcore, so a lazy import only kept about 20 KB gzipped out of the first
chunk (measured on the `dist` builds in the checkout, against about 95 KB for
dawcore). The laziness is what made the copies: there was no owner while the
first tracks loaded. The engine is imported normally.

**The DOM's role (decided: C, the `<input>` model).** Rejected: A, elements as
requests with properties left stale (the DOM does not show the updated state);
B, the editor writing attributes and moving elements (the `contenteditable`
model; copied HTML is current, but the editor edits its children and fights a
framework that renders them). C keeps one owner and reads like a form control.
Order is part of the same rule (decided after discussion: no DOM order sync).

**Undo during a drag (decided: a).** Options were a) undo and redo do nothing
during a drag, b) undo cancels the drag, c) undo cancels the drag and then
undoes. During a native HTML drag-and-drop the browser passes no key presses
to the page except Escape, which cancels the drag (known browser behaviour,
not run here); a) matches it.

## PR 1: undo during a drag, Escape cancels a drag

Independent of PRs 2 and 3.

**Behaviour (decided):**

- While a clip move, a clip trim or a track-reorder drag is in progress,
  `undo()` and `redo()` do nothing: `<daw-editor>`'s methods and its
  `<daw-keyboard-shortcuts undo>` keys; React's `useEditorControls().undo` /
  `redo` and `<KeyboardShortcuts undo />`. Closes #906 (React, undo during a
  track drag leaves the panels' DOM order wrong): the reproduced case is undo
  mid-drag.
- In `<daw-editor>`, Escape cancels a clip move, a clip trim, a track-reorder
  drag and an annotation edge drag, the same way `pointercancel` does today:
  `abortTransaction()` for a clip drag, the saved order for a track drag, the
  snapshot for an annotation drag; the rest of the pointer's travel is
  ignored.

**Calls:**

- Escape during a drag cancels the drag and does nothing else: it does not
  also stop playback through `<daw-keyboard-shortcuts playback>` (which binds
  Escape to stop) or React's `usePlaybackShortcuts`. The native drag swallows
  the key the same way.
- `canUndo` / `canRedo` are unchanged during a drag (no extra re-render on
  drag start and end). Only the actions are inert.
- The undo call during a drag is silent (no console warning): it is a normal
  key press, not a mistake.
- React's drags already cancel on Escape (dnd-kit; documented for the
  annotation drag in `website/docs/react/guides/annotations.md`, and
  `useClipDragHandlers.ts:319`). PR 1 confirms it for a clip move, a clip
  trim and a track drag in a browser before saying so, and adds only the
  undo rule there.
- React needs one place that knows a drag is in progress, which the undo
  action reads. The drags live under different `DragDropProvider`s (clips,
  track reorder, annotations). The plan picks the place; it must be written
  by drag start and end only, and survive a drag that ends by unmount.

**Not covered:** a change to the arrangement made by the app during a drag
(an agent calling `arrangement.undo()` mid-drag). That is PR 3, below.

## PR 2: the arrangement from the start; loading through it

**Decided:** the engine is imported normally; the `CLAUDE.md` rule
"`@waveform-playlist/engine` is imported as types only" is removed.

**Calls:**

- The editor creates its arrangement when it is constructed
  (`createArrangement()`), not when the first track has decoded.
- The engine is built when `editor.adapter` is set (and the editor is
  connected), on that arrangement. `engine.init()` stays deferred to the
  first `play()` (the user-gesture rule). The sample rate comes from
  `adapter.audioContext`; `_resolvedSampleRate` from decoded audio goes, or is
  read from the loaded clips if the plan finds a case where they differ.
- A `<daw-track>` that connects enters the arrangement at once, with a
  `LoadingClip` per `<daw-clip>` (`src`, times in seconds, `name`, `gain`,
  fades), the same as `audioTrack()` in React. MIDI clips have no source and
  enter loaded, as today.
- The arrangement loads each source once with its `loadSource`; the editor
  reads `sources` for pending and failed, and dispatches its existing
  `daw-clip-error` / `daw-track-error` / `daw-track-ready` events from it.
  A track whose clips all failed is still an error, as today.
- The `.dat` preview stays in the editor: it fetches `peaks-src` and draws the
  peaks for the loading clip's id until the clip loads. Whether it goes onto
  the `LoadingClip`'s `waveformData` instead (core has the field) is for the
  plan: putting it there writes the arrangement after the clip entered, which
  must not be an undo step.
- Undo history: a track entering at connect is an undo step like any added
  track, except the tracks declared in the markup when the page loads, which
  are not (the React MIDI guide does the same with `clearHistory()` after the
  first load). The plan settles how "declared at page load" is told apart
  (for example, tracks added before the editor's first render).
- Gone in this PR: `_seedMix`, the peaks-first preview track in
  `_engineTracks`, every `engine.setTracks` in the load path (and its
  fallbacks), `_audioCache`, `_clipBuffers`, `_loadingTracks` if `sources`
  answers the same question, `_adapterConsumedByDispose` if a reconnect can
  simply build a new engine on the kept arrangement once a fresh adapter is
  set.
- Reparenting: the arrangement survives a disconnect (a moved `<input>` keeps
  its value). The engine is disposed with its adapter as today and rebuilt
  when a fresh adapter is set. Element tracks are not added a second time on
  reconnect (their ids are already in the arrangement).
- Recording: a finished take goes in with `arrangement.updateTrack` (today
  `engine.updateTrack` plus `_engineTracks` and the descriptor); the take
  mute stays `setTrackRecording`.
- File drops (`loadFiles`): each file enters as a track with a `LoadingClip`
  whose `src` is the `File` (a `ClipSource`); the blob-URL handling goes. A
  file that fails is removed with `{ undoable: false }`, as the React example
  pages do.
- Before the arrangement has a decode context (no adapter yet), tracks sit as
  loading clips; they load once the engine attaches the adapter's context.

## PR 3: a handed-in arrangement; live element properties

**Decided:** `editor.arrangement` can be set by the app; element attributes
are never written by the editor; element properties read the arrangement;
DOM order is not synced.

**Calls:**

- `editor.arrangement` is a property (no attribute). Reading it returns the
  arrangement the editor plays. Setting it replaces the arrangement: the
  engine is rebuilt on the new one (one engine per arrangement), and each
  connected `<daw-track>` whose id the new arrangement does not hold is added
  to it. The old arrangement is left as it is; the editor never disposes an
  arrangement it was handed.
- `<daw-track>` properties `volume`, `pan`, `muted`, `soloed`, `name` and
  `<daw-clip>` properties `start`, `duration`, `offset`, `gain`, `name`,
  fades, become getters over the arrangement, falling back to the parsed
  attribute when the element is not in an editor or the arrangement does not
  hold it (refused, or removed). Setting one is a request to the arrangement,
  one undo step, as an attribute change is (#843 already does this for the
  mix of a `<daw-track>`). Setting a property never writes the attribute.
- A position property, like `option.index`: `trackEl.index`, the track's
  position in the arrangement.
- An attribute changed by the page is a request, one undo step. The value the
  arrangement already holds changes nothing (same-value setters are silent
  since #843).
- Moving a `<daw-track>` in the DOM is a reorder request: it is placed after
  the arrangement track of its previous element sibling. An Undo of a reorder
  does not move elements. `_syncDomToEngineOrder`, `_syncEngineOrderToDom`
  and `_inOrderSync` go.
- Removing an element removes its track as an undo step (as today). Undo
  brings the track back without an element, drawn like any element-less
  track. `_reconcileDescriptorsWithEngineTracks` goes: the editor-only fields
  of a track with no descriptor take their defaults (render mode from the
  kind, no effects).
- `_engineTracks` goes: the editor reads `arrangement.getTracks()` (the same
  array until the tracks change; untouched tracks keep their object), and the
  descriptors keep only the editor-only fields.
- `editor.tracks` reads the arrangement's order and mix.
- A change to the arrangement made elsewhere while a drag is in progress (an
  app or agent calling `undo()`, `reorderTrack`, `removeTrack`) cancels the
  drag, like `pointercancel`. Whether the clip drag keeps writing every
  pointer move into the arrangement inside a transaction, or moves to React's
  model (a view-only preview and one call on release, #864) so that its own
  writes cannot be confused with someone else's, is for the plan.

## Documentation surface

Named here so it is not discovered during review.

- PR 1: `packages/dawcore/COMPONENTS.md` (`<daw-keyboard-shortcuts>`, the
  editor's `undo` / `redo`), `packages/dawcore/notes/interactions.md`,
  `website/docs/react/guides/playback-controls.md` (shortcuts) and
  `custom-drag-setup.md`, `docs/specs/web-components-migration.md` (keyboard
  section), changesets for dawcore and browser.
- PR 2: `packages/dawcore/CLAUDE.md` (the engine-import rule; "Engine built
  lazily on first track load"; "Engine API note"),
  `notes/tracks-and-loading.md`, `packages/dawcore/README.md`,
  `website/docs/web-components/getting-started.md`, `llms.txt` and
  `llm-reference.md` where they describe dawcore loading.
- PR 3: `COMPONENTS.md` (`editor.arrangement`, element properties,
  `trackEl.index`, attributes as declaration), the elements' entries in
  `packages/dawcore/CLAUDE.md` and `notes/elements.md`, the attribute tables
  in `docs/specs/web-components-migration.md`, `README.md`,
  `examples/dawcore-*/programmatic.html` (reads `clipEl.start` after a drag),
  `llms.txt` (handing an arrangement to `<daw-editor>`, the agent path).
- A new section in `packages/dawcore/CLAUDE.md` (decided: there, not a skill
  for now): "As close to the native DOM as possible": the rule, the native
  precedents (`<input>` value / `defaultValue`, `<option>` `selected` /
  `index`, `<details open>`, `<video>`), and a checklist for a new attribute or
  property (what the attribute holds, what the property returns, whether the
  editor writes it back, which event fires, what happens before the element
  connects). Written in PR 3, where the rule is applied.

## Left to the builder

- Where React's "a drag is in progress" lives (PR 1).
- How Escape is caught in `<daw-editor>` so it reaches no other shortcut.
- The `.dat` preview on the `LoadingClip` or beside it (PR 2).
- Telling page-load tracks apart from later ones for the undo history (PR 2).
- The clip drag model in PR 3 (transaction or preview).
- Which unit tests of dawcore change meaning (the reconciler, order sync and
  seed tests go with their code) and which e2e specs cover the new behaviour.
