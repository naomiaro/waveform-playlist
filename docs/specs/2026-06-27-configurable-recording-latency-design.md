# Configurable Recording Latency Offset — Design

**Issue:** [#502](https://github.com/naomiaro/waveform-playlist/issues/502)
**Branch:** `feat/recording-offset-override`
**Date:** 2026-06-27

## Problem

Recording latency compensation is computed internally from the browser's
self-reported `AudioContext.outputLatency`, with no public, documented way for a
host app to substitute a better, externally-measured round-trip latency.

- **dawcore** (`@dawcore/components`): `RecordingController` captures
  `outputLatency` at `startRecording()` and stores it as `session.latencySamples`
  (`recording-controller.ts:183-185`). That value drives both the live preview
  (`daw-editor.ts:2586`, `:2589`) and the finalized clip
  (`recording-controller.ts:402-431`). `RecordingOptions` has no field to override
  it (`recording-controller.ts:13-21`).
- **React** (`@waveform-playlist/recording` + `@waveform-playlist/browser`):
  `useIntegratedRecording.stopRecording()` computes the finalized clip offset via
  `audibleLatencySamples(outputLatency, lookAhead, sampleRate)`
  (`useIntegratedRecording.ts:199-215`); the live preview recomputes the same value
  independently in `PlaylistVisualization` (`PlaylistVisualization.tsx:742-754`).
  Neither is configurable.

Today the only escape hatch (dawcore) is `event.preventDefault()` on
`daw-recording-complete` plus the internal, undocumented `editor._addRecordedClip`.
This makes external latency measurement a private workaround instead of a
first-class API.

### Why it matters

`outputLatency` is a one-sided browser estimate of *output* latency, not the
hardware round-trip (output → acoustic/electrical path → input). On the reporter's
hardware, `outputLatency`-based compensation (~7.3 ms) left a ~41 ms residual
misalignment; substituting an externally-measured value (~42.8 ms) brought the
residual to within run-to-run measurement noise. The undercompensation was roughly
5–6×, not marginal.

## Goals

1. Add a **public, documented** way to override the auto-computed recording offset
   on **both** API surfaces (React and dawcore).
2. The override is an **absolute replacement** for the auto-computed value.
3. **Maximize shared code** between React and dawcore.
4. When the override is **unset, behavior is unchanged** (no regression).
5. In React, the override applies to **both** the live preview and the finalized
   clip, so they stay visually consistent (matching dawcore's single-field
   behavior).

## Non-goals

- Measuring latency. The library accepts a value; it does not measure round-trip
  latency itself. (Consumers use a tool such as `@adasp/latency-test`.)
- The adjacent `editor.tracks` / `TrackDescriptor.trackId` friction noted in #502
  ("not asking for a fix here"). Left untouched.
- Changing the `daw-recording-complete` event shape — its `offsetSamples` already
  reports the *applied* offset; it will simply carry the override-derived value
  when an override is set.

## Public API

A single new option, named identically on both surfaces, expressed in **seconds**:

```ts
latencyOffset?: number;
```

- **Unit:** seconds. Portable (matches how latency tools report values) and frees
  the consumer from needing the AudioContext sample rate at config time.
- **Semantics (absolute replacement):**
  - `undefined` → current auto-compute behavior, unchanged.
  - a finite value `> 0` → used as the offset, replacing the auto-computed value.
  - `0` → explicitly disables compensation (offset of 0 samples).
  - negative / non-finite → resolves to `0` (via existing guards in
    `audibleLatencySamples`).

## Architecture: shared core primitive

New pure function in `packages/core/src/utils/latency.ts`, exported from the core
barrel alongside the existing `audibleLatencySamples`:

```ts
/**
 * Resolve the recording latency offset (in samples). When `overrideSeconds` is
 * provided it is an absolute replacement for the auto-computed value (treated as
 * a latency in seconds, converted at `sampleRate`). Otherwise the offset is the
 * auto-computed audible-latency window (`outputLatency + lookAhead`).
 *
 * Single source of truth for the override-vs-auto decision across dawcore
 * (`RecordingController`) and React (`useIntegratedRecording` finalization +
 * `PlaylistVisualization` live preview).
 */
export function resolveRecordingOffsetSamples(params: {
  overrideSeconds?: number; // public knob; absolute replacement when defined
  outputLatency: number;
  lookAhead: number; // 0 for dawcore's native transport
  sampleRate: number;
}): number {
  const { overrideSeconds, outputLatency, lookAhead, sampleRate } = params;
  return overrideSeconds !== undefined
    ? audibleLatencySamples(overrideSeconds, 0, sampleRate)
    : audibleLatencySamples(outputLatency, lookAhead, sampleRate);
}
```

Reuse note: the override branch is the same math as the auto branch with
`lookAhead = 0`, so it routes through `audibleLatencySamples` and inherits its
finite/positive guards — no duplicated validation.

## Per-package changes

### 1. `@waveform-playlist/core`

- Add `resolveRecordingOffsetSamples` to `src/utils/latency.ts`.
- Export it from the core barrel (`src/index.ts`) next to `audibleLatencySamples`.

### 2. `@dawcore/components` (dawcore)

- `RecordingOptions` (`recording-controller.ts:13-21`): add
  `latencyOffset?: number;` (seconds) with a doc comment.
- `startRecording()` (`recording-controller.ts:183-185`): replace the inline
  ```ts
  const outputLatency = rawCtx.outputLatency ?? 0;
  const latencySamples = Math.floor(outputLatency * rawCtx.sampleRate);
  ```
  with
  ```ts
  const latencySamples = resolveRecordingOffsetSamples({
    overrideSeconds: options.latencyOffset,
    outputLatency: rawCtx.outputLatency ?? 0,
    lookAhead: 0, // native transport — no scheduler lookahead
    sampleRate: rawCtx.sampleRate,
  });
  ```
- No other dawcore changes needed: `session.latencySamples` already drives both
  the live preview (`daw-editor.ts:2586`, `:2589`) and the finalized clip / event
  (`recording-controller.ts:402-431`).

### 3. `@waveform-playlist/recording` (React finalization)

- `IntegratedRecordingOptions` (`useIntegratedRecording.ts:18-42`): add
  `latencyOffset?: number;` (seconds) with a doc comment.
- `stopRecording()` (`useIntegratedRecording.ts:199-215`): replace the inline
  `audibleLatencySamples(...)` call with
  ```ts
  const latencyOffsetSamples = resolveRecordingOffsetSamples({
    overrideSeconds: latencyOffset,
    outputLatency,
    lookAhead,
    sampleRate: buffer.sampleRate,
  });
  ```
  (`outputLatency` / `lookAhead` are still read from
  `getGlobalAudioContext()` / `getGlobalContext()` as today).

### 4. `@waveform-playlist/browser` (React live preview)

- `recordingState` prop type — add `latencyOffset?: number;` (seconds) in both
  declaration sites:
  - `PlaylistVisualization.tsx:92-99`
  - `Waveform.tsx:54` (mirror)
- Live-preview block (`PlaylistVisualization.tsx:742-754`): replace the raw
  `audibleLatencySamples(getOutputLatency(), getLookAhead(), sampleRate)` with
  ```ts
  const latencyOffsetSamples = resolveRecordingOffsetSamples({
    overrideSeconds: recordingState.latencyOffset,
    outputLatency: getOutputLatency(),
    lookAhead: getLookAhead(),
    sampleRate,
  });
  ```

## Data flow / consumer wiring (React)

The `recordingState` object is assembled by the consumer (it already carries
`startSample`, `durationSamples`, `bits`, `trackId`, `peaks`). To keep the preview
and the finalized clip consistent, the consumer passes the **same** `latencyOffset`
to both `useIntegratedRecording` (finalization) and into `recordingState` (preview).
This matches the existing manual-assembly pattern; it will be documented in the
recording guide. (dawcore needs no equivalent wiring — its single session field
covers both paths.)

## Edge cases

| Case | Behavior |
|---|---|
| `latencyOffset` unset | Auto-compute, unchanged (no regression). |
| `latencyOffset = 0` | Offset 0 samples — compensation explicitly disabled. |
| `latencyOffset` negative / `NaN` / `Infinity` | Resolves to `0` (guarded). |
| Override ≥ buffer length | Existing "recording too short" discard guard fires (`recording-controller.ts:406`, `useIntegratedRecording.ts:218`). |
| dawcore preview vs final | Both read `session.latencySamples`; always consistent. |
| React preview vs final | Both call the resolver with the consumer-supplied `latencyOffset`; consistent when wired per "Data flow" above. |

## Testing

- **core** — new tests for `resolveRecordingOffsetSamples`: override wins over
  auto; `0` disables; `undefined` falls back to auto; negative/non-finite → `0`;
  seconds→samples conversion at 44.1 k and 48 k.
- **recording** — extend `latencyCompensation.test.ts` to cover the override
  branch (override replaces `outputLatency + lookAhead`).
- **dawcore** — extend the recording-controller tests so an override on
  `RecordingOptions` produces the matching `session.latencySamples` and the
  matching `offsetSamples` / `durationSamples` on `daw-recording-complete`.

## Documentation

- Recording guide: document `latencyOffset` (seconds, absolute replacement, `0`
  disables) on both surfaces, including the React "thread the same value into the
  hook and `recordingState`" note.
- LLM doc surfaces: `website/docs/api/llm-reference.md` (option interfaces),
  `website/static/llms.txt` (description) per the keep-in-sync rule.

## Files touched (summary)

- `packages/core/src/utils/latency.ts` — add `resolveRecordingOffsetSamples`
- `packages/core/src/index.ts` — export it
- `packages/core/src/__tests__/latency.test.ts` — resolver tests
- `packages/dawcore/src/controllers/recording-controller.ts` — option + resolver call
- `packages/dawcore/src/__tests__/recording-controller.test.ts` — override test
- `packages/recording/src/hooks/useIntegratedRecording.ts` — option + resolver call
- `packages/recording/src/__tests__/latencyCompensation.test.ts` — override test
- `packages/browser/src/components/PlaylistVisualization.tsx` — prop field + resolver call
- `packages/browser/src/components/Waveform.tsx` — prop field mirror
- docs: recording guide, `llm-reference.md`, `llms.txt`
