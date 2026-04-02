export interface MeterEntry {
  tick: number;
  numerator: number;
  denominator: number;
}

/**
 * Scans a beat number sequence and detects meter (time signature) changes.
 *
 * Each beat in the input has a `beat` number (1-indexed). When the beat resets
 * to 1, we count how many beats were in the previous bar and derive the numerator.
 *
 * @param beats - Array of beat events with `time` (seconds) and `beat` (1-indexed number).
 * @param firstBeatTick - The tick position of beats[0] on the timeline.
 * @param ppqn - Ticks per quarter note (ticks per beat).
 * @returns Array of MeterEntry sorted by tick. Always includes an entry at tick 0.
 */
export function detectMeterChanges(
  beats: { time: number; beat: number }[],
  firstBeatTick: number,
  ppqn: number
): MeterEntry[] {
  const DEFAULT_NUMERATOR = 4;
  const DENOMINATOR = 4;

  const defaultResult: MeterEntry[] = [
    { tick: 0, numerator: DEFAULT_NUMERATOR, denominator: DENOMINATOR },
  ];

  if (beats.length === 0) {
    return defaultResult;
  }

  // Find the index of the first downbeat (beat === 1)
  const firstDownbeatIndex = beats.findIndex((b) => b.beat === 1);

  if (firstDownbeatIndex === -1) {
    // No downbeat found — default to 4/4
    return defaultResult;
  }

  // Collect completed bars: for each bar, record its start beat index and beat count
  const bars: { beatIndex: number; count: number }[] = [];
  let barStartBeatIndex = firstDownbeatIndex;

  for (let i = firstDownbeatIndex + 1; i < beats.length; i++) {
    if (beats[i].beat === 1) {
      bars.push({ beatIndex: barStartBeatIndex, count: i - barStartBeatIndex });
      barStartBeatIndex = i;
    }
  }

  if (bars.length === 0) {
    // Only one downbeat observed — can't determine meter
    return defaultResult;
  }

  // Build raw meter entries: emit a new entry only when numerator changes
  const rawEntries: MeterEntry[] = [];
  let prevNumerator = -1;

  for (const bar of bars) {
    const numerator = bar.count;
    if (numerator !== prevNumerator) {
      const tick = firstBeatTick + bar.beatIndex * ppqn;
      rawEntries.push({ tick, numerator, denominator: DENOMINATOR });
      prevNumerator = numerator;
    }
  }

  // Ensure tick 0 is always present
  if (rawEntries.length === 0) {
    return defaultResult;
  }

  if (rawEntries[0].tick === 0) {
    return rawEntries;
  }

  // First entry is after tick 0 — prepend tick 0 with the same numerator
  const tick0Entry: MeterEntry = {
    tick: 0,
    numerator: rawEntries[0].numerator,
    denominator: DENOMINATOR,
  };

  // If the first raw entry has the same numerator as tick 0, we don't need it as a
  // separate entry (they'd be adjacent duplicates). Drop the first raw entry and use
  // the tick-0 entry to represent it.
  const rest = rawEntries[0].numerator === tick0Entry.numerator ? rawEntries.slice(1) : rawEntries;

  return [tick0Entry, ...rest];
}
