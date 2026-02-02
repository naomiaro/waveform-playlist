---
sidebar_position: 4
title: LLM API Reference
description: Machine-readable API reference for LLMs and coding agents. All TypeScript interfaces from source.
---

# LLM API Reference

This page contains all TypeScript interfaces extracted from source code. Designed for LLMs and coding agents — no prose, just types.

**Source of truth:** `packages/browser/src/WaveformPlaylistContext.tsx`, `packages/browser/src/MediaElementPlaylistContext.tsx`

---

## Provider Props (WaveformPlaylistProvider)

```typescript
interface WaveformPlaylistProviderProps {
  tracks: ClipTrack[];
  children: ReactNode;
  timescale?: boolean;
  mono?: boolean;
  waveHeight?: number;                    // Default: 80
  samplesPerPixel?: number;               // Default: 1024
  zoomLevels?: number[];
  automaticScroll?: boolean;              // Default: false
  theme?: Partial<WaveformPlaylistTheme>;
  controls?: { show: boolean; width: number }; // Default: { show: false, width: 0 }
  annotationList?: {
    annotations?: any[];
    editable?: boolean;
    isContinuousPlay?: boolean;
    linkEndpoints?: boolean;
    controls?: any[];
  };
  effects?: EffectsFunction;
  onReady?: () => void;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  barWidth?: number;                      // Default: 1
  barGap?: number;                        // Default: 0
  progressBarWidth?: number;              // Default: barWidth + barGap
}
```

---

## Provider Props (MediaElementPlaylistProvider)

```typescript
interface MediaElementTrackConfig {
  source: string;                        // Audio source URL or Blob URL
  waveformData: WaveformDataObject;      // Pre-computed waveform data (required)
  name?: string;                         // Track name for display
}

interface MediaElementPlaylistProviderProps {
  track: MediaElementTrackConfig;
  children: ReactNode;
  samplesPerPixel?: number;              // Default: 1024
  waveHeight?: number;                   // Default: 100
  timescale?: boolean;                   // Default: false
  playbackRate?: number;                 // Default: 1 (range: 0.5–2.0, pitch-preserving)
  automaticScroll?: boolean;             // Default: false
  theme?: Partial<WaveformPlaylistTheme>;
  controls?: { show: boolean; width: number }; // Default: { show: false, width: 0 }
  annotationList?: {
    annotations?: any[];
    isContinuousPlay?: boolean;
  };
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  onReady?: () => void;
  barWidth?: number;                     // Default: 1
  barGap?: number;                       // Default: 0
  progressBarWidth?: number;             // Default: barWidth + barGap
}
```

---

## MediaElement Context Hooks

### useMediaElementAnimation()

```typescript
interface MediaElementAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: RefObject<number>;
}
```

### useMediaElementState()

```typescript
interface MediaElementStateContextValue {
  continuousPlay: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  playbackRate: number;
  isAutomaticScroll: boolean;
}
```

### useMediaElementControls()

```typescript
interface MediaElementControlsContextValue {
  play: (startTime?: number) => void;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setContinuousPlay: (enabled: boolean) => void;
  setAnnotations: Dispatch<SetStateAction<AnnotationData[]>>;
  setActiveAnnotationId: (id: string | null) => void;
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}
```

### useMediaElementData()

```typescript
interface MediaElementDataContextValue {
  duration: number;
  peaksDataArray: TrackClipPeaks[];
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  samplesPerPixel: number;
  playoutRef: RefObject<MediaElementPlayout | null>;
  controls: { show: boolean; width: number };
  barWidth: number;
  barGap: number;
  progressBarWidth: number;
}
```

---

## WaveformPlaylist Context Hooks

### usePlaybackAnimation()

```typescript
interface PlaybackAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: RefObject<number>;
  playbackStartTimeRef: RefObject<number>;
  audioStartPositionRef: RefObject<number>;
}
```

### usePlaylistState()

```typescript
interface PlaylistStateContextValue {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  annotationsEditable: boolean;
  isAutomaticScroll: boolean;
  isLoopEnabled: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
  selectedTrackId: string | null;
  loopStart: number;
  loopEnd: number;
}
```

### usePlaylistControls()

