import type { Sample } from '../types';

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
 * quantum lattice, so elapsed time is counted in whole frames and seconds are
 * a derived view (`getTime() = getFrameExact() / sampleRate`). A seek may land
 * between frames (`seekTo(seconds)`); `getFrame()` rounds once at the Sample
 * boundary and `getFrameExact()` keeps the fraction — the same round-once
 * rule as the tick conversions.
 *
 * Anchoring events (what re-reads the context and re-bases the position):
 * - `start()` anchors the current position to the current context frame.
 * - `seekTo()`/`seekToFrame()` while running re-anchor to the current frame.
 * - `stop()` folds elapsed frames into the position and detaches.
 * - A context reading that goes BACKWARDS (Chromium re-bases currentTime on
 *   some device changes) moves the anchor with it so the position holds
 *   instead of jumping back; `rebaseCount` counts those.
 * - A STALLED reading (suspend, device change) simply freezes the position:
 *   no audio is rendering, so no transport time elapses. Nothing to re-anchor.
 * Forward jumps are taken at face value — the context rendered that audio.
 *
 * Frames are CONTEXT-rate frames (`audioContext.sampleRate`); a Transport
 * built with a different `sampleRate` option converts via its SampleTimeline.
 */
export class Clock {
  private readonly _audioContext: AudioContext;
  private readonly _sampleRate: number;
  private _running = false;
  /** Snapped context frame when the position was last anchored. */
  private _contextFrameAtAnchor = 0;
  /** Transport position (frames, may be fractional after a seconds seek) at the anchor. */
  private _positionAtAnchor = 0;
  /** Highest snapped context frame seen; a lower reading is a re-base. */
  private _lastContextFrame = -Infinity;
  private _rebaseCount = 0;

  constructor(audioContext: AudioContext) {
    this._audioContext = audioContext;
    this._sampleRate = audioContext.sampleRate;
  }

  /** The rate frames are counted in: the AudioContext's. */
  get sampleRate(): number {
    return this._sampleRate;
  }

  /** How many times a backward context reading was absorbed (diagnostics). */
  get rebaseCount(): number {
    return this._rebaseCount;
  }

  start(): void {
    if (this._running) return;
    this._contextFrameAtAnchor = this._readContextFrame();
    this._running = true;
  }

  stop(): void {
    if (!this._running) return;
    this._positionAtAnchor = this.getFrameExact();
    this._running = false;
  }

  reset(): void {
    this._running = false;
    this._positionAtAnchor = 0;
    this._contextFrameAtAnchor = 0;
  }

  /** Position in seconds — a view of the frame position. */
  getTime(): number {
    return this.getFrameExact() / this._sampleRate;
  }

  /** Position in whole context frames (rounded once, here). */
  getFrame(): Sample {
    return Math.round(this.getFrameExact()) as Sample;
  }

  /** Position in frames, keeping any sub-frame part a seconds seek introduced. */
  getFrameExact(): number {
    if (this._running) {
      return this._positionAtAnchor + (this._readContextFrame() - this._contextFrameAtAnchor);
    }
    return this._positionAtAnchor;
  }

  seekTo(time: number): void {
    this._seekToFrameExact(time * this._sampleRate);
  }

  seekToFrame(frame: Sample): void {
    this._seekToFrameExact(frame);
  }

  /**
   * Convert transport time to AudioContext.currentTime space, for
   * AudioBufferSourceNode.start(when). While running this is anchor-based —
   * it never re-reads currentTime, so sub-quantum noise in a reading cannot
   * shift scheduled events; stopped, it maps relative to "now".
   */
  toAudioTime(transportTime: number): number {
    const positionFrames = transportTime * this._sampleRate;
    if (this._running) {
      return (
        (this._contextFrameAtAnchor + (positionFrames - this._positionAtAnchor)) / this._sampleRate
      );
    }
    return this._audioContext.currentTime + (transportTime - this.getTime());
  }

  isRunning(): boolean {
    return this._running;
  }

  private _seekToFrameExact(frames: number): void {
    this._positionAtAnchor = frames;
    if (this._running) {
      this._contextFrameAtAnchor = this._readContextFrame();
    }
  }

  /** currentTime as an integer frame on the render-quantum lattice, monotonic. */
  private _readContextFrame(): number {
    const raw = this._audioContext.currentTime * this._sampleRate;
    const onLattice = Math.round(raw / RENDER_QUANTUM_FRAMES) * RENDER_QUANTUM_FRAMES;
    const frame = Math.abs(raw - onLattice) < LATTICE_SNAP_FRAMES ? onLattice : Math.round(raw);
    if (frame < this._lastContextFrame) {
      // Re-based backwards: carry the anchor along so the position holds.
      this._contextFrameAtAnchor -= this._lastContextFrame - frame;
      this._rebaseCount++;
    }
    this._lastContextFrame = frame;
    return frame;
  }
}
