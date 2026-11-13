/**
 * The options that only affect how a view draws (#689): row height, bar
 * style, playhead width, and whether a multitrack timeline fills its
 * container. One home for them, read by the root of each view below.
 *
 * It is a context and not props of a root or a part because several
 * components draw with these values (the root lays the rows out, the channels
 * draw the bars, the playhead takes its width) and because one set of options
 * often serves several views: ten players on a page, each under its own
 * provider, are styled by one `<WaveformViewOptions>` above them all.
 */
import React, { createContext, use, useMemo, type ReactNode } from 'react';
import {
  DEFAULT_BAR_GAP,
  DEFAULT_BAR_WIDTH,
  DEFAULT_WAVE_HEIGHT,
} from '@waveform-playlist/ui-components';
import { warnOnce } from './partWarnings';

export interface WaveformViewOptionsValue {
  /** Height in pixels of one channel of a track. Default: 80 */
  waveHeight?: number;
  /** Width in pixels of a waveform bar. Default: 1 */
  barWidth?: number;
  /** Space in pixels between two bars. Default: 0 */
  barGap?: number;
  /** Draw bars with rounded caps (radius `barWidth / 2`). Default: false */
  roundedBars?: boolean;
  /** Width in pixels of the playhead line. Default: `barWidth + barGap` */
  progressBarWidth?: number;
  /**
   * Draw the timeline at least as wide as its scroll container when the audio
   * is shorter. `WaveformRoot` only: a MediaElement timeline is as long as
   * its audio. Default: false
   */
  fillViewport?: boolean;
}

export interface WaveformViewOptionsProps extends WaveformViewOptionsValue {
  children?: ReactNode;
}

const NO_OPTIONS: WaveformViewOptionsValue = {};

/** INTERNAL: what the nearest `<WaveformViewOptions>` says, inherited props included. */
const WaveformViewOptionsContext = createContext<WaveformViewOptionsValue>(NO_OPTIONS);

/**
 * Sets view options for every waveform root below it, under either provider.
 * It may sit above the provider, and above several.
 *
 * A prop that is left out is taken from the `<WaveformViewOptions>` above
 * (`??`, so `0` and `false` are values), and from the defaults when there is
 * none: nest one to change a single option for part of the tree. A nested one
 * cannot return an option to its default: write the value.
 *
 * It goes ABOVE a root. A root reads the options above itself, so one written
 * among a root's children does nothing for that root (and warns).
 */
export const WaveformViewOptions: React.FC<WaveformViewOptionsProps> = ({
  children,
  waveHeight: ownWaveHeight,
  barWidth: ownBarWidth,
  barGap: ownBarGap,
  roundedBars: ownRoundedBars,
  progressBarWidth: ownProgressBarWidth,
  fillViewport: ownFillViewport,
}) => {
  const above = use(WaveformViewOptionsContext);
  const waveHeight = ownWaveHeight ?? above.waveHeight;
  const barWidth = ownBarWidth ?? above.barWidth;
  const barGap = ownBarGap ?? above.barGap;
  const roundedBars = ownRoundedBars ?? above.roundedBars;
  const progressBarWidth = ownProgressBarWidth ?? above.progressBarWidth;
  const fillViewport = ownFillViewport ?? above.fillViewport;
  // Memoized on the six values: the component that renders this usually
  // holds the tracks and renders on every move of a trim.
  const value = useMemo<WaveformViewOptionsValue>(
    () => ({ waveHeight, barWidth, barGap, roundedBars, progressBarWidth, fillViewport }),
    [waveHeight, barWidth, barGap, roundedBars, progressBarWidth, fillViewport]
  );
  return <WaveformViewOptionsContext value={value}>{children}</WaveformViewOptionsContext>;
};

/** INTERNAL: every option with a value, as a root draws with them. */
export interface ResolvedViewOptions {
  waveHeight: number;
  barWidth: number;
  barGap: number;
  roundedBars: boolean;
  progressBarWidth: number;
  fillViewport: boolean;
}

const isPositive = (value: number) => value > 0;

/**
 * INTERNAL: the options a root draws with. Called by the two roots only; what
 * is drawn below a root reads the resolved values from ui-components'
 * `PlaylistInfoContext`, where the root publishes them once (memoized there).
 *
 * Values that cannot be drawn are replaced, with one development warning per
 * message: a row height or a bar width that is not above 0 becomes the
 * default, a gap that is no number becomes the default, a gap that would put
 * the next bar less than one pixel on is raised until the step is one pixel,
 * and a playhead width that is not above 0 becomes the bar and its gap.
 */
export function useResolvedViewOptions(): ResolvedViewOptions {
  const options = use(WaveformViewOptionsContext);
  let waveHeight = options.waveHeight ?? DEFAULT_WAVE_HEIGHT;
  let barWidth = options.barWidth ?? DEFAULT_BAR_WIDTH;
  let barGap = options.barGap ?? DEFAULT_BAR_GAP;
  const roundedBars = options.roundedBars ?? false;
  const fillViewport = options.fillViewport ?? false;

  if (!isPositive(waveHeight)) {
    warnOnce(
      `<WaveformViewOptions waveHeight> must be a positive number of pixels: ${String(waveHeight)} ` +
        `is replaced by ${DEFAULT_WAVE_HEIGHT}.`
    );
    waveHeight = DEFAULT_WAVE_HEIGHT;
  }
  if (!isPositive(barWidth)) {
    warnOnce(
      `<WaveformViewOptions barWidth> must be a positive number of pixels: ${String(barWidth)} ` +
        `is replaced by ${DEFAULT_BAR_WIDTH}.`
    );
    barWidth = DEFAULT_BAR_WIDTH;
  }
  if (Number.isNaN(barGap)) {
    warnOnce(
      `<WaveformViewOptions barGap> must be a number of pixels: ${String(barGap)} is replaced by ` +
        `${DEFAULT_BAR_GAP}.`
    );
    barGap = DEFAULT_BAR_GAP;
  }
  if (!(barWidth + barGap >= 1)) {
    const raised = 1 - barWidth;
    warnOnce(
      `<WaveformViewOptions barGap> of ${String(barGap)} with a bar ${barWidth} px wide puts the ` +
        `next bar less than one pixel on, which cannot be drawn: the gap is ${raised}.`
    );
    barGap = raised;
  }
  // As wide as a bar and its gap unless a width is given.
  let progressBarWidth = options.progressBarWidth ?? barWidth + barGap;
  if (!isPositive(progressBarWidth)) {
    warnOnce(
      `<WaveformViewOptions progressBarWidth> must be a positive number of pixels: ` +
        `${String(progressBarWidth)} is replaced by the bar and its gap, ${barWidth + barGap}. ` +
        'Leave <WaveformPlayhead> out to draw no playhead.'
    );
    progressBarWidth = barWidth + barGap;
  }

  // A new object on every call: the roots read its fields, and the frame
  // memoizes what it publishes on those values, so nothing follows its identity.
  return { waveHeight, barWidth, barGap, roundedBars, progressBarWidth, fillViewport };
}
