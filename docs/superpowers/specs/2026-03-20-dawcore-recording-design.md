# Dawcore Recording — Design Spec

**Date:** 2026-03-20
**Scope:** `@dawcore/components` — recording controller, record button, live preview, clip creation
**Branch:** `feat/dawcore-recording`

## Problem

Dawcore has no recording support. Users cannot capture microphone input, see a live waveform preview, or create clips from recorded audio. The React browser package has full recording via hooks (`useRecording`, `useIntegratedRecording`), but dawcore's web component layer has no equivalent.

## Solution

Add a `RecordingController` (Lit reactive controller) to `<daw-editor>` that manages the full recording lifecycle: worklet loading, sample accumulation, incremental peak generation via `appendPeaks()` from `@waveform-playlist/recording`, live waveform preview via `updatePeaks()` on `<daw-waveform>`, and post-recording clip creation with a cancelable event.

## Dependencies

- **`@waveform-playlist/recording`** — peer dependency. Provides `appendPeaks()`, `createAudioBuffer()`, `concatenateAudioData()`.
- **`@waveform-playlist/worklets`** — already a peer dependency. Provides `recordingProcessorUrl`.
- **`@waveform-playlist/playout`** — already a peer dependency. Provides `getGlobalAudioContext()`.

## daw-waveform API Addition: `setPeaksQuiet()`

`appendPeaks()` returns a **new** typed array (immutable). Setting `waveformEl.peaks = newArray` triggers a full redraw (the setter marks all dirty). For incremental recording updates, we need to swap the peaks reference without a full redraw.

**New method on `<daw-waveform>`:**

```typescript
/**
 * Replace the internal peaks reference without marking all dirty.
 * Use with updatePeaks() for incremental recording updates where
 * appendPeaks() returns a new array but only the tail changed.
 */
setPeaksQuiet(value: Peaks): void {
  this._peaks = value;
}
```

**Recording update sequence:**
1. `const newPeaks = appendPeaks(session.peaks, samples, ...)`
2. `waveformEl.setPeaksQuiet(newPeaks)` — swaps reference, no dirty marking
3. `waveformEl.updatePeaks(oldPeakCount - 1, newPeakCount)` — marks only the changed range dirty

The `-1` on `oldPeakCount` redraws the last bar in case it was a partial peak that got updated by `appendPeaks`.

**Files changed:** `daw-waveform.ts` (add method), `daw-waveform.test.ts` (add test).

## API

### Consumer setup

```javascript
// 1. Consumer manages mic access
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Set stream on editor (or per-track in future)
document.getElementById('editor').recordingStream = stream;

// 3. Record button toggles recording on/off
```

```html
<daw-editor id="editor">
  <daw-track name="Vocals"></daw-track>
</daw-editor>

<daw-transport for="editor">
  <daw-record-button></daw-record-button>
  <daw-play-button></daw-play-button>
  <daw-stop-button></daw-stop-button>
</daw-transport>
```

### Editor methods

```typescript
// Start recording on the selected track at cursor position
editor.startRecording(stream: MediaStream, options?: RecordingOptions): void;

// Stop recording — dispatches cancelable daw-recording-complete
editor.stopRecording(): void;

// Readonly state
editor.isRecording: boolean;

// Stream property — set by consumer, used by record button
editor.recordingStream: MediaStream | null;
```

### RecordingOptions

```typescript
interface RecordingOptions {
  trackId?: string;    // defaults to selectedTrackId
  bits?: 8 | 16;       // peak bit depth, defaults to 16
  startSample?: number; // defaults to cursor position (currentTime * sampleRate)
}
```

### Future multi-mic

The controller uses `Map<string, RecordingSession>` keyed by track ID internally. For this PR, only one session at a time. Multi-mic future: per-track `recordingStream` property on `<daw-track>`, controller checks `track.recordingStream ?? editor.recordingStream`.

## Recording Session Model

```typescript
interface RecordingSession {
  trackId: string;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  workletNode: AudioWorkletNode;
  chunks: Float32Array[][];               // per-channel sample accumulation
  totalSamples: number;
  peaks: (Int8Array | Int16Array)[];      // per-channel interleaved min/max
  startSample: number;                     // timeline position
  channelCount: number;
  bits: 8 | 16;
}
```

