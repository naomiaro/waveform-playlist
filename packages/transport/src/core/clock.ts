import type { ContextFrame } from '../types';

/** Web Audio renders in blocks of 128 frames; `AudioContext.currentTime`
 *  advances by exactly this many frames per render, so a context reading is
 *  always on this lattice (up to float noise). */
export const RENDER_QUANTUM_FRAMES = 128;

/** How far (in frames) a context reading may sit off the quantum lattice and
 *  still be snapped onto it — covers float noise in currentTime × sampleRate,
 *  nothing more. A reading further off (a non-conforming or mocked context)
 *  is kept at its own integer frame rather than moved up to 64 frames. */
const LATTICE_SNAP_FRAMES = 1e-3;

/**
 * Transport position, kept in integer context frames (#636).
 *
 * The position is `positionAtAnchor + (contextFrame − contextFrameAtAnchor)`,
 * where contextFrame is `currentTime × sampleRate` snapped to the render
 * quantum lattice, so elapsed time is counted in whole frames. A seconds seek
 * remembers its exact seconds (`secondsAtAnchor`) so `getTime()` returns the
 * seek target bit-exactly instead of `(t × rate) / rate`; `getFrame()` rounds
 * once at the ContextFrame boundary and `getFrameExact()` keeps the fraction
 * — the same round-once rule as the tick conversions.
 *
 * Anchoring events (what re-reads the context and re-bases the position):
 * - `start()` anchors the current position to the current context frame.
 * - `seekTo()`/`seekToFrame()` while running re-anchor to the current frame.
 * - `stop()` folds elapsed frames into the position and detaches.
 * - A context reading that goes BACKWARDS moves the anchor with it so the
 *   position holds instead of jumping back. The spec makes currentTime
 *   monotonic and #636 describes Chromium STALLING it on device changes, so
 *   this is a defensive path — but whoever reads first absorbs it (reads are
 *   idempotent: the outcome does not depend on which reader saw it), and
 *   `takeDiscontinuity()` tells the Transport to re-create sources that were
 *   armed in the old time base. `rebaseCount` counts those.
 * - A STALLED reading (suspend, device change) simply freezes the position:
 *   no audio is rendering, so no transport time elapses. Nothing to re-anchor.
 * Forward jumps are taken at face value — the context rendered that audio.
 *
 * Frames are CONTEXT-rate frames (`audioContext.sampleRate`, the
 * `ContextFrame` brand); a Transport built with a different `sampleRate`
 * option converts via its SampleTimeline (`Sample` brand).
 */
export class Clock {
  private readonly _audioContext: AudioContext;
  private readonly _sampleRate: number;
  private _running = false;
  /** Snapped context frame when the position was last anchored. */
  private _contextFrameAtAnchor = 0;
  /** Transport position (frames, may be fractional after a seconds seek) at the anchor. */
  private _positionAtAnchor = 0;
  /** The same position in seconds — the exact seek target after seekTo(seconds). */
  private _secondsAtAnchor = 0;
  /** The PREVIOUS snapped context reading (not a high-water mark): a lower
   *  reading than this one is a re-base. */
  private _lastContextFrame = -Infinity;
  private _rebaseCount = 0;
  /** Set by a re-base while running; consumed by `takeDiscontinuity()`. */
  private _discontinuityPending = false;

  constructor(audioContext: AudioContext) {
    const rate = audioContext.sampleRate;
    if (!(Number.isFinite(rate) && rate > 0)) {
      throw new Error(
        '[waveform-playlist] Clock: audioContext.sampleRate must be a positive finite number, got ' +
          rate
      );
    }
    this._audioContext = audioContext;
    this._sampleRate = rate;
  }

  /** The rate frames are counted in: the AudioContext's. */
  get sampleRate(): number {
    return this._sampleRate;
  }

  /** How many times a backward context reading was absorbed (diagnostics). */
  get rebaseCount(): number {
    return this._rebaseCount;
  }

  /** True once after a backward reading was absorbed while running: audio
   *  already scheduled through `toAudioTime()` is in the old time base and
   *  must be re-created from the (held) position. Consuming it clears it. */
  takeDiscontinuity(): boolean {
    const pending = this._discontinuityPending;
    this._discontinuityPending = false;
    return pending;
  }

