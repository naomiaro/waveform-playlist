import { ticksPerBeat, ticksPerBar } from './beatsAndBars';

/** All supported snap-to-grid values. */
export type SnapTo =
  | 'bar'
  | 'beat'
  | '1/2'
  | '1/4'
  | '1/8'
  | '1/16'
  | '1/32'
  | '1/2T'
  | '1/4T'
  | '1/8T'
  | '1/16T'
  | 'off';

/**
 * Returns the tick interval for the given SnapTo value.
 *
 * Straight subdivisions (1/2, 1/4, 1/8, 1/16, 1/32) are always expressed as
 * fractions of a quarter note (ppqn), independent of the time signature
 * denominator.  Triplet subdivisions use × 2/3 of the corresponding straight
 * value.  'bar' and 'beat' depend on the time signature.  'off' returns 0.
 */
export function snapToTicks(
  snapTo: SnapTo,
  timeSignature: [number, number],
  ppqn = 960
): number {
  switch (snapTo) {
    case 'bar':
      return ticksPerBar(timeSignature, ppqn);
    case 'beat':
      return ticksPerBeat(timeSignature, ppqn);
    case '1/2':
      return ppqn * 2;
    case '1/4':
      return ppqn;
    case '1/8':
      return ppqn / 2;
    case '1/16':
      return ppqn / 4;
    case '1/32':
      return ppqn / 8;
    case '1/2T':
      return Math.round((ppqn * 2 * 2) / 3);
    case '1/4T':
      return Math.round((ppqn * 2) / 3);
    case '1/8T':
      return Math.round((ppqn * 2) / 6);
    case '1/16T':
      return Math.round((ppqn * 2) / 12);
    case 'off':
      return 0;
  }
}

/**
 * Snaps a tick position to the nearest grid boundary defined by `snapTo`.
 *
 * Returns the original tick unchanged when `snapTo` is 'off'.
 */
export function snapTickToGrid(
  tick: number,
  snapTo: SnapTo,
  timeSignature: [number, number],
  ppqn = 960
): number {
  if (snapTo === 'off') return tick;
  const gridSize = snapToTicks(snapTo, timeSignature, ppqn);
  return Math.round(tick / gridSize) * gridSize;
}