```typescript
interface PlaylistControlsContextValue {
  // Playback
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setCurrentTime: (time: number) => void;

  // Track controls
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;

  // Selection
  setSelection: (start: number, end: number) => void;
  setSelectedTrackId: (trackId: string | null) => void;

  // Time format
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (seconds: number) => string;

  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;

  // Master volume
  setMasterVolume: (volume: number) => void;

  // Scroll
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;

  // Annotation controls
  setContinuousPlay: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setAnnotations: Dispatch<SetStateAction<AnnotationData[]>>;
  setActiveAnnotationId: (id: string | null) => void;

  // Loop controls
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;
}
```

### usePlaylistData()

```typescript
interface PlaylistDataContextValue {
  duration: number;
  audioBuffers: AudioBuffer[];
  peaksDataArray: TrackClipPeaks[];
  trackStates: TrackState[];
  tracks: ClipTrack[];
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  minimumPlaylistHeight: number;
  controls: { show: boolean; width: number };
  playoutRef: RefObject<TonePlayout | null>;
  samplesPerPixel: number;
  timeFormat: string;
  masterVolume: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  barWidth: number;
  barGap: number;
  progressBarWidth: number;
  isReady: boolean;
}
```

---

## Data Types

```typescript
interface TrackState {
  name: string;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
}

interface ClipPeaks {
  clipId: string;
  trackName: string;
  peaks: PeakData;
  startSample: number;
  durationSamples: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
}

type TrackClipPeaks = ClipPeaks[];
```

---

## useAudioTracks

```typescript
function useAudioTracks(
  configs: AudioTrackConfig[],
  options?: UseAudioTracksOptions
): {
  tracks: ClipTrack[];
  loading: boolean;
  error: string | null;
  progress: number;
};

interface AudioTrackConfig {
  src?: string;
  audioBuffer?: AudioBuffer;
  name?: string;
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  color?: string;
  effects?: TrackEffectsFunction;
  startTime?: number;
  duration?: number;
  offset?: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
  waveformData?: WaveformDataObject;
}

interface UseAudioTracksOptions {
  progressive?: boolean;  // Default: false
}
```

---

## Effects Hooks

### useDynamicEffects

```typescript
function useDynamicEffects(fftSize?: number): UseDynamicEffectsReturn;

interface UseDynamicEffectsReturn {
  activeEffects: ActiveEffect[];
  availableEffects: EffectDefinition[];
  addEffect: (effectId: string) => void;
  removeEffect: (instanceId: string) => void;
  updateParameter: (instanceId: string, paramName: string, value: number | string | boolean) => void;
  toggleBypass: (instanceId: string) => void;
  reorderEffects: (fromIndex: number, toIndex: number) => void;
  clearAllEffects: () => void;
  masterEffects: EffectsFunction;
  createOfflineEffectsFunction: () => EffectsFunction | undefined;
  analyserRef: RefObject<any>;
}

interface ActiveEffect {
  instanceId: string;
  effectId: string;
  definition: EffectDefinition;
  params: Record<string, number | string | boolean>;
  bypassed: boolean;
}
```

### useTrackDynamicEffects

```typescript
function useTrackDynamicEffects(): UseTrackDynamicEffectsReturn;

interface UseTrackDynamicEffectsReturn {
  trackEffectsState: Map<string, TrackActiveEffect[]>;
  addEffectToTrack: (trackId: string, effectId: string) => void;
  removeEffectFromTrack: (trackId: string, instanceId: string) => void;
  updateTrackEffectParameter: (trackId: string, instanceId: string, paramName: string, value: number | string | boolean) => void;
  toggleBypass: (trackId: string, instanceId: string) => void;
  clearTrackEffects: (trackId: string) => void;
  getTrackEffectsFunction: (trackId: string) => TrackEffectsFunction | undefined;
  createOfflineTrackEffectsFunction: (trackId: string) => TrackEffectsFunction | undefined;
  availableEffects: EffectDefinition[];
}

interface TrackActiveEffect {
  instanceId: string;
  effectId: string;
  definition: EffectDefinition;
  params: Record<string, number | string | boolean>;
  bypassed: boolean;
}
```

---

## Editing Hooks

### useClipDragHandlers

```typescript
function useClipDragHandlers(options: UseClipDragHandlersOptions): {
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  collisionModifier: Modifier;
};

interface UseClipDragHandlersOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  samplesPerPixel: number;
  sampleRate: number;
}
```

### useClipSplitting

