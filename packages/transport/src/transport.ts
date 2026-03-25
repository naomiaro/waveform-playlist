import type { ClipTrack } from '@waveform-playlist/core';
import type { Tick, Sample, TransportOptions, MeterSignature } from './types';
import { Clock } from './core/clock';
import { Scheduler } from './core/scheduler';
import { Timer } from './core/timer';
import { SampleTimeline } from './timeline/sample-timeline';
import { TempoMap } from './timeline/tempo-map';
import { MeterMap } from './timeline/meter-map';
import { ClipPlayer } from './audio/clip-player';
import { MetronomePlayer } from './audio/metronome-player';
import { MasterNode } from './audio/master-node';
import { TrackNode } from './audio/track-node';

export interface TransportEvents {
  play: () => void;
  pause: () => void;
  stop: () => void;
  loop: () => void;
  tempochange: () => void;
  meterchange: () => void;
}

type TransportEventType = keyof TransportEvents;

export class Transport {
  private _audioContext: AudioContext;
  private _clock: Clock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _scheduler: Scheduler<any>;
  private _timer: Timer;
  private _sampleTimeline: SampleTimeline;
  private _meterMap: MeterMap;
  private _tempoMap: TempoMap;
  private _clipPlayer!: ClipPlayer;
  private _metronomePlayer!: MetronomePlayer;
  private _masterNode!: MasterNode;
  private _trackNodes: Map<string, TrackNode> = new Map();
  private _tracks: ClipTrack[] = [];
  private _soloedTrackIds: Set<string> = new Set();
  private _mutedTrackIds: Set<string> = new Set();
  private _playing = false;
  private _endTime: number | undefined;
  private _loopEnabled = false;
  private _loopStartSeconds = 0;
  private _listeners: Map<TransportEventType, Set<TransportEvents[TransportEventType]>> = new Map();

  constructor(audioContext: AudioContext, options: TransportOptions = {}) {
    this._audioContext = audioContext;

    const sampleRate = options.sampleRate ?? audioContext.sampleRate;
    const ppqn = options.ppqn ?? 960;
    const tempo = options.tempo ?? 120;
    const numerator = options.numerator ?? 4;
    const denominator = options.denominator ?? 4;
    const lookahead = options.schedulerLookahead ?? 0.2;

    Transport._validateOptions(sampleRate, ppqn, tempo, numerator, denominator, lookahead);

    this._clock = new Clock(audioContext);
    this._sampleTimeline = new SampleTimeline(sampleRate);
    this._meterMap = new MeterMap(ppqn, numerator, denominator);
    this._tempoMap = new TempoMap(ppqn, tempo);

    this._scheduler = new Scheduler(this._tempoMap, {
      lookahead,
      onLoop: (loopStartSeconds: number, loopEndSeconds: number, currentTimeSeconds: number) => {
        // The wrap fires in the middle of advance(), which runs ahead of
        // real time by the lookahead.  Post-wrap events use toAudioTime()
        // which reads the clock, so the seek target must place loopStart
        // at the audio-time of the boundary — not at "now".
        // Uses the currentTimeSeconds snapshot from advance() to avoid
        // re-reading the live AudioContext.currentTime (sub-ms drift).
        const timeToBoundary = loopEndSeconds - currentTimeSeconds;
        this._clock.seekTo(loopStartSeconds - timeToBoundary);
      },
    });
    this._sampleTimeline.setTempoMap(this._tempoMap);

    this._initAudioGraph(audioContext);

    this._timer = new Timer(() => {
      const time = this._clock.getTime();
      if (this._endTime !== undefined && time >= this._endTime) {
        this.stop();
        return;
      }
      this._scheduler.advance(time);
    });
  }

  get audioContext(): AudioContext {
    return this._audioContext;
  }

  // --- Playback ---

  play(startTime?: number, endTime?: number): void {
    if (this._playing) return;

    if (startTime !== undefined) {
      this._clock.seekTo(startTime);
    }

    // Always reset scheduler to current position — after pause, the old
    // rightEdge is stale and clips whose startTime is before it won't
    // be picked up by generate().
    const currentTime = this._clock.getTime();
    this._scheduler.reset(currentTime);

    this._endTime = endTime;
    this._clock.start();

    // Re-create sources for clips spanning the current position.
    // After pause, silence() killed all active sources. generate() only
    // picks up clips whose startTime falls in the window, so clips that
    // started before the current position need mid-clip sources.
    const currentTick = this._tempoMap.secondsToTicks(currentTime);
    this._clipPlayer.onPositionJump(currentTick);

    this._timer.start();
    this._playing = true;
    this._emit('play');
  }

