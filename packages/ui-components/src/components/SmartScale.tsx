import React, { FunctionComponent, useContext, useMemo, type ReactNode } from 'react';
import styled from 'styled-components';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { useBeatsAndBars } from '../contexts/BeatsAndBars';
import { StyledTimeScale } from './TimeScale';
import type { PrecomputedTickData } from './TimeScale';
import {
  PPQN,
  ticksToSamples,
  ticksPerBeat,
  ticksPerBar,
  samplesToPixels,
  secondsToPixels,
} from '@waveform-playlist/core';

/** Format ticks as a 1-indexed bar.beat label. Beat 1 shows bar number only (e.g., "3" not "3.1"). */
function ticksToBarBeatLabel(ticks: number, timeSignature: [number, number], ppqn = PPQN): string {
  const barTicks = ticksPerBar(timeSignature, ppqn);
  const beatTicks = ticksPerBeat(timeSignature, ppqn);
  const bar = Math.floor(ticks / barTicks) + 1;
  const beatInBar = Math.floor((ticks % barTicks) / beatTicks) + 1;
  if (beatInBar === 1) return `${bar}`;
  return `${bar}.${beatInBar}`;
}

export interface SmartScaleProps {
  readonly renderTick?: (label: string, pixelPosition: number) => ReactNode;
}

const timeinfo = new Map([
  [700, { marker: 1000, bigStep: 500, smallStep: 100 }],
  [1500, { marker: 2000, bigStep: 1000, smallStep: 200 }],
  [2500, { marker: 2000, bigStep: 1000, smallStep: 500 }],
  [5000, { marker: 5000, bigStep: 1000, smallStep: 500 }],
  [10000, { marker: 10000, bigStep: 5000, smallStep: 1000 }],
  [12000, { marker: 15000, bigStep: 5000, smallStep: 1000 }],
  [Infinity, { marker: 30000, bigStep: 10000, smallStep: 5000 }],
]);

export function getScaleInfo(samplesPerPixel: number) {
  const keys = timeinfo.keys();
  let config;

  for (const resolution of keys) {
    if (samplesPerPixel < resolution) {
      config = timeinfo.get(resolution);
      break;
    }
  }

  if (config === undefined) {
    config = { marker: 30000, bigStep: 10000, smallStep: 5000 };
  }
  return config;
}

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const s = seconds % 60;
  const m = (seconds - s) / 60;

  return `${m}:${String(s).padStart(2, '0')}`;
}

interface TimeStampProps {
  readonly $left: number;
}
const TimeStamp = styled.div.attrs<TimeStampProps>((props) => ({
  style: {
    left: `${props.$left + 4}px`, // Offset 4px to the right of the tick
  },
}))<TimeStampProps>`
  position: absolute;
  font-size: 0.75rem; /* Smaller font to prevent overflow */
  white-space: nowrap; /* Prevent text wrapping */
  color: ${(props) => props.theme.timeColor}; /* Use theme color instead of inheriting */
`;

