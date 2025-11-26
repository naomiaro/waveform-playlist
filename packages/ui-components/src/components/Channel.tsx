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

interface ProgressProps {
  readonly $progress: number;
  readonly $waveHeight: number;
  readonly $waveProgressColor: string;
}
const Progress = styled.div.attrs<ProgressProps>((props) => ({
  style: {
    width: `${props.$progress}px`,
    height: `${props.$waveHeight}px`,
  },
}))<ProgressProps>`
  position: absolute;
  background: ${(props) => props.$waveProgressColor};
`;

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
`;

export interface ChannelProps {
  className?: string;
  index: number;
  data: Peaks;
  bits: Bits;
  length: number;
  progress?: number;
  devicePixelRatio?: number;
  waveHeight?: number;
  waveProgressColor?: string;
  /** Waveform bar color - can be a solid color string or gradient config */
  waveOutlineColor?: WaveformColor;
  /** Waveform background color - can be a solid color string or gradient config */
  waveFillColor?: WaveformColor;
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth?: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap?: number;
}

export const Channel: FunctionComponent<ChannelProps> = (props) => {
  const {
    data,
    bits,
    length,
    index,
    className,
    progress = 0,
    devicePixelRatio = 1,
    waveHeight = 80,
    waveProgressColor = 'orange',
    waveOutlineColor = '#E0EFF1',
    waveFillColor = 'grey',
    barWidth = 1,
    barGap = 0,
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
    let offset = 0;
    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];
      const ctx = canvas.getContext('2d');
      const h2 = Math.floor(waveHeight / 2);
      const maxValue = 2 ** (bits - 1);

      if (ctx) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        // Create gradient or use solid color for waveform bars
        ctx.fillStyle = createCanvasFillStyle(
          ctx,
          waveOutlineColor,
          canvas.width,
          canvas.height
        );
        ctx.scale(devicePixelRatio, devicePixelRatio);

        const peakSegmentLength = canvas.width / devicePixelRatio;
        const step = barWidth + barGap;
        for (let i = 0; i < peakSegmentLength; i += step) {
          const peakIndex = Math.floor(i + offset);
          const minPeak = data[peakIndex * 2] / maxValue;
          const maxPeak = data[peakIndex * 2 + 1] / maxValue;

          const min = Math.abs(minPeak * h2);
          const max = Math.abs(maxPeak * h2);

          // draw max
          ctx.fillRect(i, 0, barWidth, h2 - max);
          // draw min
          ctx.fillRect(i, h2 + min, barWidth, h2 - min);
        }
      }

      offset += MAX_CANVAS_WIDTH;
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
  const backgroundCss = waveformColorToCss(waveFillColor);

  return (
    <Wrapper
      $index={index}
      $cssWidth={length}
      className={className}
      $waveHeight={waveHeight}
      $waveFillColor={backgroundCss}
    >
      <Progress
        $progress={progress}
        $waveHeight={waveHeight}
        $waveProgressColor={waveProgressColor}
      />
      {waveforms}
    </Wrapper>
  );
};
