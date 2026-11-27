import { createContext, use } from 'react';
import { installCommand } from './utils/installCommand';
import type {
  SpectrogramConfig,
  ColorMapValue,
  RenderMode,
  SpectrogramCanvasRegistration,
} from '@waveform-playlist/core';
import type { TrackMenuItem } from '@waveform-playlist/ui-components';

export interface SpectrogramIntegration {
  spectrogramConfig?: SpectrogramConfig;
  spectrogramColorMap?: ColorMapValue;
  /**
   * Set a track's `renderMode` in the arrangement (an undo step). The mode
   * the track is already drawn with (an unset one is `'waveform'`) changes
   * nothing, and so does any mode for a MIDI track (drawn as a piano roll).
   * The track menu and `useTrack().setRenderMode` call it.
   */
  setTrackRenderMode: (trackId: string, mode: RenderMode) => void;
  /**
   * Set a track's `spectrogramConfig`, and its `spectrogramColorMap` when one
   * is given, in the arrangement (an undo step). The settings dialog's Apply
   * calls it.
   */
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
    /** The provider's sample rate (its audio context's); half of it is the default top frequency. */
    sampleRate?: number;
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
  const context = use(SpectrogramIntegrationContext);
  if (!context) {
    throw new Error(
      'useSpectrogramIntegration must be used within <SpectrogramProvider>. ' +
        'Install @waveform-playlist/spectrogram (' +
        installCommand('@waveform-playlist/spectrogram') +
        ') and wrap your app with <SpectrogramProvider>.'
    );
  }
  return context;
}
