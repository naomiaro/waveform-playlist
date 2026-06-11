import { EffectsChainController } from './effects-chain-controller';
import { createEffectInstance } from './effect-registry';
import type { EffectState, SerializedEffectEntry } from './types';

const PREFIX = '[waveform-playlist] ';

/** The transport surface the effects system needs — satisfied by @dawcore/transport's Transport. */
export interface EffectsTransportLike {
  connectTrackOutput(trackId: string, node: AudioNode): void;
  disconnectTrackOutput(trackId: string): void;
  connectMasterOutput(node: AudioNode): void;
  disconnectMasterOutput(): void;
  readonly masterOutputNode: AudioNode;
}

interface AdapterLike {
  audioContext?: AudioContext;
  transport?: EffectsTransportLike;
}

/**
 * Owns all effect chains for one editor: the master chain plus one chain per
 * track. Wires chains into the adapter's transport hooks and dispatches the
 * daw-effect-* events from the owning element (track element for track
 * chains, the editor for the master chain) so they bubble track → editor.
 */
export class EffectsManager {
  private _getAdapter: () => AdapterLike | null;
  private _masterTarget: EventTarget;
  private _masterChain: EffectsChainController | null = null;
  private _trackChains = new Map<string, EffectsChainController>();
  /** Per-chain restore ownership — a newer setEffectsState supersedes a stale in-flight one. */
  private _restoreTokens = new WeakMap<EffectsChainController, symbol>();
  /** Live WAM plugin nodes across all chains, fed to the wam-transport bridge. */
  private _wamNodes = new Set<import('@dawcore/wam').WamTransportNode>();
  private _transportBridge: { notifyNodeAdded(node: unknown): void; dispose(): void } | null = null;

  constructor(getAdapter: () => AdapterLike | null, masterEventTarget: EventTarget) {
    this._getAdapter = getAdapter;
    this._masterTarget = masterEventTarget;
  }

  // --- Master chain ---

  addMasterEffect(type: string, params?: Record<string, number>): string {
    const chain = this._ensureMasterChain();
    return this._addToChain(chain, this._masterTarget, type, params);
  }

  masterEffects(): EffectState[] {
    return this._masterChain?.entries ?? [];
  }

  masterOp(
    op: 'remove' | 'setParams' | 'setBypassed' | 'move',
    effectId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arg?: any
  ): void {
    this._runOp(this._masterChain, this._masterTarget, op, effectId, arg);
  }

  addMasterWamPlugin(url: string, initialState?: unknown): Promise<string> {
    const chain = this._ensureMasterChain();
    return this._addWamToChain(chain, this._masterTarget, url, initialState);
  }

  getMasterEffectsState(): Promise<SerializedEffectEntry[]> {
    return this._masterChain?.serialize() ?? Promise.resolve([]);
  }

  async setMasterEffectsState(entries: SerializedEffectEntry[]): Promise<void> {
    validateSerializedEntries(entries);
    await this._restoreChain(this._ensureMasterChain(), this._masterTarget, entries);
  }

  // --- Track chains ---

  addTrackEffect(
    trackId: string,
    target: EventTarget,
    type: string,
    params?: Record<string, number>
  ): string {
    const chain = this._ensureTrackChain(trackId);
    return this._addToChain(chain, target, type, params);
  }

  addTrackWamPlugin(
    trackId: string,
    target: EventTarget,
    url: string,
    initialState?: unknown
  ): Promise<string> {
    const chain = this._ensureTrackChain(trackId);
    return this._addWamToChain(chain, target, url, initialState);
  }

  trackEffects(trackId: string): EffectState[] {
    return this._trackChains.get(trackId)?.entries ?? [];
  }

  getTrackEffectsState(trackId: string): Promise<SerializedEffectEntry[]> {
    return this._trackChains.get(trackId)?.serialize() ?? Promise.resolve([]);
  }

  async setTrackEffectsState(
    trackId: string,
    target: EventTarget,
    entries: SerializedEffectEntry[]
  ): Promise<void> {
    validateSerializedEntries(entries);
    await this._restoreChain(this._ensureTrackChain(trackId), target, entries);
  }

  trackOp(
    trackId: string,
    target: EventTarget,
    op: 'remove' | 'setParams' | 'setBypassed' | 'move',
    effectId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arg?: any
  ): void {
    this._runOp(this._trackChains.get(trackId) ?? null, target, op, effectId, arg);
  }

  // --- Lifecycle ---

