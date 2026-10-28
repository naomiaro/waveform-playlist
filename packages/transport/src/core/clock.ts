import type { ContextFrame } from '../types';

/** Web Audio renders in blocks of 128 frames (the spec default; a context
 *  created with a non-default `renderSizeHint` renders in other block sizes),
 *  so `AudioContext.currentTime` normally advances by exactly this many frames
 *  per render and a reading sits on this lattice up to float noise. A context
 *  off the lattice simply keeps its raw integer frame (see LATTICE_SNAP_FRAMES). */
export const RENDER_QUANTUM_FRAMES = 128;

/** How far (in frames) a context reading may sit off the quantum lattice and
 *  still be snapped onto it — covers float noise in currentTime × sampleRate,
 *  nothing more. A reading further off (a non-conforming or mocked context)
 *  is kept at its own integer frame rather than moved up to 64 frames. */
const LATTICE_SNAP_FRAMES = 1e-3;

/**
 * Transport position, with elapsed time counted in integer context frames
 * (#636).
 *
 * The position is `seekPosition + elapsedFrames`, where `elapsedFrames` is
 * ONE integer accumulator: whole frames elapsed in earlier runs since the last
 * seek (`_elapsedBeforeAnchor`) plus, while running, the frames since the
 * current anchor (`contextFrame − contextFrameAtAnchor`). `contextFrame` is
 * `currentTime × sampleRate` snapped to the render-quantum lattice. The seek
 * position is kept in BOTH units — `_seekFrames` (fractional after a seconds
 * seek) and `_seekSeconds` (the exact seconds a caller passed) — so
 * `getTime()` returns a seek target bit-exactly (`(t × rate) / rate` differs
 * from `t` for roughly one millisecond position in seven at 44.1 kHz) and the
 * two views cannot drift apart across pause/resume cycles: both add the same
 * integer. `getFrame()` rounds once at the ContextFrame boundary;
 * `getFrameExact()` keeps the fraction — the round-once rule of the tick
 * conversions.
 *
 * Anchoring events (the full table, including `reset()`, is in
 * packages/transport/CLAUDE.md — keep the two in step):
 * - `start()` anchors the current position to the current context frame. It
 *   reads the context BEFORE setting `_running`, so a context that moved
 *   backwards while stopped re-anchors silently instead of counting a re-base.
 * - `seekTo()`/`seekToFrame()` while running re-anchor to the current frame.
 * - `stop()` folds the frames elapsed in this run into the accumulator.
 * - A context reading that goes BACKWARDS while running moves the anchor with
 *   it so the position holds instead of jumping back. The spec makes
 *   currentTime monotonic and #636 describes Chromium STALLING it on device
 *   changes, so this is a defensive path. Whoever reads first absorbs it —
 *   reads are idempotent (the outcome does not depend on which reader saw it)
 *   — and `rebaseCount` / `lastRebaseFrames` let the Transport notice on its
 *   next tick and re-create the sources it armed in the old time base.
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
  /** Snapped context frame when the current run was anchored. */
  private _contextFrameAtAnchor = 0;
  /** Position at the last seek, in frames (fractional after a seconds seek). */
  private _seekFrames = 0;
  /** The same position in seconds — bit-exactly what seekTo(seconds) got. */
  private _seekSeconds = 0;
  /** Whole frames elapsed in earlier runs since the last seek. */
  private _elapsedBeforeAnchor = 0;
  /** The PREVIOUS snapped context reading (not a high-water mark): a lower
   *  reading than this one, while running, is a re-base. */
  private _lastContextFrame = -Infinity;
  private _rebaseCount = 0;
  private _lastRebaseFrames = 0;

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

  /** How many backward context readings were absorbed while running. The
   *  Transport diffs this against its own cursor each tick to re-create
   *  sources armed in the old time base; observers may read it freely. */
  get rebaseCount(): number {
    return this._rebaseCount;
  }

  /** Size (frames) of the most recently absorbed backward reading. */
  get lastRebaseFrames(): number {
    return this._lastRebaseFrames;
  }

  /** Seconds → whole context frames, rounded once here. */
  secondsToFrame(seconds: number): ContextFrame {
    return Math.round(seconds * this._sampleRate) as ContextFrame;
  }

  /** Whole context frames → seconds (the inverse view). */
  frameToSeconds(frame: ContextFrame): number {
    return frame / this._sampleRate;
  }

  start(): void {
    if (this._running) return;
    // Read before `_running` is set: a backward reading while stopped is a
    // fresh anchor, not a re-base (nothing was scheduled against the old one).
    this._contextFrameAtAnchor = this._readContextFrame();
    this._running = true;
  }

  stop(): void {
    if (!this._running) return;
    this._elapsedBeforeAnchor += this._elapsedFrames();
    this._running = false;
  }

  reset(): void {
    this._running = false;
    this._seekFrames = 0;
    this._seekSeconds = 0;
    this._elapsedBeforeAnchor = 0;
    this._contextFrameAtAnchor = 0;
  }

  /** Position in seconds: the exact seek target plus whole elapsed frames. */
  getTime(): number {
    return this._seekSeconds + this._totalElapsedFrames() / this._sampleRate;
  }

  /** Position in whole context frames (rounded once, here). */
  getFrame(): ContextFrame {
    return Math.round(this.getFrameExact()) as ContextFrame;
  }

  /** Position in frames, keeping any sub-frame part a seconds seek introduced. */
  getFrameExact(): number {
    return this._seekFrames + this._totalElapsedFrames();
  }

  seekTo(time: number): void {
    assertFinite('seekTo', time);
    this._seekToPosition(time * this._sampleRate, time);
  }

  /** A fractional frame is rounded here, at the API boundary. */
  seekToFrame(frame: ContextFrame): void {
    assertFinite('seekToFrame', frame);
    const whole = Math.round(frame);
    this._seekToPosition(whole, whole / this._sampleRate);
  }

  /**
   * Convert transport time to AudioContext.currentTime space, for
   * AudioBufferSourceNode.start(when). Anchor-based in both states: while
   * running it never re-reads currentTime, so sub-quantum noise in a reading
   * cannot shift scheduled events; stopped, the anchor is the same snapped
   * "now" that start() is about to capture, so a `when` computed just before
   * start() and one computed just after are identical.
   */
  toAudioTime(transportTime: number): number {
    const positionFrames = transportTime * this._sampleRate;
    const anchorFrame = this._running ? this._contextFrameAtAnchor : this._snappedContextFrame();
    return (anchorFrame + (positionFrames - this._positionAtAnchorFrames())) / this._sampleRate;
  }

  isRunning(): boolean {
    return this._running;
  }

  private _seekToPosition(frames: number, seconds: number): void {
    this._seekFrames = frames;
    this._seekSeconds = seconds;
    this._elapsedBeforeAnchor = 0;
    if (this._running) {
      this._contextFrameAtAnchor = this._readContextFrame();
    }
  }

  /** Position (frames) at the start of the current run. */
  private _positionAtAnchorFrames(): number {
    return this._seekFrames + this._elapsedBeforeAnchor;
  }

  /** Whole frames elapsed since the last seek, across runs. */
  private _totalElapsedFrames(): number {
    return this._elapsedBeforeAnchor + (this._running ? this._elapsedFrames() : 0);
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
      const shift = this._lastContextFrame - frame;
      this._contextFrameAtAnchor -= shift;
      this._lastRebaseFrames = shift;
      this._rebaseCount++;
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
