import React, { FunctionComponent, useRef, useEffect, useLayoutEffect } from 'react';
import styled from 'styled-components';
import type { SpectrogramData } from '@waveform-playlist/core';
import { useVisibleChunkIndices } from '../contexts/ScrollViewport';
import { useClipViewportOrigin } from '../contexts/ClipViewportOrigin';
import { useChunkedCanvasRefs } from '../hooks/useChunkedCanvasRefs';
import { MAX_CANVAS_WIDTH } from '@waveform-playlist/core';
const LINEAR_FREQUENCY_SCALE = (f: number, minF: number, maxF: number) =>
  (f - minF) / (maxF - minF);

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

// Inline getColorMap to avoid cross-package import at component level
// This avoids needing browser package as dependency of ui-components
function defaultGetColorMap(): Uint8Array {
  // Grayscale fallback — 256-entry LUT (used when no colorLUT prop provided)
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    lut[i * 3] = lut[i * 3 + 1] = lut[i * 3 + 2] = i;
  }
  return lut;
}
const DEFAULT_COLOR_LUT = defaultGetColorMap();

export interface SpectrogramWorkerCanvasApi {
  registerCanvas(canvasId: string, canvas: OffscreenCanvas): void;
  unregisterCanvas(canvasId: string): void;
}

export interface SpectrogramChannelProps {
  /** Visual position index — used for CSS positioning (top offset). */
  index: number;
  /** Audio channel index for canvas ID construction. Defaults to `index` when omitted. */
  channelIndex?: number;
  /** Computed spectrogram data (not needed when workerApi is provided) */
  data?: SpectrogramData;
  /** Width in CSS pixels */
  length: number;
  /** Height in CSS pixels */
  waveHeight: number;
  /** Device pixel ratio for sharp rendering */
  devicePixelRatio?: number;
  /** Samples per pixel at current zoom level */
  samplesPerPixel: number;
  /** 256-entry RGB LUT (768 bytes) from getColorMap() */
  colorLUT?: Uint8Array;
  /** Frequency scale function: (freqHz, minF, maxF) => [0,1] */
  frequencyScaleFn?: (f: number, minF: number, maxF: number) => number;
  /** Min frequency in Hz */
  minFrequency?: number;
  /** Max frequency in Hz (defaults to sampleRate/2) */
  maxFrequency?: number;
  /** Worker API for transferring canvas ownership. When provided, rendering is done in the worker. */
  workerApi?: SpectrogramWorkerCanvasApi;
  /** Clip ID used to construct unique canvas IDs for worker registration */
  clipId?: string;
  /** Callback when canvases are registered with the worker, providing canvas IDs and widths */
  onCanvasesReady?: (canvasIds: string[], canvasWidths: number[]) => void;
}

