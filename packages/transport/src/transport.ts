import type { ClipTrack } from '@waveform-playlist/core';
import type { TransportOptions } from './types';
import { Clock } from './core/clock';
import { Scheduler } from './core/scheduler';
import { Timer } from './core/timer';
import { SampleTimeline } from './timeline/sample-timeline';
import { TickTimeline } from './timeline/tick-timeline';
import { TempoMap } from './timeline/tempo-map';
import { ClipPlayer } from './audio/clip-player';
import { MetronomePlayer } from './audio/metronome-player';
import { MasterNode } from './audio/master-node';
import { TrackNode } from './audio/track-node';

type TransportEventType =
  | 'play'
  | 'pause'
  | 'stop'
  | 'loop'
  | 'tempochange';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type EventCallback = Function;

export class Transport {
  private _audioContext: AudioContext;
  private _clock: Clock;
  private _scheduler: Scheduler<any>;
  private _timer: Timer;
  private _sampleTimeline: SampleTimeline;
  private _tickTimeline: TickTimeline;
  private _tempoMap: TempoMap;
  private _clipPlayer: ClipPlayer;
  private _metronomePlayer: MetronomePlayer;
  private _masterNode: MasterNode;
  private _trackNodes: Map<string, TrackNode> = new Map();
  private _tracks: ClipTrack[] = [];
  private _soloedTrackIds: Set<string> = new Set();
  private _mutedTrackIds: Set<string> = new Set();
  private _playing = false;
  private _endTime: number | undefined;
  private _listeners: Map<TransportEventType, Set<EventCallback>> = new Map();

  constructor(
    audioContext: AudioContext,
    options: TransportOptions = {}
  ) {
    this._audioContext = audioContext;

    const sampleRate = options.sampleRate ?? audioContext.sampleRate;
    const ppqn = options.ppqn ?? 960;
    const tempo = options.tempo ?? 120;
    const beatsPerBar = options.beatsPerBar ?? 4;
    const lookahead = options.schedulerLookahead ?? 0.2;

    this._clock = new Clock(audioContext);
    this._scheduler = new Scheduler({ lookahead });
    this._sampleTimeline = new SampleTimeline(sampleRate);
    this._tickTimeline = new TickTimeline(ppqn);
    this._tempoMap = new TempoMap(ppqn, tempo);

    this._masterNode = new MasterNode(audioContext);
    this._masterNode.output.connect(audioContext.destination);

    // Bind toAudioTime so players can convert transport time → AudioContext time
    const toAudioTime = (transportTime: number) =>
      this._clock.toAudioTime(transportTime);

    this._clipPlayer = new ClipPlayer(
      audioContext,
      this._sampleTimeline,
      toAudioTime
    );
    this._metronomePlayer = new MetronomePlayer(
      audioContext,
      this._tempoMap,
      this._tickTimeline,
      this._masterNode.input,
      toAudioTime
    );
    this._metronomePlayer.setBeatsPerBar(beatsPerBar);

    this._scheduler.addListener(this._clipPlayer);
    this._scheduler.addListener(this._metronomePlayer);

    this._timer = new Timer(() => {
      const time = this._clock.getTime();

      // Check endTime
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
    this._clipPlayer.onPositionJump(currentTime);

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

    if (wasPlaying) {
      this._clock.start();
      this._timer.start();
    }
  }

  getCurrentTime(): number {
    return this._clock.getTime();
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
    this._tracks = this._tracks.map((t) =>
      t.id === trackId ? track : t
    );

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
    if (node) {
      node.setVolume(volume);
    }
  }

  setTrackPan(trackId: string, pan: number): void {
    const node = this._trackNodes.get(trackId);
    if (node) {
      node.setPan(pan);
    }
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

  setLoop(enabled: boolean, start: number, end: number): void {
    this._scheduler.setLoop(enabled, start, end);
    this._emit('loop');
  }

  // --- Tempo ---

  setTempo(bpm: number): void {
    this._tempoMap.setTempo(bpm);
    this._emit('tempochange');
  }

  getTempo(): number {
    return this._tempoMap.getTempo();
  }

  setBeatsPerBar(beats: number): void {
    this._metronomePlayer.setBeatsPerBar(beats);
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
    if (trackNode) {
      trackNode.connectEffects(node);
    }
  }

  disconnectTrackOutput(trackId: string): void {
    const trackNode = this._trackNodes.get(trackId);
    if (trackNode) {
      trackNode.disconnectEffects();
    }
  }

  // --- Events ---

  on(event: TransportEventType, cb: EventCallback): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(cb);
  }

  off(event: TransportEventType, cb: EventCallback): void {
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
        cb();
      }
    }
  }
}
