import { EffectsChainController } from './effects-chain-controller';
import { loadWamModule, loadFaustModule } from './optional-modules';
import { createEffectInstance, getEffectDefinitions } from './effect-registry';
import type { EffectChainItem, EffectState, SerializedEffectEntry } from './types';

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

/** A created (and cached) GUI element plus its idempotent destroyer. */
interface GuiRecord {
  element: HTMLElement;
  destroy: () => void;
}

function makeGuiRecord(element: HTMLElement, destroyImpl: () => void): GuiRecord {
  let destroyed = false;
  return {
    element,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      destroyImpl();
    },
  };
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
  /** Cached GUI elements by effectId — close hides, only removal destroys. */
  private _guis = new Map<string, GuiRecord>();
  /** In-flight GUI creation by effectId — concurrent opens share one build. */
  private _guiPending = new Map<string, Promise<GuiRecord>>();
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

  addMasterFaustEffect(dspCode: string, options?: { name?: string }): Promise<string> {
    const chain = this._ensureMasterChain();
    return this._addFaustToChain(chain, this._masterTarget, dspCode, { name: options?.name });
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

  addTrackFaustEffect(
    trackId: string,
    target: EventTarget,
    dspCode: string,
    options?: { name?: string }
  ): Promise<string> {
    const chain = this._ensureTrackChain(trackId);
    return this._addFaustToChain(chain, target, dspCode, { name: options?.name });
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

  // --- Effect GUIs ---

  /** Open (lazily creating) the GUI for a master-chain effect. */
  openMasterEffectGui(effectId: string, container: HTMLElement): Promise<HTMLElement> {
    return this._openGui(this._masterChain, this._masterTarget, effectId, container);
  }

  /** Open (lazily creating) the GUI for a track-chain effect. */
  openTrackEffectGui(
    trackId: string,
    target: EventTarget,
    effectId: string,
    container: HTMLElement
  ): Promise<HTMLElement> {
    return this._openGui(this._trackChains.get(trackId) ?? null, target, effectId, container);
  }

  /** Hide an open GUI. The element stays cached so reopen is instant —
   *  audio processing is never interrupted. */
  closeEffectGui(effectId: string): void {
    const record = this._guis.get(effectId);
    if (!record) {
      console.warn(PREFIX + 'closeEffectGui: no open GUI for effectId "' + effectId + '"');
      return;
    }
    record.element.remove();
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
    for (const entry of chain.entries) {
      this._destroyGui(entry.id);
    }
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
      for (const entry of this._masterChain.entries) {
        this._destroyGui(entry.id);
      }
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

  /** Dynamic-import the optional @dawcore/wam peer with an actionable error. */
  private _loadWamModule(feature: string): Promise<typeof import('@dawcore/wam')> {
    return loadWamModule(feature);
  }

  /** Dynamic-import the optional @dawcore/faust peer with an actionable error. */
  private _loadFaustModule(feature: string): Promise<typeof import('@dawcore/faust')> {
    return loadFaustModule(feature);
  }

  private async _openGui(
    chain: EffectsChainController | null,
    target: EventTarget,
    effectId: string,
    container: HTMLElement
  ): Promise<HTMLElement> {
    if (!container || typeof container.appendChild !== 'function') {
      throw new Error(PREFIX + 'openEffectGui: container must be a DOM element');
    }
    const entry = chain?.getEntry(effectId);
    if (!chain || !entry) {
      throw new Error(PREFIX + 'openEffectGui: unknown effectId "' + effectId + '"');
    }
    if (entry.error !== undefined) {
      throw new Error(
        PREFIX +
          'openEffectGui: effect "' +
          effectId +
          '" is a failed-plugin placeholder (' +
          entry.error +
          ') — no GUI is available. Remove it or retry the restore.'
      );
    }

    const cached = this._guis.get(effectId);
    if (cached) {
      container.appendChild(cached.element);
      return cached.element;
    }

    let pending = this._guiPending.get(effectId);
    if (!pending) {
      pending = this._createGuiRecord(chain, target, entry, effectId).finally(() => {
        this._guiPending.delete(effectId);
      });
      this._guiPending.set(effectId, pending);
    }
    const record = await pending;

    // The effect (or its whole chain) may have been removed while the GUI
    // was building — a late mount would leak a GUI for a destroyed plugin.
    if (chain.disposed || !chain.getEntry(effectId)) {
      this._guis.delete(effectId);
      record.element.remove();
      try {
        record.destroy();
      } catch (err) {
        console.warn(
          PREFIX +
            'openEffectGui: destroying a late GUI for "' +
            effectId +
            '" failed: ' +
            String(err)
        );
      }
      throw new Error(
        PREFIX +
          'openEffectGui: effect "' +
          effectId +
          '" was removed while its GUI was loading; the GUI was discarded.'
      );
    }

    this._guis.set(effectId, record);
    container.appendChild(record.element);
    return record.element;
  }

  /** Build a GUI record: the plugin's own GUI when available, otherwise the
   *  generic parameter panel from @dawcore/wam. */
  private async _createGuiRecord(
    chain: EffectsChainController,
    target: EventTarget,
    entry: EffectChainItem & { id: string },
    effectId: string
  ): Promise<GuiRecord> {
    const { instance } = entry;
    if (typeof instance.createGui === 'function') {
      try {
        const element = await instance.createGui();
        return makeGuiRecord(element, () => instance.destroyGui?.(element));
      } catch (err) {
        console.warn(
          PREFIX +
            'openEffectGui: plugin createGui failed for "' +
            effectId +
            '" — falling back to the generic parameter panel: ' +
            String(err)
        );
      }
    }
    const element = await this._createFallbackPanel(chain, target, entry, effectId);
    // The generic panel is plain DOM owned by this manager — removal from the
    // document (done by _destroyGui) is its entire teardown.
    return makeGuiRecord(element, () => {});
  }

  /** The generic parameter panel — one code path for "no custom GUI":
   *  native entries render from the registry's params metadata, WAM entries
   *  from getParameterInfo(). Edits route through the regular setParams op so
   *  they hit the audio (applyParams → setParameterValues for WAM) AND
   *  dispatch daw-effect-change like any other parameter edit. */
  private async _createFallbackPanel(
    chain: EffectsChainController,
    target: EventTarget,
    entry: EffectChainItem & { id: string },
    effectId: string
  ): Promise<HTMLElement> {
    const wamModule = await this._loadWamModule('openEffectGui() parameter panels');
    const onChange = (paramId: string, value: number) => {
      this._runOp(chain, target, 'setParams', effectId, { [paramId]: value });
    };

    if (entry.kind === 'native') {
      const definition = getEffectDefinitions().get(entry.type);
      if (!definition) {
        throw new Error(
          PREFIX + 'openEffectGui: no registry definition for effect type "' + entry.type + '"'
        );
      }
      const params = Object.entries(definition.params).map(([id, def]) => ({
        id,
        min: def.min,
        max: def.max,
        ...(def.step !== undefined ? { step: def.step } : {}),
        ...(def.unit !== undefined ? { unit: def.unit } : {}),
        value: entry.params[id] ?? definition.defaults[id],
      }));
      return wamModule.createParameterPanel(params, onChange);
    }

    if (typeof entry.instance.getParameterInfo !== 'function') {
      throw new Error(
        PREFIX +
          'openEffectGui: effect "' +
          effectId +
          '" has no GUI and exposes no parameter info — nothing to render.'
      );
    }
    return wamModule.createWamParameterPanel(
      { getParameterInfo: () => entry.instance.getParameterInfo!() },
      { onParamChange: onChange }
    );
  }

  /** Detach + destroy a cached GUI. Called only from removal paths — close
   *  never destroys. Safe when no GUI was ever opened. */
  private _destroyGui(effectId: string): void {
    const record = this._guis.get(effectId);
    if (!record) return;
    this._guis.delete(effectId);
    record.element.remove();
    try {
      record.destroy();
    } catch (err) {
      console.warn(PREFIX + 'destroyGui failed for effect "' + effectId + '": ' + String(err));
    }
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
    const wamModule = await this._loadWamModule('addWamPlugin()');
    const { hostGroupId } = await wamModule.ensureWamHost(audioContext);
    const plugin = await wamModule.createWamInstance(url, audioContext, hostGroupId, {
      initialState,
    });
    return this._insertWamPlugin(chain, target, wamModule, plugin, { url });
  }

  /**
   * Compile Faust DSP source in the browser (via the optional @dawcore/faust
   * peer) and add the resulting WAM to a chain. Compilation happens BEFORE
   * any chain work, so a Faust error (with its line/column diagnostics intact)
   * leaves the chain untouched. The entry lands as kind:'wam' with a
   * `source: { faust }` marker so persistence recompiles instead of fetching.
   */
  private async _addFaustToChain(
    chain: EffectsChainController,
    target: EventTarget,
    dspCode: string,
    opts: { name?: string; initialState?: unknown }
  ): Promise<string> {
    if (typeof dspCode !== 'string' || dspCode.trim().length === 0) {
      throw new Error(PREFIX + 'addFaustEffect: dspCode must be a non-empty string');
    }
    this._requireWiring();
    const faustModule = await this._loadFaustModule('addFaustEffect()');
    // Faust compile errors propagate unchanged — the diagnostics are
    // user-facing (the user wrote the DSP).
    const compiled = await faustModule.compileFaustToWam(dspCode, { name: opts.name });

    const { audioContext } = this._requireWiring();
    const wamModule = await this._loadWamModule('addFaustEffect()');
    const { hostGroupId } = await wamModule.ensureWamHost(audioContext);
    const plugin = await wamModule.createWamInstanceFromFactory(
      compiled.factory as import('@dawcore/wam').WamFactory,
      audioContext,
      hostGroupId,
      { initialState: opts.initialState, label: compiled.name }
    );
    return this._insertWamPlugin(chain, target, wamModule, plugin, {
      source: { faust: compiled.dspCode },
    });
  }

  /**
   * Wire a live WAM plugin instance into a chain as a kind:'wam' entry —
   * shared by the url path (addWamPlugin) and the Faust path (addFaustEffect).
   * WAM entries participate in every chain operation with no special-casing:
   * remove destroys the plugin (via the entry's dispose), bypass uses
   * disconnection semantics (no wet param), and setParams maps onto the
   * plugin's setParameterValues.
   */
  private _insertWamPlugin(
    chain: EffectsChainController,
    target: EventTarget,
    wamModule: typeof import('@dawcore/wam'),
    plugin: import('@dawcore/wam').WamPluginInstance,
    meta: { url?: string; source?: { faust: string } }
  ): string {
    const node = plugin.audioNode;
    const label = plugin.descriptor.name;

    // The chain may have been torn down while the plugin was loading/compiling
    // (track removed, editor disconnected, adapter swapped). A late add would
    // wire the plugin into a severed graph and leak its worklet.
    if (chain.disposed) {
      plugin.destroy();
      throw new Error(
        PREFIX +
          'addWamPlugin: the effects chain was disposed while "' +
          (meta.url ?? label) +
          '" was loading; the plugin was discarded.'
      );
    }

    let effectId: string;
    try {
      effectId = chain.add({
        kind: 'wam',
        type: 'wam',
        ...(meta.url !== undefined ? { url: meta.url } : {}),
        ...(meta.source !== undefined ? { source: meta.source } : {}),
        label,
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
          getParameterInfo: () => plugin.getParameterInfo(),
          ...(plugin.createGui ? { createGui: () => plugin.createGui!() } : {}),
          ...(plugin.destroyGui
            ? { destroyGui: (gui: HTMLElement) => plugin.destroyGui!(gui) }
            : {}),
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
      ...(meta.url !== undefined ? { url: meta.url } : {}),
      ...(meta.source !== undefined ? { source: meta.source } : {}),
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
      typeof transport.tickToBar !== 'function' ||
      typeof transport.timeToTick !== 'function'
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
        // Faust entries recompile from their persisted DSP source; url
        // entries load from their URL.
        const id =
          entry.faustDsp !== undefined
            ? await this._addFaustToChain(chain, target, entry.faustDsp, {
                name: entry.faustName,
                initialState: entry.state,
              })
            : await this._addWamToChain(chain, target, entry.url ?? '', entry.state);
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
        const sourceLabel = entry.url ?? entry.faustName ?? 'Faust effect';
        console.warn(
          PREFIX + 'setEffectsState: plugin "' + sourceLabel + '" failed to restore: ' + message
        );
        const effectId = this._addWamPlaceholder(chain, entry, message);
        this._dispatch(target, 'daw-effect-error', {
          effectId,
          ...(entry.url !== undefined ? { url: entry.url } : {}),
          ...(entry.faustDsp !== undefined ? { source: { faust: entry.faustDsp } } : {}),
          message,
        });
      }
    }
  }

  /** A silent passthrough occupying the failed plugin's chain position. */
  private _addWamPlaceholder(
    chain: EffectsChainController,
    entry: {
      url?: string;
      faustDsp?: string;
      faustName?: string;
      bypassed: boolean;
      state?: unknown;
    },
    message: string
  ): string {
    const { audioContext } = this._requireWiring();
    const node = audioContext.createGain();
    const effectId = chain.add({
      kind: 'wam',
      type: 'wam',
      ...(entry.url !== undefined ? { url: entry.url } : {}),
      ...(entry.faustDsp !== undefined ? { source: { faust: entry.faustDsp } } : {}),
      label: entry.url ?? entry.faustName ?? 'Faust effect',
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
        this._destroyGui(effectId);
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
      const hasUrl = typeof e.url === 'string' && e.url.length > 0;
      const hasFaustDsp = typeof e.faustDsp === 'string' && e.faustDsp.trim().length > 0;
      if (!hasUrl && !hasFaustDsp) {
        throw new Error(
          PREFIX +
            'setEffectsState: wam entry requires a url string or a faustDsp source string' +
            at
        );
      }
      if (e.faustName !== undefined && typeof e.faustName !== 'string') {
        throw new Error(PREFIX + 'setEffectsState: faustName must be a string when provided' + at);
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