```typescript
function useClipSplitting(options: UseClipSplittingOptions): UseClipSplittingResult;

interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  sampleRate: number;
  samplesPerPixel: number;
}

interface UseClipSplittingResult {
  splitClipAtPlayhead: () => boolean;
  splitClipAt: (trackIndex: number, clipIndex: number, splitTime: number) => boolean;
}
```

---

## Recording (`@waveform-playlist/recording`)

### useIntegratedRecording

```typescript
function useIntegratedRecording(
  tracks: ClipTrack[],
  setTracks: (tracks: ClipTrack[]) => void,
  selectedTrackId: string | null,
  options?: IntegratedRecordingOptions
): UseIntegratedRecordingReturn;

interface IntegratedRecordingOptions {
  currentTime?: number;
  audioConstraints?: MediaTrackConstraints;
  channelCount?: number;      // Default: 1
  samplesPerPixel?: number;   // Default: 1024
}

interface UseIntegratedRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  level: number;
  peakLevel: number;
  error: Error | null;
  stream: MediaStream | null;
  devices: MicrophoneDevice[];
  hasPermission: boolean;
  selectedDevice: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  requestMicAccess: () => Promise<void>;
  changeDevice: (deviceId: string) => Promise<void>;
  recordingPeaks: Int8Array | Int16Array;
}
```

---

## Export

### useExportWav

```typescript
function useExportWav(): UseExportWavReturn;

interface UseExportWavReturn {
  exportWav: (tracks: ClipTrack[], trackStates: TrackState[], options?: ExportOptions) => Promise<ExportResult>;
  isExporting: boolean;
  progress: number;
  error: string | null;
}

interface ExportOptions {
  filename?: string;
  mode?: 'master' | 'individual';
  trackIndex?: number;
  autoDownload?: boolean;
  applyEffects?: boolean;        // Default: true
  effectsFunction?: EffectsFunction;
  createOfflineTrackEffects?: (trackId: string) => TrackEffectsFunction | undefined;
  onProgress?: (progress: number) => void;
  bitDepth?: 16 | 32;
}

interface ExportResult {
  audioBuffer: AudioBuffer;
  blob: Blob;
  duration: number;
}
```

---

## Keyboard Shortcuts

```typescript
function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void;

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
  preventDefault?: boolean;
}

function usePlaybackShortcuts(options?: UsePlaybackShortcutsOptions): UsePlaybackShortcutsReturn;
// Default shortcuts: Space (play/pause), Escape (stop), 0 (rewind)
```

---

## Waveform Component Props

```typescript
interface WaveformProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  renderTimestamp?: (timeMs: number, pixelPosition: number) => ReactNode;
  renderPlayhead?: RenderPlayheadFunction;
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => ReactNode;
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  annotationControls?: AnnotationAction[];
  annotationListConfig?: AnnotationActionOptions;
  annotationTextHeight?: number;
  scrollActivePosition?: ScrollLogicalPosition;
  scrollActiveContainer?: 'nearest' | 'all';
  className?: string;
  showClipHeaders?: boolean;      // Default: false
  interactiveClips?: boolean;     // Default: false
  showFades?: boolean;
  touchOptimized?: boolean;
  recordingState?: {
    isRecording: boolean;
    trackId: string;
    startSample: number;
    durationSamples: number;
    peaks: Int8Array | Int16Array;
  };
}
```

---

## Pre-built Components

```
Buttons: PlayButton, PauseButton, StopButton, RewindButton, FastForwardButton,
         SkipBackwardButton, SkipForwardButton, LoopButton, SetLoopRegionButton,
         ZoomInButton, ZoomOutButton, ExportWavButton, DownloadAnnotationsButton
Controls: MasterVolumeControl, TimeFormatSelect, AudioPosition, SelectionTimeInputs
Checkboxes: AutomaticScrollCheckbox, ContinuousPlayCheckbox, LinkEndpointsCheckbox, EditableCheckbox
Playheads: Playhead, PlayheadWithMarker (from @waveform-playlist/ui-components)
```

All button/control components connect to context automatically. No props required for basic usage. All accept `className` and `style`.

---

## Spectrogram (@waveform-playlist/spectrogram)

Spectrogram is an **optional** package. Integrate via `SpectrogramProvider`:

```typescript
import { SpectrogramProvider } from '@waveform-playlist/spectrogram';

<WaveformPlaylistProvider tracks={tracks}>
  <SpectrogramProvider config={spectrogramConfig} colorMap="viridis">
    <Waveform />
  </SpectrogramProvider>
</WaveformPlaylistProvider>

interface SpectrogramProviderProps {
  config?: SpectrogramConfig;
  colorMap?: ColorMapValue;
  children: ReactNode;
}
```

```typescript
// From @waveform-playlist/core
type FFTSize = 256 | 512 | 1024 | 2048 | 4096 | 8192;
type ColorMapEntry = [number, number, number] | [number, number, number, number];
type ColorMapName = 'viridis' | 'magma' | 'inferno' | 'grayscale' | 'igray' | 'roseus';
type ColorMapValue = ColorMapName | ColorMapEntry[];
type RenderMode = 'waveform' | 'spectrogram' | 'both';

interface SpectrogramConfig {
  fftSize?: FFTSize;                    // Default: 2048
  hopSize?: number;                     // Default: fftSize / 4
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'rectangular' | 'bartlett' | 'blackman-harris';
  alpha?: number;                       // Window function parameter (0-1)
  frequencyScale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'; // Default: 'mel'
  minFrequency?: number;               // Default: 0
  maxFrequency?: number;               // Default: sampleRate / 2
  gainDb?: number;                     // Default: 20
  rangeDb?: number;                    // Default: 80
  zeroPaddingFactor?: number;          // Default: 2
  labels?: boolean;                    // Default: false
  labelsColor?: string;
  labelsBackground?: string;
}

interface SpectrogramData {
  fftSize: number;
  windowSize: number;
  frequencyBinCount: number;
  sampleRate: number;
  hopSize: number;
  frameCount: number;
  data: Float32Array;                  // frameCount * frequencyBinCount (row-major)
  gainDb: number;
  rangeDb: number;
}

interface TrackSpectrogramOverrides {
  renderMode: RenderMode;
  config?: SpectrogramConfig;
  colorMap?: ColorMapValue;
}

// From @waveform-playlist/spectrogram
interface SpectrogramWorkerApi {
  compute(params: SpectrogramWorkerComputeParams): Promise<SpectrogramData[]>;
  computeFFT(params: SpectrogramWorkerFFTParams): Promise<{ cacheKey: string }>;
  renderChunks(params: SpectrogramWorkerRenderChunksParams): Promise<void>;
  registerCanvas(canvasId: string, canvas: OffscreenCanvas): void;
  unregisterCanvas(canvasId: string): void;
  registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void;
  unregisterAudioData(clipId: string): void;
  computeAndRender(params: SpectrogramWorkerRenderParams): Promise<void>;
  terminate(): void;
}

// Key exports
export { SpectrogramProvider } from '@waveform-playlist/spectrogram';
export { computeSpectrogram, computeSpectrogramMono, getColorMap, getFrequencyScale } from '@waveform-playlist/spectrogram';
export { createSpectrogramWorker } from '@waveform-playlist/spectrogram';
export { SpectrogramMenuItems, SpectrogramSettingsModal } from '@waveform-playlist/spectrogram';

// Integration context (from @waveform-playlist/browser)
export { useSpectrogramIntegration, SpectrogramIntegrationProvider } from '@waveform-playlist/browser';
export type { SpectrogramIntegration, SpectrogramWorkerApi } from '@waveform-playlist/browser';
```

---

## Utilities

```typescript
// Waveform data (BBC audiowaveform)
loadWaveformData(src: string): Promise<WaveformData>;
waveformDataToPeaks(data: WaveformData, samplesPerPixel: number): PeakData;
loadPeaksFromWaveformData(src: string, samplesPerPixel: number): Promise<PeakData>;
getWaveformDataMetadata(data: WaveformData): { sampleRate: number; duration: number; channels: number };

// Effects
effectDefinitions: EffectDefinition[];
effectCategories: string[];
getEffectDefinition(id: string): EffectDefinition | undefined;
getEffectsByCategory(category: string): EffectDefinition[];
createEffectInstance(definition: EffectDefinition): EffectInstance;
createEffectChain(effects: EffectInstance[]): void;

// Keyboard
getShortcutLabel(shortcut: KeyboardShortcut): string;
// Returns e.g. "Cmd+Shift+S" on Mac, "Ctrl+Shift+S" on Windows
```
