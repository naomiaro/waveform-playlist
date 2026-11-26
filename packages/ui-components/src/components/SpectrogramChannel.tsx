import React, { FunctionComponent, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useVisibleChunkIndices } from '../contexts/ScrollViewport';
import { useClipViewportOrigin } from '../contexts/ClipViewportOrigin';
import { useChunkedCanvasRefs } from '../hooks/useChunkedCanvasRefs';
import {
  MAX_CANVAS_WIDTH,
  buildSpectrogramCanvasId,
  parseSpectrogramCanvasId,
} from '@waveform-playlist/core';
import type { SpectrogramCanvasRegistration } from '@waveform-playlist/core';

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
  /* Shown until the worker has drawn, and where a chunk is not mounted. */
  background: ${(props) => props.theme?.spectrogramBackgroundColor ?? '#000'};
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
  /**
   * Where in the audio the drawn clip starts, in samples. Each canvas
   * registers with it, and the provider draws this range instead of the
   * clip's own (the view draws a trim being dragged before the tracks have
   * it). A new value registers new canvases. Omitted: the clip's own.
   */
  offsetSamples?: number;
  /** How much of the audio the drawn clip covers, in samples. See `offsetSamples`. */
  durationSamples?: number;
}

/**
 * Unregisters each id whose canvas is no longer on the page, and returns the
 * ids that stay registered.
 */
function releaseUnmounted(
  ids: ReadonlySet<string>,
  canvases: ReadonlyMap<number, HTMLCanvasElement>,
  unregister: (canvasId: string) => void
): Set<string> {
  const remaining = new Set<string>();
  for (const id of ids) {
    const parsed = parseSpectrogramCanvasId(id);
    const canvas = parsed ? canvases.get(parsed.chunkIndex) : undefined;
    if (canvas?.isConnected) {
      remaining.add(id);
      continue;
    }
    try {
      unregister(id);
    } catch (err) {
      console.warn(`[spectrogram] unregister failed for ${id}:`, err);
    }
  }
  return remaining;
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
  offsetSamples,
  durationSamples,
}) => {
  const channelIndex = channelIndexProp ?? index;
  const { canvasRef, canvasMapRef } = useChunkedCanvasRefs();
  // A set: a canvas whose key changes remounts and registers again under the
  // same id, and the id must be unregistered once (#856).
  const registeredIdsRef = useRef<ReadonlySet<string>>(new Set());
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
    const remaining = releaseUnmounted(registeredIdsRef.current, canvasMapRef.current, unregister);

    // Step 2: Transfer newly mounted canvases.
    for (const [canvasIdx, canvas] of canvasMapRef.current.entries()) {
      if (transferredCanvasesRef.current.has(canvas)) continue;

      const canvasId = buildSpectrogramCanvasId({ clipId, channelIndex, chunkIndex: canvasIdx });

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
          ...(offsetSamples !== undefined ? { offsetSamples } : {}),
          ...(durationSamples !== undefined ? { durationSamples } : {}),
        });
        remaining.add(canvasId);
      } catch (err) {
        console.warn(`[spectrogram] register failed for ${canvasId}:`, err);
      }
    }
    registeredIdsRef.current = remaining;
  }, [
    canvasMapRef,
    clipId,
    channelIndex,
    length,
    waveHeight,
    offsetSamples,
    durationSamples,
    visibleChunkIndices,
  ]);

  // On unmount, unregister the canvases that left the page with the component.
  // A cleanup that leaves them on the page (StrictMode's simulated unmount, a
  // hidden <Activity>, Fast Refresh) keeps them registered: a transferred canvas
  // cannot be registered again when the effects run once more (#856).
  useEffect(() => {
    const canvasMap = canvasMapRef.current;
    return () => {
      registeredIdsRef.current = releaseUnmounted(
        registeredIdsRef.current,
        canvasMap,
        onCanvasUnregisterRef.current
      );
    };
  }, [canvasMapRef]);

  // Build visible canvas chunk elements
  const canvases = visibleChunkIndices.map((i) => {
    const chunkLeft = i * MAX_CANVAS_WIDTH;
    const currentWidth = Math.min(length - chunkLeft, MAX_CANVAS_WIDTH);

    return (
      <SpectrogramCanvas
        // The height and the audio range are in the key: a transferred canvas
        // cannot be resized or registered again from here, and the provider
        // renders at the height and the range a canvas registered with.
        key={`${length}-${waveHeight}-${offsetSamples ?? ''}-${durationSamples ?? ''}-${i}`}
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
