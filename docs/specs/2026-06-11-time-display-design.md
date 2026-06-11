# Design: `<daw-time-display>` + `<daw-time-format>` + `daw-timeupdate` (#459)

Part of epic #452 (transport & control elements). First sub-issue; also establishes
two foundations the rest of the epic builds on: a single editor-owned playback
animation loop, and duck-typed capability detection in the transport base class
(pre-paying #474, `<daw-player>` transport compatibility).

Working document — `git rm` before the PR merges. The PR description is the durable record.

## Goals

- `<daw-time-display>` — formatted playback time readout for `<daw-transport>`
- `<daw-time-format>` — select controlling the target's time format
- `daw-timeupdate` event — RAF-driven time event on `<daw-editor>` (spec: detail carries current time)
- Public `editor.isPlaying` / `editor.duration` getters (currently private state)
- One editor-owned RAF loop that internal consumers (playhead) and external
  consumers (`daw-timeupdate` listeners) hook into — mirrors the React
  `usePlaybackAnimation` pattern
- HTML5-adjacent semantics throughout: events mirror `HTMLMediaElement`
  (`timeupdate`, read-only `duration`), state lives on the target element the way
  form state lives on form controls, attributes reflect

## Non-goals

- `<daw-player>` itself (epic #454) — but every contract here is written so the
  player can implement it later (`currentTime`/`duration`/`isPlaying`/`timeFormat`/
  `setTimeFormat` + `daw-timeupdate`)
- Selection inputs (#463) — but `parseDisplayTime` ships here so they can reuse it
- The remaining ui-components time formats (`hh:mm:ss.u`, `.uu`, `thousandths`) —
  the WC spec defines three; YAGNI

## 1. Single playback animation loop (editor-owned)

New `PlaybackAnimationController` (Lit ReactiveController on `<daw-editor>`,
wrapping the existing `AnimationController`):

- `start()` — called where `_startPlayhead()` is called today. Each frame:
  1. `time = engine.getAudibleTime()` (computed once per frame — same
     latency-compensated clock the playhead uses today)
  2. dispatch `daw-timeupdate` (`detail: { time }`, bubbles, composed)
  3. update the playhead position (see below)
- `stop(finalTime)` — called where `_stopPlayhead()` is called today. Positions
  the playhead at the raw final time and dispatches one final `daw-timeupdate`
  so idle displays settle on the exact commanded position.
- Seeks while stopped also dispatch one `daw-timeupdate` (displays update
  without playback, matching `HTMLMediaElement` firing `timeupdate` on seek).

`<daw-playhead>` simplification: the editor already branches on `scaleMode` in
`_startPlayhead` and owns every conversion input (`effectiveSampleRate`,
`samplesPerPixel`, `_secondsToTicks`, `ticksPerPixel`). The editor now computes
pixels per frame and calls `playhead.setPosition(px)`. The playhead's six
mode-specific `start*/stop*Animation` methods and its own `AnimationController`
are removed (~70 lines). Breaking for `DawPlayheadElement`'s quasi-public
methods — acceptable at 0.0.x; nothing in-repo calls them except the editor.

Result: exactly one RAF loop during playback (today there is one in the playhead;
naively adding a second for `daw-timeupdate` is what this design avoids).

## 2. Editor API additions

```ts
get isPlaying(): boolean   // over @state _isPlaying
get duration(): number     // over @state _duration   (read-only, like HTMLMediaElement)
// currentTime getter already exists (daw-editor.ts:2384)

timeFormat: TimeDisplayFormat   // @property({ reflect: true, attribute: 'time-format' })
                                // default 'hh:mm:ss.sss'
setTimeFormat(format: TimeDisplayFormat): void
// validates against the three formats (console.warn + ignore on bad input),
// sets the property, dispatches 'daw-time-format-change' (detail: { format })
```

Format state lives on the *target* (the editor), not on the format select —
mirrors native forms (`<label for>` points at state it doesn't own). Any number
of displays/inputs sync via the bubbled change event with no inter-element wiring.

New typed events in `DawEventMap`:

- `daw-timeupdate` — `{ time: number }`
- `daw-time-format-change` — `{ format: TimeDisplayFormat }`

## 3. Time format utility (dawcore-local)

`src/utils/time-display-format.ts`:

```ts
export type TimeDisplayFormat = 'hh:mm:ss.sss' | 'hh:mm:ss' | 'seconds';
export const TIME_DISPLAY_FORMATS: readonly TimeDisplayFormat[];
export function formatDisplayTime(seconds: number, format: TimeDisplayFormat): string;
export function parseDisplayTime(value: string, format: TimeDisplayFormat): number; // for #463
```

ui-components has an equivalent (`utils/timeFormat.ts`) but dawcore can't depend
on a React package, the WC spec's format names differ (`.sss` vs `.uuu`), and
hoisting into `@waveform-playlist/core` would churn ui-components/browser import
sites for no immediate gain. ~50 lines of accepted duplication. Negative/NaN
input clamps to 0.

## 4. `<daw-time-display>`

- Shadow DOM. `role="status"`, `aria-label="Playback time"`, `aria-live="off"`
  (spec accessibility section: not announced every frame; queried on demand).
- Target resolution: `closest('daw-transport')?.target` (existing pattern).
- Subscribes on `document` for bubbled `daw-timeupdate` and
  `daw-time-format-change`, filtering `event.target === this.target` — works
  with late-upgrading editors, no polling; listeners added in
  `connectedCallback`, removed in `disconnectedCallback`.
- Initial render reads `target.currentTime` / `target.timeFormat` directly
  (deferred via rAF — Lit controller/attribute timing).
- Renders `formatDisplayTime(time, format)` in a tabular-numerals span. Themed
  via existing `--daw-controls-*` custom properties.
- Outside a `<daw-transport>` or with a missing target: renders `--:--`-style
  placeholder and warns once (matches existing button behavior).

## 5. `<daw-time-format>`

- Shadow DOM native `<select>`, `aria-label="Time format"`, three options.
- On change → `target.setTimeFormat(value)`. The editor's
  `daw-time-format-change` round-trips back to set the select's value (and
  syncs any sibling selects), so programmatic `setTimeFormat` calls stay in sync.
- Initial value read from `target.timeFormat`.
- Capability detection (below): requires `setTimeFormat` on the target.

## 6. Capability detection (foundation for #474)

Shared pure helpers in `src/utils/transport-capability.ts` so button AND
non-button transport elements (selects, inputs) use one implementation:

```ts
export function targetSupports(target: unknown, methods: readonly string[]): boolean;
// true when target exists and every name is a function on it (duck typing —
// no instanceof, works for <daw-editor>, future <daw-player>, or any conforming element)
export function warnUnsupportedOnce(element: HTMLElement, target: unknown, methods: readonly string[]): void;

// DawTransportButton base class wires them up for buttons:
protected static requiredTargetMethods: string[] = [];   // subclasses declare
protected get targetSupported(): boolean;
```

- Unsupported target → inner control renders `disabled`.
- One-time `console.warn` on first pointer interaction with a disabled-by-
  capability control (listener on the host element, since disabled buttons
  swallow clicks). Warn names the element and the missing method.
- Re-evaluated on a deferred `requestUpdate()` in `connectedCallback` to catch
  targets that upgrade after the button connects.
- Retrofit: `<daw-record-button>` declares `['startRecording', 'stopRecording']`.
  Play/pause/stop declare nothing (work with any target). `<daw-time-format>`
  uses the same mechanism for `setTimeFormat`.

## 7. Testing (TDD, vitest + happy-dom)

- `time-display-format.test.ts` — all three formats, parse round-trip, clamping
- `daw-time-display.test.ts` — aria/role attributes, initial render from target,
  updates on `daw-timeupdate`, format switch on `daw-time-format-change`,
  ignores events from non-target editors, placeholder + warn without transport
- `daw-time-format.test.ts` — renders options, change calls `setTimeFormat`,
  syncs from `daw-time-format-change`, disabled against target lacking the method
- `daw-editor` additions — `isPlaying`/`duration` getters, `setTimeFormat`
  validation + event, `daw-timeupdate` dispatched per frame while playing
  (mocked RAF) and once on seek/stop
- Playhead — `setPosition(px)` sets transform; editor positions playhead via
  the controller (regression for the refactor)

## 8. Demo, docs, exports

- Register both elements; export from `src/index.ts`
- Add `<daw-time-display>` + `<daw-time-format>` to the `examples/dawcore-native`
  transport demo page
- Tick the spec checklist line for #459 in `docs/specs/web-components-migration.md`
  and note the playhead API change in the element registry section if listed
- `pnpm --filter @dawcore/components typecheck` + dawcore vitest + `pnpm lint`