**Multi-channel:** `peaks` is an array of per-channel typed arrays. `appendPeaks` is called once per channel on each worklet message. The editor renders one `<daw-waveform>` per channel for the recording preview (same pattern as regular clips).

**Channel count detection:** Read from `stream.getAudioTracks()[0].getSettings().channelCount` (not `source.channelCount` which defaults to 2 per Web Audio spec). See recording CLAUDE.md.

## Recording Lifecycle

### Start

1. Consumer calls `editor.startRecording(stream, options?)`
2. Controller loads recording worklet if not already loaded: `rawContext.audioWorklet.addModule(recordingProcessorUrl)` (native API, not Tone.js — see recording CLAUDE.md)
3. Creates `MediaStreamAudioSourceNode` from `getGlobalAudioContext()`
4. Creates `AudioWorkletNode`, connects `source → worklet`
5. Detects channel count from stream settings
6. Creates `RecordingSession` with `startSample` from cursor position, per-channel empty peaks
7. Dispatches `daw-recording-start` event
8. Editor renders live preview `<daw-waveform>` elements (one per channel) at the cursor position on the selected track

### During (worklet message loop)

1. Worklet sends `{ channels: Float32Array[] }` at ~60fps (~16ms buffers)
2. Capture `samplesProcessedBefore = session.totalSamples` (pre-increment value for `appendPeaks`)
3. Accumulate chunks in `session.chunks[ch][]`, then increment `session.totalSamples += channels[0].length`
4. Per channel: calls `appendPeaks(session.peaks[ch], channels[ch], samplesPerPixel, samplesProcessedBefore, bits)` — returns new typed array. The pre-increment value is critical: `appendPeaks` uses `totalSamplesProcessed % samplesPerPixel` to detect partial peaks from the previous update.
5. Computes `oldPeakCount` and `newPeakCount` from array lengths
6. First message: sets `waveformEl.peaks = newPeaks` per channel (full draw via setter)
7. Subsequent messages per channel: `waveformEl.setPeaksQuiet(newPeaks)` then `waveformEl.updatePeaks(oldPeakCount - 1, newPeakCount)` — incremental draw of only the new/updated bars
8. Updates `session.peaks[ch]` reference
9. Throttled `this._host.requestUpdate()` — only when peak count crosses a new pixel boundary (container width needs to grow), not on every worklet message

### Stop

1. Consumer calls `editor.stopRecording()`
2. Controller disconnects source and worklet, posts `stop` to worklet
3. Concatenates `session.chunks` per channel → creates `AudioBuffer` via `createAudioBuffer()`
4. Dispatches cancelable `daw-recording-complete` event with `{ trackId, audioBuffer, startSample, durationSamples }`
5. If not `preventDefault()`'d: creates a clip on the track, feeds AudioBuffer through `PeakPipeline` for final high-quality peaks (web worker), removes live preview waveform
6. Cleans up session from the map

## Live Preview Rendering

The editor's template renders a "phantom clip" for each active recording session, alongside regular clips. This uses Lit's reactive rendering — the controller updates a `@state()` property (recording session state) on the editor, and Lit's template conditionally renders the recording waveforms.

```typescript
// In editor render(), after regular clips for a track:
${this._recordingController.getSession(trackId)
  ? this._renderRecordingPreview(trackId)
  : ''}
```

**Per-channel rendering:** `_renderRecordingPreview` renders one `<daw-waveform>` per channel, same layout as regular multi-channel clips. Each waveform gets the session's per-channel peaks.

**Key optimization:** Lit re-renders only when the container width needs to grow (throttled `requestUpdate`). Canvas pixels are drawn incrementally via `setPeaksQuiet()` + `updatePeaks()` — only 1-2 new pixels per frame.

## Events

| Event | Detail | Cancelable | When |
|-------|--------|------------|------|
| `daw-recording-start` | `{ trackId, stream }` | No | Recording begins |
| `daw-recording-complete` | `{ trackId, audioBuffer, startSample, durationSamples }` | **Yes** | Recording stops — `preventDefault()` skips clip creation |
| `daw-recording-error` | `{ trackId, error }` | No | Worklet fails, stream ends unexpectedly |