export const SmartScale: FunctionComponent<SmartScaleProps> = ({ renderTick }) => {
  const { samplesPerPixel, sampleRate, duration, timeScaleHeight } =
    useContext(PlaylistInfoContext);
  const beatsAndBars = useBeatsAndBars();

  // Pre-compute tick data for beats & bars mode using integer PPQN math.
  // This avoids millisecond-based modular arithmetic which breaks
  // with non-integer beat durations (e.g., 119 BPM → 504.20ms per beat).
  const tickData = useMemo<PrecomputedTickData>(() => {
    const widthX = secondsToPixels(duration / 1000, samplesPerPixel, sampleRate);

    if (beatsAndBars && beatsAndBars.scaleMode === 'beats') {
      const { bpm, timeSignature, ticksPerBar: tpBar, ticksPerBeat: tpBeat } = beatsAndBars;
      const canvasInfo = new Map<number, number>();
      const timeMarkersWithPositions: Array<{ pix: number; element: React.ReactNode }> = [];

      // Total duration in PPQN ticks
      const durationSeconds = duration / 1000;
      const totalTicks = Math.ceil((durationSeconds * bpm * PPQN) / 60);

      // Compute pixel spacing to determine tick density at this zoom level.
      // We pick the finest granularity that keeps ticks >= MIN_TICK_PX apart.
      const pixelsPerBeat = ticksToSamples(tpBeat, bpm, sampleRate) / samplesPerPixel;
      const pixelsPerBar = ticksToSamples(tpBar, bpm, sampleRate) / samplesPerPixel;

      const MIN_TICK_PX = 10; // Minimum pixels between tick marks
      const MIN_LABEL_PX = 30; // Minimum pixels between labels

      // Find the tick step: beat, bar, or N bars
      let tickStep: number;
      if (pixelsPerBeat >= MIN_TICK_PX) {
        tickStep = tpBeat;
      } else if (pixelsPerBar >= MIN_TICK_PX) {
        tickStep = tpBar;
      } else {
        // Skip bars: find smallest multiplier that gives >= MIN_TICK_PX
        const barsPerTick = Math.ceil(MIN_TICK_PX / pixelsPerBar);
        tickStep = tpBar * barsPerTick;
      }

      // Find the label step: beat, bar, or N bars
      let labelStep: number;
      if (pixelsPerBeat >= MIN_LABEL_PX) {
        labelStep = tpBeat;
      } else if (pixelsPerBar >= MIN_LABEL_PX) {
        labelStep = tpBar;
      } else {
        const barsPerLabel = Math.ceil(MIN_LABEL_PX / pixelsPerBar);
        labelStep = tpBar * barsPerLabel;
      }

      for (let tick = 0; tick <= totalTicks; tick += tickStep) {
        const samples = ticksToSamples(tick, bpm, sampleRate);
        const pix = samplesToPixels(samples, samplesPerPixel);
        if (pix >= widthX) break;

        const isBarLine = tick % tpBar === 0;
        const isLabelTick = tick % labelStep === 0;

        // Tick height: bar lines full, labeled ticks half, unlabeled ticks 1/5
        const tickHeight = isBarLine
          ? timeScaleHeight
          : isLabelTick
            ? Math.floor(timeScaleHeight / 2)
            : Math.floor(timeScaleHeight / 5);
        canvasInfo.set(pix, tickHeight);

        if (isLabelTick) {
          const label = ticksToBarBeatLabel(tick, timeSignature);
          const element = renderTick ? (
            <React.Fragment key={`bb-${tick}`}>{renderTick(label, pix)}</React.Fragment>
          ) : (
            <div
              key={`bb-${tick}`}
              style={{
                position: 'absolute',
                left: `${pix + 4}px`,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </div>
          );
          timeMarkersWithPositions.push({ pix, element });
        }
      }

      return { widthX, canvasInfo, timeMarkersWithPositions };
    }

    // Temporal mode — iterate using timeinfo-based millisecond steps,
    // converting to pixel positions for the tick renderer.
    const config = getScaleInfo(samplesPerPixel);
    const { marker, bigStep, smallStep } = config;
    const canvasInfo = new Map<number, number>();
    const timeMarkersWithPositions: Array<{ pix: number; element: React.ReactNode }> = [];
    const pixPerSec = sampleRate / samplesPerPixel;

    let counter = 0;
    for (let i = 0; i < widthX; i += (pixPerSec * smallStep) / 1000) {
      const pix = Math.floor(i);

      if (counter % marker === 0) {
        const timestamp = formatTime(counter);

        const element = renderTick ? (
          <React.Fragment key={`timestamp-${counter}`}>{renderTick(timestamp, pix)}</React.Fragment>
        ) : (
          <TimeStamp key={timestamp} $left={pix}>
            {timestamp}
          </TimeStamp>
        );

        timeMarkersWithPositions.push({ pix, element });
        canvasInfo.set(pix, timeScaleHeight);
      } else if (counter % bigStep === 0) {
        canvasInfo.set(pix, Math.floor(timeScaleHeight / 2));
      } else if (counter % smallStep === 0) {
        canvasInfo.set(pix, Math.floor(timeScaleHeight / 5));
      }

      counter += smallStep;
    }

    return { widthX, canvasInfo, timeMarkersWithPositions };
  }, [beatsAndBars, duration, samplesPerPixel, sampleRate, timeScaleHeight, renderTick]);

  return <StyledTimeScale tickData={tickData} />;
};
