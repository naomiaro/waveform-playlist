import React, { FunctionComponent, useLayoutEffect } from 'react';
import styled from 'styled-components';
import type { Peaks, Bits } from '@waveform-playlist/core';
import {
  WaveformColor,
  WaveformDrawMode,
  isWaveformGradient,
  waveformColorToCss,
} from '../wfpl-theme';
import { useVisibleChunkIndices } from '../contexts/ScrollViewport';
import { useClipViewportOrigin } from '../contexts/ClipViewportOrigin';
import { useChunkedCanvasRefs } from '../hooks/useChunkedCanvasRefs';
import { MAX_CANVAS_WIDTH } from '@waveform-playlist/core';
import {
  aggregatePeaks,
  calculateBarRects,
  calculateFirstBarPosition,
} from '../utils/peakRendering';

// Re-export WaveformColor for consumers
export type { WaveformColor } from '../wfpl-theme';
export type { WaveformDrawMode } from '../wfpl-theme';

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
  readonly $left: number;
}

const Waveform = styled.canvas.attrs<WaveformProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
    left: `${props.$left}px`,
  },
}))<WaveformProps>`
  position: absolute;
  top: 0;
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
  /**
   * Drawing mode:
   * - 'inverted': Canvas draws waveOutlineColor where there's NO audio, revealing waveFillColor background as bars (default). Good for gradient bars.
   * - 'normal': Canvas draws waveFillColor where there IS audio. Use with transparentBackground for progress overlays.
   */
  drawMode?: WaveformDrawMode;
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
    drawMode = 'inverted',
  } = props;
  const { canvasRef, canvasMapRef } = useChunkedCanvasRefs();
  const clipOriginX = useClipViewportOrigin();

  const visibleChunkIndices = useVisibleChunkIndices(length, MAX_CANVAS_WIDTH, clipOriginX);

  // Draw waveform bars on visible canvas chunks.
  // visibleChunkIndices changes only when chunks mount/unmount, not on every scroll pixel.
  // useLayoutEffect so canvas drawing completes before the browser paints —
  // prevents flicker from clearRect being visible for one frame.
  useLayoutEffect(() => {
    const step = barWidth + barGap;

    for (const [canvasIdx, canvas] of canvasMapRef.current.entries()) {
      const globalPixelOffset = canvasIdx * MAX_CANVAS_WIDTH;

      const ctx = canvas.getContext('2d');
      const h2 = Math.floor(waveHeight / 2);

      if (ctx) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.scale(devicePixelRatio, devicePixelRatio);

        // Create gradient using CSS pixel coordinates (after scaling)
        // This ensures the gradient aligns with the drawing coordinates
        const canvasWidth = canvas.width / devicePixelRatio;

        // Choose canvas fill color based on draw mode:
        let fillColor: WaveformColor;
        if (drawMode === 'normal') {
          // Normal: canvas draws the bars directly
          fillColor = waveFillColor;
        } else {
          // Inverted: canvas masks non-audio areas, background shows as bars
          fillColor = waveOutlineColor;
        }
        ctx.fillStyle = createCanvasFillStyle(ctx, fillColor, canvasWidth, waveHeight);

        const canvasStartGlobal = globalPixelOffset;
        const canvasEndGlobal = globalPixelOffset + canvasWidth;
        const firstBarGlobal = calculateFirstBarPosition(canvasStartGlobal, barWidth, step);

        for (
          let barGlobal = Math.max(0, firstBarGlobal);
          barGlobal < canvasEndGlobal;
          barGlobal += step
        ) {
          const x = barGlobal - canvasStartGlobal;

          // Skip if the entire bar would be before this canvas
          if (x + barWidth <= 0) continue;

          const peakEnd = Math.min(barGlobal + step, length);
          const peak = aggregatePeaks(data, bits, barGlobal, peakEnd);

          if (peak) {
            const rects = calculateBarRects(x, barWidth, h2, peak.min, peak.max, drawMode);
            for (const rect of rects) {
              ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            }
          }
        }
      }
    }
  }, [
    canvasMapRef,
    data,
    bits,
    waveHeight,
    waveOutlineColor,
    waveFillColor,
    devicePixelRatio,
    length,
    barWidth,
    barGap,
    drawMode,
    visibleChunkIndices,
    index,
  ]);

  // Build visible canvas chunk elements
  const waveforms = visibleChunkIndices.map((i) => {
    const chunkLeft = i * MAX_CANVAS_WIDTH;
    const currentWidth = Math.min(length - chunkLeft, MAX_CANVAS_WIDTH);

    return (
      <Waveform
        key={`${length}-${i}`}
        $cssWidth={currentWidth}
        $left={chunkLeft}
        width={currentWidth * devicePixelRatio}
        height={waveHeight * devicePixelRatio}
        $waveHeight={waveHeight}
        data-index={i}
        ref={canvasRef}
      />
    );
  });

  // Background color depends on draw mode:
  // - inverted: waveFillColor background, canvas masks non-audio areas with waveOutlineColor
  // - normal: waveFillColor background, canvas draws waveFillColor at audio peaks (use with transparentBackground)
  const bgColor = waveFillColor;
  const backgroundCss = transparentBackground ? 'transparent' : waveformColorToCss(bgColor);

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
