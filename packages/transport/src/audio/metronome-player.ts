import type { SchedulerEvent, SchedulerListener } from '../types';
import type { TempoMap } from '../timeline/tempo-map';
import type { TickTimeline } from '../timeline/tick-timeline';

export interface MetronomeEvent extends SchedulerEvent {
  isAccent: boolean;
  buffer: AudioBuffer;
}

export class MetronomePlayer implements SchedulerListener<MetronomeEvent> {
  private _audioContext: AudioContext;
  private _tempoMap: TempoMap;
  private _tickTimeline: TickTimeline;
  private _destination: AudioNode;
  private _toAudioTime: (transportTime: number) => number;
  private _enabled = false;
  private _beatsPerBar = 4;
  private _accentBuffer: AudioBuffer | null = null;
  private _normalBuffer: AudioBuffer | null = null;
  private _activeSources: Set<AudioBufferSourceNode> = new Set();

  constructor(
    audioContext: AudioContext,
    tempoMap: TempoMap,
    tickTimeline: TickTimeline,
    destination: AudioNode,
    toAudioTime: (transportTime: number) => number
  ) {
    this._audioContext = audioContext;
    this._tempoMap = tempoMap;
    this._tickTimeline = tickTimeline;
    this._destination = destination;
    this._toAudioTime = toAudioTime;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      this.silence();
    }
  }

  setBeatsPerBar(beats: number): void {
    this._beatsPerBar = beats;
  }

  setClickSounds(accent: AudioBuffer, normal: AudioBuffer): void {
    this._accentBuffer = accent;
    this._normalBuffer = normal;
  }

  generate(fromTime: number, toTime: number): MetronomeEvent[] {
    if (!this._enabled || !this._accentBuffer || !this._normalBuffer) {
      return [];
    }

    const events: MetronomeEvent[] = [];
    const ppqn = this._tickTimeline.ppqn;

    // Convert time window to ticks
    const fromTicks = this._tempoMap.secondsToTicks(fromTime);
    const toTicks = this._tempoMap.secondsToTicks(toTime);

    // Find first beat at or after fromTicks
    const firstBeatTick = Math.ceil(fromTicks / ppqn) * ppqn;

    for (let tick = firstBeatTick; tick < toTicks; tick += ppqn) {
      const transportTime = this._tempoMap.ticksToSeconds(tick);
      const ticksPerBar = this._tickTimeline.ticksPerBar(this._beatsPerBar);
      const isAccent = tick % ticksPerBar === 0;

      events.push({
        transportTime,
        isAccent,
        buffer: isAccent ? this._accentBuffer : this._normalBuffer,
      });
    }

    return events;
  }

  consume(event: MetronomeEvent): void {
    const source = this._audioContext.createBufferSource();
    source.buffer = event.buffer;
    source.connect(this._destination);

    this._activeSources.add(source);
    source.addEventListener('ended', () => {
      this._activeSources.delete(source);
      try {
        source.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MetronomePlayer: error disconnecting source:',
          String(err)
        );
      }
    });

    source.start(this._toAudioTime(event.transportTime));
  }

  onPositionJump(_newTime: number): void {
    this.silence();
  }

  silence(): void {
    for (const source of this._activeSources) {
      try {
        source.stop();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MetronomePlayer.silence: error stopping source:',
          String(err)
        );
      }
      try {
        source.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MetronomePlayer.silence: error disconnecting:',
          String(err)
        );
      }
    }
    this._activeSources.clear();
  }
}
