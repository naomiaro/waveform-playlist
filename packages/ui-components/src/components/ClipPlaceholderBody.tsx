import React, { FunctionComponent } from 'react';
import styled from 'styled-components';
import { useTheme } from '../contexts';
import {
  isWaveformGradient,
  waveformColorToCss,
  type WaveformColor,
  type WaveformPlaylistTheme,
} from '../wfpl-theme';

/** `Channel`'s own default for `waveFillColor`: used when the theme gives nothing usable. */
const FALLBACK_BODY_COLOR = 'grey';

/** A theme colour as CSS, or undefined when it is neither a string nor a whole gradient. */
function colorToCss(color: unknown): string | undefined {
  if (typeof color === 'string') return color === '' ? undefined : color;
  const gradient = color as WaveformColor;
  if (isWaveformGradient(gradient) && Array.isArray(gradient.stops)) {
    return waveformColorToCss(gradient);
  }
  return undefined;
}

/**
 * The colour a channel draws its bars in: `waveFillColor` (the selected one on
 * a selected track) in both draw modes. In 'inverted' it is the background the
 * bars are cut out of, in 'normal' the colour the canvas paints them with.
 */
function barColor(theme: Partial<WaveformPlaylistTheme> | undefined, isSelected: boolean): string {
  const selected = isSelected ? colorToCss(theme?.selectedWaveFillColor) : undefined;
  return selected ?? colorToCss(theme?.waveFillColor) ?? FALLBACK_BODY_COLOR;
}

interface BodyProps {
  readonly $color: string;
}

const Body = styled.div.attrs<BodyProps>((props) => ({
  style: { background: props.$color },
}))<BodyProps>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

export interface ClipPlaceholderBodyProps {
  /** The clip's track is selected: the selected bar colour. Default false. */
  isSelected?: boolean;
}

/**
 * The body of a placeholder clip that has no peaks to draw (its audio is
 * still loading and nothing gives its waveform): a box over the clip's whole
 * channel area, the clip's width and the height below its header, in the
 * colour of the waveform's bars, with nothing drawn in it. Rendered as a child
 * of `Clip` (with `isPlaceholder`), which dims it with the rest of the clip;
 * it sets no opacity itself. Carries `data-clip-placeholder-body="true"`.
 */
export const ClipPlaceholderBody: FunctionComponent<ClipPlaceholderBodyProps> = ({
  isSelected = false,
}) => {
  const theme = useTheme() as Partial<WaveformPlaylistTheme> | undefined;
  return <Body $color={barColor(theme, isSelected)} data-clip-placeholder-body="true" />;
};
