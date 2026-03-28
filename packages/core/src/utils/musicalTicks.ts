import { ticksPerBeat, ticksPerBar, ticksToBarBeatLabel } from './beatsAndBars';

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
export function snapToTicks(snapTo: SnapTo, timeSignature: [number, number], ppqn = 960): number {
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
 * Three-tier tick hierarchy (following Audacity's model):
 *   major      — Bar boundaries. Always labeled, strongest grid lines.
 *   minor      — Beat boundaries. Labeled when wide enough, medium grid lines.
 *   minorMinor — Subdivisions (eighths, sixteenths). Never labeled, ruler ticks only (no grid).
 */
export type TickType = 'major' | 'minor' | 'minorMinor';

/** Zoom level category used to select which subdivision to iterate at. */
export type ZoomLevel = 'coarse' | 'bar' | 'beat' | 'eighth' | 'sixteenth';

/** A single musical tick with rendering metadata. */
export interface MusicalTick {
  /** Pixel position of the tick in the timeline. */
  pixel: number;
  /** Three-tier type: major (bar), minor (beat), minorMinor (subdivision). */
  type: TickType;
  /** Human-readable label. Present for major ticks always; minor ticks when zoomed in. */
  label?: string;
  /** 0-based global bar index (for alternating bar-level striping). */
  barIndex: number;
}

/** Result of computeMusicalTicks(). */
export interface MusicalTickData {
  ticks: MusicalTick[];
  pixelsPerBar: number;
  pixelsPerBeat: number;
  zoomLevel: ZoomLevel;
  /** At 'coarse' zoom: how many bars between rendered tick lines. */
  coarseBarStep?: number;
}

/** Parameters for computeMusicalTicks(). */
export interface MusicalTickParams {
  timeSignature: [number, number];
  /** Ticks per pixel (zoom level — lower value = more zoomed in). */
  ticksPerPixel: number;
  startPixel: number;
  endPixel: number;
  /** Pulses per quarter note. Defaults to 960. */
  ppqn?: number;
}

/** Minimum pixels per musical unit before switching to a coarser zoom level. */
export const MIN_PIXELS_PER_UNIT = 8;

/** Minimum pixels between beat labels for readable text. */
const MIN_PIXELS_PER_LABEL = 60;

/**
 * Determines the zoom level and computes which tick lines to render for a
 * given viewport. Pure tick arithmetic — no BPM or sample rate required.
 */
export function computeMusicalTicks(params: MusicalTickParams): MusicalTickData {
  const { timeSignature, ticksPerPixel, startPixel, endPixel, ppqn = 960 } = params;

  // Guard against invalid inputs that would cause division by zero or infinite loops
  if (ticksPerPixel <= 0 || ppqn <= 0 || timeSignature[1] <= 0) {
    return { ticks: [], pixelsPerBar: 0, pixelsPerBeat: 0, zoomLevel: 'coarse' };
  }

  const tpBeat = ticksPerBeat(timeSignature, ppqn);
  const tpBar = ticksPerBar(timeSignature, ppqn);
  const tpEighth = ppqn / 2;
  const tpSixteenth = ppqn / 4;

  const pixelsPerBar = tpBar / ticksPerPixel;
  const pixelsPerBeat = tpBeat / ticksPerPixel;
  const pixelsPerEighth = tpEighth / ticksPerPixel;
  const pixelsPerSixteenth = tpSixteenth / ticksPerPixel;

  // Determine zoom level based on pixel density thresholds.
  let zoomLevel: ZoomLevel;
  if (pixelsPerBar < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'coarse';
  } else if (pixelsPerBeat < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'bar';
  } else if (pixelsPerEighth < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'beat';
  } else if (pixelsPerSixteenth < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'eighth';
  } else {
    zoomLevel = 'sixteenth';
  }

  // Determine step size in ticks and coarse bar step when zoomed far out.
  let stepTicks: number;
  let coarseBarStep: number | undefined;

  if (zoomLevel === 'coarse') {
    // Choose the smallest power-of-2 multiple of tpBar that gives ≥8px.
    let multiplier = 2;
    while ((tpBar * multiplier) / ticksPerPixel < MIN_PIXELS_PER_UNIT) {
      multiplier *= 2;
    }
    stepTicks = tpBar * multiplier;
    coarseBarStep = multiplier;
  } else if (zoomLevel === 'bar') {
    stepTicks = tpBar;
  } else if (zoomLevel === 'beat') {
    stepTicks = tpBeat;
  } else if (zoomLevel === 'eighth') {
    stepTicks = tpEighth;
  } else {
    stepTicks = tpSixteenth;
  }

  // Convert pixel viewport to tick range, align start to step boundary.
  const startTick = startPixel * ticksPerPixel;
  const endTick = endPixel * ticksPerPixel;
  const firstStep = Math.floor(startTick / stepTicks) * stepTicks;

  const ticks: MusicalTick[] = [];

  for (let tick = firstStep; tick <= endTick; tick += stepTicks) {
    const pixel = tick / ticksPerPixel;

    if (pixel < startPixel || pixel > endPixel) {
      continue;
    }

    // Classify into three-tier hierarchy (Audacity model):
    //   major      = bar boundary
    //   minor      = beat boundary
    //   minorMinor = subdivision (eighth, sixteenth)
    let type: TickType;
    if (tick % tpBar === 0) {
      type = 'major';
    } else if (tick % tpBeat === 0) {
      type = 'minor';
    } else {
      type = 'minorMinor';
    }

    // Bar index for alternating bar-level zebra stripes
    const barIndex = Math.floor(tick / tpBar);

    // Labels: major always, minor only when wide enough, minorMinor never
    let label: string | undefined;
    if (type === 'major') {
      label = ticksToBarBeatLabel(tick, timeSignature, ppqn);
    } else if (type === 'minor' && pixelsPerBeat >= MIN_PIXELS_PER_LABEL) {
      label = ticksToBarBeatLabel(tick, timeSignature, ppqn);
    }

    ticks.push({ pixel, type, barIndex, ...(label !== undefined ? { label } : {}) });
  }

  const result: MusicalTickData = {
    ticks,
    pixelsPerBar,
    pixelsPerBeat,
    zoomLevel,
    ...(coarseBarStep !== undefined ? { coarseBarStep } : {}),
  };

  return result;
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
  if (gridSize <= 0) return tick;
  return Math.round(tick / gridSize) * gridSize;
}
