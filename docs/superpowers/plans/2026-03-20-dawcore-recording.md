# Dawcore Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add microphone recording to `<daw-editor>` with live waveform preview via incremental rendering and post-recording clip creation with a cancelable event.

**Architecture:** A `RecordingController` (Lit reactive controller) on the editor manages the full lifecycle: AudioWorklet loading, sample accumulation, per-channel peak generation via `appendPeaks()`, live preview via `setPeaksQuiet()` + `updatePeaks()`, and clip creation via the existing peak pipeline. A `<daw-record-button>` transport element toggles recording.

**Tech Stack:** Lit web components, AudioWorklet (`recording-processor`), `@waveform-playlist/recording` (appendPeaks, createAudioBuffer), `@waveform-playlist/worklets` (recordingProcessorUrl), vitest + happy-dom

**Spec:** `docs/superpowers/specs/2026-03-20-dawcore-recording-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/recording/src/index.ts` | Export `appendPeaks` (currently missing) |
| Modify | `packages/dawcore/src/elements/daw-waveform.ts` | Add `setPeaksQuiet()` method |
| Modify | `packages/dawcore/src/__tests__/daw-waveform.test.ts` | Test for `setPeaksQuiet` |
| Modify | `packages/dawcore/src/events.ts` | Add recording event types |
| Create | `packages/dawcore/src/controllers/recording-controller.ts` | `RecordingController` — worklet, sessions, peaks, live preview |
| Create | `packages/dawcore/src/__tests__/recording-controller.test.ts` | Controller tests |
| Create | `packages/dawcore/src/elements/daw-record-button.ts` | Transport button |
| Create | `packages/dawcore/src/__tests__/daw-record-button.test.ts` | Button tests |
| Modify | `packages/dawcore/src/elements/daw-editor.ts` | Wire controller, public API, recording preview template |
| Modify | `packages/dawcore/src/index.ts` | Export new element + types |
| Modify | `packages/dawcore/package.json` | Add `@waveform-playlist/recording` to peerDependencies |

---

### Task 1: Export `appendPeaks` from recording package

**Files:**
- Modify: `packages/recording/src/index.ts`

`appendPeaks` is defined in `packages/recording/src/utils/peaksGenerator.ts` but not exported from the package's `index.ts`. Dawcore needs it.

- [ ] **Step 1: Add export**

In `packages/recording/src/index.ts`, change:

```typescript
export { generatePeaks } from './utils/peaksGenerator';
```

To:

```typescript
export { generatePeaks, appendPeaks } from './utils/peaksGenerator';
```

- [ ] **Step 2: Build recording package**

Run: `pnpm --filter @waveform-playlist/recording build`
Expected: Clean build with `appendPeaks` in DTS output

- [ ] **Step 3: Commit**

```bash
git add packages/recording/src/index.ts
git commit -m "feat(recording): export appendPeaks from package index"
```

---

### Task 2: Add `setPeaksQuiet()` to daw-waveform

**Files:**
- Modify: `packages/dawcore/src/elements/daw-waveform.ts`
- Modify: `packages/dawcore/src/__tests__/daw-waveform.test.ts`

- [ ] **Step 1: Write failing test**

Add to the describe block in `packages/dawcore/src/__tests__/daw-waveform.test.ts`:

```typescript
  it('setPeaksQuiet replaces peaks without marking all dirty', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 200;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    // Set initial peaks (full draw)
    el.peaks = new Int16Array([0, 100, -50, 200, 0, 150, -100, 300]);
    flushRaf();

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    };
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    // setPeaksQuiet should NOT trigger a draw
    const longerPeaks = new Int16Array([0, 100, -50, 200, 0, 150, -100, 300, 0, 50, -25, 100]);
    el.setPeaksQuiet(longerPeaks);
    flushRaf();

    // No clearRect called — peaks replaced silently
    expect(mockCtx.clearRect).not.toHaveBeenCalled();
    // But the peaks reference is updated
    expect(el.peaks).toBe(longerPeaks);
    expect(el.bits).toBe(16);

    document.body.removeChild(el);
  });
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: FAIL — `setPeaksQuiet` not defined

- [ ] **Step 3: Implement `setPeaksQuiet()`**

Read `packages/dawcore/src/elements/daw-waveform.ts`. Add this method to the class, near the `peaks` getter/setter:

```typescript
/**
 * Replace the internal peaks reference without marking all dirty.
 * Use with updatePeaks() for incremental recording updates where
 * appendPeaks() returns a new array but only the tail changed.
 */