  /** Transport setTracks rebuilds TrackNodes, severing chain hookups — re-wire. */
  rewireTrackChains(): void {
    const transport = this._getAdapter()?.transport;
    if (!transport) return;
    for (const [trackId, chain] of this._trackChains) {
      transport.connectTrackOutput(trackId, chain.input);
      chain.output.connect(transport.masterOutputNode);
    }
  }

  disposeTrackChain(trackId: string): void {
    const chain = this._trackChains.get(trackId);
    if (!chain) return;
    this._trackChains.delete(trackId);
    try {
      this._getAdapter()?.transport?.disconnectTrackOutput(trackId);
    } catch (err) {
      console.warn(PREFIX + 'EffectsManager: error disconnecting track output: ' + String(err));
    }
    chain.dispose();
  }

  disposeAll(): void {
    this._transportBridge?.dispose();
    this._transportBridge = null;
    this._wamNodes.clear();
    for (const trackId of [...this._trackChains.keys()]) {
      this.disposeTrackChain(trackId);
    }
    if (this._masterChain) {
      try {
        this._getAdapter()?.transport?.disconnectMasterOutput();
      } catch (err) {
        console.warn(PREFIX + 'EffectsManager: error disconnecting master output: ' + String(err));
      }
      this._masterChain.dispose();
      this._masterChain = null;
    }
  }

  // --- Private ---

  private _requireWiring(): { audioContext: AudioContext; transport: EffectsTransportLike } {
    const adapter = this._getAdapter();
    if (!adapter) {
      throw new Error(
        PREFIX + 'effects require an adapter — set editor.adapter before adding effects.'
      );
    }
    const { audioContext, transport } = adapter;
    if (!audioContext || !transport || typeof transport.connectTrackOutput !== 'function') {
      throw new Error(
        PREFIX +
          'the current adapter does not expose effects hooks (transport.connectTrackOutput / connectMasterOutput).'
      );
    }
    return { audioContext, transport };
  }

  private _ensureMasterChain(): EffectsChainController {
    if (this._masterChain) return this._masterChain;
    const { audioContext, transport } = this._requireWiring();
    const chain = new EffectsChainController(audioContext);
    transport.connectMasterOutput(chain.input);
    chain.output.connect(audioContext.destination);
    this._masterChain = chain;
    return chain;
  }

  private _ensureTrackChain(trackId: string): EffectsChainController {
    const existing = this._trackChains.get(trackId);
    if (existing) return existing;
    const { audioContext, transport } = this._requireWiring();
    const chain = new EffectsChainController(audioContext);
    transport.connectTrackOutput(trackId, chain.input);
    chain.output.connect(transport.masterOutputNode);
    this._trackChains.set(trackId, chain);
    return chain;
  }

  private _addToChain(
    chain: EffectsChainController,
    target: EventTarget,
    type: string,
    params?: Record<string, number>
  ): string {
    const audioContext = this._requireWiring().audioContext;
    const created = createEffectInstance(type, audioContext, params);
    const effectId = chain.add({
      kind: 'native',
      type,
      instance: created.instance,
      params: created.params,
      wetParam: created.wetParam,
    });
    const index = chain.entries.findIndex((e) => e.id === effectId);
    this._dispatch(target, 'daw-effect-add', {
      effectId,
      kind: 'native',
      type,
      params: { ...created.params },
      index,
    });
    return effectId;
  }

