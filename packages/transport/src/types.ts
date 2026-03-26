/** Branded type for tick positions — prevents accidentally passing seconds where ticks are expected. */
declare const __tick: unique symbol;
export type Tick = number & { readonly [__tick]: never };

/** Branded type for sample counts — prevents accidentally passing seconds where samples are expected. */
declare const __sample: unique symbol;
export type Sample = number & { readonly [__sample]: never };

export interface SchedulerEvent {
  /** Tick position (integer) on the timeline */
  tick: Tick;
}

export interface SchedulerListener<T extends SchedulerEvent> {
  /** Generate events in the tick window [fromTick, toTick) */
  generate(fromTick: Tick, toTick: Tick): T[];
  /** Realize an event (create audio nodes, start sources) */
  consume(event: T): void;
  /** Position jumped (loop/seek) — listeners may stop and re-schedule as appropriate
   *  (ClipPlayer stops sources and creates mid-clip restarts; MetronomePlayer is a no-op
   *  since clicks are short one-shots that finish naturally) */
  onPositionJump(newTick: Tick): void;
  /** Stop all active audio immediately */
  silence(): void;
}

export interface TransportOptions {
  /** Sample rate for SampleTimeline. Default: audioContext.sampleRate */
  sampleRate?: number;
  /** Ticks per quarter note. Default: 960 */
  ppqn?: number;
  /** Initial tempo in BPM. Default: 120 */
  tempo?: number;
  /** Time signature numerator. Default: 4 */
  numerator?: number;
  /** Time signature denominator. Default: 4 */
  denominator?: number;
  /** How far ahead to schedule audio, in seconds. Default: 0.2 */
  schedulerLookahead?: number;
  /** Accent click frequency in Hz. Default: 1000 */
  accentFrequency?: number;
  /** Normal click frequency in Hz. Default: 800 */
  normalFrequency?: number;
}

/** Public return type for getMeter() */
export interface MeterSignature {
  numerator: number;
  denominator: number;
}

/** Storage entry for MeterMap */
export interface MeterEntry {
  /** Tick position where this meter starts */
  tick: Tick;
  /** Time signature numerator (e.g., 6 in 6/8) */
  numerator: number;
  /** Time signature denominator (e.g., 8 in 6/8) */
  denominator: number;
  /** Cached cumulative bar count from tick 0 to this entry. Derived — do not set manually. */
  readonly barAtTick: number;
}

/** How to interpolate tempo from the previous entry to this one.
 *  'step' = instant jump (default). 'linear' = linear ramp.
 *  { type: 'curve', slope } = Möbius-Ease curve (slope 0-1 exclusive). */
export type TempoInterpolation = 'step' | 'linear' | { type: 'curve'; slope: number };

export interface TempoEntry {
  /** Tick position where this tempo starts */
  tick: Tick;
  /** Beats per minute */
  bpm: number;
  /** How to arrive at this BPM from the previous entry */
  readonly interpolation: TempoInterpolation;
  /** Cached cumulative seconds up to this tick (for O(log n) lookup). Derived — do not set manually. */
  readonly secondsAtTick: number;
}

export interface TransportPosition {
  /** 1-indexed bar number */
  bar: number;
  /** 1-indexed beat within bar */
  beat: number;
  /** Sub-beat tick remainder (0 to ppqn-1). Named subTick to avoid
   *  collision with SchedulerEvent.tick (absolute timeline position).
   *  Not branded Tick — a remainder within a beat, not an absolute position. */
  subTick: number;
}

/** Count-in mode: 'always' plays count-in on every play(), 'recording-only' only when recording. */
export type CountInMode = 'always' | 'recording-only';

/** Payload emitted with the 'countIn' transport event.
 *  Example: beat=1, totalBeats=4 means "first of four beats". */
export interface CountInEventData {
  /** Current beat number (1-indexed) */
  beat: number;
  /** Total number of beats in the count-in */
  totalBeats: number;
}

/** Payload emitted with the 'tempochange' transport event. */
export interface TempoChangeEventData {
  /** The new BPM value */
  bpm: number;
  /** Tick position where the tempo was set */
  atTick: Tick;
}

/** Payload emitted with the 'meterchange' transport event.
 *  After removeMeter/clearMeters, reflects the resulting meter at that position. */
export interface MeterChangeEventData {
  /** Time signature numerator */
  numerator: number;
  /** Time signature denominator */
  denominator: number;
  /** Tick position where the meter was set or removed */
  atTick: Tick;
}
