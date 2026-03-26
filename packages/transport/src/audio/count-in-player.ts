import type { Tick, SchedulerEvent, SchedulerListener } from '../types';
import type { TempoMap } from '../timeline/tempo-map';
import type { MeterMap } from '../timeline/meter-map';

export interface CountInEvent extends SchedulerEvent {
  isAccent: boolean;
  buffer: AudioBuffer;
  beat: number;
  totalBeats: number;
}

interface CountInConfig {
  totalBeats: number;
  accentBuffer: AudioBuffer;
  normalBuffer: AudioBuffer;
  meterMap: MeterMap;
  /** TempoMap for tick→seconds conversion in consume(). Must match the
   *  count-in scheduler's TempoMap (locked to BPM at the play position). */
  tempoMap: TempoMap;
  onBeat: (beat: number, totalBeats: number) => void;
}

export class CountInPlayer implements SchedulerListener<CountInEvent> {
  private _audioContext: AudioContext;
  private _tempoMap: TempoMap;
  private _destination: AudioNode;
  private _toAudioTime: (transportTime: number) => number;
  private _activeSources: Set<AudioBufferSourceNode> = new Set();

  private _totalBeats = 0;
  private _beatsGenerated = 0;
  private _accentBuffer: AudioBuffer | null = null;
  private _normalBuffer: AudioBuffer | null = null;
  private _meterMap: MeterMap | null = null;
  private _onBeat: ((beat: number, totalBeats: number) => void) | null = null;

  constructor(
    audioContext: AudioContext,
    tempoMap: TempoMap,
    destination: AudioNode,
    toAudioTime: (transportTime: number) => number
  ) {
    this._audioContext = audioContext;
    this._tempoMap = tempoMap;
    this._destination = destination;
    this._toAudioTime = toAudioTime;
  }

  configure(config: CountInConfig): void {
    this._totalBeats = config.totalBeats;
    this._beatsGenerated = 0;
    this._accentBuffer = config.accentBuffer;
    this._normalBuffer = config.normalBuffer;
    this._meterMap = config.meterMap;
    this._tempoMap = config.tempoMap;
    this._onBeat = config.onBeat;
  }

  generate(fromTick: Tick, toTick: Tick): CountInEvent[] {
    if (!this._accentBuffer || !this._normalBuffer || !this._meterMap) {
      return [];
    }

    const events: CountInEvent[] = [];
    const meterMap = this._meterMap;

    // Walk the beat grid anchored at the active meter entry (same algorithm as MetronomePlayer)
    let entry = meterMap.getEntryAt(fromTick);
    let beatSize = meterMap.ticksPerBeat(fromTick);
    const tickIntoSection = fromTick - entry.tick;
    let tick = entry.tick + Math.ceil(tickIntoSection / beatSize) * beatSize;

    while (tick < toTick && this._beatsGenerated < this._totalBeats) {
      const tickPos = tick as Tick;

      // Re-snap at meter boundaries
      const currentEntry = meterMap.getEntryAt(tickPos);
      if (currentEntry.tick !== entry.tick) {
        entry = currentEntry;
        beatSize = meterMap.ticksPerBeat(tickPos);
      }

      this._beatsGenerated++;
      const isAccent = meterMap.isBarBoundary(tickPos);

      events.push({
        tick: tickPos,
        isAccent,
        buffer: isAccent ? this._accentBuffer : this._normalBuffer,
        beat: this._beatsGenerated,
        totalBeats: this._totalBeats,
      });

      beatSize = meterMap.ticksPerBeat(tickPos);
      tick += beatSize;
    }

    return events;
  }

  consume(event: CountInEvent): void {
    try {
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
            '[waveform-playlist] CountInPlayer: error disconnecting source:',
            String(err)
          );
        }
      });

      const transportTime = this._tempoMap.ticksToSeconds(event.tick);
      source.start(this._toAudioTime(transportTime));
    } catch (err) {
      console.warn(
        '[waveform-playlist] CountInPlayer.consume: failed to schedule beat ' +
          event.beat +
          '/' +
          event.totalBeats +
          ': ' +
          String(err)
      );
    }

    // Beat callback stays outside try/catch so count-in events still
    // fire even if one beat fails to schedule audio.
    this._onBeat?.(event.beat, event.totalBeats);
  }

  onPositionJump(_newTick: Tick): void {
    // No-op — clicks are short one-shots that finish naturally.
  }

  silence(): void {
    for (const source of this._activeSources) {
      try {
        source.stop();
      } catch (err) {
        console.warn(
          '[waveform-playlist] CountInPlayer.silence: error stopping source:',
          String(err)
        );
      }
      try {
        source.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] CountInPlayer.silence: error disconnecting:',
          String(err)
        );
      }
    }
    this._activeSources.clear();
  }
}