  /**
   * Load a WAM plugin (via the optional @dawcore/wam peer dep) and add it to
   * a chain as a kind:'wam' entry. WAM entries participate in every chain
   * operation with no special-casing: remove destroys the plugin (via the
   * entry's dispose), bypass uses disconnection semantics (no wet param),
   * and setParams maps onto the plugin's setParameterValues.
   */
  private async _addWamToChain(
    chain: EffectsChainController,
    target: EventTarget,
    url: string,
    initialState?: unknown
  ): Promise<string> {
    const { audioContext } = this._requireWiring();

    let wamModule: typeof import('@dawcore/wam');
    try {
      wamModule = await import('@dawcore/wam');
    } catch (originalErr) {
      // Log the original error so debugging isn't blocked when the failure
      // is something other than "not installed" (broken exports map, CSP, …).
      console.warn(PREFIX + '@dawcore/wam dynamic import failed: ' + String(originalErr));
      throw new Error(
        PREFIX +
          '@dawcore/wam is required for addWamPlugin(). Install with: npm install @dawcore/wam'
      );
    }

    const { hostGroupId } = await wamModule.ensureWamHost(audioContext);
    const plugin = await wamModule.createWamInstance(url, audioContext, hostGroupId, {
      initialState,
    });
    const node = plugin.audioNode;

    // The chain may have been torn down while the plugin was loading (track
    // removed, editor disconnected, adapter swapped). A late add would wire
    // the plugin into a severed graph and leak its worklet.
    if (chain.disposed) {
      plugin.destroy();
      throw new Error(
        PREFIX +
          'addWamPlugin: the effects chain was disposed while "' +
          url +
          '" was loading; the plugin was discarded.'
      );
    }

    let effectId: string;
    try {
      effectId = chain.add({
        kind: 'wam',
        type: 'wam',
        url,
        label: plugin.descriptor.name,
        instance: {
          input: node,
          output: node,
          applyParams: (params) => {
            node.setParameterValues?.(toWamParameterMap(params))?.catch((err: unknown) => {
              console.warn(PREFIX + 'WAM setParameterValues failed: ' + String(err));
            });
          },
          dispose: () => {
            this._wamNodes.delete(node);
            plugin.destroy();
          },
          getState: () => plugin.getState(),
        },
        params: {},
      });
    } catch (err) {
      // Insertion failed — the chain never took ownership, so the live
      // worklet must be torn down here or it leaks.
      try {
        plugin.destroy();
      } catch (destroyErr) {
        console.warn(
          PREFIX + 'addWamPlugin: cleanup after failed insertion also failed: ' + String(destroyErr)
        );
      }
      throw err;
    }
    this._wamNodes.add(node);
    this._ensureTransportBridge(wamModule)?.notifyNodeAdded(node);
    const index = chain.entries.findIndex((e) => e.id === effectId);
    this._dispatch(target, 'daw-effect-add', {
      effectId,
      kind: 'wam',
      type: 'wam',
      url,
      params: {},
      index,
    });
    return effectId;
  }

  /**
   * Lazily create the wam-transport bridge so tempo-synced plugins lock to
   * the timeline. Skipped (not an error) when the adapter's transport lacks
   * the query/event surface — the bridge is an enhancement, not a
   * requirement for audio processing.
   */
  private _ensureTransportBridge(
    wamModule: typeof import('@dawcore/wam')
  ): { notifyNodeAdded(node: unknown): void; dispose(): void } | null {
    if (this._transportBridge) return this._transportBridge;
    if (typeof wamModule.createWamTransportBridge !== 'function') return null;
    const transport = this._getAdapter()?.transport as
      | (EffectsTransportLike & import('@dawcore/wam').TransportQueryLike)
      | undefined;
    if (
      !transport ||
      typeof transport.on !== 'function' ||
      typeof transport.getTempo !== 'function' ||
      typeof transport.tickToBar !== 'function'
    ) {
      return null;
    }
    this._transportBridge = wamModule.createWamTransportBridge(transport, () => [
      ...this._wamNodes,
    ]);
    return this._transportBridge;
  }

