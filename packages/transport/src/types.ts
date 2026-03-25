export interface SchedulerEvent {
  /** Tick position (integer) on the timeline */
  tick: number;
}

export interface SchedulerListener<T extends SchedulerEvent> {
  /** Generate events in the tick window [fromTick, toTick) */
  generate(fromTick: number, toTick: number): T[];
  /** Realize an event (create audio nodes, start sources) */
  consume(event: T): void;
  /** Position jumped (loop/seek) — listeners may stop and re-schedule as appropriate
   *  (ClipPlayer stops sources and creates mid-clip restarts; MetronomePlayer is a no-op
   *  since clicks are short one-shots that finish naturally) */
  onPositionJump(newTick: number): void;
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
}

/** Public return type for getMeter() */
export interface MeterSignature {
  numerator: number;
  denominator: number;
}

/** Storage entry for MeterMap */
export interface MeterEntry {
  /** Tick position where this meter starts */
  tick: number;
  /** Time signature numerator (e.g., 6 in 6/8) */
  numerator: number;
  /** Time signature denominator (e.g., 8 in 6/8) */
  denominator: number;
  /** Cached cumulative bar count from tick 0 to this entry. Derived — do not set manually. */
  readonly barAtTick: number;
}

export interface TempoEntry {
  /** Tick position where this tempo starts */
  tick: number;
  /** Beats per minute */
  bpm: number;
  /** Cached cumulative seconds up to this tick (for O(log n) lookup). Derived — do not set manually. */
  readonly secondsAtTick: number;
}

export interface TransportPosition {
  /** 1-indexed bar number */
  bar: number;
  /** 1-indexed beat within bar */
  beat: number;
  /** Sub-beat tick remainder (0 to ppqn-1). Named subTick to avoid
   *  collision with SchedulerEvent.tick (absolute timeline position). */
  subTick: number;
}
