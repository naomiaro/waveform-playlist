import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  SpectrogramOrchestrator,
  type ClipRegistration,
  type CanvasRegistration,
  type ViewportState,
} from '@dawcore/spectrogram';
import type { SpectrogramConfig, ColorMapValue } from '@waveform-playlist/core';
import {
  SPECTROGRAM_DEFAULTS as LIBRARY_DEFAULTS,
  DEFAULT_SPECTROGRAM_COLOR_MAP as LIBRARY_DEFAULT_COLOR_MAP,
} from '@waveform-playlist/core';

export interface SpectrogramControllerHost extends ReactiveControllerHost {
  dispatchEvent(event: Event): boolean;
}

/**
 * Lit reactive controller that owns a `SpectrogramOrchestrator` for the
 * `<daw-editor>` host. Creates the orchestrator lazily on first canvas
 * registration so editors without spectrogram tracks pay nothing.
 *
 * Holds editor-level defaults and per-track overrides separately; merges
 * them down to a single (config, colorMap) pair for the orchestrator on
 * each change.
 *
 * v1 limitation: orchestrator accepts ONE config / colorMap at a time, so
 * the "first registered track wins" rule applies when multiple tracks are
 * in spectrogram mode with different overrides. Multi-track per-clip
 * configs are deferred to a follow-up.
 */
export class SpectrogramController implements ReactiveController {
  private host: SpectrogramControllerHost;
  private workerFactory: () => Worker;
  private orchestrator: SpectrogramOrchestrator | null = null;

  private editorConfig: SpectrogramConfig | null = null;
  private editorColorMap: ColorMapValue | null = null;
  private trackConfigs = new Map<string, SpectrogramConfig | null>();
  private trackColorMaps = new Map<string, ColorMapValue | null>();

  constructor(host: SpectrogramControllerHost, workerFactory: () => Worker) {
    this.host = host;
    this.workerFactory = workerFactory;
    this.host.addController(this);
  }

  hostConnected(): void {
    // Lazy — orchestrator created on first registerCanvas.
  }

  hostDisconnected(): void {
    this.dispose();
  }

  setEditorConfig(config: SpectrogramConfig | null): void {
    this.editorConfig = config;
    this.reapply();
  }

  setEditorColorMap(colorMap: ColorMapValue | null): void {
    this.editorColorMap = colorMap;
    this.reapply();
  }

  setTrackConfig(trackId: string, config: SpectrogramConfig | null): void {
    if (config === null) {
      this.trackConfigs.delete(trackId);
    } else {
      this.trackConfigs.set(trackId, config);
    }
    this.reapply();
  }

  setTrackColorMap(trackId: string, colorMap: ColorMapValue | null): void {
    if (colorMap === null) {
      this.trackColorMaps.delete(trackId);
    } else {
      this.trackColorMaps.set(trackId, colorMap);
    }
    this.reapply();
  }

  registerClipAudio(reg: ClipRegistration): void {
    this.ensureOrchestrator().registerClip(reg);
  }

  unregisterClipAudio(clipId: string): void {
    this.orchestrator?.unregisterClip(clipId);
  }

  registerCanvas(reg: CanvasRegistration): void {
    this.ensureOrchestrator().registerCanvas(reg);
  }

  unregisterCanvas(canvasId: string): void {
    this.orchestrator?.unregisterCanvas(canvasId);
  }

  setViewport(state: ViewportState): void {
    this.orchestrator?.setViewport(state);
  }

  dispose(): void {
    if (this.orchestrator) {
      this.orchestrator.dispose();
      this.orchestrator = null;
    }
  }

  private ensureOrchestrator(): SpectrogramOrchestrator {
    if (!this.orchestrator) {
      this.orchestrator = new SpectrogramOrchestrator({
        workerFactory: this.workerFactory,
        workerPoolSize: 2,
        config: this.mergedConfig(),
        colorMap: this.mergedColorMap(),
      });
      this.orchestrator.addEventListener('viewport-ready', (e: Event) => {
        const detail = (e as CustomEvent<{ trackId: string; generation: number }>).detail;
        this.host.dispatchEvent(
          new CustomEvent('daw-spectrogram-ready', {
            detail: { trackId: detail.trackId, generation: detail.generation },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.orchestrator.addEventListener('viewport-error', (e: Event) => {
        const detail = (e as CustomEvent<{ trackId: string; generation: number; error: Error }>)
          .detail;
        this.host.dispatchEvent(
          new CustomEvent('daw-spectrogram-error', {
            detail: {
              trackId: detail.trackId,
              generation: detail.generation,
              error: detail.error,
            },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.reapply();
    }
    return this.orchestrator;
  }

  private reapply(): void {
    if (!this.orchestrator) return;
    this.orchestrator.setConfig(this.mergedConfig());
    this.orchestrator.setColorMap(this.mergedColorMap());
  }

  private mergedConfig(): SpectrogramConfig {
    // First track override wins (v1 limitation noted above).
    let track: SpectrogramConfig | null = null;
    for (const c of this.trackConfigs.values()) {
      track = c;
      break;
    }
    return { ...LIBRARY_DEFAULTS, ...(this.editorConfig ?? {}), ...(track ?? {}) };
  }

  private mergedColorMap(): ColorMapValue {
    for (const c of this.trackColorMaps.values()) {
      return c ?? LIBRARY_DEFAULT_COLOR_MAP;
    }
    return this.editorColorMap ?? LIBRARY_DEFAULT_COLOR_MAP;
  }
}