  pause(): void {
    if (!this._playing) return;

    this._timer.stop();
    this._clock.stop();
    this._silenceAll();
    this._playing = false;
    this._emit('pause');
  }

  stop(): void {
    const wasPlaying = this._playing;
    this._timer.stop();
    this._clock.reset();
    this._scheduler.reset(0);
    this._silenceAll();
    this._playing = false;
    this._endTime = undefined;
    if (wasPlaying) {
      this._emit('stop');
    }
  }

  seek(time: number): void {
    const wasPlaying = this._playing;

    if (wasPlaying) {
      this._timer.stop();
    }

    this._silenceAll();
    this._clock.seekTo(time);
    this._scheduler.reset(time);
    // Clear stale endTime — seeking past a previous endTime shouldn't
    // cause immediate stop on the next play()
    this._endTime = undefined;

    if (wasPlaying) {
      this._clock.start();
      // Re-create sources for clips spanning the seek position
      const seekTick = this._tempoMap.secondsToTicks(time);
      this._clipPlayer.onPositionJump(seekTick);
      this._timer.start();
    }
  }

  getCurrentTime(): number {
    const t = this._clock.getTime();
    // After a loop wrap, the clock is briefly behind loopStart (the seek
    // target accounts for lookahead offset). Clamp for display purposes.
    if (this._loopEnabled && t < this._loopStartSeconds) {
      return this._loopStartSeconds;
    }
    return t;
  }

  isPlaying(): boolean {
    return this._playing;
  }

  // --- Tracks ---

  setTracks(tracks: ClipTrack[]): void {
    // Dispose existing track nodes
    for (const node of this._trackNodes.values()) {
      node.dispose();
    }
    this._trackNodes.clear();
    this._soloedTrackIds.clear();
    this._mutedTrackIds.clear();

    this._tracks = tracks;

    // Create track nodes
    for (const track of tracks) {
      const trackNode = new TrackNode(track.id, this._audioContext);
      trackNode.setVolume(track.volume);
      trackNode.setPan(track.pan);
      trackNode.connectOutput(this._masterNode.input);
      this._trackNodes.set(track.id, trackNode);

      if (track.muted) {
        this._mutedTrackIds.add(track.id);
      }
      if (track.soloed) {
        this._soloedTrackIds.add(track.id);
      }
    }

    this._applyMuteState();
    this._clipPlayer.setTracks(tracks, this._trackNodes);
  }

  addTrack(track: ClipTrack): void {
    const trackNode = new TrackNode(track.id, this._audioContext);
    trackNode.setVolume(track.volume);
    trackNode.setPan(track.pan);
    trackNode.connectOutput(this._masterNode.input);
    this._trackNodes.set(track.id, trackNode);

    if (track.muted) {
      this._mutedTrackIds.add(track.id);
    }
    if (track.soloed) {
      this._soloedTrackIds.add(track.id);
    }

    this._tracks = [...this._tracks, track];
    this._applyMuteState();
    this._clipPlayer.setTracks(this._tracks, this._trackNodes);
  }

  removeTrack(trackId: string): void {
    const node = this._trackNodes.get(trackId);
    if (node) {
      node.dispose();
      this._trackNodes.delete(trackId);
    }
    this._soloedTrackIds.delete(trackId);
    this._mutedTrackIds.delete(trackId);
    this._tracks = this._tracks.filter((t) => t.id !== trackId);
    this._applyMuteState();
    this._clipPlayer.setTracks(this._tracks, this._trackNodes);
  }

  updateTrack(trackId: string, track: ClipTrack): void {
    this._tracks = this._tracks.map((t) => (t.id === trackId ? track : t));

    const node = this._trackNodes.get(trackId);
    if (node) {
      node.setVolume(track.volume);
      node.setPan(track.pan);
    }

    // Update mute/solo
    if (track.muted) {
      this._mutedTrackIds.add(trackId);
    } else {
      this._mutedTrackIds.delete(trackId);
    }
    if (track.soloed) {
      this._soloedTrackIds.add(trackId);
    } else {
      this._soloedTrackIds.delete(trackId);
    }

    this._applyMuteState();
    this._clipPlayer.updateTrack(trackId, track);
  }

  // --- Track Controls ---