  /** Seconds → whole context frames, rounded once here. */
  secondsToFrame(seconds: number): ContextFrame {
    return Math.round(seconds * this._sampleRate) as ContextFrame;
  }

  start(): void {
    if (this._running) return;
    this._contextFrameAtAnchor = this._readContextFrame();
    this._running = true;
  }

  stop(): void {
    if (!this._running) return;
    const elapsed = this._elapsedFrames();
    this._positionAtAnchor += elapsed;
    this._secondsAtAnchor += elapsed / this._sampleRate;
    this._running = false;
  }

  reset(): void {
    this._running = false;
    this._positionAtAnchor = 0;
    this._secondsAtAnchor = 0;
    this._contextFrameAtAnchor = 0;
  }

  /** Position in seconds: the exact seek target plus whole elapsed frames. */
  getTime(): number {
    if (this._running) {
      return this._secondsAtAnchor + this._elapsedFrames() / this._sampleRate;
    }
    return this._secondsAtAnchor;
  }

  /** Position in whole context frames (rounded once, here). */
  getFrame(): ContextFrame {
    return Math.round(this.getFrameExact()) as ContextFrame;
  }

  /** Position in frames, keeping any sub-frame part a seconds seek introduced. */
  getFrameExact(): number {
    if (this._running) {
      return this._positionAtAnchor + this._elapsedFrames();
    }
    return this._positionAtAnchor;
  }

  seekTo(time: number): void {
    assertFinite('seekTo', time);
    this._seekToAnchor(time * this._sampleRate, time);
  }

  seekToFrame(frame: ContextFrame): void {
    assertFinite('seekToFrame', frame);
    this._seekToAnchor(frame, frame / this._sampleRate);
  }

  /**
   * Convert transport time to AudioContext.currentTime space, for
   * AudioBufferSourceNode.start(when). While running this is anchor-based —
   * it never re-reads currentTime, so sub-quantum noise in a reading cannot
   * shift scheduled events; stopped, it maps relative to the same SNAPPED
   * "now" the running branch will anchor to, so a `when` computed just before
   * `start()` and one computed just after agree.
   */
  toAudioTime(transportTime: number): number {
    const positionFrames = transportTime * this._sampleRate;
    if (this._running) {
      return (
        (this._contextFrameAtAnchor + (positionFrames - this._positionAtAnchor)) / this._sampleRate
      );
    }
    return this._snappedContextFrame() / this._sampleRate + (transportTime - this.getTime());
  }

  isRunning(): boolean {
    return this._running;
  }

  private _seekToAnchor(frames: number, seconds: number): void {
    this._positionAtAnchor = frames;
    this._secondsAtAnchor = seconds;
    if (this._running) {
      this._contextFrameAtAnchor = this._readContextFrame();
    }
  }

  /** Whole frames elapsed since the anchor (running only). */
  private _elapsedFrames(): number {
    return this._readContextFrame() - this._contextFrameAtAnchor;
  }

  /** currentTime as an integer frame on the render-quantum lattice. Pure. */
  private _snappedContextFrame(): number {
    const raw = this._audioContext.currentTime * this._sampleRate;
    const onLattice = Math.round(raw / RENDER_QUANTUM_FRAMES) * RENDER_QUANTUM_FRAMES;
    return Math.abs(raw - onLattice) < LATTICE_SNAP_FRAMES ? onLattice : Math.round(raw);
  }

  /** The snapped reading, with backward re-bases absorbed. Not pure: the
   *  first reader to see a backward reading shifts the anchor (idempotent —
   *  every later reader sees the already-held position). */
  private _readContextFrame(): number {
    const frame = this._snappedContextFrame();
    if (frame < this._lastContextFrame && this._running) {
      // Re-based backwards: carry the anchor along so the position holds.
      this._contextFrameAtAnchor -= this._lastContextFrame - frame;
      this._rebaseCount++;
      this._discontinuityPending = true;
    }
    this._lastContextFrame = frame;
    return frame;
  }
}

function assertFinite(method: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(
      '[waveform-playlist] Clock.' + method + ': position must be finite, got ' + value
    );
  }
}
