import { EffectsChainController } from './effects-chain-controller';
import { createEffectInstance } from './effect-registry';
import type { EffectState } from './types';

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

  trackEffects(trackId: string): EffectState[] {
    return this._trackChains.get(trackId)?.entries ?? [];
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
