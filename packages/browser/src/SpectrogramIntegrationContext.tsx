import { createContext, useContext } from 'react';
import type {
  SpectrogramConfig,
  ColorMapValue,
  RenderMode,
  TrackSpectrogramOverrides,
} from '@waveform-playlist/core';
import type { TrackMenuItem } from '@waveform-playlist/ui-components';

/**
 * Single-call canvas registration shape. Consolidates the OffscreenCanvas
 * transfer and per-canvas metadata that earlier required two separate
 * registration paths.
 *
 * Provider/orchestrator look up trackId from clipId and derive
 * globalPixelOffset = chunkIndex * MAX_CANVAS_WIDTH.
 */
export interface SpectrogramCanvasRegistration {
  canvasId: string;
  canvas: OffscreenCanvas;
  clipId: string;
  channelIndex: number;
  chunkIndex: number;
  widthPx: number;
  heightPx: number;
}

export interface SpectrogramIntegration {
  trackSpectrogramOverrides: Map<string, TrackSpectrogramOverrides>;
  spectrogramConfig?: SpectrogramConfig;
  spectrogramColorMap?: ColorMapValue;
  setTrackRenderMode: (trackId: string, mode: RenderMode) => void;
  setTrackSpectrogramConfig: (
    trackId: string,
    config: SpectrogramConfig,
    colorMap?: ColorMapValue
  ) => void;
  /** Single-canvas registration. OffscreenCanvas is non-transferable — call once per canvas. */
  registerSpectrogramCanvas: (reg: SpectrogramCanvasRegistration) => void;
  unregisterSpectrogramCanvas: (canvasId: string) => void;
  /** Render spectrogram menu items for a track's context menu */
  renderMenuItems?: (props: {
    renderMode: string;
    onRenderModeChange: (mode: RenderMode) => void;
    onOpenSettings: () => void;
    onClose?: () => void;
  }) => TrackMenuItem[];
  /** Settings modal component provided by the spectrogram package */
  SettingsModal?: React.ComponentType<{
    open: boolean;
    onClose: () => void;
    config: SpectrogramConfig;
    colorMap: ColorMapValue;
    onApply: (config: SpectrogramConfig, colorMap: ColorMapValue) => void;
  }>;
  /** Get color lookup table for a color map name */
  getColorMap: (name: ColorMapValue) => Uint8Array;
  /** Get frequency scale function for a scale name */
  getFrequencyScale: (name: string) => (f: number, minF: number, maxF: number) => number;
}

export const SpectrogramIntegrationContext = createContext<SpectrogramIntegration | null>(null);

export const SpectrogramIntegrationProvider = SpectrogramIntegrationContext.Provider;

/**
 * Hook to access spectrogram integration provided by @waveform-playlist/spectrogram.
 * Throws if used without <SpectrogramProvider> wrapping the component tree.
 *
 * Follows the Kent C. Dodds pattern:
 * https://kentcdodds.com/blog/how-to-use-react-context-effectively
 */
export function useSpectrogramIntegration(): SpectrogramIntegration {
  const context = useContext(SpectrogramIntegrationContext);
  if (!context) {
    throw new Error(
      'useSpectrogramIntegration must be used within <SpectrogramProvider>. ' +
        'Install @waveform-playlist/spectrogram and wrap your app with <SpectrogramProvider>.'
    );
  }
  return context;
}
