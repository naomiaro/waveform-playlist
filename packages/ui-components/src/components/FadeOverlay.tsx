import React, { FunctionComponent } from 'react';
import styled, { useTheme } from 'styled-components';
import type { FadeType } from '@waveform-playlist/core';
import type { WaveformPlaylistTheme } from '../wfpl-theme';

interface FadeContainerProps {
  readonly $left: number;
  readonly $width: number;
  readonly $type: 'fadeIn' | 'fadeOut';
}

// Use .attrs() for left/width to avoid generating new CSS classes on every render
const FadeContainer = styled.div.attrs<FadeContainerProps>((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`,
  },
}))<FadeContainerProps>`
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 50;
`;

interface FadeSvgProps {
  readonly $type: 'fadeIn' | 'fadeOut';
}

const FadeSvg = styled.svg<FadeSvgProps>`
  width: 100%;
  height: 100%;
  display: block;
  /* Flip horizontally for fadeOut - makes it mirror of fadeIn */
  transform: ${props => props.$type === 'fadeOut' ? 'scaleX(-1)' : 'none'};
`;

export interface FadeOverlayProps {
  /** Position in pixels from the start of the clip */
  left: number;
  /** Width of the fade region in pixels */
  width: number;
  /** Type of fade: fadeIn or fadeOut */
  type: 'fadeIn' | 'fadeOut';
  /** Fade curve type */
  curveType?: FadeType;
  /** Custom fill color (defaults to theme.fadeOverlayColor) */
  color?: string;
}

/**
 * Generates an SVG path for a fade in curve
 * Always generates fadeIn shape - fadeOut is achieved by CSS transform scaleX(-1)
 *
 * The curve shows: more overlay at start (audio quiet), less overlay at end (audio full)
 */
function generateFadePath(
  width: number,
  height: number,
  curveType: FadeType = 'logarithmic'
): string {
  const points: string[] = [];
  const numPoints = Math.max(20, Math.min(width, 100)); // More points for smoother curves

  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * width;
    const progress = i / numPoints; // 0 to 1

    // Apply curve transformation based on type
    let curvedProgress: number;
    switch (curveType) {
      case 'linear':
        curvedProgress = progress;
        break;
      case 'exponential':
        curvedProgress = progress * progress;
        break;
      case 'sCurve':
        // S-curve using sine
        curvedProgress = (1 - Math.cos(progress * Math.PI)) / 2;
        break;
      case 'logarithmic':
      default:
        // Logarithmic curve (more natural for audio)
        curvedProgress = Math.log10(1 + progress * 9) / Math.log10(10);
        break;
    }

    // fadeIn: starts covered (y near 0), ends uncovered (y near height)
    // Y=0 is top of SVG, Y=height is bottom
    // We draw the curve edge, then fill above it
    const y = (1 - curvedProgress) * height;
    points.push(`${x},${y}`);
  }

  // Path: start at bottom-left, draw curve, go to top-right, top-left, close
  return `M 0,${height} L ${points.join(' L ')} L ${width},0 L 0,0 Z`;
}

/**
 * FadeOverlay component - Visual indicator for fade in/out regions on clips
 *
 * Renders a semi-transparent overlay with a curved shape indicating
 * the fade envelope. The shape follows the selected fade curve type.
 */
export const FadeOverlay: FunctionComponent<FadeOverlayProps> = ({
  left,
  width,
  type,
  curveType = 'logarithmic',
  color,
}) => {
  const theme = useTheme() as WaveformPlaylistTheme;

  // Don't render if width is too small
  if (width < 1) return null;

  // Use color prop, then theme color, then fallback
  const fillColor = color || theme?.fadeOverlayColor || 'rgba(0, 0, 0, 0.4)';

  return (
    <FadeContainer $left={left} $width={width} $type={type}>
      <FadeSvg $type={type} viewBox={`0 0 ${width} 100`} preserveAspectRatio="none">
        <path
          d={generateFadePath(width, 100, curveType)}
          fill={fillColor}
        />
      </FadeSvg>
    </FadeContainer>
  );
};
