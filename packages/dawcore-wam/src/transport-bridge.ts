const PREFIX = '[waveform-playlist] ';

/** Payload of a `wam-transport` event, per the WAM 2.0 host conventions. */
export interface WamTransportData {
  playing: boolean;
  tempo: number;
  timeSigNumerator: number;
  timeSigDenominator: number;
  currentBar: number;
  /** AudioContext time at which the current bar began. */
  currentBarStarted: number;
}

/**
 * Structural view of @dawcore/transport's Transport — only the read-only
 * query/event surface the bridge needs. The transport package stays
 * plugin-free; this bridge reads from it.
 */
export interface TransportQueryLike {
  readonly audioContext: { readonly currentTime: number };
  isPlaying(): boolean;
  getCurrentTime(): number;
  getTempo(atTick?: number): number;
  getMeter(atTick?: number): { numerator: number; denominator: number };
  secondsToTicks(seconds: number): number;
  ticksToSeconds(tick: number): number;
  tickToBar(tick: number): number;
  barToTick(bar: number): number;
  on(event: string, cb: () => void): void;
  off(event: string, cb: () => void): void;
}

/** The slice of a WamNode the bridge schedules events on. Optional because
 *  the loader's structural WamPluginAudioNode can't require it. */
export interface WamTransportNode {
  scheduleEvents?(...events: Array<{ type: string; time: number; data: WamTransportData }>): void;
}

export interface WamTransportBridge {
  /** Push the current transport state to one node (e.g. a plugin added mid-playback). */
  notifyNodeAdded(node: WamTransportNode): void;
  /** Push the current transport state to all nodes. */
  broadcastNow(): void;
  dispose(): void;
}

/**
 * Broadcasts `wam-transport` events to all live plugin nodes so tempo-synced
 * effects (delays, LFOs, arpeggiators) lock to the timeline.
 *
 * Rebroadcast triggers: play, pause, stop, seek, tempochange, meterchange —
 * plus a rAF watcher active only while playing, which catches tempo/meter
 * map boundary crossings that emit no transport event (variable-tempo
 * sessions).
 */
export function createWamTransportBridge(
  transport: TransportQueryLike,
  getPluginNodes: () => WamTransportNode[]
): WamTransportBridge {
  let disposed = false;
  let rafId: number | null = null;
  let lastTempo: number | null = null;
  let lastNumerator: number | null = null;
  let lastDenominator: number | null = null;

  const computeData = (): WamTransportData => {
    const seconds = transport.getCurrentTime();
    const tick = transport.secondsToTicks(seconds);
    const tempo = transport.getTempo(tick);
    const meter = transport.getMeter(tick);
    const currentBar = transport.tickToBar(tick);
    const barStartSeconds = transport.ticksToSeconds(transport.barToTick(currentBar));
    return {
      playing: transport.isPlaying(),
      tempo,
      timeSigNumerator: meter.numerator,
      timeSigDenominator: meter.denominator,
      currentBar,
      currentBarStarted: transport.audioContext.currentTime - (seconds - barStartSeconds),
    };
  };

  const send = (node: WamTransportNode, data: WamTransportData): void => {
    try {
      node.scheduleEvents?.({
        type: 'wam-transport',
        time: transport.audioContext.currentTime,
        data,
      });
    } catch (err) {
      console.warn(PREFIX + 'wam-transport broadcast failed for a plugin node: ' + String(err));
    }
  };

  const broadcast = (): void => {
    const data = computeData();
    lastTempo = data.tempo;
    lastNumerator = data.timeSigNumerator;
    lastDenominator = data.timeSigDenominator;
    for (const node of getPluginNodes()) {
      send(node, data);
    }
  };

  // Watcher: catches tempo/meter map boundary crossings during playback,
  // which fire no transport event. Active only while playing.
  const watch = (): void => {
    rafId = null;
    if (disposed || !transport.isPlaying()) return;
    const tick = transport.secondsToTicks(transport.getCurrentTime());
    const tempo = transport.getTempo(tick);
    const meter = transport.getMeter(tick);
    if (
      tempo !== lastTempo ||
      meter.numerator !== lastNumerator ||
      meter.denominator !== lastDenominator
    ) {
      broadcast();
    }
    rafId = requestAnimationFrame(watch);
  };

  const startWatcher = (): void => {
    if (rafId === null) {
      rafId = requestAnimationFrame(watch);
    }
  };

  const stopWatcher = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const onPlay = (): void => {
    broadcast();
    startWatcher();
  };
  const onHalt = (): void => {
    stopWatcher();
    broadcast();
  };
  const onChange = (): void => {
    broadcast();
  };

  transport.on('play', onPlay);
  transport.on('pause', onHalt);
  transport.on('stop', onHalt);
  transport.on('seek', onChange);
  transport.on('tempochange', onChange);
  transport.on('meterchange', onChange);

  // The bridge is created lazily (first plugin added) — if playback already
  // started, the play event that would have armed the watcher has passed.
  if (transport.isPlaying()) {
    onPlay();
  }

  return {
    notifyNodeAdded(node: WamTransportNode): void {
      if (disposed) return;
      send(node, computeData());
    },
    broadcastNow(): void {
      if (disposed) return;
      broadcast();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopWatcher();
      transport.off('play', onPlay);
      transport.off('pause', onHalt);
      transport.off('stop', onHalt);
      transport.off('seek', onChange);
      transport.off('tempochange', onChange);
      transport.off('meterchange', onChange);
    },
  };
}