export const SpectrogramChannel: FunctionComponent<SpectrogramChannelProps> = ({
  index,
  channelIndex: channelIndexProp,
  data,
  length,
  waveHeight,
  devicePixelRatio = 1,
  samplesPerPixel,
  colorLUT,
  frequencyScaleFn,
  minFrequency = 0,
  maxFrequency,
  workerApi,
  clipId,
  onCanvasesReady,
}) => {
  const channelIndex = channelIndexProp ?? index;
  const { canvasRef, canvasMapRef } = useChunkedCanvasRefs();
  const registeredIdsRef = useRef<string[]>([]);
  const transferredCanvasesRef = useRef<WeakSet<HTMLCanvasElement>>(new WeakSet());
  const workerApiRef = useRef(workerApi);
  const onCanvasesReadyRef = useRef(onCanvasesReady);

  // Track whether we're in worker mode (canvas transferred)
  const isWorkerMode = !!(workerApi && clipId);
  const clipOriginX = useClipViewportOrigin();

  const visibleChunkIndices = useVisibleChunkIndices(length, MAX_CANVAS_WIDTH, clipOriginX);

  const lut = colorLUT ?? DEFAULT_COLOR_LUT;
  const maxF = maxFrequency ?? (data ? data.sampleRate / 2 : 22050);
  const scaleFn = frequencyScaleFn ?? LINEAR_FREQUENCY_SCALE;
  const hasCustomFrequencyScale = Boolean(frequencyScaleFn);

  // Keep refs in sync with latest props
  useEffect(() => {
    workerApiRef.current = workerApi;
  }, [workerApi]);

  useEffect(() => {
    onCanvasesReadyRef.current = onCanvasesReady;
  }, [onCanvasesReady]);

  // Worker mode: clean up stale canvases, then transfer new ones.
  // Cleanup and registration are combined in a single effect so that
  // `onCanvasesReady` always receives a clean list without stale IDs.
  // Uses visibleChunkIndices so it only re-runs when chunks mount/unmount.
  useEffect(() => {
    if (!isWorkerMode) return;
    const currentWorkerApi = workerApiRef.current;
    if (!currentWorkerApi || !clipId) return;

    // Step 1: Remove stale registrations for unmounted canvases.
    const previousCount = registeredIdsRef.current.length;
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
          currentWorkerApi.unregisterCanvas(id);
        } catch (err) {
          console.warn(`[spectrogram] unregisterCanvas failed for ${id}:`, err);
        }
      }
    }
    registeredIdsRef.current = remaining;

    // Step 2: Transfer new canvases to the worker.
    const newIds: string[] = [];

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

      try {
        currentWorkerApi.registerCanvas(canvasId, offscreen);
        newIds.push(canvasId);
      } catch (err) {
        console.warn(`[spectrogram] registerCanvas failed for ${canvasId}:`, err);
        continue;
      }
    }

    if (newIds.length > 0) {
      registeredIdsRef.current = [...registeredIdsRef.current, ...newIds];
    }

    // Step 3: Notify provider when canvas set changed (added or removed).
    const canvasSetChanged = newIds.length > 0 || remaining.length < previousCount;
    if (canvasSetChanged) {
      const allIds = registeredIdsRef.current;
      const allWidths = allIds.map((id) => {
        const match = id.match(/chunk(\d+)$/);
        if (!match) {
          console.warn(`[spectrogram] Unexpected canvas ID format: ${id}`);
          return MAX_CANVAS_WIDTH;
        }
        const chunkIdx = parseInt(match[1], 10);
        return Math.min(length - chunkIdx * MAX_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
      });
      onCanvasesReadyRef.current?.(allIds, allWidths);
    }
  }, [canvasMapRef, isWorkerMode, clipId, channelIndex, length, visibleChunkIndices]);

  // Unregister all canvases from worker on component unmount
  useEffect(() => {
    return () => {
      const api = workerApiRef.current;
      if (!api) return;
      for (const id of registeredIdsRef.current) {
        try {
          api.unregisterCanvas(id);
        } catch (err) {
          console.warn(`[spectrogram] unregisterCanvas failed for ${id}:`, err);
        }
      }
      registeredIdsRef.current = [];
    };
  }, []);

  // Main-thread rendering (skipped in worker mode).
  // useLayoutEffect so canvas drawing completes before the browser paints —
  // prevents flicker from clearRect being visible for one frame.
  useLayoutEffect(() => {
    if (isWorkerMode || !data) return;

    const {
      frequencyBinCount,
      frameCount,
      hopSize,
      sampleRate,
      gainDb,
      rangeDb: rawRangeDb,
    } = data;
    const rangeDb = rawRangeDb === 0 ? 1 : rawRangeDb;

    // Pre-compute Y mapping: for each pixel row, which frequency bin(s) to sample
    const binToFreq = (bin: number) => (bin / frequencyBinCount) * (sampleRate / 2);

    for (const [canvasIdx, canvas] of canvasMapRef.current.entries()) {
      const globalPixelOffset = canvasIdx * MAX_CANVAS_WIDTH;

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const canvasWidth = canvas.width / devicePixelRatio;
      const canvasHeight = waveHeight;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.scale(devicePixelRatio, devicePixelRatio);

      // Create ImageData at CSS pixel size, then putImageData at scaled resolution
      const imgData = ctx.createImageData(canvasWidth, canvasHeight);
      const pixels = imgData.data;

      for (let x = 0; x < canvasWidth; x++) {
        const globalX = globalPixelOffset + x;

        // Map pixel X → spectrogram frame
        const samplePos = globalX * samplesPerPixel;
        const frame = Math.floor(samplePos / hopSize);

        if (frame < 0 || frame >= frameCount) continue;

        const frameOffset = frame * frequencyBinCount;

        for (let y = 0; y < canvasHeight; y++) {
          // Y=0 is top of canvas, but low frequencies should be at bottom
          const normalizedY = 1 - y / canvasHeight; // 0=bottom, 1=top

          // Map normalizedY through frequency scale to find which frequency this pixel represents
          // We need the inverse: given a normalized position, find the frequency
          // Use binary search over frequency bins
          let bin = Math.floor(normalizedY * frequencyBinCount);

          // If we have a non-linear scale, find the correct bin
          if (hasCustomFrequencyScale) {
            // Binary search: find the bin whose scaled position is closest to normalizedY
            let lo = 0;
            let hi = frequencyBinCount - 1;
            while (lo < hi) {
              const mid = (lo + hi) >> 1;
              const freq = binToFreq(mid);
              const scaled = scaleFn(freq, minFrequency, maxF);
              if (scaled < normalizedY) {
                lo = mid + 1;
              } else {
                hi = mid;
              }
            }
            bin = lo;
          }

          if (bin < 0 || bin >= frequencyBinCount) continue;

          // Get dB value and normalize to [0, 1]
          const db = data.data[frameOffset + bin];
          const normalized = Math.max(0, Math.min(1, (db + rangeDb + gainDb) / rangeDb));

          // Map to color via LUT (0-255 index)
          const colorIdx = Math.floor(normalized * 255);
          const pixelIdx = (y * canvasWidth + x) * 4;
          pixels[pixelIdx] = lut[colorIdx * 3];
          pixels[pixelIdx + 1] = lut[colorIdx * 3 + 1];
          pixels[pixelIdx + 2] = lut[colorIdx * 3 + 2];
          pixels[pixelIdx + 3] = 255;
        }
      }

      // Put at device pixel ratio scale
      ctx.resetTransform();
      ctx.putImageData(imgData, 0, 0);

      // Scale up to fill canvas
      if (devicePixelRatio !== 1) {
        // Draw the image data at 1:1, then scale
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = canvasWidth;
        tmpCanvas.height = canvasHeight;
        const tmpCtx = tmpCanvas.getContext('2d');
        if (!tmpCtx) continue;
        tmpCtx.putImageData(imgData, 0, 0);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [
    canvasMapRef,
    isWorkerMode,
    data,
    length,
    waveHeight,
    devicePixelRatio,
    samplesPerPixel,
    lut,
    minFrequency,
    maxF,
    scaleFn,
    hasCustomFrequencyScale,
    visibleChunkIndices,
  ]);

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
