import React, { FunctionComponent, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useVisibleChunkIndices } from '../contexts/ScrollViewport';
import { useClipViewportOrigin } from '../contexts/ClipViewportOrigin';
import { useChunkedCanvasRefs } from '../hooks/useChunkedCanvasRefs';
import { MAX_CANVAS_WIDTH } from '@waveform-playlist/core';

interface WrapperProps {
  readonly $index: number;
  readonly $cssWidth: number;
  readonly $waveHeight: number;
}

const Wrapper = styled.div.attrs<WrapperProps>((props) => ({
  style: {
    top: `${props.$waveHeight * props.$index}px`,
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
  },
}))<WrapperProps>`
  position: absolute;
  background: #000;
  transform: translateZ(0);
  backface-visibility: hidden;
`;

interface CanvasProps {
  readonly $cssWidth: number;
  readonly $waveHeight: number;
  readonly $left: number;
}

const SpectrogramCanvas = styled.canvas.attrs<CanvasProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
    left: `${props.$left}px`,
  },
}))<CanvasProps>`
  position: absolute;
  top: 0;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;

export interface SpectrogramCanvasRegistration {
  canvasId: string;
  canvas: OffscreenCanvas;
  clipId: string;
  channelIndex: number;
  chunkIndex: number;
  widthPx: number;
  heightPx: number;
}

export interface SpectrogramChannelProps {
  /** Visual position index — used for CSS positioning (top offset). */
  index: number;
  /** Audio channel index for canvas ID construction. Defaults to `index` when omitted. */
  channelIndex?: number;
  /** Width in CSS pixels */
  length: number;
  /** Height in CSS pixels */
  waveHeight: number;
  /** Device pixel ratio for sharp rendering */
  devicePixelRatio?: number;
  /** Samples per pixel at current zoom level */
  samplesPerPixel: number;
  /** Clip ID used to construct unique canvas IDs */
  clipId: string;
  /** Single-call canvas registration. Receives the transferred OffscreenCanvas + metadata. */
  onCanvasRegister: (reg: SpectrogramCanvasRegistration) => void;
  /** Counterpart for chunk unmount / component unmount. */
  onCanvasUnregister: (canvasId: string) => void;
}

export const SpectrogramChannel: FunctionComponent<SpectrogramChannelProps> = ({
  index,
  channelIndex: channelIndexProp,
  length,
  waveHeight,
  devicePixelRatio = 1,
  samplesPerPixel: _samplesPerPixel,
  clipId,
  onCanvasRegister,
  onCanvasUnregister,
}) => {
  const channelIndex = channelIndexProp ?? index;
  const { canvasRef, canvasMapRef } = useChunkedCanvasRefs();
  const registeredIdsRef = useRef<string[]>([]);
  const transferredCanvasesRef = useRef<WeakSet<HTMLCanvasElement>>(new WeakSet());
  const onCanvasRegisterRef = useRef(onCanvasRegister);
  const onCanvasUnregisterRef = useRef(onCanvasUnregister);

  const clipOriginX = useClipViewportOrigin();
  const visibleChunkIndices = useVisibleChunkIndices(length, MAX_CANVAS_WIDTH, clipOriginX);

  useEffect(() => {
    onCanvasRegisterRef.current = onCanvasRegister;
  }, [onCanvasRegister]);

  useEffect(() => {
    onCanvasUnregisterRef.current = onCanvasUnregister;
  }, [onCanvasUnregister]);

  // Clean up stale canvases, then transfer new ones to the spectrogram provider.
  useEffect(() => {
    if (!clipId) return;

    const unregister = onCanvasUnregisterRef.current;
    const register = onCanvasRegisterRef.current;

    // Step 1: Drop registrations for canvases that have unmounted.
    const remaining: string[] = [];
    for (const id of registeredIdsRef.current) {
      const match = id.match(/chunk(\d+)$/);
      if (!match) {
        remaining.push(id);
        continue;
      }
      const chunkIdx = parseInt(match[1], 10);
      const canvas = canvasMapRef.current.get(chunkIdx);
      if (canvas && canvas.isConnected) {
        remaining.push(id);
      } else {
        try {
          unregister(id);
        } catch (err) {
          console.warn(`[spectrogram] unregister failed for ${id}:`, err);
        }
      }
    }
    registeredIdsRef.current = remaining;

    // Step 2: Transfer newly mounted canvases.
    for (const [canvasIdx, canvas] of canvasMapRef.current.entries()) {
      if (transferredCanvasesRef.current.has(canvas)) continue;

      const canvasId = `${clipId}-ch${channelIndex}-chunk${canvasIdx}`;

      let offscreen: OffscreenCanvas;
      try {
        offscreen = canvas.transferControlToOffscreen();
      } catch (err) {
        console.warn(`[spectrogram] transferControlToOffscreen failed for ${canvasId}:`, err);
        continue;
      }
      // Mark transferred immediately — transferControlToOffscreen is irreversible.
      transferredCanvasesRef.current.add(canvas);

      const widthPx = Math.min(length - canvasIdx * MAX_CANVAS_WIDTH, MAX_CANVAS_WIDTH);

      try {
        register({
          canvasId,
          canvas: offscreen,
          clipId,
          channelIndex,
          chunkIndex: canvasIdx,
          widthPx,
          heightPx: waveHeight,
        });
        registeredIdsRef.current.push(canvasId);
      } catch (err) {
        console.warn(`[spectrogram] register failed for ${canvasId}:`, err);
      }
    }
  }, [canvasMapRef, clipId, channelIndex, length, waveHeight, visibleChunkIndices]);

  // Unregister all canvases on component unmount.
  useEffect(() => {
    return () => {
      const unregister = onCanvasUnregisterRef.current;
      for (const id of registeredIdsRef.current) {
        try {
          unregister(id);
        } catch (err) {
          console.warn(`[spectrogram] unregister failed for ${id}:`, err);
        }
      }
      registeredIdsRef.current = [];
    };
  }, []);

  // Build visible canvas chunk elements
  const canvases = visibleChunkIndices.map((i) => {
    const chunkLeft = i * MAX_CANVAS_WIDTH;
    const currentWidth = Math.min(length - chunkLeft, MAX_CANVAS_WIDTH);

    return (
      <SpectrogramCanvas
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

  return (
    <Wrapper $index={index} $cssWidth={length} $waveHeight={waveHeight}>
      {canvases}
    </Wrapper>
  );
};