  setTrackVolume(trackId: string, volume: number): void {
    const node = this._trackNodes.get(trackId);
    if (!node) {
      console.warn('[waveform-playlist] setTrackVolume: unknown trackId "' + trackId + '"');
      return;
    }
    node.setVolume(volume);
  }

  setTrackPan(trackId: string, pan: number): void {
    const node = this._trackNodes.get(trackId);
    if (!node) {
      console.warn('[waveform-playlist] setTrackPan: unknown trackId "' + trackId + '"');
      return;
    }
    node.setPan(pan);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    if (muted) {
      this._mutedTrackIds.add(trackId);
    } else {
      this._mutedTrackIds.delete(trackId);
    }
    this._applyMuteState();
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    if (soloed) {
      this._soloedTrackIds.add(trackId);
    } else {
      this._soloedTrackIds.delete(trackId);
    }
    this._applyMuteState();
  }

  // --- Master ---

  setMasterVolume(volume: number): void {
    this._masterNode.setVolume(volume);
  }

  // --- Loop ---

  /** Primary loop API — ticks as source of truth */
  setLoop(enabled: boolean, startTick: Tick, endTick: Tick): void {
    if (enabled && startTick >= endTick) {
      console.warn(
        '[waveform-playlist] Transport.setLoop: startTick (' +
          startTick +
          ') must be less than endTick (' +
          endTick +
          ')'
      );
      return;
    }
    this._loopEnabled = enabled;
    this._loopStartSeconds = this._tempoMap.ticksToSeconds(startTick);
    this._scheduler.setLoop(enabled, startTick, endTick);
    this._clipPlayer.setLoop(enabled, startTick, endTick);
    this._emit('loop');
  }

  /** Convenience — converts seconds to ticks */
  setLoopSeconds(enabled: boolean, startSec: number, endSec: number): void {
    const startTick = this._tempoMap.secondsToTicks(startSec);
    const endTick = this._tempoMap.secondsToTicks(endSec);
    this.setLoop(enabled, startTick, endTick);
  }

  /** Convenience — sets loop in samples */
  setLoopSamples(enabled: boolean, startSample: Sample, endSample: Sample): void {
    if (enabled && (!Number.isFinite(startSample) || !Number.isFinite(endSample))) {
      console.warn(
        '[waveform-playlist] Transport.setLoopSamples: non-finite sample values (' +
          startSample +
          ', ' +
          endSample +
          ')'
      );
      return;
    }
    if (enabled && startSample >= endSample) {
      console.warn(
        '[waveform-playlist] Transport.setLoopSamples: startSample (' +
          startSample +
          ') must be less than endSample (' +
          endSample +
          ')'
      );
      return;
    }
    const startTick = this._sampleTimeline.samplesToTicks(startSample);
    const endTick = this._sampleTimeline.samplesToTicks(endSample);
    this._loopEnabled = enabled;
    this._loopStartSeconds = this._tempoMap.ticksToSeconds(startTick);
    this._clipPlayer.setLoopSamples(enabled, startSample, endSample);
    this._scheduler.setLoop(enabled, startTick, endTick);
    this._emit('loop');
  }

  // --- Tempo ---

  setTempo(bpm: number, atTick?: Tick): void {
    this._tempoMap.setTempo(bpm, atTick);
    this._emit('tempochange');
  }

  getTempo(atTick?: Tick): number {
    return this._tempoMap.getTempo(atTick);
  }

  // --- Meter ---

  setMeter(numerator: number, denominator: number, atTick?: Tick): void {
    this._meterMap.setMeter(numerator, denominator, atTick);
    this._emit('meterchange');
  }

  getMeter(atTick?: Tick): MeterSignature {
    return this._meterMap.getMeter(atTick);
  }

  removeMeter(atTick: Tick): void {
    this._meterMap.removeMeter(atTick);
    this._emit('meterchange');
  }

  clearMeters(): void {
    this._meterMap.clearMeters();
    this._emit('meterchange');
  }

  clearTempos(): void {
    this._tempoMap.clearTempos();
    this._emit('tempochange');
  }

  barToTick(bar: number): Tick {
    return this._meterMap.barToTick(bar);
  }

  tickToBar(tick: Tick): number {
    return this._meterMap.tickToBar(tick);
  }

  /** Convert transport time (seconds) to tick position, using the tempo map. */
  timeToTick(seconds: number): Tick {
    return this._tempoMap.secondsToTicks(seconds);
  }

