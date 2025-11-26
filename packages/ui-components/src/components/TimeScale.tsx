import React, { FunctionComponent, useRef, useEffect, useContext } from 'react';
import styled, { withTheme, DefaultTheme } from 'styled-components';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { useDevicePixelRatio } from '../contexts/DevicePixelRatio';
import { secondsToPixels } from '../utils/conversions';

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const s = seconds % 60;
  const m = (seconds - s) / 60;

  return `${m}:${String(s).padStart(2, '0')}`;
}

interface PlaylistTimeScaleScroll {
  readonly $cssWidth: number;
  readonly $controlWidth: number;
  readonly $timeScaleHeight: number;
}
const PlaylistTimeScaleScroll = styled.div.attrs<PlaylistTimeScaleScroll>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    marginLeft: `${props.$controlWidth}px`,
    height: `${props.$timeScaleHeight}px`,
  },
}))<PlaylistTimeScaleScroll>`
  position: relative;
  overflow: visible; /* Allow time labels to render above the container */
  border-bottom: 1px solid ${props => props.theme.timeColor};
  box-sizing: border-box;
`;

interface TimeTicks {
  readonly $cssWidth: number;
  readonly $timeScaleHeight: number;
}
const TimeTicks = styled.canvas.attrs<TimeTicks>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$timeScaleHeight}px`,
  },
}))<TimeTicks>`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
`;

interface TimeStamp {
  readonly $left: number;
}
const TimeStamp = styled.div.attrs<TimeStamp>((props) => ({
  style: {
    left: `${props.$left + 4}px`, // Offset 4px to the right of the tick
  },
}))<TimeStamp>`
  position: absolute;
  font-size: 0.75rem; /* Smaller font to prevent overflow */
  white-space: nowrap; /* Prevent text wrapping */
  color: ${props => props.theme.timeColor}; /* Use theme color instead of inheriting */
`;

export interface TimeScaleProps {
  readonly theme?: DefaultTheme;
  readonly duration: number;
  readonly marker: number;
  readonly bigStep: number;
  readonly secondStep: number;
  readonly renderTimestamp?: (timeMs: number, pixelPosition: number) => React.ReactNode;
}

interface TimeScalePropsWithTheme extends TimeScaleProps {
  readonly theme: DefaultTheme;
}

export const TimeScale: FunctionComponent<TimeScalePropsWithTheme> = (props) => {
  const {
    theme: { timeColor },
    duration,
    marker,
    bigStep,
    secondStep,
    renderTimestamp,
  } = props;
  const canvasInfo = new Map();
  const timeMarkers = [];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    sampleRate,
    samplesPerPixel,
    timeScaleHeight,
    controls: { show: showControls, width: controlWidth },
  } = useContext(PlaylistInfoContext);
  const devicePixelRatio = useDevicePixelRatio();

  useEffect(() => {
    if (canvasRef.current !== null) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = timeColor;
        ctx.scale(devicePixelRatio, devicePixelRatio);

        for (const [pixLeft, scaleHeight] of canvasInfo.entries()) {
          const scaleY = timeScaleHeight - scaleHeight;
          ctx.fillRect(pixLeft, scaleY, 1, scaleHeight);
        }
      }
    }
  }, [
    duration,
    devicePixelRatio,
    timeColor,
    timeScaleHeight,
    bigStep,
    secondStep,
    marker,
    canvasInfo,
  ]);

  const widthX = secondsToPixels(duration / 1000, samplesPerPixel, sampleRate);
  const pixPerSec = sampleRate / samplesPerPixel;
  let counter = 0;

  for (let i = 0; i < widthX; i += (pixPerSec * secondStep) / 1000) {
    const pix = Math.floor(i);

    // create three levels of time markers - at marker point also place a timestamp.
    if (counter % marker === 0) {
      const timeMs = counter;
      const timestamp = formatTime(timeMs);

      // Use custom renderer if provided, otherwise use default
      const timestampContent = renderTimestamp ? (
        <React.Fragment key={`timestamp-${counter}`}>
          {renderTimestamp(timeMs, pix)}
        </React.Fragment>
      ) : (
        <TimeStamp key={timestamp} $left={pix}>
          {timestamp}
        </TimeStamp>
      );

      timeMarkers.push(timestampContent);
      canvasInfo.set(pix, timeScaleHeight);
    } else if (counter % bigStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 2));
    } else if (counter % secondStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 5));
    }

    counter += secondStep;
  }

  return (
    <PlaylistTimeScaleScroll
      $cssWidth={widthX}
      $controlWidth={showControls ? controlWidth : 0}
      $timeScaleHeight={timeScaleHeight}
    >
      {timeMarkers}
      <TimeTicks
        $cssWidth={widthX}
        $timeScaleHeight={timeScaleHeight}
        width={widthX * devicePixelRatio}
        height={timeScaleHeight * devicePixelRatio}
        ref={canvasRef}
      />
    </PlaylistTimeScaleScroll>
  );
};

export const StyledTimeScale = withTheme(TimeScale) as FunctionComponent<TimeScaleProps>;
