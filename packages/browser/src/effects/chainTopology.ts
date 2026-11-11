/**
 * What the wiring of an effects chain depends on: which instances are in it
 * and in what order. A bypassed WAM entry is left out of the chain (it has no
 * wet parameter), so it is left out of the key too. Parameter values and the
 * bypass of a native effect (its wet set to 0) are not wiring, and a change to
 * them must not disconnect and reconnect a chain that is playing.
 */
export function chainTopologyKey(
  effects: ReadonlyArray<{ instanceId: string; kind?: string; bypassed: boolean }>
): string {
  return effects
    .filter((effect) => !(effect.kind === 'wam' && effect.bypassed))
    .map((effect) => effect.instanceId)
    .join('|');
}