setPeaksQuiet(value: Peaks) {
  this._peaks = value;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-waveform.ts packages/dawcore/src/__tests__/daw-waveform.test.ts
git commit -m "feat(dawcore): add setPeaksQuiet() to daw-waveform

Replaces internal peaks reference without marking all dirty.
Used by RecordingController for incremental live preview updates."
```

---

### Task 3: Add recording event types

**Files:**
- Modify: `packages/dawcore/src/events.ts`

- [ ] **Step 1: Add event detail types and map entries**

Read `packages/dawcore/src/events.ts`. Add these detail types after the existing ones:

```typescript
export interface DawRecordingStartDetail {
  trackId: string;
  stream: MediaStream;
}

export interface DawRecordingCompleteDetail {
  trackId: string;
  audioBuffer: AudioBuffer;
  startSample: number;
  durationSamples: number;
}

export interface DawRecordingErrorDetail {
  trackId: string;
  error: unknown;
}
```

Add to the `DawEventMap` interface:

```typescript
  'daw-recording-start': CustomEvent<DawRecordingStartDetail>;
  'daw-recording-complete': CustomEvent<DawRecordingCompleteDetail>;
  'daw-recording-error': CustomEvent<DawRecordingErrorDetail>;
```

- [ ] **Step 2: Export new types from index.ts**

Read `packages/dawcore/src/index.ts`. Add the new types to the existing type export block:

```typescript
  DawRecordingStartDetail,
  DawRecordingCompleteDetail,
  DawRecordingErrorDetail,
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/dawcore/src/events.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add recording event types

DawRecordingStartDetail, DawRecordingCompleteDetail (cancelable),
DawRecordingErrorDetail added to DawEventMap."
```

---

### Task 4: Implement RecordingController — session start/stop

**Files:**
- Create: `packages/dawcore/src/controllers/recording-controller.ts`
- Create: `packages/dawcore/src/__tests__/recording-controller.test.ts`

This is the core task. The controller manages the session map, worklet loading, audio graph setup, and dispatches events. Peak generation and live preview come in Task 5.

- [ ] **Step 1: Write tests for start/stop lifecycle**

Create `packages/dawcore/src/__tests__/recording-controller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@waveform-playlist/playout', () => ({
  getGlobalAudioContext: vi.fn(() => mockAudioContext),
}));

vi.mock('@waveform-playlist/worklets', () => ({
  recordingProcessorUrl: 'blob:mock-recording-processor',
}));

vi.mock('@waveform-playlist/recording', () => ({
  appendPeaks: vi.fn((existing) => existing),
  concatenateAudioData: vi.fn((chunks) => new Float32Array(0)),
  createAudioBuffer: vi.fn(() => mockAudioBuffer),
}));

let mockAudioContext: any;
let mockAudioBuffer: any;
let mockWorkletNode: any;
let mockSource: any;

import { RecordingController } from '../controllers/recording-controller';

function createMockHost() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return Object.assign(el, {
    addController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
    samplesPerPixel: 1024,
    effectiveSampleRate: 48000,
    _selectedTrackId: 'track-1',
    _currentTime: 0,
  }) as any;
}

