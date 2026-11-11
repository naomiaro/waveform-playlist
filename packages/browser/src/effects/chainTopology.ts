/** The fields of a chain entry that decide how it is bypassed. */
export interface BypassShape {
  bypassed: boolean;
  /** Name of the entry's wet/dry parameter, when it has one. */
  wetParam?: string;
}

/**
 * Whether a bypassed entry is taken out of the chain. An effect with a wet
 * parameter is bypassed in place (wet set to 0); one without (a WAM plugin, a
 * compressor, a custom effect that declares no `wetParam`) has nothing to
 * turn down, so it is disconnected.
 */
export function isDisconnectBypassed(effect: BypassShape): boolean {
  return effect.bypassed && effect.wetParam === undefined;
}

/**
 * What the wiring of an effects chain depends on: which instances are in it
 * and in what order. An entry bypassed by disconnection is left out of the
 * chain, so it is left out of the key too. Parameter values and an in-place
 * bypass (wet set to 0) are not wiring, and a change to them must not
 * disconnect and reconnect a chain that is playing.
 */
export function chainTopologyKey(
  effects: ReadonlyArray<BypassShape & { instanceId: string }>
): string {
  return effects
    .filter((effect) => !isDisconnectBypassed(effect))
    .map((effect) => effect.instanceId)
    .join('|');
}
