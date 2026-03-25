import type { Tick, SchedulerEvent, SchedulerListener } from '../types';
import type { TempoMap } from '../timeline/tempo-map';
import { MeterMap } from '../timeline/meter-map';

export interface MetronomeEvent extends SchedulerEvent {
  isAccent: boolean;
  buffer: AudioBuffer;
}

export class MetronomePlayer implements SchedulerListener<MetronomeEvent> {
  private _audioContext: AudioContext;
  private _tempoMap: TempoMap;
  private _meterMap: MeterMap;
  private _destination: AudioNode;
  private _toAudioTime: (transportTime: number) => number;
  private _enabled = false;
  private _accentBuffer: AudioBuffer | null = null;
  private _normalBuffer: AudioBuffer | null = null;
  private _activeSources: Set<AudioBufferSourceNode> = new Set();

  constructor(
    audioContext: AudioContext,
    tempoMap: TempoMap,
    meterMap: MeterMap,
    destination: AudioNode,
    toAudioTime: (transportTime: number) => number
  ) {
    this._audioContext = audioContext;
    this._tempoMap = tempoMap;
    this._meterMap = meterMap;
    this._destination = destination;
    this._toAudioTime = toAudioTime;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      this.silence();
    }
  }

  setClickSounds(accent: AudioBuffer, normal: AudioBuffer): void {
    this._accentBuffer = accent;
    this._normalBuffer = normal;
  }

  generate(fromTick: Tick, toTick: Tick): MetronomeEvent[] {
    if (!this._enabled || !this._accentBuffer || !this._normalBuffer) {
      return [];
    }

    const events: MetronomeEvent[] = [];

    // Snap to first beat: align to beat grid anchored at the active meter entry
    let entry = this._meterMap.getEntryAt(fromTick);
    let beatSize = this._meterMap.ticksPerBeat(fromTick);
    const tickIntoSection = fromTick - entry.tick;
    let tick = entry.tick + Math.ceil(tickIntoSection / beatSize) * beatSize;

    while (tick < toTick) {
      // Re-snap at meter boundaries
      const currentEntry = this._meterMap.getEntryAt(tick);
      if (currentEntry.tick !== entry.tick) {
        entry = currentEntry;
        beatSize = this._meterMap.ticksPerBeat(tick);
      }

      const isAccent = this._meterMap.isBarBoundary(tick);

      events.push({
        tick: tick as Tick,
        isAccent,
        buffer: isAccent ? this._accentBuffer : this._normalBuffer,
      });

      beatSize = this._meterMap.ticksPerBeat(tick);
      tick += beatSize;
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

    const transportTime = this._tempoMap.ticksToSeconds(event.tick);
    source.start(this._toAudioTime(transportTime));
  }

  onPositionJump(_newTick: Tick): void {
    // Don't silence — clicks are short one-shots that finish naturally.
    // Calling silence() here kills clicks scheduled in the lookahead window
    // that haven't played yet, causing the last beat before a loop wrap
    // to be cut off.
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