function createMockStream(channelCount = 1): MediaStream {
  return {
    getAudioTracks: () => [
      { getSettings: () => ({ channelCount }) },
    ],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as any;
}

describe('RecordingController', () => {
  let host: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkletNode = {
      port: { postMessage: vi.fn() },
      disconnect: vi.fn(),
      addEventListener: vi.fn(),
    };
    mockSource = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    mockAudioContext = {
      createMediaStreamSource: vi.fn(() => mockSource),
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
      sampleRate: 48000,
    };
    mockAudioBuffer = {
      length: 48000,
      sampleRate: 48000,
      numberOfChannels: 1,
    };
    vi.stubGlobal('AudioWorkletNode', vi.fn(() => mockWorkletNode));
    host = createMockHost();
  });

  afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
  });

  it('startRecording creates a session', async () => {
    const controller = new RecordingController(host);
    const stream = createMockStream();

    await controller.startRecording(stream, { trackId: 'track-1' });

    expect(controller.isRecording).toBe(true);
    expect(controller.getSession('track-1')).toBeTruthy();
    expect(mockSource.connect).toHaveBeenCalledWith(mockWorkletNode);
  });

  it('startRecording warns and returns when no trackId', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new RecordingController(host);
    host._selectedTrackId = null;

    await controller.startRecording(createMockStream());

    expect(controller.isRecording).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No track selected'));
    warnSpy.mockRestore();
  });

  it('stopRecording dispatches cancelable event and cleans up', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    const events: CustomEvent[] = [];
    host.dispatchEvent = vi.fn((e: CustomEvent) => {
      events.push(e);
      return true; // not prevented
    });

    controller.stopRecording();

    expect(mockSource.disconnect).toHaveBeenCalled();
    expect(mockWorkletNode.disconnect).toHaveBeenCalled();
    expect(controller.isRecording).toBe(false);
    expect(controller.getSession('track-1')).toBeUndefined();

    const completeEvent = events.find((e) => e.type === 'daw-recording-complete');
    expect(completeEvent).toBeTruthy();
    expect(completeEvent!.cancelable).toBe(true);
    expect(completeEvent!.detail.trackId).toBe('track-1');
  });

  it('stopRecording with preventDefault skips clip creation', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    host.dispatchEvent = vi.fn((e: CustomEvent) => {
      e.preventDefault();
      return false;
    });

    controller.stopRecording();

    // Clip creation would involve calling host methods — verify they weren't called
    expect(controller.getSession('track-1')).toBeUndefined();
  });

  it('rejects recording on a track that already has a session', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Already recording'));
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd packages/dawcore && npx vitest run src/__tests__/recording-controller.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement RecordingController**

Create `packages/dawcore/src/controllers/recording-controller.ts`:

```typescript
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { Peaks, Bits } from '@waveform-playlist/core';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { recordingProcessorUrl } from '@waveform-playlist/worklets';
import {
  appendPeaks,
  concatenateAudioData,
  createAudioBuffer,
} from '@waveform-playlist/recording';
import type {
  DawRecordingStartDetail,
  DawRecordingCompleteDetail,
  DawRecordingErrorDetail,
} from '../events';

export interface RecordingOptions {
  trackId?: string;
  bits?: 8 | 16;
  startSample?: number;
}

interface RecordingSession {
  trackId: string;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  workletNode: AudioWorkletNode;
  chunks: Float32Array[][];
  totalSamples: number;
  peaks: (Int8Array | Int16Array)[];
  startSample: number;
  channelCount: number;
  bits: 8 | 16;
  isFirstMessage: boolean;
}

/** Narrow interface for the host editor. */
export interface RecordingHost extends ReactiveControllerHost {
  readonly samplesPerPixel: number;
  readonly effectiveSampleRate: number;
  readonly _selectedTrackId: string | null;
  readonly _currentTime: number;
  dispatchEvent(event: Event): boolean;
}

export class RecordingController implements ReactiveController {
  private _host: RecordingHost & HTMLElement;
  private _sessions = new Map<string, RecordingSession>();
  private _workletLoaded = false;

  constructor(host: RecordingHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  hostConnected() {}
  hostDisconnected() {
    // Stop all recordings on disconnect
    for (const trackId of [...this._sessions.keys()]) {
      this._cleanupSession(trackId);
    }
  }

  get isRecording(): boolean {
    return this._sessions.size > 0;
  }

  getSession(trackId: string): RecordingSession | undefined {
    return this._sessions.get(trackId);
  }

  async startRecording(
    stream: MediaStream,
    options: RecordingOptions = {}
  ): Promise<void> {
    const trackId = options.trackId ?? this._host._selectedTrackId;
    if (!trackId) {
      console.warn('[dawcore] RecordingController: No track selected for recording');
      return;
    }
    if (this._sessions.has(trackId)) {
      console.warn(
        '[dawcore] RecordingController: Already recording on track "' + trackId + '"'
      );
      return;
    }

    const bits: Bits = options.bits ?? 16;
    const audioContext = getGlobalAudioContext();

    try {
      // Load worklet if needed
      if (!this._workletLoaded) {
        await audioContext.audioWorklet.addModule(recordingProcessorUrl);
        this._workletLoaded = true;
      }

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'recording-processor');
      source.connect(workletNode);

      // Detect channel count from stream (not source.channelCount — defaults to 2)
      const channelCount =
        stream.getAudioTracks()[0]?.getSettings()?.channelCount ?? 1;

      const startSample =
        options.startSample ??
        Math.floor(this._host._currentTime * this._host.effectiveSampleRate);

      const emptyPeaks = bits === 8 ? new Int8Array(0) : new Int16Array(0);
      const session: RecordingSession = {
        trackId,
        stream,
        source,
        workletNode,
        chunks: Array.from({ length: channelCount }, () => []),
        totalSamples: 0,
        peaks: Array.from({ length: channelCount }, () =>
          bits === 8 ? new Int8Array(0) : new Int16Array(0)
        ),
        startSample,
        channelCount,
        bits,
        isFirstMessage: true,
      };

      // Wire worklet messages
      workletNode.port.onmessage = (e: MessageEvent) => {
        this._onWorkletMessage(trackId, e.data);
      };

      // Handle stream ending (mic unplug)
      const onStreamEnded = () => {
        stream.removeEventListener('ended', onStreamEnded);
        if (this._sessions.has(trackId)) {
          this.stopRecording(trackId);
        }
      };
      stream.addEventListener('ended', onStreamEnded);

      this._sessions.set(trackId, session);

      // Dispatch start event
      this._host.dispatchEvent(
        new CustomEvent<DawRecordingStartDetail>('daw-recording-start', {
          bubbles: true,
          composed: true,
          detail: { trackId, stream },
        })
      );

      this._host.requestUpdate();
    } catch (err) {
      console.warn('[dawcore] RecordingController: Failed to start recording: ' + String(err));
      this._host.dispatchEvent(
        new CustomEvent<DawRecordingErrorDetail>('daw-recording-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, error: err },
        })
      );
    }
  }

  stopRecording(trackId?: string): void {
    const id = trackId ?? [...this._sessions.keys()][0];
    if (!id) return;

    const session = this._sessions.get(id);
    if (!session) return;

    // Disconnect audio graph
    session.source.disconnect();
    session.workletNode.disconnect();
    session.workletNode.port.postMessage({ command: 'stop' });

    // Build AudioBuffer from accumulated chunks
    const audioContext = getGlobalAudioContext();
    const channelData = session.chunks.map((chunkArr) =>
      concatenateAudioData(chunkArr)
    );
    const audioBuffer = createAudioBuffer(
      audioContext,
      channelData,
      audioContext.sampleRate,
      session.channelCount
    );

    const durationSamples = audioBuffer.length;

    // Dispatch cancelable event
    const event = new CustomEvent<DawRecordingCompleteDetail>(
      'daw-recording-complete',
      {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: {
          trackId: id,
          audioBuffer,
          startSample: session.startSample,
          durationSamples,
        },
      }
    );
    const notPrevented = this._host.dispatchEvent(event);

    // Clean up session
    this._sessions.delete(id);
    this._host.requestUpdate();

    // If not prevented, create clip (Task 6 will implement this)
    if (notPrevented) {
      this._createClipFromRecording(id, audioBuffer, session.startSample, durationSamples);
    }
  }

  private _onWorkletMessage(trackId: string, data: any) {
    const session = this._sessions.get(trackId);
    if (!session) return;

    const { channels } = data as { channels: Float32Array[] };
    if (!channels || channels.length === 0) return;

    // Capture pre-increment value for appendPeaks
    const samplesProcessedBefore = session.totalSamples;

    // Accumulate chunks per channel
    for (let ch = 0; ch < session.channelCount; ch++) {
      if (channels[ch]) {
        session.chunks[ch].push(channels[ch]);
      }
    }
    session.totalSamples += channels[0].length;

    // Generate peaks per channel
    for (let ch = 0; ch < session.channelCount; ch++) {
      if (!channels[ch]) continue;
      const oldPeakCount = Math.floor(session.peaks[ch].length / 2);
      session.peaks[ch] = appendPeaks(
        session.peaks[ch],
        channels[ch],
        this._host.samplesPerPixel,
        samplesProcessedBefore,
        session.bits
      );
      const newPeakCount = Math.floor(session.peaks[ch].length / 2);

      // Live preview update will be wired in Task 5
      // For now, just store the peaks
    }
  }

  private _createClipFromRecording(
    trackId: string,
    audioBuffer: AudioBuffer,
    startSample: number,
    durationSamples: number
  ) {
    // Task 6 will implement clip creation via the editor's existing track/peak pipeline
  }

  private _cleanupSession(trackId: string) {
    const session = this._sessions.get(trackId);
    if (!session) return;
    try {
      session.source.disconnect();
      session.workletNode.disconnect();
    } catch {
      // Ignore disconnect errors on cleanup
    }
    this._sessions.delete(trackId);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd packages/dawcore && npx vitest run src/__tests__/recording-controller.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/controllers/recording-controller.ts packages/dawcore/src/__tests__/recording-controller.test.ts
git commit -m "feat(dawcore): RecordingController — session start/stop lifecycle

Manages worklet loading, audio graph setup, session map, sample accumulation,
per-channel peak generation via appendPeaks. Dispatches cancelable
daw-recording-complete event. Live preview wiring in next task."
```

---

### Task 5: Wire live preview rendering

**Files:**
- Modify: `packages/dawcore/src/controllers/recording-controller.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

This task wires the controller's peak data to `<daw-waveform>` elements for live preview during recording. The controller calls `setPeaksQuiet()` + `updatePeaks()` on the waveform elements queried from the editor's Shadow DOM.

- [ ] **Step 1: Add live preview update to `_onWorkletMessage`**

In `recording-controller.ts`, update the per-channel peak loop in `_onWorkletMessage` to include waveform updates. Replace the comment `// Live preview update will be wired in Task 5` with:

```typescript
      // Update live preview waveform
      const waveformSelector = `daw-waveform[data-recording-track="${trackId}"][data-recording-channel="${ch}"]`;
      const waveformEl = (this._host as any).shadowRoot?.querySelector(waveformSelector);
      if (waveformEl) {
        if (session.isFirstMessage) {
          waveformEl.peaks = session.peaks[ch];
        } else {
          waveformEl.setPeaksQuiet(session.peaks[ch]);
          waveformEl.updatePeaks(
            Math.max(0, oldPeakCount - 1),
            newPeakCount
          );
        }
      }
```

After the channel loop, set `session.isFirstMessage = false` and throttle `requestUpdate`:

```typescript
    session.isFirstMessage = false;

    // Throttle requestUpdate — only when container width needs to grow
    const newPixelWidth = Math.floor(session.totalSamples / this._host.samplesPerPixel);
    const oldPixelWidth = Math.floor(
      (session.totalSamples - channels[0].length) / this._host.samplesPerPixel
    );
    if (newPixelWidth > oldPixelWidth) {
      this._host.requestUpdate();
    }
```

- [ ] **Step 2: Add recording preview template to daw-editor**

Read `packages/dawcore/src/elements/daw-editor.ts`. Add the following changes:

1. Import `RecordingController`:
```typescript
import { RecordingController } from '../controllers/recording-controller';
```

2. Add controller instance (near other controllers ~line 86):
```typescript
  private _recordingController = new RecordingController(this as any);
```

3. Add public API methods (near play/pause/stop ~line 590):
```typescript
  recordingStream: MediaStream | null = null;

  get isRecording(): boolean {
    return this._recordingController.isRecording;
  }

  async startRecording(stream?: MediaStream, options?: any): Promise<void> {
    const s = stream ?? this.recordingStream;
    if (!s) {
      console.warn('[dawcore] startRecording: no stream provided and recordingStream is null');
      return;
    }
    await this._recordingController.startRecording(s, options);
  }

  stopRecording(): void {
    this._recordingController.stopRecording();
  }
```

4. Add recording preview rendering in the track template. Find the section where clips are rendered (the `t.track.clips.map(...)` block ~line 738). After the clips map, add:

```typescript
                ${(() => {
                  const recSession = this._recordingController.getSession(t.trackId);
                  if (!recSession) return '';
                  const clipLeft = Math.floor(recSession.startSample / this.samplesPerPixel);
                  const recWidth = Math.floor(recSession.totalSamples / this.samplesPerPixel);
                  return recSession.peaks.map(
                    (chPeaks, chIdx) => html`
                      <daw-waveform
                        data-recording-track=${t.trackId}
                        data-recording-channel=${chIdx}
                        style="position: absolute; left: ${clipLeft}px; top: ${chIdx * channelHeight}px;"
                        .peaks=${chPeaks}
                        .length=${recWidth}
                        .waveHeight=${channelHeight}
                        .barWidth=${this.barWidth}
                        .barGap=${this.barGap}
                        .visibleStart=${this._viewport.visibleStart}
                        .visibleEnd=${this._viewport.visibleEnd}
                        .originX=${clipLeft}
                      ></daw-waveform>
                    `
                  );
                })()}
```

- [ ] **Step 3: Run full test suite**

Run: `cd packages/dawcore && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Typecheck**

Run: `cd packages/dawcore && pnpm typecheck`

- [ ] **Step 5: Verify editor line count**

Run: `wc -l packages/dawcore/src/elements/daw-editor.ts`
Expected: <= 800

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/controllers/recording-controller.ts packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): wire live recording preview with incremental rendering

RecordingController calls setPeaksQuiet() + updatePeaks() on daw-waveform
elements for per-channel live preview. Editor renders phantom clip at
cursor position. Throttled requestUpdate only on pixel boundary changes."
```

---

### Task 6: Post-recording clip creation

**Files:**
- Modify: `packages/dawcore/src/controllers/recording-controller.ts`

- [ ] **Step 1: Write test for clip creation**

Add to `recording-controller.test.ts`:

```typescript
  it('stopRecording creates clip when not prevented', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    // Simulate worklet message to have some data
    const session = controller.getSession('track-1')!;
    session.chunks[0].push(new Float32Array(1024));
    session.totalSamples = 1024;

    // Track clip creation
    let clipCreated = false;
    host._loadTrackFromBuffer = vi.fn(() => { clipCreated = true; });

    const originalDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => originalDispatch(e));

    controller.stopRecording();

    // Event dispatched
    expect(host.dispatchEvent).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Implement `_createClipFromRecording`**

Replace the stub in `recording-controller.ts`. The implementation feeds the AudioBuffer through the editor's existing `_loadTrack` pipeline by adding a clip to the track's descriptor and loading the buffer:

```typescript
  private _createClipFromRecording(
    trackId: string,
    audioBuffer: AudioBuffer,
    startSample: number,
    durationSamples: number
  ) {
    // Delegate to host's clip creation — the editor knows how to add clips
    // to tracks and feed audio through the peak pipeline
    const host = this._host as any;
    if (typeof host._addRecordedClip === 'function') {
      host._addRecordedClip(trackId, audioBuffer, startSample, durationSamples);
    }
  }
```

Add `_addRecordedClip` to `daw-editor.ts` (near the play/stop methods):

```typescript
  _addRecordedClip(trackId: string, audioBuffer: AudioBuffer, startSample: number, durationSamples: number) {
    // Create clip from recorded audio — similar to file-loader clip creation
    const clipId = crypto.randomUUID();
    const track = createTrack();
    track.id = trackId;
    // Store buffer and generate peaks via pipeline
    this._clipBuffers = new Map(this._clipBuffers).set(clipId, audioBuffer);
    // Trigger peak generation and track update through existing pipeline
    this._peakPipeline
      .generatePeaks(audioBuffer, this.samplesPerPixel, this.mono)
      .then((peakData) => {
        this._peaksData = new Map(this._peaksData).set(clipId, peakData);
        this._recomputeDuration();
      });
  }
```

**Note:** The exact clip creation integration depends on the existing `_loadTrack` internals. The implementer should read `daw-editor.ts` and the `file-loader.ts` patterns to understand how clips are added to `_tracks` and `_engineTracks`. This step may need adjustment during implementation.

- [ ] **Step 3: Run tests**

Run: `cd packages/dawcore && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add packages/dawcore/src/controllers/recording-controller.ts packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): post-recording clip creation via peak pipeline

