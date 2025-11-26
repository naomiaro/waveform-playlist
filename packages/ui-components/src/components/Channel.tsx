import React, { FunctionComponent, useLayoutEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Peaks, Bits } from '@waveform-playlist/webaudio-peaks';
import { WaveformColor, isWaveformGradient, waveformColorToCss } from '../wfpl-theme';

// Re-export WaveformColor for consumers
export type { WaveformColor } from '../wfpl-theme';

const MAX_CANVAS_WIDTH = 1000;

/**
 * Creates a Canvas gradient from a WaveformColor configuration
 */
function createCanvasFillStyle(
  ctx: CanvasRenderingContext2D,
  color: WaveformColor,
  width: number,
  height: number
): string | CanvasGradient {
  if (!isWaveformGradient(color)) {
    return color;
  }

  let gradient: CanvasGradient;
  if (color.direction === 'vertical') {
    gradient = ctx.createLinearGradient(0, 0, 0, height);
  } else {
    gradient = ctx.createLinearGradient(0, 0, width, 0);
  }

  for (const stop of color.stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }

  return gradient;
}

interface WaveformProps {
  readonly $cssWidth: number;
  readonly $waveHeight: number;
}

const Waveform = styled.canvas.attrs<WaveformProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
  },
}))<WaveformProps>`
  float: left;
  position: relative;
  /* Promote to own compositing layer for smoother scrolling */
  will-change: transform;
  /* Disable image rendering interpolation */
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;

interface WrapperProps {
  readonly $index: number;
  readonly $cssWidth: number;
  readonly $waveHeight: number;
  readonly $waveFillColor: string; // CSS background value (solid or gradient)
}

const Wrapper = styled.div.attrs<WrapperProps>((props) => ({
  style: {
    top: `${props.$waveHeight * props.$index}px`,
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
  },
}))<WrapperProps>`
  position: absolute;
  background: ${(props) => props.$waveFillColor};
  /* Force GPU compositing layer to reduce scroll flickering */
  transform: translateZ(0);
  backface-visibility: hidden;
`;

export interface ChannelProps {
  className?: string;
  index: number;
  data: Peaks;
  bits: Bits;
  length: number;
  devicePixelRatio?: number;
  waveHeight?: number;
  /** Waveform bar color - can be a solid color string or gradient config */
  waveOutlineColor?: WaveformColor;
  /** Waveform background color - can be a solid color string or gradient config */
  waveFillColor?: WaveformColor;
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth?: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap?: number;
  /** If true, background is transparent (for use with external progress overlay) */
  transparentBackground?: boolean;
}

export const Channel: FunctionComponent<ChannelProps> = (props) => {
  const {
    data,
    bits,
    length,
    index,
    className,
    devicePixelRatio = 1,
    waveHeight = 80,
    waveOutlineColor = '#E0EFF1',
    waveFillColor = 'grey',
    barWidth = 1,
    barGap = 0,
    transparentBackground = false,
  } = props;
  const canvasesRef = useRef<HTMLCanvasElement[]>([]);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas !== null) {
        const index: number = parseInt(canvas.dataset.index!, 10);
        canvasesRef.current[index] = canvas;
      }
    },
    []
  );

  useLayoutEffect(() => {
    const canvases = canvasesRef.current;
    const step = barWidth + barGap;
    let globalPixelOffset = 0; // Track global pixel position across all canvases

    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];
      const ctx = canvas.getContext('2d');
      const h2 = Math.floor(waveHeight / 2);
      const maxValue = 2 ** (bits - 1);

      if (ctx) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.scale(devicePixelRatio, devicePixelRatio);

        // Create gradient using CSS pixel coordinates (after scaling)
        // This ensures the gradient aligns with the drawing coordinates
        const canvasWidth = canvas.width / devicePixelRatio;
        ctx.fillStyle = createCanvasFillStyle(
          ctx,
          waveOutlineColor,
          canvasWidth,
          waveHeight
        );

        // Calculate where bars should be drawn in this canvas
        // by finding where in the global bar pattern this canvas starts
        const canvasStartGlobal = globalPixelOffset;
        const canvasEndGlobal = globalPixelOffset + canvasWidth;

        // Find the first bar that could affect this canvas
        // A bar at position X extends from X to X+barWidth-1
        // So we need bars where barStart + barWidth > canvasStartGlobal
        // Which means barStart > canvasStartGlobal - barWidth
        const firstBarGlobal = Math.floor((canvasStartGlobal - barWidth + step) / step) * step;

        // Draw bars at the correct positions
        for (let barGlobal = Math.max(0, firstBarGlobal); barGlobal < canvasEndGlobal; barGlobal += step) {
          const x = barGlobal - canvasStartGlobal; // Local x position in this canvas

          // Skip if the entire bar would be before this canvas
          if (x + barWidth <= 0) continue;

          const peakIndex = barGlobal; // Each pixel position corresponds to a peak

          if (peakIndex * 2 + 1 < data.length) {
            const minPeak = data[peakIndex * 2] / maxValue;
            const maxPeak = data[peakIndex * 2 + 1] / maxValue;

            const min = Math.abs(minPeak * h2);
            const max = Math.abs(maxPeak * h2);

            // draw max
            ctx.fillRect(x, 0, barWidth, h2 - max);
            // draw min
            ctx.fillRect(x, h2 + min, barWidth, h2 - min);
          }
        }
      }

      globalPixelOffset += canvas.width / devicePixelRatio;
    }
  }, [
    data,
    bits,
    waveHeight,
    waveOutlineColor,
    devicePixelRatio,
    length,
    barWidth,
    barGap,
  ]);

  let totalWidth = length;
  let waveformCount = 0;
  const waveforms = [];
  while (totalWidth > 0) {
    const currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);
    const waveform = (
      <Waveform
        key={`${length}-${waveformCount}`}
        $cssWidth={currentWidth}
        width={currentWidth * devicePixelRatio}
        height={waveHeight * devicePixelRatio}
        $waveHeight={waveHeight}
        data-index={waveformCount}
        ref={canvasRef}
      />
    );

    waveforms.push(waveform);
    totalWidth -= currentWidth;
    waveformCount += 1;
  }

  // Convert waveFillColor to CSS for the background
  const backgroundCss = transparentBackground ? 'transparent' : waveformColorToCss(waveFillColor);

  return (
    <Wrapper
      $index={index}
      $cssWidth={length}
      className={className}
      $waveHeight={waveHeight}
      $waveFillColor={backgroundCss}
    >
      {waveforms}
    </Wrapper>
  );
};