### `daw-recording-complete` preventDefault pattern

```javascript
// Default: editor creates clip automatically
editor.addEventListener('daw-recording-complete', (e) => {
  console.log('Recording complete on track:', e.detail.trackId);
});

// Custom: prevent default, handle AudioBuffer yourself
editor.addEventListener('daw-recording-complete', (e) => {
  e.preventDefault();
  const { audioBuffer, trackId, startSample } = e.detail;
  // consumer does their own thing
});
```

## Error Handling

1. **No selected track** — `startRecording()` warns `[dawcore]` and returns early
2. **No stream** — `recordingStream` is null, warn and return early
3. **Worklet load fails** — CSP blocks blob URLs. Dispatch `daw-recording-error`, clean up
4. **Stream ends mid-recording** — mic unplugged. Treat as implicit stop, run normal stop flow with whatever was captured
5. **Already recording on this track** — warn and return early

## New Elements

### `<daw-record-button>`

Extends `DawTransportButton`. Toggles recording:
- When not recording: calls `target.startRecording(target.recordingStream)`
- When recording: calls `target.stopRecording()`
- Listens for `daw-recording-start` and `daw-recording-complete` events on the target to update visual state (e.g., red recording indicator via CSS `part` or attribute)

## Files Changed

- **Modified:** `packages/dawcore/src/elements/daw-waveform.ts` — add `setPeaksQuiet()` method
- **New:** `packages/dawcore/src/controllers/recording-controller.ts` — `RecordingController`
- **New:** `packages/dawcore/src/elements/daw-record-button.ts` — transport button
- **Modified:** `packages/dawcore/src/elements/daw-editor.ts` — `recordingStream` property, `startRecording()`/`stopRecording()` methods, controller creation, recording preview in template (~15 lines, within 800-line budget at 778 + 15 = 793)
- **Modified:** `packages/dawcore/src/events.ts` — new event types
- **Modified:** `packages/dawcore/src/index.ts` — export new element + types
- **Modified:** `packages/dawcore/package.json` — add `@waveform-playlist/recording` to peerDependencies
- **New:** `packages/dawcore/src/__tests__/recording-controller.test.ts`
- **New:** `packages/dawcore/src/__tests__/daw-record-button.test.ts`
- **Modified:** `packages/dawcore/src/__tests__/daw-waveform.test.ts` — test for `setPeaksQuiet()`

## Testing

### `setPeaksQuiet` test on daw-waveform:

1. `setPeaksQuiet` replaces peaks without marking all dirty

### RecordingController tests:

2. `startRecording` creates session with correct `startSample` from cursor
3. `startRecording` rejects when no `recordingStream` (warns, no-op)
4. `startRecording` rejects when no track selected (warns, no-op)
5. `stopRecording` dispatches cancelable `daw-recording-complete`
6. `stopRecording` with `preventDefault()` skips clip creation
7. `stopRecording` without prevent creates clip at correct timeline position
8. Worklet message triggers `appendPeaks` per channel and `updatePeaks` on waveform elements
9. Session cleanup on stop (source disconnected, worklet disconnected, map cleared)
10. Stream `ended` event triggers implicit stop

### `<daw-record-button>` tests:

11. Registered as custom element
12. Calls `startRecording()` on target when clicked (not recording)
13. Calls `stopRecording()` on target when clicked (already recording)
14. Warns when target is null

### Mocking approach:

- `vi.mock('@waveform-playlist/playout')` for `getGlobalAudioContext()`
- `vi.stubGlobal()` for `AudioWorkletNode` constructor
- `vi.mock('@waveform-playlist/recording')` for `appendPeaks`
- `vi.mock('@waveform-playlist/worklets')` for `recordingProcessorUrl`
- Same rAF/happy-dom patterns as existing dawcore tests

## Non-Goals

- Mic access / device enumeration — consumer responsibility
- Overdub (record while playing) — future, requires latency compensation
- Multi-mic simultaneous recording — future, internal map supports it
- VU meter element — future
- Pause/resume recording — future
- Audio constraints configuration — consumer passes configured stream
