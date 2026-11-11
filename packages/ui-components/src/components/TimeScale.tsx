import React, { FunctionComponent, useLayoutEffect, useContext, useMemo } from 'react';
import styled, { withTheme, DefaultTheme } from 'styled-components';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { useDevicePixelRatio } from '../contexts/DevicePixelRatio';
import { useVisibleChunkIndices } from '../contexts/ScrollViewport';
import { useChunkedCanvasRefs } from '../hooks/useChunkedCanvasRefs';
import { useIdentityVersion } from '../hooks/useIdentityVersion';
import { MAX_CANVAS_WIDTH } from '@waveform-playlist/core';

interface PlaylistTimeScaleScrollProps {
  readonly $cssWidth: number;
  readonly $timeScaleHeight: number;
}
const PlaylistTimeScaleScroll = styled.div.attrs<PlaylistTimeScaleScrollProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$timeScaleHeight}px`,
  },
}))<PlaylistTimeScaleScrollProps>`
  position: relative;
  overflow: visible; /* Allow time labels to render above the container */
  border-bottom: 1px solid ${(props) => props.theme.timeColor};
  box-sizing: border-box;
`;

interface TimeTickChunkProps {
  readonly $cssWidth: number;
  readonly $timeScaleHeight: number;
  readonly $left: number;
}
const TimeTickChunk = styled.canvas.attrs<TimeTickChunkProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$timeScaleHeight}px`,
    left: `${props.$left}px`,
  },
}))<TimeTickChunkProps>`
  position: absolute;
  bottom: 0;
`;

export interface PrecomputedTickData {
  widthX: number;
  canvasInfo: Map<number, number>;
  timeMarkersWithPositions: Array<{ pix: number; element: React.ReactNode }>;
}

export interface TimeScaleProps {
  readonly theme?: DefaultTheme;
  readonly tickData: PrecomputedTickData;
}

interface TimeScalePropsWithTheme extends TimeScaleProps {
  readonly theme: DefaultTheme;
}

/** Index of the first tick whose pixel position is >= `pixel` (ticks sorted by pixel). */
function firstTickAtOrAfter(ticks: ReadonlyArray<readonly [number, number]>, pixel: number) {
  let low = 0;
  let high = ticks.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (ticks[mid][0] < pixel) low = mid + 1;
    else high = mid;
  }
  return low;
}

export const TimeScale: FunctionComponent<TimeScalePropsWithTheme> = (props) => {
  const {
    theme: { timeColor },
    tickData,
  } = props;
  const { canvasRef, canvasMapRef } = useChunkedCanvasRefs();
  const { timeScaleHeight } = useContext(PlaylistInfoContext);
  const devicePixelRatio = useDevicePixelRatio();

  const { widthX, canvasInfo, timeMarkersWithPositions } = tickData;

  const visibleChunkIndices = useVisibleChunkIndices(widthX, MAX_CANVAS_WIDTH);

  // Build visible canvas chunk elements
  const visibleChunks = visibleChunkIndices.map((i) => {
    const chunkLeft = i * MAX_CANVAS_WIDTH;
    const chunkWidth = Math.min(widthX - chunkLeft, MAX_CANVAS_WIDTH);

    return (
      <TimeTickChunk
        key={`timescale-${i}`}
        $cssWidth={chunkWidth}
        $left={chunkLeft}
        $timeScaleHeight={timeScaleHeight}
        width={chunkWidth * devicePixelRatio}
        height={timeScaleHeight * devicePixelRatio}
        data-index={i}
        ref={canvasRef}
      />
    );
  });

  // Filter time markers to visible chunk range. Uses chunk boundaries
  // rather than exact viewport pixels — sufficient given the 1.5× overscan buffer.
  const firstChunkLeft =
    visibleChunkIndices.length > 0 ? visibleChunkIndices[0] * MAX_CANVAS_WIDTH : 0;
  const lastChunkRight =
    visibleChunkIndices.length > 0
      ? (visibleChunkIndices[visibleChunkIndices.length - 1] + 1) * MAX_CANVAS_WIDTH
      : Infinity;

  const visibleMarkers =
    visibleChunkIndices.length > 0
      ? timeMarkersWithPositions
          .filter(({ pix }) => pix >= firstChunkLeft && pix < lastChunkRight)
          .map(({ element }) => element)
      : timeMarkersWithPositions.map(({ element }) => element);

  // Ticks as [pixel, height] pairs in pixel order, so a chunk can find its own
  // ticks with a binary search instead of scanning every tick of the timeline.
  const sortedTicks = useMemo(
    () => Array.from(canvasInfo.entries()).sort((a, b) => a[0] - b[0]),
    [canvasInfo]
  );

  // Fingerprint of everything the drawing depends on. Each canvas is stamped
  // with it after drawing, so when only the set of visible chunks changes
  // (scrolling) the chunks already on screen are skipped. Same scheme as Channel.
  const ticksVersion = useIdentityVersion(canvasInfo);
  // widthX is included because it sets the last chunk's canvas width, and
  // resizing a canvas clears it.
  const drawVersion = `${ticksVersion}-${widthX}-${devicePixelRatio}-${timeColor}-${timeScaleHeight}`;

  // Draw tick marks on visible canvas chunks.
  // visibleChunkIndices changes only when chunks mount/unmount, not on every scroll pixel.
  useLayoutEffect(() => {
    for (const [chunkIdx, canvas] of canvasMapRef.current.entries()) {
      if (canvas.dataset.drawVersion === drawVersion) continue;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const chunkLeft = chunkIdx * MAX_CANVAS_WIDTH;
      const chunkRight = chunkLeft + canvas.width / devicePixelRatio;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = timeColor;
      ctx.scale(devicePixelRatio, devicePixelRatio);

      for (let i = firstTickAtOrAfter(sortedTicks, chunkLeft); i < sortedTicks.length; i++) {
        const [pixLeft, scaleHeight] = sortedTicks[i];
        if (pixLeft >= chunkRight) break;
        ctx.fillRect(pixLeft - chunkLeft, timeScaleHeight - scaleHeight, 1, scaleHeight);
      }

      canvas.dataset.drawVersion = drawVersion;
    }
  }, [
    canvasMapRef,
    devicePixelRatio,
    timeColor,
    timeScaleHeight,
    sortedTicks,
    drawVersion,
    visibleChunkIndices,
  ]);

  return (
    <PlaylistTimeScaleScroll $cssWidth={widthX} $timeScaleHeight={timeScaleHeight}>
      {visibleMarkers}
      {visibleChunks}
    </PlaylistTimeScaleScroll>
  );
};

export const StyledTimeScale = withTheme(TimeScale) as FunctionComponent<TimeScaleProps>;