  /** Convert tick position to transport time (seconds), using the tempo map. */
  tickToTime(tick: Tick): number {
    return this._tempoMap.ticksToSeconds(tick);
  }

  // --- Metronome ---

  setMetronomeEnabled(enabled: boolean): void {
    this._metronomePlayer.setEnabled(enabled);
  }

  setMetronomeClickSounds(accent: AudioBuffer, normal: AudioBuffer): void {
    this._metronomePlayer.setClickSounds(accent, normal);
  }

  // --- Effects Hook ---

  connectTrackOutput(trackId: string, node: AudioNode): void {
    const trackNode = this._trackNodes.get(trackId);
    if (!trackNode) {
      console.warn('[waveform-playlist] connectTrackOutput: unknown trackId "' + trackId + '"');
      return;
    }
    trackNode.connectEffects(node);
  }

  disconnectTrackOutput(trackId: string): void {
    const trackNode = this._trackNodes.get(trackId);
    if (!trackNode) {
      console.warn('[waveform-playlist] disconnectTrackOutput: unknown trackId "' + trackId + '"');
      return;
    }
    trackNode.disconnectEffects();
  }

  // --- Events ---

  on<K extends TransportEventType>(event: K, cb: TransportEvents[K]): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(cb);
  }

  off<K extends TransportEventType>(event: K, cb: TransportEvents[K]): void {
    this._listeners.get(event)?.delete(cb);
  }

  // --- Dispose ---

  dispose(): void {
    this.stop();
    for (const node of this._trackNodes.values()) {
      node.dispose();
    }
    this._trackNodes.clear();
    this._masterNode.dispose();
    this._listeners.clear();
  }

  // --- Private ---

  private static _validateOptions(
    sampleRate: number,
    ppqn: number,
    tempo: number,
    numerator: number,
    denominator: number,
    lookahead: number
  ): void {
    if (sampleRate <= 0) {
      throw new Error(
        '[waveform-playlist] Transport: sampleRate must be positive, got ' + sampleRate
      );
    }
    if (ppqn <= 0 || !Number.isInteger(ppqn)) {
      throw new Error(
        '[waveform-playlist] Transport: ppqn must be a positive integer, got ' + ppqn
      );
    }
    if (tempo <= 0) {
      throw new Error('[waveform-playlist] Transport: tempo must be positive, got ' + tempo);
    }
    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) {
      throw new Error(
        '[waveform-playlist] Transport: numerator must be an integer 1-32, got ' + numerator
      );
    }
    if (denominator <= 0 || (denominator & (denominator - 1)) !== 0 || denominator > 32) {
      throw new Error(
        '[waveform-playlist] Transport: denominator must be a power of 2 (1-32), got ' + denominator
      );
    }
    if (lookahead <= 0) {
      throw new Error(
        '[waveform-playlist] Transport: schedulerLookahead must be positive, got ' + lookahead
      );
    }
  }

  private _initAudioGraph(audioContext: AudioContext): void {
    this._masterNode = new MasterNode(audioContext);
    this._masterNode.output.connect(audioContext.destination);

    const toAudioTime = (transportTime: number) => this._clock.toAudioTime(transportTime);

    this._clipPlayer = new ClipPlayer(
      audioContext,
      this._sampleTimeline,
      this._tempoMap,
      toAudioTime
    );
    this._metronomePlayer = new MetronomePlayer(
      audioContext,
      this._tempoMap,
      this._meterMap,
      this._masterNode.input,
      toAudioTime
    );

    this._scheduler.addListener(this._clipPlayer);
    this._scheduler.addListener(this._metronomePlayer);
  }

  private _silenceAll(): void {
    this._clipPlayer.silence();
    this._metronomePlayer.silence();
  }

  private _applyMuteState(): void {
    const hasSolo = this._soloedTrackIds.size > 0;

    for (const [trackId, node] of this._trackNodes) {
      const isExplicitlyMuted = this._mutedTrackIds.has(trackId);
      const isSoloMuted = hasSolo && !this._soloedTrackIds.has(trackId);

      // Explicit mute takes precedence — a track that is both soloed AND muted stays muted
      node.setMute(isExplicitlyMuted || isSoloMuted);
    }
  }

  private _emit(event: TransportEventType): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb();
        } catch (err) {
          console.warn(
            '[waveform-playlist] Transport "' + event + '" listener threw:',
            String(err)
          );
        }
      }
    }
  }
}
