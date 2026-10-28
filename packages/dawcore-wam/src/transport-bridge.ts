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
  timeToTick(seconds: number): number;
  tickToTime(tick: number): number;
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
 * Rebroadcast triggers: play, pause, stop, seek, discontinuity, tempochange,
 * meterchange — plus the transport's `tick` event (one per Worker-driven
 * scheduler tick while playing), on which the bridge rebroadcasts when the
 * playhead crossed a tempo/meter map boundary (variable-tempo sessions emit
 * no event for that) or moved BACKWARDS (a loop wrap: the transport performs
 * it without an event; the clamped position just reads lower). Nothing here
 * uses requestAnimationFrame: rAF stops in a hidden tab while the transport
 * keeps playing (#645).
 */
export function createWamTransportBridge(
  transport: TransportQueryLike,
  getPluginNodes: () => WamTransportNode[]
): WamTransportBridge {
  let disposed = false;
  /** Position at the last broadcast/tick; a lower reading means a wrap. */
  let lastSeconds = -Infinity;
  let lastTempo: number | null = null;
  let lastNumerator: number | null = null;
  let lastDenominator: number | null = null;

  const computeData = (): WamTransportData => {
    const seconds = transport.getCurrentTime();
    lastSeconds = seconds;
    const tick = transport.timeToTick(seconds);
    const tempo = transport.getTempo(tick);
    const meter = transport.getMeter(tick);
    const currentBar = transport.tickToBar(tick);
    const barStartSeconds = transport.tickToTime(transport.barToTick(currentBar));
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

  // Per scheduler tick: catches tempo/meter map boundary crossings and loop
  // wraps during playback, neither of which fires a transport event. A tick
  // can arrive after stop (one was in flight), so the playing check stays.
  const onTick = (): void => {
    if (disposed || !transport.isPlaying()) return;
    const seconds = transport.getCurrentTime();
    const wrapped = seconds < lastSeconds;
    lastSeconds = seconds;
    const tick = transport.timeToTick(seconds);
    const tempo = transport.getTempo(tick);
    const meter = transport.getMeter(tick);
    if (
      wrapped ||
      tempo !== lastTempo ||
      meter.numerator !== lastNumerator ||
      meter.denominator !== lastDenominator
    ) {
      broadcast();
    }
  };

  const onChange = (): void => {
    broadcast();
  };

  const subscriptions: ReadonlyArray<[string, () => void]> = [
    ['play', onChange],
    ['pause', onChange],
    ['stop', onChange],
    ['seek', onChange],
    ['discontinuity', onChange],
    ['tempochange', onChange],
    ['meterchange', onChange],
    ['tick', onTick],
  ];
  for (const [event, cb] of subscriptions) {
    transport.on(event, cb);
  }

  // The bridge is created lazily (first plugin added) — if playback already
  // started, the play event that would have synced the plugins has passed.
  if (transport.isPlaying()) {
    broadcast();
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
      for (const [event, cb] of subscriptions) {
        transport.off(event, cb);
      }
    },
  };
}