  /**
   * Replace a chain's contents with a persisted snapshot. Entries restore
   * sequentially so chain order survives async WAM loads. A WAM url that
   * fails to load becomes a bypassed passthrough placeholder at its saved
   * position — the restore continues, a daw-effect-error fires, and the
   * saved state is retained so a later snapshot/retry round-trips it.
   */
  private async _restoreChain(
    chain: EffectsChainController,
    target: EventTarget,
    entries: SerializedEffectEntry[]
  ): Promise<void> {
    // Last writer wins: a newer restore takes ownership of the chain and the
    // stale one aborts at its next checkpoint instead of interleaving entries.
    const token = Symbol('restore');
    this._restoreTokens.set(chain, token);
    const superseded = () => this._restoreTokens.get(chain) !== token;

    for (const existing of chain.entries) {
      this._runOp(chain, target, 'remove', existing.id);
    }
    for (const entry of entries) {
      if (superseded()) return;
      if (entry.kind === 'native') {
        const id = this._addToChain(chain, target, entry.type, entry.params);
        if (entry.bypassed) {
          this._runOp(chain, target, 'setBypassed', id, true);
        }
        continue;
      }
      try {
        const id = await this._addWamToChain(chain, target, entry.url, entry.state);
        if (superseded()) {
          // A newer restore cleared the chain while this plugin loaded —
          // remove (and thereby destroy) the late arrival.
          this._runOp(chain, target, 'remove', id);
          return;
        }
        if (entry.bypassed) {
          this._runOp(chain, target, 'setBypassed', id, true);
        }
      } catch (err) {
        if (superseded()) return;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          PREFIX + 'setEffectsState: plugin "' + entry.url + '" failed to restore: ' + message
        );
        const effectId = this._addWamPlaceholder(chain, entry, message);
        this._dispatch(target, 'daw-effect-error', { effectId, url: entry.url, message });
      }
    }
  }

  /** A silent passthrough occupying the failed plugin's chain position. */
  private _addWamPlaceholder(
    chain: EffectsChainController,
    entry: { url: string; bypassed: boolean; state?: unknown },
    message: string
  ): string {
    const { audioContext } = this._requireWiring();
    const node = audioContext.createGain();
    const effectId = chain.add({
      kind: 'wam',
      type: 'wam',
      url: entry.url,
      label: entry.url,
      error: message,
      placeholder: { state: entry.state, bypassed: entry.bypassed },
      instance: { input: node, output: node, applyParams: () => {} },
      params: {},
    });
    // Placeholders pass audio through, bypassed-style (no wet param).
    chain.setBypassed(effectId, true);
    return effectId;
  }

  private _runOp(
    chain: EffectsChainController | null,
    target: EventTarget,
    op: 'remove' | 'setParams' | 'setBypassed' | 'move',
    effectId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arg?: any
  ): void {
    const entries = chain?.entries ?? [];
    const fromIndex = entries.findIndex((e) => e.id === effectId);
    if (!chain || fromIndex === -1) {
      console.warn(PREFIX + 'effects.' + op + ': unknown effectId "' + effectId + '"');
      return;
    }
    if (entries[fromIndex].error !== undefined && (op === 'setParams' || op === 'setBypassed')) {
      // Error placeholders are inert passthroughs — silently "succeeding"
      // would mislead the consumer into thinking the edit took effect.
      console.warn(
        PREFIX +
          'effects.' +
          op +
          ': effect "' +
          effectId +
          '" is a failed-plugin placeholder (' +
          entries[fromIndex].error +
          ') — edit ignored. Remove it or retry the restore.'
      );
      return;
    }
    switch (op) {
      case 'remove':
        chain.remove(effectId);
        this._dispatch(target, 'daw-effect-remove', { effectId });
        break;
      case 'setParams':
        chain.setParams(effectId, arg);
        this._dispatch(target, 'daw-effect-change', { effectId, params: { ...arg } });
        break;
      case 'setBypassed':
        chain.setBypassed(effectId, arg);
        this._dispatch(target, 'daw-effect-bypass', { effectId, bypassed: arg });
        break;
      case 'move':
        chain.move(effectId, arg);
        this._dispatch(target, 'daw-effect-reorder', { effectId, fromIndex, toIndex: arg });
        break;
    }
  }

  private _dispatch(target: EventTarget, name: string, detail: Record<string, unknown>): void {
    target.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }
}

/** Fail fast on malformed persisted data — external input, never trusted. */
function validateSerializedEntries(entries: unknown): asserts entries is SerializedEffectEntry[] {
  if (!Array.isArray(entries)) {
    throw new Error(PREFIX + 'setEffectsState: expected an array of serialized effect entries');
  }
  entries.forEach((entry, i) => {
    const at = ' (entry ' + i + ')';
    if (entry === null || typeof entry !== 'object') {
      throw new Error(PREFIX + 'setEffectsState: entry must be an object' + at);
    }
    const e = entry as Record<string, unknown>;
    if (e.kind === 'native') {
      if (typeof e.type !== 'string' || e.type.length === 0) {
        throw new Error(PREFIX + 'setEffectsState: native entry requires a type string' + at);
      }
      if (e.params === null || typeof e.params !== 'object') {
        throw new Error(PREFIX + 'setEffectsState: native entry requires a params object' + at);
      }
    } else if (e.kind === 'wam') {
      if (typeof e.url !== 'string' || e.url.length === 0) {
        throw new Error(PREFIX + 'setEffectsState: wam entry requires a url string' + at);
      }
    } else {
      throw new Error(PREFIX + 'setEffectsState: unknown entry kind "' + String(e.kind) + '"' + at);
    }
    if (typeof e.bypassed !== 'boolean') {
      throw new Error(PREFIX + 'setEffectsState: entry requires a boolean bypassed flag' + at);
    }
  });
}

/** WAM setParameterValues takes a map of {id, value, normalized} records. */
function toWamParameterMap(
  params: Record<string, number>
): Record<string, { id: string; value: number; normalized: boolean }> {
  const map: Record<string, { id: string; value: number; normalized: boolean }> = {};
  for (const [id, value] of Object.entries(params)) {
    map[id] = { id, value, normalized: false };
  }
  return map;
}
