import type { EffectChainItem, EffectState, SerializedEffectEntry } from './types';

interface ChainEntry extends EffectChainItem {
  id: string;
  bypassed: boolean;
}

let idCounter = 0;

/**
 * An ordered insert-effects chain. Owns `input`/`output` gain nodes; entries
 * are wired in series between them (empty chain = straight passthrough).
 *
 * Topology changes (add/remove/move/disconnect-bypass) rebuild the internal
 * wiring; parameter changes never do. Only the controller's own outgoing
 * edges are severed during a rebuild — the consumer's edges into `input` and
 * out of `output` are untouched.
 */
export class EffectsChainController {
  private _input: GainNode;
  private _output: GainNode;
  private _entries: ChainEntry[] = [];
  private _disposed = false;

  constructor(audioContext: BaseAudioContext) {
    this._input = audioContext.createGain();
    this._output = audioContext.createGain();
    this._input.connect(this._output);
  }

  /** Connect the upstream source (track mute node, master gain) into this. */
  get input(): AudioNode {
    return this._input;
  }

  /** Route this onward (to the master bus / destination). */
  get output(): AudioNode {
    return this._output;
  }

  get entries(): EffectState[] {
    return this._entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      type: entry.type,
      params: { ...entry.params },
      bypassed: entry.bypassed,
      ...(entry.url !== undefined ? { url: entry.url } : {}),
      ...(entry.label !== undefined ? { label: entry.label } : {}),
      ...(entry.error !== undefined ? { error: entry.error } : {}),
    }));
  }

  /** Snapshot the chain in its persisted form. WAM entries are asked for
   *  their live state; placeholders re-emit the state they were saved with. */
  serialize(): Promise<SerializedEffectEntry[]> {
    return Promise.all(
      this._entries.map(async (entry): Promise<SerializedEffectEntry> => {
        if (entry.kind === 'wam') {
          if (entry.placeholder) {
            return {
              kind: 'wam',
              url: entry.url ?? '',
              bypassed: entry.placeholder.bypassed,
              ...(entry.placeholder.state !== undefined ? { state: entry.placeholder.state } : {}),
            };
          }
          let state: unknown;
          try {
            state = await entry.instance.getState?.();
          } catch (err) {
            // One misbehaving plugin must not poison the whole snapshot —
            // emit the entry without state and let the consumer persist the rest.
            console.warn(
              '[waveform-playlist] serialize: plugin "' +
                (entry.url ?? entry.type) +
                '" getState failed: ' +
                String(err)
            );
          }
          return {
            kind: 'wam',
            url: entry.url ?? '',
            bypassed: entry.bypassed,
            ...(state !== undefined ? { state } : {}),
          };
        }
        return {
          kind: 'native',
          type: entry.type,
          params: { ...entry.params },
          bypassed: entry.bypassed,
        };
      })
    );
  }

  get disposed(): boolean {
    return this._disposed;
  }

  /** Internal (manager-facing): the live entry — including its instance —
   *  for GUI wiring. Returns undefined (no warning) when the id is unknown. */
  getEntry(effectId: string): (EffectChainItem & { id: string; bypassed: boolean }) | undefined {
    return this._entries.find((e) => e.id === effectId);
  }

  add(item: EffectChainItem, index?: number): string {
    if (this._disposed) {
      throw new Error(
        '[waveform-playlist] EffectsChainController.add: chain is disposed — entries cannot be added'
      );
    }
    const id = 'effect-' + ++idCounter;
    const entry: ChainEntry = { ...item, params: { ...item.params }, id, bypassed: false };
    const at =
      index === undefined
        ? this._entries.length
        : Math.max(0, Math.min(index, this._entries.length));
    this._entries = [...this._entries.slice(0, at), entry, ...this._entries.slice(at)];
    this._rebuild();
    return id;
  }

  remove(effectId: string): void {
    const entry = this._find('remove', effectId);
    if (!entry) return;
    this._entries = this._entries.filter((e) => e.id !== effectId);
    entry.instance.output.disconnect();
    entry.instance.dispose?.();
    this._rebuild();
  }

  move(effectId: string, newIndex: number): void {
    const entry = this._find('move', effectId);
    if (!entry) return;
    const without = this._entries.filter((e) => e.id !== effectId);
    const at = Math.max(0, Math.min(newIndex, without.length));
    this._entries = [...without.slice(0, at), entry, ...without.slice(at)];
    this._rebuild();
  }

  setParams(effectId: string, params: Record<string, number>): void {
    const entry = this._find('setParams', effectId);
    if (!entry) return;
    entry.params = { ...entry.params, ...params };
    if (entry.bypassed && entry.wetParam && entry.wetParam in params) {
      // Store the new wet level but keep the audible wet at 0 while bypassed.
      const { [entry.wetParam]: _stored, ...rest } = params;
      if (Object.keys(rest).length > 0) {
        entry.instance.applyParams(rest);
      }
      return;
    }
    entry.instance.applyParams(params);
  }

  setBypassed(effectId: string, bypassed: boolean): void {
    const entry = this._find('setBypassed', effectId);
    if (!entry || entry.bypassed === bypassed) return;
    entry.bypassed = bypassed;

    if (entry.wetParam) {
      // Wet-style bypass: zero the wet level, restore the stored value later.
      const wet = bypassed ? 0 : (entry.params[entry.wetParam] ?? 0);
      entry.instance.applyParams({ [entry.wetParam]: wet });
      return;
    }
    // No wet param: take the entry out of the series, keep the instance alive.
    this._rebuild();
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._severOwnEdges();
    for (const entry of this._entries) {
      entry.instance.dispose?.();
    }
    this._entries = [];
    try {
      this._output.disconnect();
    } catch {
      // Output may already be detached by the consumer.
    }
  }

  private _find(op: string, effectId: string): ChainEntry | undefined {
    const entry = this._entries.find((e) => e.id === effectId);
    if (!entry) {
      console.warn(
        '[waveform-playlist] EffectsChainController.' + op + ': unknown effectId "' + effectId + '"'
      );
    }
    return entry;
  }

  /** Sever only this chain's outgoing edges — never the consumer's. */
  private _severOwnEdges(): void {
    this._input.disconnect();
    for (const entry of this._entries) {
      entry.instance.output.disconnect();
    }
  }

  private _rebuild(): void {
    this._severOwnEdges();
    let previous: AudioNode = this._input;
    for (const entry of this._entries) {
      if (entry.bypassed && !entry.wetParam) {
        continue;
      }
      previous.connect(entry.instance.input);
      previous = entry.instance.output;
    }
    previous.connect(this._output);
  }
}