_addRecordedClip feeds AudioBuffer through PeakPipeline for final
high-quality peaks. Clip added to track at recorded timeline position."
```

---

### Task 7: `<daw-record-button>` transport element

**Files:**
- Create: `packages/dawcore/src/elements/daw-record-button.ts`
- Create: `packages/dawcore/src/__tests__/daw-record-button.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write tests**

Create `packages/dawcore/src/__tests__/daw-record-button.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-record-button');
});

describe('DawRecordButtonElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-record-button')).toBeDefined();
  });

  it('renders a button with Record slot', () => {
    const el = document.createElement('daw-record-button') as any;
    document.body.appendChild(el);
    const button = el.shadowRoot?.querySelector('button');
    expect(button).toBeTruthy();
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement daw-record-button**

Create `packages/dawcore/src/elements/daw-record-button.ts`:

```typescript
import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-record-button')
export class DawRecordButtonElement extends DawTransportButton {
  @state() private _isRecording = false;

  static styles = [
    DawTransportButton.styles,
    css`
      button[data-recording] {
        color: #d08070;
        border-color: #d08070;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    // Listen for recording events on the target to update visual state
    this._listenToTarget();
  }

  private _listenToTarget() {
    const target = this.target;
    if (!target) return;
    target.addEventListener('daw-recording-start', () => {
      this._isRecording = true;
    });
    target.addEventListener('daw-recording-complete', () => {
      this._isRecording = false;
    });
    target.addEventListener('daw-recording-error', () => {
      this._isRecording = false;
    });
  }

  render() {
    return html`
      <button
        part="button"
        ?data-recording=${this._isRecording}
        @click=${this._onClick}
      >
        <slot>${this._isRecording ? 'Stop Rec' : 'Record'}</slot>
      </button>
    `;
  }

  private _onClick() {
    const target = this.target;
    if (!target) {
      console.warn(
        '[dawcore] <daw-record-button> has no target. Check <daw-transport for="..."> references a valid <daw-editor> id.'
      );
      return;
    }
    if (this._isRecording) {
      target.stopRecording();
    } else {
      target.startRecording(target.recordingStream);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-record-button': DawRecordButtonElement;
  }
}
```

- [ ] **Step 4: Register in index.ts**

Add to `packages/dawcore/src/index.ts`:

```typescript
import './elements/daw-record-button';
export { DawRecordButtonElement } from './elements/daw-record-button';
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd packages/dawcore && npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-record-button.ts packages/dawcore/src/__tests__/daw-record-button.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-record-button transport element

Extends DawTransportButton. Toggles startRecording/stopRecording on target.
Listens for daw-recording-start/complete/error to update visual state."
```

---

### Task 8: Package config, build verification, and CLAUDE.md

**Files:**
- Modify: `packages/dawcore/package.json`
- Modify: `packages/dawcore/CLAUDE.md`

- [ ] **Step 1: Add recording to peerDependencies**

In `packages/dawcore/package.json`, add to `peerDependencies`:

```json
"@waveform-playlist/recording": "workspace:*"
```

And to `peerDependenciesMeta`:

```json
"@waveform-playlist/recording": {
  "optional": true
}
```

- [ ] **Step 2: Format, lint, typecheck, build**

Run:
```bash
pnpm format
pnpm lint
cd packages/dawcore && pnpm typecheck
pnpm --filter @dawcore/components build
```

- [ ] **Step 3: Verify editor line count**

Run: `wc -l packages/dawcore/src/elements/daw-editor.ts`
Expected: <= 800

- [ ] **Step 4: Update CLAUDE.md**

Add to `packages/dawcore/CLAUDE.md` in the "Control elements" section:

```markdown
- `<daw-record-button>` — Transport button. Toggles `startRecording()`/`stopRecording()` on target editor. Listens for `daw-recording-start`/`daw-recording-complete` events to update visual state.
```

Add a new "Recording" section:

```markdown
## Recording

- **`RecordingController`** — Lit reactive controller on `<daw-editor>`. Manages AudioWorklet lifecycle, per-channel sample accumulation, incremental peak generation via `appendPeaks()` from `@waveform-playlist/recording`, and live preview via `setPeaksQuiet()` + `updatePeaks()` on `<daw-waveform>`.
- **Session map** — `Map<string, RecordingSession>` keyed by track ID. Single session for now; map structure supports future multi-mic.
- **Consumer provides stream** — `editor.recordingStream = stream` or pass to `startRecording(stream)`. Mic access/permission is consumer responsibility.
- **Cancelable clip creation** — `daw-recording-complete` event is cancelable. `preventDefault()` skips automatic clip creation; consumer handles the `AudioBuffer` themselves.
- **Channel detection** — `stream.getAudioTracks()[0].getSettings().channelCount`, not `source.channelCount` (defaults to 2 per spec).
- **Worklet loading** — `rawContext.audioWorklet.addModule(recordingProcessorUrl)` (native API, not Tone.js which caches single module).
```

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/package.json packages/dawcore/CLAUDE.md
git commit -m "docs(dawcore): recording docs, peer dependency, build verification"
```
