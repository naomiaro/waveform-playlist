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
object: it creates an arrangement and hands it to the editor (or reads the
editor's own, `editor.arrangement`), and reads and changes the tracks, the mix, undo and loading on it, without knowing about
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
- The editor writing attributes or moving its children on its own. That
  fights a framework that renders the `<daw-track>` children (decided: the
  markup is the starting declaration, track order included). The one
  exception is an explicit request to remove: `editor.removeTrack` /
  `removeClip` remove the element, as `select.remove(i)` does.

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

**Other choices made in the conversation (each decided, 2026-11-25), with
what was rejected:**

- Markup and a handed-in arrangement: the `srcObject` model. Rejected: the
  children added to whichever arrangement the editor plays (page tracks in
  the app's undo history, duplicate ids on a swap, a split's leftover clip
  coming back).
- An element whose id left the arrangement: detached, linked by id.
  Rejected: an element that declares its track again on reconnect or on an
  attribute change (a split's `<daw-clip>` would come back over its halves).
  Made visible: split keeps the left id, `:state(detached)`, a warning.
- The editor's methods: arrangement calls. Rejected: element factory (the
  editor writes its children after all, and the elements it made would be
  detached under a handed-in arrangement); removing them (editor-only parts
  would still need methods, two APIs for one task).
- Inserting a track at a position: `addTrack(track, { index })`. Rejected:
  a transaction around `addTrack` + `reorderTrack` (overwrites an open drag
  transaction); always appending (not native).
- A swap after the engine exists: keep the adapter. Rejected: the app sets a
  fresh adapter after the swap (two steps, no playback between them); swap
  allowed only before an engine (another project needs a new element).
- A track whose sources all failed: stays, like a broken `<img>`. Rejected:
  removed by the editor (drops the arrangement's retry).
- Escape during a drag: only cancels the drag. Rejected: it also stops
  playback and deselects.

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
- Escape during a drag only cancels the drag, in both editors (decided,
  2026-11-25). It does not also stop playback (`<daw-keyboard-shortcuts
  playback>` and React's `usePlaybackShortcuts` bind Escape to Stop) and does
  not deselect an annotation (React's `useAnnotationKeyboardControls`). A
  second Escape after the drag does those as usual. The native drag swallows
  the key the same way. Not checked yet: whether React does both today during
  a dnd-kit drag; PR 1 runs it before changing it.

**Calls:**

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
(an agent calling `arrangement.undo()` mid-drag). That is PR 3, below, for
both editors.

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
- A `<daw-track>` that connects enters the arrangement as soon as the editor
  has an adapter (at once in practice: pages set the adapter before tracks
  load, as decode needs its `audioContext` today), with a
  `LoadingClip` per `<daw-clip>` (`src`, times in seconds, `name`, `gain`,
  fades), the same as `audioTrack()` in React. MIDI clips have no source and
  enter loaded, as today.
- The arrangement loads each source once with its `loadSource`; the editor
  reads `sources` for pending and failed, and dispatches its existing
  `daw-clip-error` / `daw-track-error` / `daw-track-ready` events from it.
- **A track whose sources all failed stays, like a broken `<img>` (decided,
  2026-11-25).** It is drawn with a failed placeholder (React dims a
  placeholder clip through `placeholderClipOpacity`; the plan picks dawcore's
  look and its CSS custom property), `daw-clip-error` and `daw-track-error`
  fire, `arrangement.retry(src)` (and an editor method for it, the plan's
  name) loads it, and `daw-track-ready` fires then. The app decides whether
  to remove it. Was: the track never entered and `addTrack()` rejected
  (`daw-editor.ts:2573`); an upgrade entry. A dropped file that fails is
  still removed with `{ undoable: false }` (below): it was never a
  declaration.
- `editor.addTrack()` resolves with the track id once the track has entered
  the arrangement, not once it has loaded; loading is followed through the
  events and `sources`. Called before `editor.adapter` is set, it waits until
  the adapter arrives and the track enters (call, 2026-11-25: tracks enter
  only with an adapter), with one `console.warn` per editor that tracks are
  waiting for `editor.adapter`. Was: it rejected with the no-adapter error.
- The `.dat` preview stays in the editor: it fetches `peaks-src` and draws the
  peaks for the loading clip's id until the clip loads. Whether it goes onto
  the `LoadingClip`'s `waveformData` instead (core has the field) is for the
  plan: putting it there writes the arrangement after the clip entered, which
  must not be an undo step.
- Undo history (call, 2026-11-25, told to the maintainer): a track entering
  at connect is an undo step like any added track, except the tracks
  declared in the markup when the page loads. If the editor's OWN
  arrangement has no history when the page's tracks arrive, the editor
  clears it again after adding them (the React MIDI guide does the same with
  `clearHistory()` after the first load), so Undo right after load removes
  nothing. If an app or agent changed `editor.arrangement` first, the history
  is not empty, the page's tracks stay undo steps and nothing is wiped. Page
  tracks never go into a handed-in arrangement (the `srcObject` model). The
  plan settles how "the page's tracks" are batched (they connect one by one,
  each after a `setTimeout(0)` in `<daw-track>`).
- **Inserting at a position (decided, 2026-11-25: the index option).** The
  engine gains `arrangement.addTrack(track, { index })` (and the engine's
  `addTrack` passes it on): the track enters at that position, one undo
  step. A `<daw-track>` inserted between two others later in the session
  lands at its DOM position. Rejected: `addTrack` then `reorderTrack` in a
  transaction (`beginTransaction` overwrites an open one, so an insert during
  a clip drag would drop the drag's transaction); always appending (not
  native). The engine calls the arrangement's methods by name through the
  `Symbol.for` attach keys, so a new option is a change of that interface:
  the keys go to `/v3` (`packages/engine/CLAUDE.md`, "Attaching goes through
  shared keys"). An engine changeset and the engine guide's entry.
- Gone in this PR: `_seedMix`, the peaks-first preview track in
  `_engineTracks`, every `engine.setTracks` in the load path (and its
  fallbacks), `_audioCache`, `_clipBuffers`, `_loadingTracks` if `sources`
  answers the same question, `_adapterConsumedByDispose` if a reconnect can
  simply build a new engine on the kept arrangement once a fresh adapter is
  set.
- Reparenting: the arrangement survives a disconnect (a moved `<input>` keeps
  its value). The engine is disposed with its adapter as today and rebuilt
  when a fresh adapter is set. Element tracks are not added again on
  reconnect, whether or not the arrangement still holds them (detached
  elements, PR 3).
- Recording: a finished take goes in with `arrangement.updateTrack` (today
  `engine.updateTrack` plus `_engineTracks` and the descriptor); the take
  mute stays `setTrackRecording`.
- File drops (`loadFiles`): each file enters as a track with a `LoadingClip`
  whose `src` is the `File` (a `ClipSource`); the blob-URL handling goes. A
  file that fails is removed with `{ undoable: false }`, as the React example
  pages do.
- Tracks wait for the adapter before entering (call, 2026-11-25): without
  it the sample rate is unknown, and a MIDI clip built at the 48000 fallback
  (`_buildMidiClip`, `daw-editor.ts:2084`; `sampleRate`, `:461`) keeps those
  samples when an engine at another rate attaches (`tickPreparer` derives
  `startTick` from `startSample` at the engine's rate and leaves samples
  alone, `packages/engine/src/arrangement/ticks.ts:67`). MIDI clips in
  musical time (start, length and notes in ticks) would remove the wait;
  that is its own issue, not part of #848.

## PR 3: a handed-in arrangement; live element properties

**Decided:** `editor.arrangement` can be set by the app; element attributes
are never written by the editor; element properties read the arrangement;
DOM order is not synced.

**Calls:**

- `editor.arrangement` is a property (no attribute). Reading it returns the
  arrangement the editor plays: a handed-in one, or else the editor's own.
- **The `srcObject` model (decided, 2026-11-25).** Like `<video src>` and
  `video.srcObject`: the `<daw-track>` children declare the content of the
  editor's OWN arrangement. A handed-in arrangement is played alone; the
  children are not added to it, and are detached (below) while it is set. An
  app that wants markup and an object to drive reads `editor.arrangement`
  (the editor's own) and does not hand one in. Setting `editor.arrangement`
  back to `null` returns to the editor's own arrangement, with what it held.
  The editor never disposes an arrangement it was handed.
- **Detached elements (decided, 2026-11-25).** An element is linked to its
  track or clip by id. It is live whenever the arrangement the editor plays
  holds that id (so a redo of its arrival or an undo of its removal makes it
  live again), and detached otherwise: after an Undo of the track's arrival,
  an app's or agent's `arrangement.removeTrack`, or while a handed-in
  arrangement is set. A detached element is not drawn, not in
  `editor.tracks`, its properties return its attribute values, and an
  attribute change on it does nothing. The editor never adds it again: not on
  the editor's reconnect, not on an arrangement swap, not on an attribute
  change. Removing it from the DOM and inserting it again declares a new
  track (or clip). Native precedents: a `<source>` inside `<video>` after
  the media element chose one (changing its `src` does nothing until
  `load()`; all are inert while `srcObject` is set), and an `<input>` whose
  value the user changed (the `value` attribute is inert until
  `form.reset()`).
- **Making detachment visible (decided, 2026-11-25: all three).**
  - A split keeps the original clip's id on the LEFT half; the right half
    gets a new id. A `<daw-clip>` then follows its left half, so a split
    never detaches an element. This is an engine change
    (`packages/engine/src/arrangement/clipEdits.ts` `splitClip`, and
    `operations/clipOperations.ts`) seen by React too, where clip ids are
    keys; the plan checks what in browser reads a split's ids (selection,
    spectrogram canvases registered by clip id, `useClipSplitting`). An undo
    of the split brings the clip back under the same id. Engine and browser
    changesets.
  - A custom state, `:state(detached)`, on `<daw-track>` and `<daw-clip>`
    (`ElementInternals.states`), so CSS and `el.matches(':state(detached)')`
    can see it. It is never written to the DOM (the page's markup stays
    untouched). The modern-web-guidance guide `custom-elements` recommends
    custom states for runtime state of this kind rather than a synthetic
    attribute.
  - A `console.warn` when an attribute changes on a detached element, naming
    the element and why it is detached.
- **The editor's own methods are arrangement calls (decided, 2026-11-25).**
  `editor.addTrack(config)` builds the track (its clips as loading clips,
  the mix, and the editor-only parts: render mode, effects) and adds it to
  the arrangement the editor plays; it creates no element and resolves with
  the track id once the track has entered (was: the `<daw-track>` element,
  `daw-editor.ts:2923`; an upgrade entry). `updateTrack`, `reorderTrack`,
  `addClip` and `updateClip` call the arrangement and write no element: an
  element-backed track's properties show the change, its attributes do not.
  `loadMidi` follows `addTrack`. The same methods work on a handed-in
  arrangement, so an agent has one API.
- **An editor method that removes also removes the element (decided,
  2026-11-25).** `editor.removeTrack` and `editor.removeClip` remove the
  `<daw-track>` / `<daw-clip>` from the DOM, as `select.remove(i)` and
  `table.deleteRow(i)` do, and as `editor.removeTrack` does today
  (`daw-editor.ts:1729`). Undo brings the track back without an element.
  Removing an element is something only the page or an editor method does;
  a change to the arrangement alone (an Undo, an agent's
  `arrangement.removeTrack`) detaches it.
- **Swapping the arrangement keeps the adapter (decided, 2026-11-25).**
  Setting `editor.arrangement` once an engine exists lets the old engine go
  WITHOUT disposing the adapter, and builds a new engine on the new
  arrangement with the same adapter: playback stops, the new tracks are sent,
  the effects chains of tracks that are not in the new arrangement are
  disposed. To the app it is one assignment, like `video.srcObject = other`.
  This needs a small public engine addition: a way for an engine to let go
  of its arrangement and its adapter subscriptions without calling
  `adapter.dispose()` (for example `engine.dispose({ keepAdapter: true })`;
  the name is for the plan). The plan checks that an adapter serves a second
  engine correctly (`onPlaybackEnded` is resubscribed, tempo and ppqn applied
  again in `_buildEngine`, the decode context attached again) and that the
  editor's `_adapterConsumedByDispose` guard does not fire for a swap. An
  engine changeset and the engine guide's entry.
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
  the arrangement track of its previous element sibling (the same rule gives
  the `index` of an inserted element). An Undo of a reorder
  does not move elements. `_syncDomToEngineOrder`, `_syncEngineOrderToDom`
  and `_inOrderSync` go.
- The page removing an element removes its track as an undo step (as
  today). Undo brings the track back without an element, drawn like any
  element-less track. `_reconcileDescriptorsWithEngineTracks` goes: the editor-only fields
  of a track with no descriptor take their defaults (render mode from the
  kind, no effects).
- `_engineTracks` goes: the editor reads `arrangement.getTracks()` (the same
  array until the tracks change; untouched tracks keep their object), and the
  descriptors keep only the editor-only fields.
- `editor.tracks` reads the arrangement's order and mix.
- **A change to the arrangement made elsewhere while a drag is in progress
  (an app or agent calling `undo()`, `reorderTrack`, `removeTrack`) cancels
  the drag, like `pointercancel`, in BOTH editors (decided, 2026-11-25,
  option a).** The outside change goes through. React apps already hold the
  arrangement, so the React drags (clip move and trim in
  `useClipDragHandlers`, the track reorder in `ClipInteractionProvider`)
  get the same rule in PR 3. Rejected: b) a lock in the arrangement that
  refuses `undo` / `redo` from anyone during a drag (new engine API, and
  other outside changes would still need a); c) leaving it to the app.
  PR 1's guards stay: they cover the editor's own undo and redo. Whether the clip drag keeps writing every
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
- PR 2 also: the engine guide (`website/docs/framework-agnostic/engine.md`)
  and `packages/engine/CLAUDE.md` for `addTrack(track, { index })` and the
  `/v3` keys; `COMPONENTS.md` for `addTrack()` resolving with an id, the
  failed placeholder and the retry method; upgrade notes in the dawcore
  changesets (dawcore has no upgrade page; `packages/dawcore/README.md`
  carries them if the plan finds no better place).
- PR 3: `COMPONENTS.md` (`editor.arrangement`, element properties,
  `trackEl.index`, attributes as declaration, `:state(detached)`, the
  warning, `removeTrack` / `removeClip` removing the element), the elements' entries in
  `packages/dawcore/CLAUDE.md` and `notes/elements.md`, the attribute tables
  in `docs/specs/web-components-migration.md`, `README.md`,
  `examples/dawcore-*/programmatic.html` (reads `clipEl.start` after a drag),
  `llms.txt` (handing an arrangement to `<daw-editor>`, the agent path), the
  engine guide and `packages/engine/CLAUDE.md` for the keep-the-adapter
  option and a split keeping the left id, and for React the split's ids in
  `website/docs/react/` wherever a split's result is described.
- A new section in `packages/dawcore/CLAUDE.md` (call, told to the
  maintainer with no objection: there, not a skill for now): "As close to the native DOM as possible": the rule, the native
  precedents (`<input>` value / `defaultValue`, `<option>` `selected` /
  `index`, `<details open>`, `<video>` and `<source>`, custom states for runtime flags), and a checklist for a new attribute or
  property (what the attribute holds, what the property returns, whether the
  editor writes it back, which event fires, what happens before the element
  connects). Written in PR 3, where the rule is applied.

## Left to the builder

- Where React's "a drag is in progress" lives (PR 1).
- How Escape is caught in `<daw-editor>` so it reaches no other shortcut.
- The `.dat` preview on the `LoadingClip` or beside it (PR 2).
- How the page's tracks are batched for the page-load history rule (PR 2).
- The name of the engine's keep-the-adapter option and of the editor's retry
  method (PR 3, PR 2).
- The failed placeholder's look and its CSS custom property (PR 2).
- The clip drag model in PR 3 (transaction or preview).
- Which unit tests of dawcore change meaning (the reconciler, order sync and
  seed tests go with their code) and which e2e specs cover the new behaviour.
