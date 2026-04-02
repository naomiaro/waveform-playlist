import { ticksPerBeat, ticksPerBar } from './beatsAndBars';
import type { MeterEntry } from './meterDetection';

export type { MeterEntry } from './meterDetection';

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
 * value.  'bar' and 'beat' depend on the first meter entry's time signature.
 * 'off' returns 0.
 */
export function snapToTicks(snapTo: SnapTo, timeSignature: [number, number], ppqn = 960): number {
  const ts = timeSignature;
  switch (snapTo) {
    case 'bar':
      return ticksPerBar(ts, ppqn);
    case 'beat':
      return ticksPerBeat(ts, ppqn);
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
  pixelsPerQuarterNote: number;
  zoomLevel: ZoomLevel;
  /** At 'coarse' zoom: how many quarter notes between rendered tick lines. */
  coarseQuarterNoteStep?: number;
}

/** Parameters for computeMusicalTicks(). */
export interface MusicalTickParams {
  meterEntries: MeterEntry[];
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
 *
 * Walks meter entries in segments, so bar/beat boundaries and labels are
 * correct across meter changes.
 */
export function computeMusicalTicks(params: MusicalTickParams): MusicalTickData {
  const { meterEntries, ticksPerPixel, startPixel, endPixel, ppqn = 960 } = params;

  const firstMeter = meterEntries[0] ?? { tick: 0, numerator: 4, denominator: 4 };

  // Guard against invalid inputs that would cause division by zero or infinite loops
  if (ticksPerPixel <= 0 || ppqn <= 0 || firstMeter.denominator <= 0) {
    return { ticks: [], pixelsPerQuarterNote: 0, zoomLevel: 'coarse' };
  }

  // pixelsPerQuarterNote is constant across meters — only depends on ppqn and zoom
  const pixelsPerQuarterNote = ppqn / ticksPerPixel;

  // All zoom thresholds derived from pixelsPerQuarterNote (meter-independent).
  // Quarter note subdivisions: half = 2×, eighth = 0.5×, sixteenth = 0.25×.
  // "Bar" threshold uses 4× quarter note (a 4/4 bar) — conservative minimum.
  const tpEighth = ppqn / 2;
  const tpSixteenth = ppqn / 4;
  const pixelsPerEighth = tpEighth / ticksPerPixel;
  const pixelsPerSixteenth = tpSixteenth / ticksPerPixel;

  let zoomLevel: ZoomLevel;
  if (pixelsPerQuarterNote * 4 < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'coarse';
  } else if (pixelsPerQuarterNote < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'bar';
  } else if (pixelsPerEighth < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'beat';
  } else if (pixelsPerSixteenth < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'eighth';
  } else {
    zoomLevel = 'sixteenth';
  }

  // Coarse step in quarter notes — meter-independent so all segments
  // render at the same visual density regardless of time signature.
  let coarseQuarterNoteStep: number | undefined;
  let coarseQuarterNotes = 0;
  if (zoomLevel === 'coarse') {
    coarseQuarterNotes = 2;
    while ((coarseQuarterNotes * ppqn) / ticksPerPixel < MIN_PIXELS_PER_UNIT) {
      coarseQuarterNotes *= 2;
    }
    coarseQuarterNoteStep = coarseQuarterNotes;
  }

  const startTick = startPixel * ticksPerPixel;
  const endTick = endPixel * ticksPerPixel;

  // Build the list of meter segments: [start, end) in ticks, with per-segment bar offset
  const segments: Array<{
    segmentStartTick: number;
    segmentEndTick: number;
    meter: MeterEntry;
    barOffset: number; // cumulative bar count before this segment
  }> = [];

  {
    let cumulativeBars = 0;
    for (let i = 0; i < meterEntries.length; i++) {
      const meter = meterEntries[i];
      const segmentStart = meter.tick;
      const segmentEnd =
        i + 1 < meterEntries.length ? meterEntries[i + 1].tick : Number.MAX_SAFE_INTEGER;

      const ts: [number, number] = [meter.numerator, meter.denominator];
      const tpBar = ticksPerBar(ts, ppqn);

      segments.push({
        segmentStartTick: segmentStart,
        segmentEndTick: segmentEnd,
        meter,
        barOffset: cumulativeBars,
      });

      // Count how many whole bars fit in this segment (for finite segments)
      if (segmentEnd !== Number.MAX_SAFE_INTEGER) {
        const segmentLen = segmentEnd - segmentStart;
        cumulativeBars += Math.floor(segmentLen / tpBar);
      }
    }
  }

  const ticks: MusicalTick[] = [];

  // Walk each meter segment and emit ticks within the visible range
  for (const { segmentStartTick, segmentEndTick, meter, barOffset } of segments) {
    const ts: [number, number] = [meter.numerator, meter.denominator];
    const tpBeat = ticksPerBeat(ts, ppqn);
    const tpBar = ticksPerBar(ts, ppqn);

    // Determine step size for this segment
    let stepTicks: number;
    if (zoomLevel === 'coarse') {
      stepTicks = coarseQuarterNotes * ppqn;
    } else if (zoomLevel === 'bar') {
      stepTicks = tpBar;
    } else if (zoomLevel === 'beat') {
      stepTicks = tpBeat;
    } else if (zoomLevel === 'eighth') {
      stepTicks = tpEighth;
    } else {
      stepTicks = tpSixteenth;
    }

    // Find first step within this segment that is >= startTick
    // Steps are aligned to segmentStartTick
    const segmentTickStart = Math.max(segmentStartTick, startTick);
    const segmentTickEnd = Math.min(segmentEndTick - 1, endTick);

    if (segmentTickStart > segmentTickEnd) {
      continue;
    }

    // First step: align to step boundary relative to segment start
    const offsetIntoSegment = segmentTickStart - segmentStartTick;
    const firstStepOffset = Math.floor(offsetIntoSegment / stepTicks) * stepTicks;
    const firstStepTick = segmentStartTick + firstStepOffset;

    for (
      let tick = firstStepTick;
      tick <= segmentTickEnd && tick < segmentEndTick;
      tick += stepTicks
    ) {
      const pixel = tick / ticksPerPixel;

      if (pixel < startPixel || pixel > endPixel) {
        continue;
      }

      // Classify into three-tier hierarchy
      const tickOffsetInSegment = tick - segmentStartTick;
      let type: TickType;
      if (tickOffsetInSegment % tpBar === 0) {
        type = 'major';
      } else if (tickOffsetInSegment % tpBeat === 0) {
        type = 'minor';
      } else {
        type = 'minorMinor';
      }

      // Cumulative bar index for zebra striping
      const barIndexInSegment = Math.floor(tickOffsetInSegment / tpBar);
      const barIndex = barOffset + barIndexInSegment;

      // Labels: major always, minor only when wide enough, minorMinor never
      let label: string | undefined;
      if (type === 'major') {
        label = `${barIndex + 1}`;
      } else if (type === 'minor' && tpBeat / ticksPerPixel >= MIN_PIXELS_PER_LABEL) {
        const beatInBar = Math.floor((tickOffsetInSegment % tpBar) / tpBeat) + 1;
        label = `${barIndex + 1}.${beatInBar}`;
      }

      ticks.push({ pixel, type, barIndex, ...(label !== undefined ? { label } : {}) });
    }
  }

  // Sort by pixel (segments are ordered, but floating point steps may cause slight reordering)
  ticks.sort((a, b) => a.pixel - b.pixel);

  const result: MusicalTickData = {
    ticks,
    pixelsPerQuarterNote,
    zoomLevel,
    ...(coarseQuarterNoteStep !== undefined ? { coarseQuarterNoteStep } : {}),
  };

  return result;
}

/**
 * Snaps a tick position to the nearest grid boundary defined by `snapTo`.
 *
 * Finds the meter entry active at the tick position and snaps relative to
 * that meter's segment start.
 *
 * Returns the original tick unchanged when `snapTo` is 'off'.
 */
export function snapTickToGrid(
  tick: number,
  snapTo: SnapTo,
  meterEntries: MeterEntry[],
  ppqn = 960
): number {
  if (snapTo === 'off') return tick;

  // Find the active meter entry for this tick
  let meter = meterEntries[0] ?? { tick: 0, numerator: 4, denominator: 4 };
  for (const entry of meterEntries) {
    if (entry.tick <= tick) {
      meter = entry;
    } else {
      break;
    }
  }

  const ts: [number, number] = [meter.numerator, meter.denominator];
  const gridSize = snapToTicks(snapTo, ts, ppqn);
  if (gridSize <= 0) return tick;

  // Snap relative to the meter's start tick
  const offset = tick - meter.tick;
  return meter.tick + Math.round(offset / gridSize) * gridSize;
}
