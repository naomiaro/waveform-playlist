import React, { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import {
  MAX_CANVAS_WIDTH,
  type SpectrogramConfig,
  type ColorMapValue,
  type RenderMode,
  type TrackSpectrogramOverrides,
  type SpectrogramCanvasRegistration,
} from '@waveform-playlist/core';
import {
  getColorMap,
  getFrequencyScale,
  createSpectrogramWorkerPool,
  SpectrogramAbortError,
  type SpectrogramWorkerApi,
} from '@dawcore/spectrogram';
import {
  extractChunkNumber,
  parseCanvasId,
  presentChunkIndices,
  groupContiguousIndices,
  classifyChunkTiers,
  computeChunkSampleRange,
  resolveRenderMode,
  buildConfigKey,
  mapsDiffer,
  registeredClipRange,
  resolveClipRange,
  type ChunkTiers,
  type RegisteredAudioRange,
} from './spectrogram-helpers';
import { createAudioKeyOf, spectrogramAudio, channelData } from './audioRegistration';
import { useStableByContent } from './useStableByContent';
import { SpectrogramMenuItems } from './components';
import { SpectrogramSettingsModal } from './components';
import {
  SpectrogramIntegrationProvider,
  type SpectrogramIntegration,
} from '@waveform-playlist/browser';
import {
  usePlaybackControls,
  usePlaylistView,
  usePlaylistZoom,
  usePlaylistTimeline,
} from '@waveform-playlist/browser';

export interface SpectrogramProviderProps {
  config?: SpectrogramConfig;
  colorMap?: ColorMapValue;
  /** Number of Web Workers for parallel FFT computation. Defaults to 2 (one per stereo channel). */
  workerPoolSize?: number;
  children: ReactNode;
}

export const SpectrogramProvider: React.FC<SpectrogramProviderProps> = ({
  config,
  colorMap,
  workerPoolSize,
  children,
}) => {
  // By content: the guide writes `config={{ … }}` inline (#821).
  const spectrogramConfig = useStableByContent(config);
  const spectrogramColorMap = useStableByContent(colorMap);
  const { mono } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const { tracks } = usePlaylistTimeline();
  const { scrollContainerRef } = usePlaybackControls();

  // State
  const [trackSpectrogramOverrides, setTrackSpectrogramOverrides] = useState<
    Map<string, TrackSpectrogramOverrides>
  >(() => new Map());

  // OffscreenCanvas registry for worker-rendered spectrograms
  const spectrogramCanvasRegistryRef = useRef<
    Map<string, Map<number, { canvasIds: string[]; canvasWidths: number[] }>>
  >(new Map());
  // The height each canvas registered with, by canvas id. The row height is an
  // option of the view (#689), so this provider, which sits above the views,
  // learns it from the canvases: a view draws at its own height, and in
  // "both" mode a canvas is half a row tall.
  const canvasHeightsRef = useRef<Map<string, number>>(new Map());
  // The range of the audio each canvas registered with, by canvas id: the view
  // draws a trim being dragged before the tracks have it (#812), so a clip is
  // rendered for the range its canvases were drawn for, not the track's. Kept
  // only as part of the registration and never written anywhere else.
  const canvasRangesRef = useRef<Map<string, RegisteredAudioRange>>(new Map());
  const [spectrogramCanvasVersion, setSpectrogramCanvasVersion] = useState(0);

  // Spectrogram refs
  const prevSpectrogramConfigRef = useRef<Map<string, string>>(new Map());
  const spectrogramWorkerRef = useRef<SpectrogramWorkerApi | null>(null);
  const spectrogramGenerationRef = useRef(0);
  const prevCanvasVersionRef = useRef(0);
  const backgroundRenderAbortRef = useRef<{ aborted: boolean } | null>(null);
  // One key per AudioBuffer: clips that share a buffer share its registration.
  const [audioKeyOf] = useState(createAudioKeyOf);

  // The one place the pool is made: lazily, on the first need. The pool is
  // created once; a later workerPoolSize applies only to a pool made after a
  // cleanup terminated this one.
  const ensureWorkerPool = useCallback((): SpectrogramWorkerApi | null => {
    if (spectrogramWorkerRef.current) return spectrogramWorkerRef.current;
    try {
      const pool = createSpectrogramWorkerPool(
        () =>
          new Worker(new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url), {
            type: 'module',
          }),
        workerPoolSize
      );
      spectrogramWorkerRef.current = pool;
      return pool;
    } catch (err) {
      console.warn(
        `[waveform-playlist] Spectrogram Web Worker unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }, [workerPoolSize]);

  // Terminate the pool in every cleanup: an unmount, and also when React keeps
  // the component and runs its effects again (a hidden <Activity> shown again,
  // StrictMode). What the pool held goes with it; the effects below ask the
  // next pool what it holds (#821).
  useEffect(() => {
    return () => {
      spectrogramWorkerRef.current?.terminate();
      spectrogramWorkerRef.current = null;
    };
  }, []);

  // Pre-register with the pool the audio of every clip on a track that draws a
  // spectrogram, once per buffer, and release what no such clip uses any more.
  // The pool is the one owner of what it holds (`registeredAudioClipIds`).
  // Not gated on the playlist's isReady: a track whose audio is decoded draws
  // while others still load, and its FFT requests would carry its audio.
  useEffect(() => {
    const wanted = spectrogramAudio(tracks, trackSpectrogramOverrides, audioKeyOf);
    // Nothing wanted and no pool yet: nothing to release, and no pool to make.
    const pool = wanted.size > 0 ? ensureWorkerPool() : spectrogramWorkerRef.current;
    if (!pool) return;

    const held = new Set(pool.registeredAudioClipIds());
    for (const [key, buffer] of wanted) {
      if (!held.has(key)) pool.registerAudioData(key, channelData(buffer), buffer.sampleRate);
    }
    for (const key of held) {
      if (!wanted.has(key)) pool.unregisterAudioData(key);
    }
  }, [tracks, trackSpectrogramOverrides, audioKeyOf, ensureWorkerPool]);

  // Main spectrogram computation effect
  useEffect(() => {
    if (tracks.length === 0) return;

    const currentKeys = new Map<string, string>();
    tracks.forEach((track) => {
      const override = trackSpectrogramOverrides.get(track.id);
      const mode = resolveRenderMode(override, track.renderMode);
      if (mode === 'waveform') return;
      const cfg = override?.config ?? track.spectrogramConfig ?? spectrogramConfig;
      const cm = override?.colorMap ?? track.spectrogramColorMap ?? spectrogramColorMap;
      currentKeys.set(track.id, buildConfigKey({ mode, cfg, cm, mono }));
    });

    const prevKeys = prevSpectrogramConfigRef.current;
    const configChanged = mapsDiffer(prevKeys, currentKeys);

    const canvasVersionChanged = spectrogramCanvasVersion !== prevCanvasVersionRef.current;
    prevCanvasVersionRef.current = spectrogramCanvasVersion;

    if (!configChanged && !canvasVersionChanged) return;

    if (configChanged) {
      prevSpectrogramConfigRef.current = currentKeys;
    }

    if (backgroundRenderAbortRef.current) {
      backgroundRenderAbortRef.current.aborted = true;
    }

    const generation = ++spectrogramGenerationRef.current;

    const workerApi = ensureWorkerPool();
    if (!workerApi) return;
    // Tell the worker to abort any in-flight FFT from previous generations
    workerApi.abortGeneration(generation);

    // Every clip of a track whose look changed or whose canvases registered.
    // A clip whose FFT the worker already has costs a cache hit, not an FFT.
    const clipsToRender: Array<{
      clipId: string;
      /** The key the clip's audio is registered under: one per AudioBuffer. */
      audioKey: string;
      channelDataArrays: Float32Array[];
      config: SpectrogramConfig;
      sampleRate: number;
      offsetSamples: number;
      durationSamples: number;
      clipStartSample: number;
      monoFlag: boolean;
      colorMap: ColorMapValue;
    }> = [];

    tracks.forEach((track) => {
      const override = trackSpectrogramOverrides.get(track.id);
      const mode = resolveRenderMode(override, track.renderMode);
      if (mode === 'waveform') return;

      const trackConfigChanged =
        configChanged && currentKeys.get(track.id) !== prevKeys.get(track.id);
      const hasRegisteredCanvases =
        canvasVersionChanged &&
        track.clips.some((clip) => spectrogramCanvasRegistryRef.current.has(clip.id));
      if (!trackConfigChanged && !hasRegisteredCanvases) return;

      const cfg = override?.config ?? track.spectrogramConfig ?? spectrogramConfig ?? {};
      const cm =
        override?.colorMap ?? track.spectrogramColorMap ?? spectrogramColorMap ?? 'viridis';

      for (const clip of track.clips) {
        if (!clip.audioBuffer) continue;

        const monoFlag = mono || clip.audioBuffer.numberOfChannels === 1;
        const { offsetSamples, durationSamples } = resolveClipRange(
          clip,
          registeredClipRange(
            spectrogramCanvasRegistryRef.current.get(clip.id),
            canvasRangesRef.current
          )
        );

        clipsToRender.push({
          clipId: clip.id,
          audioKey: audioKeyOf(clip.audioBuffer),
          channelDataArrays: channelData(clip.audioBuffer),
          config: cfg,
          sampleRate: clip.audioBuffer.sampleRate,
          offsetSamples,
          durationSamples,
          clipStartSample: clip.startSample,
          monoFlag,
          colorMap: cm,
        });
      }
    });

    if (clipsToRender.length === 0) return;

    // Three-tier chunk classification:
    // - viewportIndices: chunks intersecting the exact viewport (phase 1a — fast first paint)
    // - bufferIndices: chunks in the 1.5× overscan buffer but outside viewport (phase 1b)
    // - remainingIndices: chunks outside the buffer (phase 2 — background batches)
    const getVisibleChunkRange = (
      channelInfo: { canvasIds: string[]; canvasWidths: number[] },
      clipPixelOffset = 0
    ): ChunkTiers => {
      const container = scrollContainerRef.current;
      return classifyChunkTiers(
        channelInfo,
        clipPixelOffset,
        container
          ? { scrollLeft: container.scrollLeft, viewportWidth: container.clientWidth }
          : null
      );
    };

    const renderChunkSubset = async (
      api: SpectrogramWorkerApi,
      cacheKey: string,
      channelInfo: { canvasIds: string[]; canvasWidths: number[] },
      requestedIndices: number[],
      item: { config: SpectrogramConfig; colorMap: ColorMapValue },
      channelIndex: number,
      gen: number
    ) => {
      // Indices are derived from channel 0's registry; this channel may have
      // registered fewer canvases so far (#562). Skipped chunks render on the
      // next pass — registration bumps spectrogramCanvasVersion.
      const indices = presentChunkIndices(channelInfo, requestedIndices);
      if (indices.length === 0) return;

      const canvasIds = indices.map((i) => channelInfo.canvasIds[i]);
      const canvasWidths = indices.map((i) => channelInfo.canvasWidths[i]);
      // The chunks of one channel are all as tall as the first.
      const canvasHeight = canvasHeightsRef.current.get(canvasIds[0]);
      if (canvasHeight === undefined) return;

      // Compute correct global pixel offsets by extracting chunk numbers from
      // canvas IDs. With virtual scrolling, the registry may contain non-consecutive
      // chunks (e.g., chunks 50-55), so summing widths from index 0 gives wrong offsets.
      const globalPixelOffsets: number[] = [];
      for (const idx of indices) {
        const chunkNumber = extractChunkNumber(channelInfo.canvasIds[idx]);
        globalPixelOffsets.push(chunkNumber * MAX_CANVAS_WIDTH);
      }

      const colorLUT = getColorMap(item.colorMap);

      await api.renderChunks(
        {
          cacheKey,
          canvasIds,
          canvasWidths,
          globalPixelOffsets,
          canvasHeight,
          devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
          samplesPerPixel,
          colorLUT,
          frequencyScale: item.config.frequencyScale ?? 'mel',
          minFrequency: item.config.minFrequency ?? 0,
          maxFrequency: item.config.maxFrequency ?? 0,
          gainDb: item.config.gainDb ?? 20,
          rangeDb: item.config.rangeDb ?? 80,
          channelIndex,
        },
        gen
      );
    };

    // Compute FFT for the sample range covered by a set of chunk indices.
    // Returns the cache key (data covers all channels).
    // This avoids computing a single full-clip FFT (which OOMs on 1hr+ files)
    // by computing per-batch ranges on demand.
    const computeFFTForChunks = async (
      api: SpectrogramWorkerApi,
      channelInfo: { canvasIds: string[]; canvasWidths: number[] },
      indices: number[],
      item: {
        audioKey: string;
        channelDataArrays: Float32Array[];
        config: SpectrogramConfig;
        sampleRate: number;
        offsetSamples: number;
        durationSamples: number;
        monoFlag: boolean;
      },
      gen: number
    ): Promise<string> => {
      // Determine the (window-padded) sample range these chunks cover.
      const { paddedStart, paddedEnd } = computeChunkSampleRange({
        channelInfo,
        indices,
        fftSize: item.config.fftSize ?? 2048,
        offsetSamples: item.offsetSamples,
        durationSamples: item.durationSamples,
        samplesPerPixel,
      });

      const { cacheKey } = await api.computeFFT(
        {
          // The pool's "clip id" names the registered audio: the buffer's key.
          clipId: item.audioKey,
          channelDataArrays: item.channelDataArrays,
          config: item.config,
          sampleRate: item.sampleRate,
          offsetSamples: item.offsetSamples,
          durationSamples: item.durationSamples,
          mono: item.monoFlag,
          sampleRange: { start: paddedStart, end: paddedEnd },
        },
        gen
      );

      return cacheKey;
    };

    const computeAsync = async () => {
      const abortToken = { aborted: false };
      backgroundRenderAbortRef.current = abortToken;

      // Render off-screen chunks in idle-callback batches, computing FFT
      // per contiguous group to avoid allocating one giant Float32Array for the
      // full clip (which OOMs on 1hr+ files — e.g., 310K frames × 2048 bins = 2.5GB).
      // Groups remaining indices into contiguous runs (e.g., [0,1,4,5] → [0,1]+[4,5])
      // so each FFT only covers the sample range actually needed.
      // Returns true if aborted (caller should return early).
      const renderBackgroundBatches = async (
        channelRanges: Array<{
          ch: number;
          channelInfo: { canvasIds: string[]; canvasWidths: number[] };
          remainingIndices: number[];
        }>,
        item: {
          audioKey: string;
          channelDataArrays: Float32Array[];
          config: SpectrogramConfig;
          sampleRate: number;
          offsetSamples: number;
          durationSamples: number;
          monoFlag: boolean;
          colorMap: ColorMapValue;
        }
      ): Promise<boolean> => {
        // Collect all contiguous groups across channels, then render
        // each group for ALL channels before moving to the next group
        // (multi-channel fairness — avoids ch1 starvation).
        const allGroups: Array<{
          group: number[];
          channelRangeEntries: Array<{
            ch: number;
            channelInfo: { canvasIds: string[]; canvasWidths: number[] };
          }>;
        }> = [];

        // Build contiguous groups from the first channel's remaining indices
        // (all channels have the same chunk layout).
        if (channelRanges.length > 0) {
          const { channelInfo, remainingIndices } = channelRanges[0];
          const groups = groupContiguousIndices(channelInfo, remainingIndices);
          for (const group of groups) {
            allGroups.push({
              group,
              channelRangeEntries: channelRanges.map(({ ch, channelInfo: ci }) => ({
                ch,
                channelInfo: ci,
              })),
            });
          }
        }

        for (const { group, channelRangeEntries } of allGroups) {
          if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return true;

          await new Promise<void>((resolve) => {
            if (typeof requestIdleCallback === 'function') {
              requestIdleCallback(() => resolve());
            } else {
              setTimeout(resolve, 0);
            }
          });

          if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return true;

          // Compute FFT once for this contiguous group (covers all channels)
          const { channelInfo: firstChannelInfo } = channelRangeEntries[0];
          const cacheKey = await computeFFTForChunks(
            workerApi!,
            firstChannelInfo,
            group,
            item,
            generation
          );

          // Render all channels from the cached FFT data
          for (const { ch, channelInfo: ci } of channelRangeEntries) {
            if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return true;
            await renderChunkSubset(workerApi!, cacheKey, ci, group, item, ch, generation);
          }
        }
        return false;
      };

      for (const item of clipsToRender) {
        if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

        try {
          const clipCanvasInfo = spectrogramCanvasRegistryRef.current.get(item.clipId);
          if (clipCanvasInfo && clipCanvasInfo.size > 0) {
            const numChannels = item.monoFlag ? 1 : item.channelDataArrays.length;
            const clipPixelOffset = Math.floor(item.clipStartSample / samplesPerPixel);

            // Three-phase rendering:
            // Phase 1a: viewport-only chunks (fast first paint)
            // Phase 1b: buffer-zone chunks (prevents black chunks on scroll)
            // Phase 2: off-screen chunks (background batches)
            const channelRanges: Array<{
              ch: number;
              channelInfo: { canvasIds: string[]; canvasWidths: number[] };
              viewportIndices: number[];
              bufferIndices: number[];
              remainingIndices: number[];
            }> = [];

            for (let ch = 0; ch < numChannels; ch++) {
              const channelInfo = clipCanvasInfo.get(ch);
              if (!channelInfo) continue;
              const range = getVisibleChunkRange(channelInfo, clipPixelOffset);
              channelRanges.push({ ch, channelInfo, ...range });
            }

            // Phase 1a: Compute FFT for viewport chunks only, render all channels
            if (channelRanges.length > 0 && channelRanges[0].viewportIndices.length > 0) {
              const cacheKey = await computeFFTForChunks(
                workerApi!,
                channelRanges[0].channelInfo,
                channelRanges[0].viewportIndices,
                item,
                generation
              );

              if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

              for (const { ch, channelInfo, viewportIndices } of channelRanges) {
                await renderChunkSubset(
                  workerApi!,
                  cacheKey,
                  channelInfo,
                  viewportIndices,
                  item,
                  ch,
                  generation
                );
              }
            }

            if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

            // Phase 1b: Compute FFT for buffer-zone chunks, render all channels.
            // Buffer indices may be non-contiguous (e.g., chunks [10,14,15] from
            // indices [0,3,4,5]), so group them to avoid spanning a huge FFT range.
            if (channelRanges.length > 0 && channelRanges[0].bufferIndices.length > 0) {
              const bufferGroups = groupContiguousIndices(
                channelRanges[0].channelInfo,
                channelRanges[0].bufferIndices
              );

              for (const group of bufferGroups) {
                if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

                const cacheKey = await computeFFTForChunks(
                  workerApi!,
                  channelRanges[0].channelInfo,
                  group,
                  item,
                  generation
                );

                if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

                for (const { ch, channelInfo } of channelRanges) {
                  await renderChunkSubset(
                    workerApi!,
                    cacheKey,
                    channelInfo,
                    group,
                    item,
                    ch,
                    generation
                  );
                }
              }
            }

            if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

            // Phase 2: Render off-screen chunks in background batches
            // (each batch computes its own bounded FFT range).
            if (await renderBackgroundBatches(channelRanges, item)) return;
          }
        } catch (err) {
          if (err instanceof SpectrogramAbortError) return;
          console.warn(
            `[waveform-playlist] Spectrogram worker error for clip ${item.clipId}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    };

    computeAsync().catch((err) => {
      console.error(
        `[waveform-playlist] Spectrogram computation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }, [
    tracks,
    mono,
    spectrogramConfig,
    spectrogramColorMap,
    trackSpectrogramOverrides,
    samplesPerPixel,
    spectrogramCanvasVersion,
    scrollContainerRef,
    audioKeyOf,
    ensureWorkerPool,
  ]);

  // Setters
  const setTrackRenderMode = useCallback((trackId: string, mode: RenderMode) => {
    setTrackSpectrogramOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(trackId);
      next.set(trackId, { ...existing, renderMode: mode });
      return next;
    });
  }, []);

  const setTrackSpectrogramConfig = useCallback(
    (trackId: string, config: SpectrogramConfig, colorMap?: ColorMapValue) => {
      setTrackSpectrogramOverrides((prev) => {
        const next = new Map(prev);
        const existing = next.get(trackId);
        // No render mode of its own: the track's, or the one chosen in the
        // menu, keeps applying (review of #926).
        next.set(trackId, {
          ...existing,
          config,
          colorMap: colorMap ?? existing?.colorMap,
        });
        return next;
      });
    },
    []
  );

  const registerSpectrogramCanvas = useCallback(
    (reg: SpectrogramCanvasRegistration) => {
      const pool = ensureWorkerPool();
      if (!pool) return;

      try {
        pool.registerCanvas(reg.canvasId, reg.canvas);
      } catch (err) {
        console.warn(
          `[waveform-playlist] registerCanvas failed for ${reg.canvasId}: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
      }

      canvasHeightsRef.current.set(reg.canvasId, reg.heightPx);
      if (reg.offsetSamples !== undefined || reg.durationSamples !== undefined) {
        canvasRangesRef.current.set(reg.canvasId, {
          offsetSamples: reg.offsetSamples,
          durationSamples: reg.durationSamples,
        });
      } else {
        canvasRangesRef.current.delete(reg.canvasId);
      }
      const registry = spectrogramCanvasRegistryRef.current;
      if (!registry.has(reg.clipId)) {
        registry.set(reg.clipId, new Map());
      }
      const perClip = registry.get(reg.clipId)!;
      const entry = perClip.get(reg.channelIndex) ?? { canvasIds: [], canvasWidths: [] };
      const existingIdx = entry.canvasIds.indexOf(reg.canvasId);
      if (existingIdx >= 0) {
        entry.canvasWidths[existingIdx] = reg.widthPx;
      } else {
        entry.canvasIds.push(reg.canvasId);
        entry.canvasWidths.push(reg.widthPx);
      }
      perClip.set(reg.channelIndex, entry);
      setSpectrogramCanvasVersion((v) => v + 1);
    },
    [ensureWorkerPool]
  );

  const unregisterSpectrogramCanvas = useCallback((canvasId: string) => {
    canvasHeightsRef.current.delete(canvasId);
    canvasRangesRef.current.delete(canvasId);
    const pool = spectrogramWorkerRef.current;
    if (pool) {
      try {
        pool.unregisterCanvas(canvasId);
      } catch (err) {
        console.warn(
          `[waveform-playlist] unregisterCanvas failed for ${canvasId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Canvas IDs follow the format `${clipId}-ch${channelIndex}-chunk${n}`.
    const parsed = parseCanvasId(canvasId);
    if (!parsed) return;
    const { clipId, channelIndex } = parsed;

    const registry = spectrogramCanvasRegistryRef.current;
    const perClip = registry.get(clipId);
    if (!perClip) return;
    const entry = perClip.get(channelIndex);
    if (!entry) return;
    const idx = entry.canvasIds.indexOf(canvasId);
    if (idx >= 0) {
      entry.canvasIds.splice(idx, 1);
      entry.canvasWidths.splice(idx, 1);
    }
    if (entry.canvasIds.length === 0) {
      perClip.delete(channelIndex);
    }
    if (perClip.size === 0) {
      registry.delete(clipId);
    }
    setSpectrogramCanvasVersion((v) => v + 1);
  }, []);

  const renderMenuItems = useCallback(
    (props: {
      renderMode: string;
      onRenderModeChange: (mode: RenderMode) => void;
      onOpenSettings: () => void;
      onClose?: () => void;
    }) => {
      return SpectrogramMenuItems({
        renderMode: props.renderMode as RenderMode,
        onRenderModeChange: props.onRenderModeChange,
        onOpenSettings: props.onOpenSettings,
        onClose: props.onClose,
      });
    },
    []
  );

  const value: SpectrogramIntegration = useMemo(
    () => ({
      trackSpectrogramOverrides,
      spectrogramConfig,
      spectrogramColorMap,
      setTrackRenderMode,
      setTrackSpectrogramConfig,
      registerSpectrogramCanvas,
      unregisterSpectrogramCanvas,
      renderMenuItems,
      SettingsModal: SpectrogramSettingsModal,
      getColorMap,
      getFrequencyScale: getFrequencyScale as (
        name: string
      ) => (f: number, minF: number, maxF: number) => number,
    }),
    [
      trackSpectrogramOverrides,
      spectrogramConfig,
      spectrogramColorMap,
      setTrackRenderMode,
      setTrackSpectrogramConfig,
      registerSpectrogramCanvas,
      unregisterSpectrogramCanvas,
      renderMenuItems,
    ]
  );

  return <SpectrogramIntegrationProvider value={value}>{children}</SpectrogramIntegrationProvider>;
};
