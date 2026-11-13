import React, { createContext, use, useMemo } from 'react';
import { ticksPerBeat, ticksPerBar } from '@waveform-playlist/core';

/** The grid a drag snaps to under `BeatsAndBarsProvider`. (Core's `SnapTo` is
 *  the longer list of grid values the web components take.) */
export type BeatsAndBarsSnapTo = 'bar' | 'beat' | 'off';
export type ScaleMode = 'beats' | 'temporal';

export interface BeatsAndBarsContextValue {
  bpm: number;
  timeSignature: [number, number];
  snapTo: BeatsAndBarsSnapTo;
  scaleMode: ScaleMode;
  ticksPerBeat: number;
  ticksPerBar: number;
}

export interface BeatsAndBarsProviderProps {
  bpm: number;
  timeSignature: [number, number];
  snapTo: BeatsAndBarsSnapTo;
  /** Which timescale to render. Defaults to `'beats'`. Set to `'temporal'` to
   *  show minutes:seconds while keeping snap-to-grid active. */
  scaleMode?: ScaleMode;
  children: React.ReactNode;
}

const BeatsAndBarsContext = createContext<BeatsAndBarsContextValue | null>(null);

export function BeatsAndBarsProvider({
  bpm,
  timeSignature,
  snapTo,
  scaleMode = 'beats',
  children,
}: BeatsAndBarsProviderProps) {
  const [numerator, denominator] = timeSignature;
  const value = useMemo<BeatsAndBarsContextValue>(() => {
    const ts: [number, number] = [numerator, denominator];
    const tpBeat = ticksPerBeat(ts);
    const tpBar = ticksPerBar(ts);
    return {
      bpm,
      timeSignature: ts,
      snapTo,
      scaleMode,
      ticksPerBeat: tpBeat,
      ticksPerBar: tpBar,
    };
  }, [bpm, numerator, denominator, snapTo, scaleMode]);

  return <BeatsAndBarsContext value={value}>{children}</BeatsAndBarsContext>;
}

export function useBeatsAndBars(): BeatsAndBarsContextValue | null {
  return use(BeatsAndBarsContext);
}
