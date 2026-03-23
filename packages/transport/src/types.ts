// packages/transport/src/types.ts

export interface SchedulerEvent {
  /** Audio time when this event should be realized */
  audioTime: number;
}

export interface SchedulerListener<T extends SchedulerEvent> {
  /** Generate events in the time window [fromTime, toTime) */
  generate(fromTime: number, toTime: number): T[];
  /** Realize an event (create audio nodes, start sources) */
  consume(event: T): void;
  /** Position jumped (loop/seek) — stop active sources, re-schedule */
  onPositionJump(newTime: number): void;
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
  /** Beats per bar. Default: 4 */
  beatsPerBar?: number;
  /** How far ahead to schedule audio, in seconds. Default: 0.2 */
  schedulerLookahead?: number;
}

export interface TempoEntry {
  /** Tick position where this tempo starts */
  tick: number;
  /** Beats per minute */
  bpm: number;
  /** Cached cumulative seconds up to this tick (for O(log n) lookup) */
  secondsAtTick: number;
}

export interface TransportPosition {
  bar: number;
  beat: number;
  tick: number;
}
