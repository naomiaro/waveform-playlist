import React, { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import type {
  EffectsFunction,
  TrackEffectsFunction,
  SoundFontCache,
} from '@waveform-playlist/playout';
import { resolvePlayoutAdapter } from './playout/resolvePlayoutAdapter';
import { PlaylistEngine, type EngineState, type PlayoutAdapter } from '@waveform-playlist/engine';
import {
  type ClipTrack,
  type Fade,
  type AnnotationAction,
  type MidiNoteData,
} from '@waveform-playlist/core';
import { type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { syncSoundFontCacheToAdapter } from './soundFontSync';
import type { TrackDragPreview } from './utils/trackOrderPreview';
import type { PeakData } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import { assertTrackKind } from '@waveform-playlist/core';
import {
  useTimeFormat,
  useZoomControls,
  useMasterVolume,
  useSelectionState,
  useLoopState,
  useSelectedTrack,
  useUndoState,
  useAnimationFrameLoop,
  useWaveformDataCache,
} from './hooks';
import { followAnnotations } from './providerInternals/followAnnotations';
import { useAnnotationState } from './providerInternals/useAnnotationState';
import { useFrameCallbacks, type FrameData } from './providerInternals/useFrameCallbacks';
import { centrePlayhead, useScrollFollow } from './providerInternals/useScrollFollow';
import { useViewDefaults } from './providerInternals/useViewDefaults';
import { derivePeaks, EMPTY_PEAKS_CACHE, type PeaksCache } from './utils/derivePeaks';
import { timelineDuration } from './utils/timelineDuration';
import { incrementalTrackChange } from './utils/incrementalTrackChange';

// Types
export interface ClipPeaks {
  clipId: string;
  trackName: string;
  peaks: PeakData;
  startSample: number;
  durationSamples: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
  midiNotes?: MidiNoteData[];
  sampleRate?: number;
  offsetSamples?: number;
  /** The clip's linear gain — drawn into the waveform when
   *  `<WaveformTracks gainScaled />` is set. */
  gain?: number;
}

export type TrackClipPeaks = ClipPeaks[];

export type { TrackDragPreview };

export interface TrackState {
  name: string;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
}

import {
  BLOCKED,
  ActiveAnnotationContext,
  AnnotationEditingContext,
  AnnotationsContext,
  CurrentTimeContext,
  EditorControlsContext,
  EngineRefsContext,
  IsPlayingContext,
  LoopContext,
  MediaElementTrackContext,
  PlaybackControlsContext,
  PlaybackRateContext,
  PlaybackRefsContext,
  PlaylistMixerContext,
  PlaylistSettingsContext,
  PlaylistTimelineContext,
  PlaylistViewContext,
  PlaylistZoomContext,
  SelectedTrackIdContext,
  SelectedRowContext,
  SelectionContext,
  TrackReorderPreviewContext,
  UndoRedoContext,
  type ActiveAnnotationContextValue,
  type AnnotationEditingContextValue,
  type AnnotationsContextValue,
  type CurrentTimeContextValue,
  type EditorControlsContextValue,
  type EngineRefsContextValue,
  type IsPlayingContextValue,
  type LoopContextValue,
  type PlaybackControlsContextValue,
  type PlaybackRefsContextValue,
  type PlaylistMixerContextValue,
  type PlaylistSettingsContextValue,
  type PlaylistTimelineContextValue,
  type PlaylistViewContextValue,
  type PlaylistZoomContextValue,
  type SelectedTrackIdContextValue,
  type SelectionContextValue,
  type TrackReorderPreviewContextValue,
  type UndoRedoContextValue,
} from './contexts/playlistContexts';

export interface WaveformPlaylistProviderProps {
  tracks: ClipTrack[]; // Updated to use clip-based model
  mono?: boolean;
  waveHeight?: number;
  samplesPerPixel?: number;
  zoomLevels?: number[]; // Array of zoom levels in samples per pixel (lower = more zoomed in)
  automaticScroll?: boolean;
  theme?: Partial<WaveformPlaylistTheme>;
  annotationList?: {
    annotations?: AnnotationData[];
    editable?: boolean;
    isContinuousPlay?: boolean;
    linkEndpoints?: boolean;
    controls?: AnnotationAction[];
  };
  /** Master effects chain (default Tone.js adapter only). */
  effects?: EffectsFunction;
  /**
   * Returns the effects function of a track by id, or `undefined` for none:
   * pass `getTrackEffectsFunction` from `useTrackDynamicEffects()`. Default
   * Tone.js adapter only; with `createAdapter`, give the same function to your
   * own `createToneAdapter({ trackEffects })`.
   *
   * It is called when a track's audio graph is built, with the function passed
   * on the latest render. A new function identity does not rebuild anything,
   * so an inline arrow is fine; a different result for a track that is already
   * built applies the next time that track is built.
   */
  trackEffects?: (trackId: string) => TrackEffectsFunction | undefined;
  onReady?: () => void;
  /** Called when audio/engine initialization fails (e.g. a missing optional peer,
   *  a throwing `createAdapter`, or an invalid `zoomLevels`/`samplesPerPixel`). The
   *  provider already logs the error; use this to surface it in your UI. */
  onError?: (err: Error) => void;
  /** @deprecated Use onAnnotationsChange instead */
  onAnnotationUpdate?: (annotations: AnnotationData[]) => void;
  /** Callback when annotations are changed (drag, edit, etc.) */
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth?: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap?: number;
  /** Draw bars with pill-shaped rounded caps (radius barWidth/2). Default: false */
  roundedBars?: boolean;
  /** Width in pixels of progress bars. Default: barWidth + barGap (fills gaps). */
  progressBarWidth?: number;
  /** Callback when engine clip operations (move, trim, split) change tracks.
   * The provider calls this so the parent can update its tracks state without
   * triggering a full engine rebuild.
   *
   * **Important:** The parent must pass the received `tracks` reference back as
   * the `tracks` prop (i.e. `setState(tracks)`). The provider uses reference
   * identity (`tracks === engineTracksRef.current`) to detect engine-originated
   * updates and skip the expensive `loadAudio` rebuild. */
  onTracksChange?: (tracks: ClipTrack[]) => void;
  /** SoundFont cache for sample-based MIDI playback. When provided, MIDI clips
   *  use SoundFont samples instead of PolySynth synthesis. */
  soundFontCache?: SoundFontCache;
  /** When true, tracks render visually but the engine build is deferred.
   *  Use this during progressive loading to avoid rebuilding the engine for
   *  each track — flip to false when all tracks are ready for a single build. */
  deferEngineRebuild?: boolean;
  /** Disable the automatic stop when the cursor reaches the end of the
   *  longest track — the transport rolls until an explicit stop/pause
   *  (DAW-style). Implies the fillViewport layout. Recording sessions
   *  suppress the auto-stop automatically, so most recording UIs don't
   *  need this. */
  indefinitePlayback?: boolean;
  /** Extend the timeline (background + timescale) to fill the visible scroll
   *  container even when the audio is shorter. Layout only. Recording UIs
   *  typically want this so the empty timeline doesn't collapse to the audio
   *  width. */
  fillViewport?: boolean;
  /** Desired AudioContext sample rate. Creates a cross-browser AudioContext at
   *  this rate via standardized-audio-context. Pre-computed peaks (.dat files)
   *  render instantly when they match. On mismatch, falls back to worker. */
  sampleRate?: number;
  /** Factory for a custom PlayoutAdapter. When omitted, the Tone.js engine
   *  (@waveform-playlist/playout) is dynamically imported — so a custom adapter
   *  lets a consumer use neither @waveform-playlist/playout nor tone. Called once
   *  per engine rebuild; the provider owns and disposes the returned instance.
   *  Pass a stable reference (module-level or useCallback) — it is read directly
   *  inside the curated `loadAudio` effect, not via its dependency array. */
  createAdapter?: () => PlayoutAdapter;
  children: ReactNode;
}

export const WaveformPlaylistProvider: React.FC<WaveformPlaylistProviderProps> = ({
  tracks,
  mono = false,
  waveHeight = 80,
  samplesPerPixel: initialSamplesPerPixel = 1024,
  zoomLevels,
  automaticScroll = false,
  theme: userThemeProp,
  annotationList,
  effects,
  trackEffects,
  onReady,
  onError,
  onAnnotationUpdate: _onAnnotationUpdate,
  onAnnotationsChange,
  barWidth = 1,
  barGap = 0,
  roundedBars = false,
  progressBarWidth: progressBarWidthProp,
  onTracksChange,
  soundFontCache,
  deferEngineRebuild = false,
  indefinitePlayback = false,
  fillViewport = false,
  sampleRate: sampleRateProp,
  createAdapter,
  children,
}) => {
  const { mergedTheme, progressBarWidth } = useViewDefaults({
    theme: userThemeProp,
    barWidth,
    barGap,
    progressBarWidth: progressBarWidthProp,
  });

  // Stabilize zoomLevels reference — inline arrays (e.g. zoomLevels={[256, 512]})
  // create a new reference every render, which would trigger engine rebuild via
  // loadAudio deps. Content-based comparison avoids spurious rebuilds.
  const stableZoomLevels = useMemo(
    () => zoomLevels,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomLevels?.join(',')]
  );

  // Annotations are derived from the prop (single source of truth in the
  // parent). Shared with the MediaElement provider (#769).
  const {
    annotations,
    annotationsRef,
    annotationLookup,
    setAnnotations,
    annotationPreview,
    activeAnnotationId,
    activeAnnotationIdRef,
    setActiveAnnotationId,
    continuousPlay,
    continuousPlayRef,
    setContinuousPlay,
  } = useAnnotationState({
    annotationList,
    onAnnotationsChange,
    providerName: 'WaveformPlaylistProvider',
  });
  const {
    scrollContainerRef,
    setScrollContainer,
    isAutomaticScroll,
    isAutomaticScrollRef,
    setAutomaticScroll,
  } = useScrollFollow(automaticScroll);
  // Components register per-frame DOM updates here instead of running their
  // own rAF loops; the single loop below drives them all.
  const { registerFrameCallback, unregisterFrameCallback, runFrameCallbacks } = useFrameCallbacks();

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Timeline length in seconds: the end of the last clip. Derived during
  // render so it never lags `tracks` (#692).
  const duration = useMemo(() => timelineDuration(tracks), [tracks]);
  // The animation loop and `seekTo` read the timeline end from here, so that
  // neither changes identity when it moves: `seekTo` and `play` are in the
  // controls value, which must not follow `duration` (#767). Written during
  // render, like `isPlayingRef` and `tracksRef`, so that a child that calls
  // `seekTo` from a layout effect of the same commit already gets the new end.
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const [trackStates, setTrackStates] = useState<TrackState[]>([]);
  const [linkEndpoints, setLinkEndpoints] = useState(annotationList?.linkEndpoints ?? false);
  const [annotationsEditable, setAnnotationsEditable] = useState(annotationList?.editable ?? false);
  const [isReady, setIsReady] = useState(false);
  // Bumped after every track-reorder DRAG interaction (committed or not) —
  // see bumpTrackReorderEpoch below for the full rationale.
  const [trackReorderEpoch, setTrackReorderEpoch] = useState(0);
  // Live track-reorder drag preview (view-level only; see the
  // "Track Reordering" section of packages/browser/CLAUDE.md). Set by
  // ClipInteractionProvider's onDragOver, cleared on drag end/cancel.
  // The engine's committed order is untouched until drop.
  const [trackDragPreview, setTrackDragPreview] = useState<TrackDragPreview | null>(null);

  // Refs
  // Engine owns selection, loop, selectedTrackId, zoom, and masterVolume state.
  // React subscribes to engine statechange and mirrors into useState/refs.
  // Playback timing (currentTime, isPlaying) remains in React for animation loop.
  const engineRef = useRef<PlaylistEngine | null>(null);
  const adapterRef = useRef<PlayoutAdapter | null>(null);
  const audioInitializedRef = useRef<boolean>(false);

  // Ref for animation loop access (avoids adding the prop to useCallback deps)
  const indefinitePlaybackRef = useRef(indefinitePlayback);
  indefinitePlaybackRef.current = indefinitePlayback;

  // Recording session state. While active:
  // 1. The animation loop's end-of-audio auto-stop is suppressed so overdub
  //    playback runs past the end of existing material (#589/#590).
  // 2. The armed track's existing content is transiently muted: punch-in
  //    replaces whatever the take overlaps (#579), so the doomed material
  //    must not play under the overdub. Engine-level mute (survives adapter
  //    rebuilds), captured/restored around the session; the track's UI mute
  //    state is untouched.
  // Called by useRecordingSession for the length of a take; overdub
  // flows also call it eagerly before play() — a render round-trip loses the
  // race against the first animation frame (empty timeline: time 0 >=
  // duration 0 would stop playback instantly).
  const recordingActiveRef = useRef(false);
  const armedTrackMuteRef = useRef<{ trackId: string; prevMuted: boolean } | null>(null);
  const setRecordingActive = useCallback((active: boolean, armedTrackId?: string | null) => {
    recordingActiveRef.current = active;
    const engine = engineRef.current;
    if (!engine) return;
    if (active && armedTrackId) {
      if (armedTrackMuteRef.current?.trackId === armedTrackId) return; // already armed
      if (armedTrackMuteRef.current) {
        // Armed track changed mid-session — restore the previous one first.
        engine.setTrackMute(armedTrackMuteRef.current.trackId, armedTrackMuteRef.current.prevMuted);
      }
      const prevMuted = engine.getState().tracks.find((t) => t.id === armedTrackId)?.muted ?? false;
      armedTrackMuteRef.current = { trackId: armedTrackId, prevMuted };
      engine.setTrackMute(armedTrackId, true);
    } else if (!active && armedTrackMuteRef.current) {
      engine.setTrackMute(armedTrackMuteRef.current.trackId, armedTrackMuteRef.current.prevMuted);
      armedTrackMuteRef.current = null;
    }
  }, []);
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;
  const playStartPositionRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  // Visually-aligned playback time (see toVisualTime / getAudibleTime). The
  // animation loop updates this per frame. Pause/seek/stop paths sync it
  // explicitly so the static playhead reflects the commanded resting position.
  const visualTimeRef = useRef<number>(0);
  const tracksRef = useRef<ClipTrack[]>(tracks);
  const soundFontCacheRef = useRef(soundFontCache);
  soundFontCacheRef.current = soundFontCache;
  // The adapter keeps ONE lookup for its whole life and calls it whenever it
  // builds a track. It reads the prop through a ref so that a new function
  // identity (an inline arrow) is not a reason to rebuild the engine (#752).
  const trackEffectsRef = useRef(trackEffects);
  trackEffectsRef.current = trackEffects;
  const resolveTrackEffects = useCallback(
    (trackId: string) => trackEffectsRef.current?.(trackId),
    []
  );
  const trackStatesRef = useRef<TrackState[]>(trackStates);
  const playbackStartTimeRef = useRef<number>(0); // context.currentTime when playback started
  const audioStartPositionRef = useRef<number>(0); // Audio position when playback started
  const playbackEndTimeRef = useRef<number | null>(null); // Audio position where playback should stop (for selections)
  // Suppresses the engine 'stop' mirror (below) around provider-initiated
  // engine.stop() calls that immediately seek/restart playback in the same
  // synchronous block (play(), setSelection, reschedulePlayback, the
  // engine-rebuild-with-resume path). Without this, the mirror's ref writes
  // would race the restart's own writes and briefly show the pre-restart
  // position/isPlaying=false. Stop paths that don't restart afterward don't
  // need suppression — see the mirror's own comment for why.
  const suppressEngineStopMirrorRef = useRef(false);
  // Engine clip operations guard: tracks reference from the last engine statechange.
  // When engine methods (moveClip, trimClip, splitClip) mutate tracks, the statechange
  // handler stores state.tracks here and calls onTracksChange with the same reference.
  // loadAudio checks tracks === engineTracksRef.current to skip the full rebuild.
  const engineTracksRef = useRef<ClipTrack[] | null>(null);
  // Monotonic counter from engine.getState().tracksVersion — used to detect
  // track mutations (move/trim/split/add/remove) vs other statechange events.
  const lastTracksVersionRef = useRef(0);
  // Set while this provider applies a `tracks` prop change to the engine track
  // by track; the statechange it causes must not be mirrored back to the parent.
  const suppressTracksMirrorRef = useRef(false);
  // Flag set during render to prevent the previous effect cleanup from disposing the
  // engine when we're skipping the rebuild. React runs previous cleanup before the
  // current effect body, so the flag must be set during render (which precedes cleanup).
  const skipEngineDisposeRef = useRef(false);
  // Set by useClipDragHandlers during boundary trim drags. When true,
  // loadAudio skips the full engine rebuild — visual updates flow via React
  // state only. On drag end, engine.trimClip() commits the final delta.
  const isDraggingRef = useRef(false);
  // Snapshot of tracks from the previous loadAudio run, used to detect
  // additive-only changes (new tracks appended, existing unchanged).
  const prevTracksRef = useRef<ClipTrack[]>([]);
  // Provider-level ref for scroll-position math and animation loop pixel
  // calculation. Distinct from useZoomControls's internal ref (statechange guard).
  const samplesPerPixelRef = useRef<number>(initialSamplesPerPixel);
  // Provisional sample rate until the adapter (which owns the AudioContext) is
  // created in loadAudio. Reconciled from adapter.audioContext.sampleRate there.
  // (#510: avoids a static @waveform-playlist/playout import at mount.)
  const [initialSampleRate] = useState<number>(() => sampleRateProp ?? 48000);
  const sampleRateRef = useRef<number>(initialSampleRate);

  // Custom hooks — engine-owned state delegated to hooks with onEngineState() pattern
  const { timeFormat, setTimeFormat } = useTimeFormat();
  const zoom = useZoomControls({ engineRef, initialSamplesPerPixel });
  const { samplesPerPixel, onEngineState: onZoomEngineState } = zoom;
  const volume = useMasterVolume({ engineRef, initialVolume: 1.0 });
  const {
    masterVolume,
    setMasterVolume,
    masterVolumeRef,
    onEngineState: onVolumeEngineState,
  } = volume;
  const {
    selectionStart,
    selectionEnd,
    setSelection: setSelectionEngine,
    selectionStartRef,
    selectionEndRef,
    onEngineState: onSelectionEngineState,
  } = useSelectionState({ engineRef });
  // True while the bounded play in progress is the highlighted selection itself
  // (its start and end are the selection's). Set by play(). Selection playback
  // ignores continuous play; anything else, including an annotation clicked
  // while a selection is highlighted elsewhere, follows it.
  const isSelectionPlayRef = useRef(false);
  const {
    isLoopEnabled,
    loopStart,
    loopEnd,
    setLoopEnabled,
    setLoopRegion,
    clearLoopRegion,
    isLoopEnabledRef,
    loopStartRef,
    loopEndRef,
    onEngineState: onLoopEngineState,
  } = useLoopState({ engineRef });
  const {
    selectedTrackId,
    setSelectedTrackId: setSelectedTrackIdControl,
    onEngineState: onSelectedTrackEngineState,
    selectedTrackIdRef,
  } = useSelectedTrack({ engineRef });
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    onEngineState: onUndoEngineState,
  } = useUndoState({ engineRef });
  const { animationFrameRef, startAnimationFrameLoop, stopAnimationFrameLoop } =
    useAnimationFrameLoop();

  // Worker-based WaveformData cache for fast zoom resampling
  const baseScale = useMemo(
    () => Math.min(...(stableZoomLevels ?? [256, 512, 1024, 2048, 4096, 8192])),
    [stableZoomLevels]
  );
  const { getWaveformData: getGeneratedWaveformData, version: generatedWaveformVersion } =
    useWaveformDataCache(tracks, baseScale);

  // Peaks per track and clip, derived during render (#692). The cache in the
  // ref is what keeps a clip's typed arrays (and its ClipPeaks object, and its
  // track's array) identical while nothing they depend on changed — see
  // utils/derivePeaks.ts. `generatedWaveformVersion` is the only signal that a
  // worker result arrived; the lookup itself goes through a ref.
  const peaksCacheRef = useRef<PeaksCache>(EMPTY_PEAKS_CACHE);
  const peaksDataArray = useMemo(() => {
    const next = derivePeaks(
      tracks,
      { samplesPerPixel, mono, getGeneratedWaveformData },
      peaksCacheRef.current
    );
    peaksCacheRef.current = next;
    return next.result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generatedWaveformVersion invalidates the ref-backed lookup
  }, [tracks, samplesPerPixel, mono, getGeneratedWaveformData, generatedWaveformVersion]);

  // Cross-hook concern: reads selection refs to set loop region
  const setLoopRegionFromSelection = useCallback(() => {
    const start = selectionStartRef.current ?? 0;
    const end = selectionEndRef.current ?? 0;
    if (start !== end && end > start) {
      setLoopRegion(start, end);
    }
  }, [setLoopRegion, selectionStartRef, selectionEndRef]);

  // Keep refs in sync with state
  useEffect(() => {
    trackStatesRef.current = trackStates;
  }, [trackStates]);

  tracksRef.current = tracks;

  // Render-phase guard: detect when tracks prop came from an engine clip operation.
  // Must be set before effects run so the previous effect cleanup can skip disposal.
  // Also skip disposal during active boundary trim drags — onDragMove updates React
  // tracks per-frame, triggering effect re-runs whose cleanup would dispose the engine.
  const isEngineTracks = tracks === engineTracksRef.current;

  // Detect track changes that can be applied to the running engine: new tracks
  // appended, or an empty track that got its clips (a placeholder whose audio
  // arrived). Existing tracks are compared by reference; a changed track that
  // already had clips makes this null and triggers a full rebuild.
  const prevTracks = prevTracksRef.current;
  const incrementalChange =
    engineRef.current !== null ? incrementalTrackChange(prevTracks, tracks) : null;
  const isIncrementalAdd = incrementalChange !== null;
  // Note: prevTracks may be empty here (e.g. recording's first track on a
  // persistent empty-timeline engine) — that's a valid 0→1 incremental add, so
  // it must NOT require prevTracks.length > 0. The engineRef !== null guard keeps
  // it correct: a lazy/no-engine consumer still takes the full build path.

  skipEngineDisposeRef.current = isEngineTracks || isDraggingRef.current || isIncrementalAdd;

  // Adjust scroll position proportionally when zoom changes
  useEffect(() => {
    if (!scrollContainerRef.current || duration === 0) return;

    const container = scrollContainerRef.current;
    const oldSamplesPerPixel = samplesPerPixelRef.current;
    const newSamplesPerPixel = samplesPerPixel;

    if (oldSamplesPerPixel === newSamplesPerPixel) return;

    // Calculate the current center time in the viewport
    const containerWidth = container.clientWidth;
    const currentScrollLeft = container.scrollLeft;
    const centerPixel = currentScrollLeft + containerWidth / 2;
    const sr = sampleRateRef.current;
    const centerTime = (centerPixel * oldSamplesPerPixel) / sr;

    // Calculate new scroll position to keep the same center time
    const newCenterPixel = (centerTime * sr) / newSamplesPerPixel;
    const newScrollLeft = Math.max(0, newCenterPixel - containerWidth / 2);

    container.scrollLeft = newScrollLeft;
    samplesPerPixelRef.current = newSamplesPerPixel;
  }, [samplesPerPixel, duration, scrollContainerRef]);

  // Track pending playback resume after tracks change
  // A play that must start once the engine being built is ready: playback
  // that was running when a rebuild began, or a play() requested while one
  // was in flight (#675). `endTime` is set for duration-limited playback.
  const pendingResumeRef = useRef<{ position: number; endTime?: number } | null>(null);
  // True from the moment a full engine build starts until its engine is
  // assigned to engineRef (or the build fails / is superseded). While it is
  // true and engineRef is null, play() queues instead of no-opping.
  const engineBuildInFlightRef = useRef(false);
  // Incremented by every play(), stop() and pause(). A play() that has been
  // waiting on engine.init() compares it afterwards: if it moved, the user has
  // since asked for something else and the older play must not start.
  const playRequestIdRef = useRef(0);
  // Bumped each time a freshly built engine is assigned. The resume effect
  // depends on it: the `tracks` change that starts a rebuild fires BEFORE the
  // async build finishes, so `tracks` alone cannot trigger the resume.
  const [engineEpoch, setEngineEpoch] = useState(0);

  // Dispose the current engine ahead of a rebuild, leaving nothing reachable
  // through engineRef. If the engine is PLAYING at this moment, queue a resume
  // for its replacement. The engine is asked directly because isPlayingRef is
  // only as fresh as the last render: a play() whose init() resolves after
  // React has committed the new `tracks` but before this effect runs starts
  // the old engine and calls setIsPlaying(true) — and the effect would still
  // read isPlayingRef === false (#675).
  const disposeEngineKeepingPlayback = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.getState().isPlaying && !pendingResumeRef.current) {
      pendingResumeRef.current = {
        position: engine.getCurrentTime(),
        endTime: playbackEndTimeRef.current ?? undefined,
      };
    }
    engine.dispose();
    engineRef.current = null;
  }, []);

  // Load audio from clips (only when tracks change)
  useEffect(() => {
    // Guard: skip full rebuild when tracks came from an engine clip operation
    // (moveClip, trimClip, splitClip). The engine and adapter already have the
    // correct tracks — we just need to update duration for the timeline.
    // Also skip during active boundary trim drags — visual updates flow via
    // React state only; engine.trimClip() commits the final delta on drag end.
    if (isEngineTracks || isDraggingRef.current) {
      if (isEngineTracks) {
        engineTracksRef.current = null;
      }

      prevTracksRef.current = tracks;
      return;
    }

    // Guard: incremental track addition — only new tracks appended, existing
    // tracks unchanged. Add each new track to the existing engine without
    // tearing down the playout. This avoids disposing and recreating all
    // audio nodes when dropping a file or finishing a recording.
    if (incrementalChange && engineRef.current) {
      try {
        // incrementalChange was computed during render from the same prevTracks
        // snapshot as the guard, not from prevTracksRef.current.
        const engine = engineRef.current;
        const { added: addedTracks, filled: filledTracks } = incrementalChange;
        // The engine rejects a track whose clips do not match its kind (#756).
        // Check the whole batch before applying any of it, so a bad track
        // late in the batch does not leave the earlier ones half applied.
        [...filledTracks, ...addedTracks].forEach(assertTrackKind);

        // Merge current UI state into a track before handing it to the engine
        const currentTrackStates = trackStatesRef.current;
        const withUiState = (track: ClipTrack): ClipTrack => {
          const trackState = currentTrackStates[tracks.indexOf(track)];
          return {
            ...track,
            volume: trackState?.volume ?? track.volume,
            muted: trackState?.muted ?? track.muted,
            soloed: trackState?.soloed ?? track.soloed,
            pan: trackState?.pan ?? track.pan,
          };
        };
        // Fills before adds: an add is mirrored to the parent, and what it
        // mirrors must already hold the filled tracks.
        if (filledTracks.length > 0) {
          // The parent already has these tracks, as on the initial setTracks:
          // do not echo them back through onTracksChange.
          suppressTracksMirrorRef.current = true;
          try {
            for (const track of filledTracks) {
              engine.updateTrack(track.id, withUiState(track));
            }
          } finally {
            suppressTracksMirrorRef.current = false;
          }
          // As a rebuild did: "the audio arrived" is not a step to undo back
          // to an empty placeholder.
          engine.clearHistory();
          // clearHistory emits nothing; without this `canUndo` stays true.
          onUndoEngineState(engine.getState());
        }

        for (const track of addedTracks) {
          engine.addTrack(withUiState(track));
        }

        // Initialize track states for the new tracks (preserve existing), and
        // take the names of the filled ones ("x (loading...)" becomes "x").
        const filledNames = new Map(filledTracks.map((t) => [tracks.indexOf(t), t.name]));
        setTrackStates((prev) => {
          const renamed = prev.some((state, i) => (filledNames.get(i) ?? state.name) !== state.name)
            ? prev.map((state, i) => ({ ...state, name: filledNames.get(i) ?? state.name }))
            : prev;
          if (renamed.length === tracks.length) return renamed;
          const newStates = [...renamed];
          for (const track of addedTracks) {
            newStates.push({
              name: track.name,
              muted: track.muted,
              soloed: track.soloed,
              volume: track.volume,
              pan: track.pan,
            });
          }
          return newStates;
        });

        prevTracksRef.current = tracks;
        return;
      } catch (err) {
        console.warn(
          '[waveform-playlist] Incremental add failed, falling through to full rebuild:',
          String(err)
        );
        // Fall through to full loadAudio path
      }
    }

    // Defer engine rebuild during progressive loading — tracks render visually
    // (controls, clip shapes, peaks via worker) but the engine isn't built yet.
    // When deferEngineRebuild flips to false, this effect re-runs and builds once.
    if (deferEngineRebuild) {
      return;
    }

    // Reset ready state for full rebuild
    setIsReady(false);

    if (tracks.length === 0) {
      // Clear content state when all tracks are removed.
      setTrackStates([]);

      // Always keep a persistent engine alive — even with no tracks — so the
      // Transport is ready before playback/recording starts. Without this the
      // engine is rebuilt asynchronously when the first track is added, and
      // play() races that rebuild — intermittently no-opping (frozen
      // playhead/time) and paying first-record latency. The engine is still
      // created via dynamic import (lazy module load preserved, #510); only its
      // lifecycle is eager.
      if (engineRef.current) {
        // Keep the existing engine; just clear its tracks.
        engineRef.current.setTracks([]);
        prevTracksRef.current = tracks;
        return;
      }
      // No engine yet (initial mount with no tracks): fall through to the
      // loadAudio path below, which builds a persistent engine for 0 tracks.
    }

    // Capture playback state before rebuilding playout (read from ref, not state,
    // so isPlaying can be excluded from the dep array — play/pause must not trigger rebuilds)
    const wasPlaying = isPlayingRef.current;
    const resumePosition = currentTimeRef.current;

    // Stop current playback and animation before disposing
    if (wasPlaying) {
      // The previous effect's cleanup has usually disposed and cleared the
      // engine already; stop it only if it is still here.
      if (engineRef.current) {
        // Suppressed: resumePlayback() (below) restarts from resumePosition once
        // the rebuilt engine is ready — an unguarded mirror would clobber the
        // refs with this (old, about-to-be-replaced) engine's rewound position
        // in the meantime. See suppressEngineStopMirrorRef declaration.
        suppressEngineStopMirrorRef.current = true;
        engineRef.current.stop();
        suppressEngineStopMirrorRef.current = false;
      }
      stopAnimationFrameLoop();
      // Mark that we need to resume playback after playout is rebuilt. A play
      // queued during the previous (superseded) build keeps its own request.
      if (!pendingResumeRef.current) {
        pendingResumeRef.current = {
          position: resumePosition,
          endTime: playbackEndTimeRef.current ?? undefined,
        };
      }
    }

    let cancelled = false;

    const loadAudio = async () => {
      try {
        const maxDuration = timelineDuration(tracks);

        // Initialize or update track states, preserving existing UI state (mute/solo/volume/pan)
        // Only initialize from ClipTrack props when trackStates is empty or track count changes
        setTrackStates((prevStates) => {
          if (prevStates.length === tracks.length) {
            // Same number of tracks - preserve existing UI state, just update names
            return prevStates.map((state, i) => ({
              ...state,
              name: tracks[i].name,
            }));
          }
          // Track count changed - reinitialize from ClipTrack properties
          return tracks.map((track) => ({
            name: track.name,
            muted: track.muted,
            soloed: track.soloed,
            volume: track.volume,
            pan: track.pan,
          }));
        });

        // Dispose old engine before creating new one. Clear the ref with it:
        // the new adapter is created asynchronously below, and until the new
        // engine is assigned nothing may reach the disposed one (#675 — a
        // play() in this window used to run against it and wedge isPlaying).
        disposeEngineKeepingPlayback();

        // Reset tracks version tracking for the new engine
        lastTracksVersionRef.current = 0;
        engineTracksRef.current = null;

        // Create engine adapter — custom if provided, else Tone.js (dynamically imported).
        // Reset init flag — new adapter needs AudioContext resume on first play.
        audioInitializedRef.current = false;
        const adapter = await resolvePlayoutAdapter({
          createAdapter,
          effects,
          trackEffects: resolveTrackEffects,
          soundFontCache: soundFontCacheRef.current,
          sampleRate: sampleRateProp,
        });
        if (cancelled) {
          // Superseded: the next effect run owns engineBuildInFlightRef now.
          adapter.dispose();
          return;
        }
        // Reconcile sample rate from the adapter's own AudioContext. The setState
        // calls later in loadAudio trigger a re-render that propagates this via
        // `const sampleRate = sampleRateRef.current` at render.
        sampleRateRef.current = adapter.audioContext.sampleRate;
        adapterRef.current = adapter;
        const engine = new PlaylistEngine({
          adapter,
          samplesPerPixel: samplesPerPixelRef.current,
          zoomLevels: stableZoomLevels,
        });

        // Seed engine with current UI state so a fresh engine doesn't
        // reset selection/loop/selectedTrack to defaults on the first statechange emission.
        engine.setSelection(selectionStartRef.current ?? 0, selectionEndRef.current ?? 0);
        engine.setLoopRegion(loopStartRef.current ?? 0, loopEndRef.current ?? 0);
        if (isLoopEnabledRef.current) engine.setLoopEnabled(true);
        engine.setMasterVolume(masterVolumeRef.current ?? 1.0);
        if (selectedTrackIdRef.current) engine.selectTrack(selectedTrackIdRef.current);

        // Merge current UI state into tracks before passing to engine
        const currentTrackStates = trackStatesRef.current;
        const tracksWithState = tracks.map((track, index) => {
          const trackState = currentTrackStates[index];
          return {
            ...track,
            volume: trackState?.volume ?? track.volume,
            muted: trackState?.muted ?? track.muted,
            soloed: trackState?.soloed ?? track.soloed,
            pan: trackState?.pan ?? track.pan,
          };
        });

        // Subscribe to engine statechange BEFORE setTracks() so the first
        // emission (which carries correct canZoomIn/canZoomOut) is captured.
        // Seeding statechanges fired above are harmless — they contain values
        // that already match the hooks' current state, so onEngineState()
        // ref guards skip them.
        // Suppress tracks mirroring during the initial setTracks — the parent
        // already has these tracks. The flag is local so it becomes false
        // after setTracks returns (statechange fires synchronously).
        let suppressTracksMirroring = true;
        engine.on('statechange', (state: EngineState) => {
          onSelectionEngineState(state);
          onLoopEngineState(state);
          onSelectedTrackEngineState(state);
          onZoomEngineState(state);
          onVolumeEngineState(state);
          onUndoEngineState(state);

          // Mirror engine tracks changes to parent via onTracksChange.
          // tracksVersion only increments on structural track mutations (move,
          // trim, split, setTracks, addTrack, removeTrack), not on
          // selection/zoom/volume changes. Per-track mixer edits bump the
          // engine's separate mixerVersion (#501) and are persisted here via
          // trackStates, so they intentionally do not flow through onTracksChange.
          if (suppressTracksMirrorRef.current) {
            // A change this provider is applying from its own `tracks` prop.
            lastTracksVersionRef.current = state.tracksVersion;
          } else if (
            !suppressTracksMirroring &&
            state.tracksVersion !== lastTracksVersionRef.current
          ) {
            lastTracksVersionRef.current = state.tracksVersion;
            engineTracksRef.current = state.tracks;

            // trackStates is positionally indexed (no track id of its own) and
            // is otherwise never touched by reorderTrack — the engine reorder is
            // "purely organizational" (see PlaylistEngine.reorderTrack) and never
            // rebuilds. Without this, a track's mixer identity (name/mute/solo/
            // volume/pan) stays pinned to its OLD index after a reorder, so the
            // control panel silently shows/controls the wrong track. Re-derive an
            // id->state map from the pre-reorder pairing (tracksRef/trackStatesRef
            // reflect the last committed render, i.e. before this mutation) and
            // re-project it onto the new track order. Guarded to same-length
            // arrays (addTrack/removeTrack already flow through a full rebuild
            // that reinitializes trackStates) and to an actual order change (so
            // non-reorder structural mutations like moveClip/trimClip/splitClip
            // — which don't change track order — are a no-op here).
            const oldTracks = tracksRef.current;
            const oldStates = trackStatesRef.current;
            if (oldTracks.length === oldStates.length && oldTracks.length === state.tracks.length) {
              const idToState = new Map(oldTracks.map((t, i) => [t.id, oldStates[i]]));
              const reordered = state.tracks.map((t, i) => idToState.get(t.id) ?? oldStates[i]);
              const orderChanged = reordered.some((s, i) => s !== oldStates[i]);
              if (orderChanged) {
                setTrackStates(reordered);
              }
            }

            if (onTracksChange) {
              onTracksChange(state.tracks);
            } else {
              console.warn(
                '[waveform-playlist] Engine tracks changed but onTracksChange prop is not set — ' +
                  'UI will revert on next render. Pass onTracksChange to WaveformPlaylistProvider.'
              );
            }
          }
        });

        // Engine-initiated stop mirror (final-review CRITICAL 1, #608 follow-up).
        // PlaylistEngine self-stops when a bounded play(start, end) completes on
        // an adapter that reports onPlaybackEnded (Tone) — see engine CLAUDE.md
        // "onPlaybackEnded hook". That self-stop rewinds the engine's own current
        // time to playStartPosition BEFORE the rAF loop's own end-of-playback
        // checks (below) can observe it, so the loop's `time >= playbackEndTimeRef`
        // / `time >= duration` comparisons never fire — React isPlaying stays
        // true and the loop spins forever at the rewound position. Mirroring the
        // engine's 'stop' event makes React authoritative-from-engine for ANY
        // engine-initiated stop, closing that race. The engine already rewound
        // its own time (`_currentTime = _playStartPosition`) — we only mirror
        // that into React's refs/state, we never seek() again here.
        //
        // Suppressed via suppressEngineStopMirrorRef around provider-initiated
        // engine.stop() calls that immediately seek/restart playback (play(),
        // setSelection, reschedulePlayback, engine-rebuild-with-resume) — those
        // already set the correct target position themselves; an unguarded
        // mirror would clobber it mid-transition with the pre-restart position.
        // Stop paths that terminate playback (stop(), the rAF loop's own
        // annotation/selection/duration-end branches) don't need suppression:
        // they either write the identical value the mirror would (both read
        // _playStartPosition), or run their own setCurrentTimeRefs call
        // synchronously right after this listener, which — as plain refs, not
        // batched state — simply overwrites the mirror's write with no other
        // code observing the transient value in between.
        engine.on('stop', () => {
          if (suppressEngineStopMirrorRef.current) return;
          setIsPlaying(false);
          stopAnimationFrameLoop();
          // The engine rewound to where its play began. For the selection,
          // return to the selection start instead (see play()): a play that
          // resumed part-way must not leave the cursor inside the selection.
          let stoppedAt = engine.getCurrentTime();
          if (isSelectionPlayRef.current) {
            stoppedAt = playStartPositionRef.current;
            engine.seek(stoppedAt);
          }
          setCurrentTimeRefs(stoppedAt);
          setCurrentTime(stoppedAt);
        });

        engine.setTracks(tracksWithState);
        suppressTracksMirroring = false;
        lastTracksVersionRef.current = engine.getState().tracksVersion;
        engineRef.current = engine;
        engineBuildInFlightRef.current = false;
        // Starts any play queued for this engine (see the resume effect).
        setEngineEpoch((epoch) => epoch + 1);

        setIsReady(true);

        // Dispatch custom event for external listeners
        const event = new CustomEvent('waveform-playlist:ready', {
          detail: {
            trackCount: tracks.length,
            duration: maxDuration,
          },
        });
        window.dispatchEvent(event);

        prevTracksRef.current = tracks;

        onReady?.();
      } catch (error) {
        // Dispose an adapter created before the engine failed to build (e.g. invalid
        // zoomLevels make `new PlaylistEngine` throw) — the cleanup skips it because
        // engineRef was never assigned, so it would otherwise leak a live AudioContext.
        if (!engineRef.current && adapterRef.current) {
          try {
            adapterRef.current.dispose();
          } catch (disposeErr) {
            console.warn(
              '[waveform-playlist] adapter dispose after load failure threw: ' + String(disposeErr)
            );
          }
          adapterRef.current = null;
        }
        if (!cancelled) {
          // No engine is coming: a queued play would otherwise wait forever
          // and fire on some later, unrelated rebuild.
          engineBuildInFlightRef.current = false;
          pendingResumeRef.current = null;
        }
        console.warn('[waveform-playlist] Error loading audio: ' + String(error));
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    engineBuildInFlightRef.current = true;
    loadAudio();

    return () => {
      cancelled = true;
      engineBuildInFlightRef.current = false;
      // Skip disposal when the next render's guard will keep the engine alive.
      // skipEngineDisposeRef is set during the render phase (before this cleanup runs).
      if (skipEngineDisposeRef.current) {
        skipEngineDisposeRef.current = false;
        return;
      }
      stopAnimationFrameLoop();
      if (engineRef.current) {
        // Never leave a disposed engine reachable (#675).
        disposeEngineKeepingPlayback();
        adapterRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tracks,
    // isEngineTracks is intentionally excluded — it's a render-phase guard read
    // inside the effect body, not a trigger. Including it causes a spurious re-run
    // when it flips from true→false after engineTracksRef is cleared.
    // isPlaying is intentionally excluded — read from isPlayingRef inside the
    // effect body. Including it causes a full engine+playout rebuild on every
    // play/pause/stop, destroying and recreating all audio Players.
    // soundFontCache is deliberately excluded — late cache changes are forwarded
    // to the live adapter by the sync effect below; only adapter creation reads it
    // (via soundFontCacheRef).
    onReady,
    onError,
    effects,
    resolveTrackEffects,
    stopAnimationFrameLoop,
    onSelectionEngineState,
    onLoopEngineState,
    onSelectedTrackEngineState,
    onZoomEngineState,
    onVolumeEngineState,
    onUndoEngineState,
    onTracksChange,
    masterVolumeRef,
    selectionStartRef,
    selectionEndRef,
    loopStartRef,
    loopEndRef,
    isLoopEnabledRef,
    stableZoomLevels,
    deferEngineRebuild,
  ]);

  // Forward late-arriving / swapped SoundFontCache to the live adapter so
  // MIDI tracks upgrade from PolySynth without an engine rebuild. On mount
  // this may run against a just-created adapter (the loadAudio effect is
  // declared earlier, runs first, and assigns adapterRef synchronously) or
  // against null (empty tracks). Both are safe: the helper no-ops on null,
  // and the adapter skips MIDI tracks whose routing is unchanged.
  useEffect(() => {
    syncSoundFontCacheToAdapter(adapterRef.current, soundFontCache);
  }, [soundFontCache]);

  // A clip with nothing to draw from is almost always a wiring mistake. Not
  // while tracks are still streaming in (deferEngineRebuild): then it is expected.
  useEffect(() => {
    if (deferEngineRebuild) return;
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (!clip.audioBuffer && !clip.waveformData && !clip.midiNotes) {
          console.warn(`[waveform-playlist] Clip "${clip.id}" has no audio data or waveform data`);
        }
      }
    }
  }, [tracks, deferEngineRebuild]);

  // Audio clock from the adapter's own AudioContext (#510 — replaces tone's
  // getContext()). Stable; reads a ref so identity never changes.
  const getAudioContextTime = useCallback(
    () => adapterRef.current?.audioContext.currentTime ?? 0,
    []
  );

  // Returns current playback time from engine (auto-wraps at loop boundaries).
  // Falls back to manual calculation when engine is unavailable.
  const getPlaybackTimeFallbackWarnedRef = useRef(false);
  const getPlaybackTime = useCallback(() => {
    if (engineRef.current) {
      return engineRef.current.getCurrentTime();
    }
    // Fallback: manual calculation (does not handle loop wrapping)
    if (!getPlaybackTimeFallbackWarnedRef.current) {
      getPlaybackTimeFallbackWarnedRef.current = true;
      console.warn(
        '[waveform-playlist] getPlaybackTime called without engine. ' +
          'Falling back to manual elapsed time (loop wrapping will not work).'
      );
    }
    const elapsed = getAudioContextTime() - (playbackStartTimeRef.current ?? 0);
    return (audioStartPositionRef.current ?? 0) + elapsed;
  }, [getAudioContextTime]);

  // Resting (non-playing) cursor positions display the raw time unchanged.
  // Latency compensation (outputLatency + lookAhead) models the gap between
  // the Transport's scheduling position and audible output — a property of
  // *playing*, not of position. A seeked/paused/stopped cursor has no audible
  // counterpart; the commanded position is the truth. During playback the
  // animation loop uses engine.getAudibleTime() instead.
  const toVisualTime = useCallback((rawTime: number): number => {
    return Number.isFinite(rawTime) ? Math.max(0, rawTime) : 0;
  }, []);

  // Pair-write helper for the dual-ref pattern. Storage stays raw on
  // `currentTimeRef`; display gets the guard-clamped raw version on `visualTimeRef`
  // (compensation happens in the animation loop via engine.getAudibleTime() while playing).
  // Use this at every pause/seek/stop/loop site — never assign one ref alone
  // (browser/CLAUDE.md: "Display uses visualTimeRef").
  const setCurrentTimeRefs = useCallback(
    (rawTime: number) => {
      currentTimeRef.current = rawTime;
      visualTimeRef.current = toVisualTime(rawTime);
    },
    [toVisualTime]
  );

  // Read the engine's scheduler lookahead (Tone adapter ~0.1s, native 0).
  // Exposed through PlaybackRefsContextValue so consumers (e.g., recording
  // live preview) compute audible-latency from the same source as the playhead.
  const getLookAhead = useCallback((): number => {
    return engineRef.current?.lookAhead ?? 0;
  }, []);

  const getOutputLatency = useCallback((): number => {
    const audioCtx = adapterRef.current?.audioContext;
    return audioCtx && 'outputLatency' in audioCtx ? (audioCtx as AudioContext).outputLatency : 0;
  }, []);

  // Animation loop
  const startAnimationLoop = useCallback(() => {
    const updateTime = () => {
      // Get current time from engine (auto-wraps at loop boundaries via Transport.seconds)
      const time = getPlaybackTime();
      currentTimeRef.current = time;

      // Compute visual time once — all visual consumers use this same value.
      // engine.getAudibleTime() subtracts outputLatency (hardware DAC delay)
      // and adapter.lookAhead (Tone.js Transport runs ~100ms ahead of audible),
      // holding at the play-start position during the pre-roll window. Native
      // adapters report lookAhead 0, so this is a near no-op there.
      const visualRaw = engineRef.current ? engineRef.current.getAudibleTime() : time;
      const visualTime = Number.isFinite(visualRaw) ? Math.max(0, visualRaw) : 0;
      visualTimeRef.current = visualTime;

      // Drive registered per-frame callbacks BEFORE stop checks so the
      // final frame renders at the correct stop position (not one frame behind).
      const sr = sampleRateRef.current;
      const spp = samplesPerPixelRef.current;
      const frameData: FrameData = {
        time,
        visualTime,
        sampleRate: sr,
        samplesPerPixel: spp,
      };
      runFrameCallbacks(frameData);

      // Annotations. Playing the selection takes continuous play out of the
      // picture: playback is not cut at annotation boundaries, whichever way
      // the toggle is set, and the active annotation still follows the
      // playhead. On the frame that reaches a bounded play's end the
      // highlight is held: the end check below stops there, and it must not
      // move on to the next annotation first.
      const activeAnnotationEnded = followAnnotations({
        annotations: annotationsRef.current,
        lookup: annotationLookup,
        time,
        activeId: activeAnnotationIdRef.current,
        followOnly: continuousPlayRef.current || isSelectionPlayRef.current,
        holdHighlight: playbackEndTimeRef.current !== null && time >= playbackEndTimeRef.current,
        setActiveAnnotationId,
      });
      if (activeAnnotationEnded) {
        // Continuous play off: stop at the end of the active annotation and
        // return the cursor to where playback started.
        if (engineRef.current) {
          engineRef.current.stop();
        }
        setIsPlaying(false);
        setCurrentTimeRefs(playStartPositionRef.current);
        setCurrentTime(playStartPositionRef.current);
        return;
      }

      // Automatic scroll: the shared visual time, so it lines up with the playhead.
      if (isAutomaticScrollRef.current && scrollContainerRef.current && durationRef.current > 0) {
        centrePlayhead(scrollContainerRef.current, visualTime, sr, spp);
      }

      // Check if we've reached the playback end time (for selection playback)
      if (playbackEndTimeRef.current !== null && time >= playbackEndTimeRef.current) {
        // Stop playback at selection end (selection playback is separate from looping)
        if (engineRef.current) {
          engineRef.current.stop();
        }
        setIsPlaying(false);
        // The selection finishing returns the cursor to the selection's start,
        // the same as when the engine ends the play itself (see the stop
        // mirror): which of the two notices the end first is a race on the
        // Tone path, and they must not disagree. Other bounded plays leave the
        // cursor at their end.
        const endCursor = isSelectionPlayRef.current
          ? playStartPositionRef.current
          : playbackEndTimeRef.current;
        setCurrentTimeRefs(endCursor);
        setCurrentTime(endCursor);
        playbackEndTimeRef.current = null; // Clear the end time
        return;
      }

      // Loop is handled natively by Tone.js Transport (Transport.loop/loopStart/loopEnd).
      // Transport.seconds auto-wraps at loop boundaries, so getPlaybackTime() returns
      // the correct position without manual detection here.

      // Auto-stop at the end of the timeline (player-style default), unless:
      // - indefinitePlayback: the transport rolls until an explicit
      //   stop/pause (DAW-style, matching dawcore's indefinite-playback), or
      // - a recording session is active: overdub playback must run past the
      //   end of existing material (#589/#590).
      // Explicit ends (selection playback, annotation boundaries) are
      // handled above regardless.
      if (
        time >= durationRef.current &&
        !indefinitePlaybackRef.current &&
        !recordingActiveRef.current
      ) {
        // Stop playback - inline to avoid circular dependency
        if (engineRef.current) {
          engineRef.current.stop();
        }
        setIsPlaying(false);
        setCurrentTimeRefs(playStartPositionRef.current);
        setCurrentTime(playStartPositionRef.current);
        setActiveAnnotationId(null);
        return;
      }
      startAnimationFrameLoop(updateTime);
    };
    startAnimationFrameLoop(updateTime);
  }, [
    setActiveAnnotationId,
    startAnimationFrameLoop,
    getPlaybackTime,
    setCurrentTimeRefs,
    annotationLookup,
    // Refs and a stable function from the shared provider hooks: they never
    // change, and are listed because the linter cannot see that.
    annotationsRef,
    activeAnnotationIdRef,
    continuousPlayRef,
    isAutomaticScrollRef,
    scrollContainerRef,
    runFrameCallbacks,
  ]);

  const stopAnimationLoop = stopAnimationFrameLoop;

  // Two jobs, during playback only:
  //  - restart the animation loop when playback starts and if its closure
  //    changes, so the running loop always has current values (its
  //    dependencies are stable today; the timeline end is read from
  //    `durationRef`, so a duration change does not restart it);
  //  - when continuous play is switched ON, reschedule the audio without an end,
  //    so it runs past the annotation it was bounded to.
  // The reschedule is tied to that false -> true transition, not to the current
  // value: this effect also runs when playback starts and when the loop is
  // rebuilt, and with continuous play already on those used to stop and restart
  // the audio as well (every Play started twice; a duration change restarted it).
  //
  // While the selection is what is playing, continuous play has no effect at
  // all: the loop does not cut playback at annotation boundaries (see the loop)
  // and switching the toggle reschedules nothing.
  const prevContinuousPlayRef = useRef(continuousPlay);
  useEffect(() => {
    const continuousPlayTurnedOn =
      continuousPlay && !prevContinuousPlayRef.current && !isSelectionPlayRef.current;
    prevContinuousPlayRef.current = continuousPlay;

    const reschedulePlayback = async () => {
      if (isPlaying && animationFrameRef.current && engineRef.current) {
        if (continuousPlayTurnedOn) {
          const currentPos = currentTimeRef.current;

          // Stop current playout (which may have duration limit + pause callback).
          // Suppressed: this immediately restarts playback below — see
          // suppressEngineStopMirrorRef declaration.
          suppressEngineStopMirrorRef.current = true;
          engineRef.current.stop();
          suppressEngineStopMirrorRef.current = false;
          stopAnimationLoop();

          const timeNow = getAudioContextTime();
          playbackStartTimeRef.current = timeNow;
          audioStartPositionRef.current = currentPos;

          // What continuous play removes is the end of the annotation being
          // played. Only an end that IS the active annotation's end is dropped
          // (the loop's own end check with it, or it would stop playback there
          // anyway). Any other bounded play, such as a programmatic
          // play(start, duration), keeps its end.
          const boundedEnd = playbackEndTimeRef.current;
          const activeId = activeAnnotationIdRef.current;
          const activeAnnotation = activeId
            ? annotationLookup.byId(annotationsRef.current, activeId)
            : undefined;
          const endsWithAnnotation =
            boundedEnd !== null &&
            activeAnnotation !== undefined &&
            Math.abs(boundedEnd - activeAnnotation.end) < 1e-6;
          const endTime = endsWithAnnotation ? null : boundedEnd;
          playbackEndTimeRef.current = endTime;
          engineRef.current.play(currentPos, endTime ?? undefined);
          startAnimationLoop();
        } else {
          // Nothing about the audio changed: only refresh the loop.
          stopAnimationLoop();
          startAnimationLoop();
        }
      }
    };

    reschedulePlayback().catch((err) => {
      console.warn('[waveform-playlist] Failed to reschedule playback:', err);
      setIsPlaying(false);
      stopAnimationLoop();
    });
  }, [
    continuousPlay,
    isPlaying,
    startAnimationLoop,
    stopAnimationLoop,
    animationFrameRef,
    getAudioContextTime,
    annotationLookup,
    annotationsRef,
    activeAnnotationIdRef,
  ]);

  // Resume playback after tracks change (e.g., after splitting a clip during playback)
  useEffect(() => {
    const resumePlayback = async () => {
      // engineRef is null while a rebuild is in flight — the pending play
      // stays queued until the run triggered by engineEpoch.
      const engine = engineRef.current;
      const request = pendingResumeRef.current;
      if (request && engine) {
        if (!audioInitializedRef.current) {
          // The request STAYS in the slot across this await, so whatever
          // happens meanwhile is unambiguous: stop()/pause()/a newer play()
          // replace or clear it, and if the engine is replaced, the new
          // engine's own run of this effect finds it still waiting.
          await engine.init();
          if (engineRef.current !== engine || pendingResumeRef.current !== request) {
            return;
          }
          audioInitializedRef.current = true;
        }

        // Read the request only now: setSelection may have re-pointed it (in
        // place, keeping its identity) while init() was pending.
        const { position, endTime } = request;
        playbackStartTimeRef.current = getAudioContextTime();
        audioStartPositionRef.current = position;

        pendingResumeRef.current = null;
        engine.play(position, endTime);
        setIsPlaying(true);
        startAnimationLoop();
      }
    };

    resumePlayback().catch((err) => {
      console.warn('[waveform-playlist] Failed to resume playback after track change:', err);
      setIsPlaying(false);
      stopAnimationLoop();
    });
  }, [tracks, engineEpoch, startAnimationLoop, stopAnimationLoop, getAudioContextTime]);

  // Playback controls
  const play = useCallback(
    async (startTime?: number, playDuration?: number) => {
      const actualStartTime = startTime ?? currentTimeRef.current;
      const endTime = playDuration !== undefined ? actualStartTime + playDuration : undefined;

      // Is this the highlighted selection being played?
      const selectionStartNow = selectionStartRef.current ?? 0;
      const selectionEndNow = selectionEndRef.current ?? 0;
      // It may start inside the selection (resuming after a pause) but always
      // runs to the selection's end.
      isSelectionPlayRef.current =
        endTime !== undefined &&
        selectionEndNow > selectionStartNow &&
        actualStartTime >= selectionStartNow - 1e-6 &&
        actualStartTime < selectionEndNow &&
        Math.abs(endTime - selectionEndNow) < 1e-6;
      // Where a Stop (or the play finishing) returns the cursor. For the
      // selection that is its start even when this play resumed part-way in:
      // otherwise the cursor would land back inside the selection and every
      // later Play would repeat only the tail.
      const playStartPosition = isSelectionPlayRef.current ? selectionStartNow : actualStartTime;
      const requestId = ++playRequestIdRef.current;

      const engine = engineRef.current;
      if (!engine) {
        // The engine is being rebuilt (tracks changed). Queue the play: the
        // resume effect starts it when the new engine is assigned. isPlaying
        // stays false until audio actually starts (#675).
        if (engineBuildInFlightRef.current) {
          playStartPositionRef.current = playStartPosition;
          setCurrentTimeRefs(actualStartTime);
          playbackEndTimeRef.current = endTime ?? null;
          pendingResumeRef.current = { position: actualStartTime, endTime };
        }
        return;
      }
      // A direct play supersedes anything queued for a rebuild.
      pendingResumeRef.current = null;

      playStartPositionRef.current = playStartPosition;

      // Update currentTimeRef to match the actual start position
      // This ensures the animation loop starts from the correct position
      setCurrentTimeRefs(actualStartTime);

      // Stop existing playback and animation loop before restarting.
      // engine.stop() resets engine._currentTime to _playStartPosition (could be 0)
      // and sets _isPlaying=false. AnimatedPlayhead's RAF may fire during this
      // window and call engine.getCurrentTime() which would return 0.
      // The seek() immediately sets _currentTime to the intended start position,
      // preventing the cursor flash.
      // Suppressed: seek()+play() below immediately re-establish the correct
      // position — see suppressEngineStopMirrorRef declaration.
      suppressEngineStopMirrorRef.current = true;
      engine.stop();
      suppressEngineStopMirrorRef.current = false;
      engine.seek(actualStartTime);
      stopAnimationLoop();

      // Record timing for accurate position tracking using the adapter's AudioContext
      const startTimeNow = getAudioContextTime();
      playbackStartTimeRef.current = startTimeNow;
      audioStartPositionRef.current = actualStartTime;

      // Set playback end time if playing with duration (e.g., selection playback)
      playbackEndTimeRef.current = endTime ?? null;

      // Don't set up playback complete callback for annotations
      // The animation loop handles stopping at annotation boundaries
      // This avoids callback timing issues when switching between annotations

      // Ensure AudioContext is resumed (requires user gesture, no-op after first call).
      // Guarded by ref so subsequent plays skip the await entirely.
      if (!audioInitializedRef.current) {
        await engine.init();
        if (playRequestIdRef.current !== requestId) {
          // stop(), pause() or a newer play() happened while init() was
          // pending. This request is obsolete — starting it now would play
          // after the user's Stop, or over their newer request.
          return;
        }
        if (engineRef.current !== engine) {
          // A rebuild disposed this engine while init() was pending. Hand the
          // play to its replacement instead of starting a dead engine — if
          // there is one: after a failed build nothing is coming, and a
          // stranded request would fire on some later, unrelated rebuild.
          if (engineRef.current) {
            pendingResumeRef.current = { position: actualStartTime, endTime };
            // Already assigned, so its epoch run has passed — ask for another.
            setEngineEpoch((epoch) => epoch + 1);
          } else if (engineBuildInFlightRef.current) {
            pendingResumeRef.current = { position: actualStartTime, endTime };
          }
          return;
        }
        audioInitializedRef.current = true;
      }

      try {
        engine.play(actualStartTime, endTime);
      } catch (err) {
        console.warn('[waveform-playlist] Playback failed to start:', err);
        stopAnimationLoop();
        return;
      }
      setIsPlaying(true);
      startAnimationLoop();
    },
    [
      startAnimationLoop,
      stopAnimationLoop,
      setCurrentTimeRefs,
      getAudioContextTime,
      selectionStartRef,
      selectionEndRef,
    ]
  );

  const pause = useCallback(() => {
    // Cancels a play queued behind an engine rebuild or parked in init().
    pendingResumeRef.current = null;
    playRequestIdRef.current += 1;

    // With no engine (a rebuild is in flight) there is nothing to pause, but
    // the UI state must still change: playback that was running when the
    // rebuild began leaves isPlaying true until its resume, which was just
    // cancelled. Hold the cursor where it is.
    const engine = engineRef.current;
    // Get current position from engine (auto-wraps at loop boundaries)
    const pauseTime = engine ? getPlaybackTime() : currentTimeRef.current;

    engine?.pause();
    setIsPlaying(false);
    stopAnimationLoop();

    // Update to the calculated pause position
    setCurrentTimeRefs(pauseTime);
    setCurrentTime(pauseTime);
  }, [stopAnimationLoop, getPlaybackTime, setCurrentTimeRefs]);

  const stop = useCallback(() => {
    // Cancels a play queued behind an engine rebuild or parked in init().
    pendingResumeRef.current = null;
    playRequestIdRef.current += 1;

    // No engine while a rebuild is in flight — the UI state still resets
    // (see pause()).
    engineRef.current?.stop();
    // The engine rewinds to where ITS play began; for a selection resumed
    // part-way that is not the selection start. Keep the two in step.
    if (isSelectionPlayRef.current) engineRef.current?.seek(playStartPositionRef.current);
    setIsPlaying(false);
    stopAnimationLoop();

    // Return cursor to where playback started (Audacity-style)
    setCurrentTimeRefs(playStartPositionRef.current);
    setCurrentTime(playStartPositionRef.current);
    setActiveAnnotationId(null);
  }, [stopAnimationLoop, setActiveAnnotationId, setCurrentTimeRefs]);

  // Seek to a specific time - works whether playing or stopped
  const seekTo = useCallback(
    (time: number) => {
      // Clamp to the audio. Where the transport may run past its end (an
      // `indefinitePlayback` provider, a recording session) a finite time
      // past the end is a valid position: Skip Backward from 30 s over 10 s
      // of material must land at 25 s, not at 10 s. An infinite one
      // (Fast Forward) still means the end of the audio.
      const pastEndAllowed =
        Number.isFinite(time) && (indefinitePlaybackRef.current || recordingActiveRef.current);
      const upperLimit = pastEndAllowed ? Infinity : durationRef.current;
      const clampedTime = Math.max(0, Math.min(time, upperLimit));

      // Update the current time state
      setCurrentTimeRefs(clampedTime);
      setCurrentTime(clampedTime);

      // If currently playing, restart at the new position. play() handles
      // stop+seek+restart internally, and with the engine mid-rebuild it
      // re-points the play that is waiting for the new engine (#688: the
      // transport buttons are `seekTo` only, and used to do this themselves).
      if (isPlayingRef.current) {
        play(clampedTime);
      }
    },
    [play, setCurrentTimeRefs]
  );

  // Track controls
  const setTrackMute = useCallback((trackIndex: number, muted: boolean) => {
    const trackId = tracksRef.current[trackIndex]?.id;
    if (!trackId) return;

    setTrackStates((prev) =>
      prev.map((state, i) => (i === trackIndex ? { ...state, muted } : state))
    );

    if (engineRef.current) {
      engineRef.current.setTrackMute(trackId, muted);
    }
  }, []);

  const setTrackSolo = useCallback((trackIndex: number, soloed: boolean) => {
    const trackId = tracksRef.current[trackIndex]?.id;
    if (!trackId) return;

    setTrackStates((prev) =>
      prev.map((state, i) => (i === trackIndex ? { ...state, soloed } : state))
    );

    if (engineRef.current) {
      engineRef.current.setTrackSolo(trackId, soloed);
    }
  }, []);

  const setTrackVolume = useCallback((trackIndex: number, volume: number) => {
    const trackId = tracksRef.current[trackIndex]?.id;
    if (!trackId) return;

    setTrackStates((prev) =>
      prev.map((state, i) => (i === trackIndex ? { ...state, volume } : state))
    );

    if (engineRef.current) {
      engineRef.current.setTrackVolume(trackId, volume);
    }
  }, []);

  const setTrackPan = useCallback((trackIndex: number, pan: number) => {
    const trackId = tracksRef.current[trackIndex]?.id;
    if (!trackId) return;

    setTrackStates((prev) =>
      prev.map((state, i) => (i === trackIndex ? { ...state, pan } : state))
    );

    if (engineRef.current) {
      engineRef.current.setTrackPan(trackId, pan);
    }
  }, []);

  const reorderTrack = useCallback(
    (trackId: string, toIndex: number) => {
      if (!engineRef.current) {
        console.warn('[waveform-playlist] reorderTrack: engine not ready, call ignored');
        return;
      }
      engineRef.current.reorderTrack(trackId, toIndex);
    },
    [engineRef]
  );

  // @dnd-kit/react's Feedback and OptimisticSortingPlugin sortable plugins
  // perform raw, React-bypassing DOM node moves (insertAdjacentElement /
  // replaceWith) as part of their live drag-preview and collision-commit
  // mechanics — confirmed via MutationObserver instrumentation to physically
  // relocate the React-owned track-controls row during a track-reorder drag,
  // leaving its parent/nextSibling different from what React's fiber tree
  // still believes. That desync is permanent for the session: every LATER
  // React-driven reorder (button OR drag) computes correct data but silently
  // fails to patch the DOM for these rows. `SortableTrackControls` already
  // sets `feedback: 'move'` to avoid the placeholder-splice half of this (see
  // its comment), but OptimisticSortingPlugin's own `reorder()` DOM splice
  // fires independently on any drag that commits a real index change and
  // isn't configurable away without losing live index tracking. Bumping this
  // epoch forces the view's track-controls part to re-key (remount) its
  // slots after every track-reorder drag ends — committed or canceled, since
  // corruption can occur before a final index is even decided — discarding
  // any corrupted fiber state so the NEXT reorder (drag or button) starts
  // from a clean DOM. Called from ClipInteractionProvider's onDragEnd.
  const bumpTrackReorderEpoch = useCallback(() => {
    setTrackReorderEpoch((epoch) => epoch + 1);
  }, []);

  // Selection — wraps hook setter with playback side-effects (provider concern).
  const setSelection = useCallback(
    (start: number, end: number) => {
      setSelectionEngine(start, end);
      setCurrentTimeRefs(start);
      setCurrentTime(start);

      // What playback does from here, if it is running or queued. A new
      // highlighted range is played start to end, as the Play button would
      // (looping on: open-ended, the transport's loop handles the bounds). A
      // plain cursor move carries on open-ended from the new position.
      const playsRange = end > start && !(isLoopEnabledRef.current ?? false);
      const endTime = playsRange ? end : undefined;

      // Whatever bounded play was running or queued (a selection, an
      // annotation) is over, so nothing of it may outlive it. Its end stopped
      // playback at once when the new position was past it; its active
      // annotation did the same through the loop's stop-at-annotation-end;
      // and its play-start position is where a later Stop would have
      // returned the cursor.
      const replaceBoundedPlay = () => {
        playbackEndTimeRef.current = endTime ?? null;
        isSelectionPlayRef.current = playsRange;
        playStartPositionRef.current = start;
        if (activeAnnotationIdRef.current !== null) setActiveAnnotationId(null);
      };

      // A play queued behind an engine rebuild follows the selection too. The
      // request is changed IN PLACE: a resume parked in init() recognises its
      // request by identity, and a new object would strand it (#675, rule 4).
      const queued = pendingResumeRef.current;
      if (queued) {
        // The queued play will start it; restarting the engine here as well
        // would start it twice.
        queued.position = start;
        queued.endTime = endTime;
        replaceBoundedPlay();
        return;
      }

      if (!isPlayingRef.current) {
        // Nothing is playing: whatever play ended earlier no longer says
        // anything about this position. Without this, Stop (Escape) pressed
        // while stopped sent the cursor back to an old play's start.
        isSelectionPlayRef.current = false;
        playStartPositionRef.current = start;
        return;
      }

      if (engineRef.current) {
        // Stop + seek before restarting playback from selection start.
        // engine.stop() resets _currentTime and _isPlaying, creating a window
        // where getCurrentTime() returns wrong value. seek() immediately
        // corrects _currentTime so any RAF firing in between reads the
        // intended position. engine.play() then restarts everything.
        // Suppressed: seek()+play() below immediately re-establish the correct
        // position — see suppressEngineStopMirrorRef declaration. Unguarded,
        // the mirror would also flip isPlaying to false with nothing here to
        // set it back true (isPlaying was already true on entry to this branch).
        suppressEngineStopMirrorRef.current = true;
        engineRef.current.stop();
        suppressEngineStopMirrorRef.current = false;
        engineRef.current.seek(start);
        replaceBoundedPlay();
        // This is a new play: say when and where it started, as `play()` does.
        // `useEngineRefs()` hands these two to consumers (a custom readout or
        // playhead), and until 2026-11 they kept describing the play this one
        // replaced.
        playbackStartTimeRef.current = getAudioContextTime();
        audioStartPositionRef.current = start;
        engineRef.current.play(start, endTime);
      }
    },
    [
      setSelectionEngine,
      setCurrentTimeRefs,
      setActiveAnnotationId,
      isLoopEnabledRef,
      activeAnnotationIdRef,
      getAudioContextTime,
    ]
  );

  const sampleRate = sampleRateRef.current;

  // Context values, grouped by how often their fields change (#768). A
  // subscription is to a whole value, so a field belongs with the fields that
  // change when it does: a component that reads `sampleRate` must not render
  // on every step of a volume slider.

  // Changes on play, pause and stop only. Not on a seek: the resting cursor
  // position has its own context (#740).
  const isPlayingValue: IsPlayingContextValue = useMemo(() => ({ isPlaying }), [isPlaying]);

  // Refs and stable functions: these two values never change. The first is
  // the part the MediaElement provider has too (#688).
  const refsValue: PlaybackRefsContextValue = useMemo(
    () => ({
      currentTimeRef,
      visualTimeRef,
      registerFrameCallback,
      unregisterFrameCallback,
    }),
    [currentTimeRef, visualTimeRef, registerFrameCallback, unregisterFrameCallback]
  );

  const engineRefsValue: EngineRefsContextValue = useMemo(
    () => ({
      playbackStartTimeRef,
      audioStartPositionRef,
      getPlaybackTime,
      getAudioContextTime,
      getLookAhead,
      getOutputLatency,
      playoutRef: engineRef,
      isDraggingRef,
    }),
    [
      playbackStartTimeRef,
      audioStartPositionRef,
      getPlaybackTime,
      getAudioContextTime,
      getLookAhead,
      getOutputLatency,
      engineRef,
      isDraggingRef,
    ]
  );

  const annotationsValue: AnnotationsContextValue = useMemo(
    () => ({ annotations, continuousPlay }),
    [annotations, continuousPlay]
  );

  const annotationEditingValue: AnnotationEditingContextValue = useMemo(
    () => ({ annotationsEditable, linkEndpoints }),
    [annotationsEditable, linkEndpoints]
  );

  const loopValue: LoopContextValue = useMemo(
    () => ({ isLoopEnabled, loopStart, loopEnd }),
    [isLoopEnabled, loopStart, loopEnd]
  );

  const selectedTrackIdValue: SelectedTrackIdContextValue = useMemo(
    () => ({ selectedTrackId }),
    [selectedTrackId]
  );

  const undoRedoValue: UndoRedoContextValue = useMemo(
    () => ({ canUndo, canRedo }),
    [canUndo, canRedo]
  );

  // Its own context: these two change on every pointer move of a selection
  // drag, and nothing else in the state value does (#733).
  const selectionValue: SelectionContextValue = useMemo(
    () => ({ selectionStart, selectionEnd }),
    [selectionStart, selectionEnd]
  );

  // Their own contexts too (#740): the resting cursor position changes on
  // every seek and on every pointer move of a leftward selection drag; the
  // active annotation changes at every annotation boundary during playback.
  const currentTimeValue: CurrentTimeContextValue = useMemo(() => ({ currentTime }), [currentTime]);
  const activeAnnotationValue: ActiveAnnotationContextValue = useMemo(
    () => ({ activeAnnotationId }),
    [activeAnnotationId]
  );

  const setCurrentTimeControl = useCallback(
    (time: number) => {
      setCurrentTimeRefs(time);
      setCurrentTime(time);
    },
    [setCurrentTimeRefs]
  );

  // The actions both providers have (#688). Never changes.
  const controlsValue: PlaybackControlsContextValue = useMemo(
    () => ({
      play,
      pause,
      stop,
      seekTo,
      setSelection,
      setTimeFormat,
      setAutomaticScroll,
      setScrollContainer,
      scrollContainerRef,
      setContinuousPlay,
      setAnnotations,
      annotationPreview,
      setActiveAnnotationId,
    }),
    [
      play,
      pause,
      stop,
      seekTo,
      setSelection,
      setTimeFormat,
      setAutomaticScroll,
      setScrollContainer,
      scrollContainerRef,
      setContinuousPlay,
      setAnnotations,
      annotationPreview,
      setActiveAnnotationId,
    ]
  );

  // The actions only the multitrack editor has. Never changes.
  const editorControlsValue: EditorControlsContextValue = useMemo(
    () => ({
      setCurrentTime: setCurrentTimeControl,

      // Track controls
      setTrackMute,
      setTrackSolo,
      setTrackVolume,
      setTrackPan,
      reorderTrack,
      bumpTrackReorderEpoch,
      setTrackDragPreview,
      setSelectedTrackId: setSelectedTrackIdControl,

      // Zoom
      zoomIn: zoom.zoomIn,
      zoomOut: zoom.zoomOut,

      // Master volume
      setMasterVolume,

      // Annotation editing
      setLinkEndpoints,
      setAnnotationsEditable,

      // Loop controls
      setLoopEnabled,
      setLoopRegion,
      setLoopRegionFromSelection,
      clearLoopRegion,

      // Undo/redo
      undo,
      redo,

      // Recording
      setRecordingActive,
    }),
    [
      setCurrentTimeControl,
      setTrackMute,
      setTrackSolo,
      setTrackVolume,
      setTrackPan,
      reorderTrack,
      bumpTrackReorderEpoch,
      setTrackDragPreview,
      setSelectedTrackIdControl,
      zoom.zoomIn,
      zoom.zoomOut,
      setMasterVolume,
      setLinkEndpoints,
      setAnnotationsEditable,
      setLoopEnabled,
      setLoopRegion,
      setLoopRegionFromSelection,
      clearLoopRegion,
      undo,
      redo,
      setRecordingActive,
    ]
  );

  const viewValue: PlaylistViewContextValue = useMemo(
    () => ({
      sampleRate,
      waveHeight,
      barWidth,
      barGap,
      roundedBars,
      progressBarWidth,
      mono,
      indefinitePlayback,
      fillViewport,
    }),
    [
      sampleRate,
      waveHeight,
      barWidth,
      barGap,
      roundedBars,
      progressBarWidth,
      mono,
      indefinitePlayback,
      fillViewport,
    ]
  );

  const settingsValue: PlaylistSettingsContextValue = useMemo(
    () => ({ timeFormat, isAutomaticScroll }),
    [timeFormat, isAutomaticScroll]
  );

  const zoomValue: PlaylistZoomContextValue = useMemo(
    () => ({ samplesPerPixel, canZoomIn: zoom.canZoomIn, canZoomOut: zoom.canZoomOut }),
    [samplesPerPixel, zoom.canZoomIn, zoom.canZoomOut]
  );

  // Changes on every pointer move of a trim, and on a zoom (the peaks are
  // computed per zoom level).
  const timelineValue: PlaylistTimelineContextValue = useMemo(
    () => ({ tracks, peaksDataArray, duration, isReady, onTracksChange }),
    [tracks, peaksDataArray, duration, isReady, onTracksChange]
  );

  // Changes on every mute, solo, volume or pan change.
  const mixerValue: PlaylistMixerContextValue = useMemo(
    () => ({ trackStates, masterVolume }),
    [trackStates, masterVolume]
  );

  // Changes on every drag-over of a track reorder.
  const reorderPreviewValue: TrackReorderPreviewContextValue = useMemo(
    () => ({ trackDragPreview, trackReorderEpoch }),
    [trackDragPreview, trackReorderEpoch]
  );

  // Outermost: the values that change least. The order has no effect on
  // behaviour (every value is committed together); it is for reading.
  // The two MediaElement-only contexts are blocked: inside this provider
  // `usePlaybackRate()` must not reach a MediaElement provider further out.
  return (
    <ThemeProvider theme={mergedTheme}>
      <PlaybackRateContext.Provider value={BLOCKED}>
        <MediaElementTrackContext.Provider value={BLOCKED}>
          <PlaybackRefsContext.Provider value={refsValue}>
            <EngineRefsContext.Provider value={engineRefsValue}>
              <PlaybackControlsContext.Provider value={controlsValue}>
                <EditorControlsContext.Provider value={editorControlsValue}>
                  <PlaylistViewContext.Provider value={viewValue}>
                    <PlaylistSettingsContext.Provider value={settingsValue}>
                      <PlaylistZoomContext.Provider value={zoomValue}>
                        <UndoRedoContext.Provider value={undoRedoValue}>
                          <SelectedTrackIdContext.Provider value={selectedTrackIdValue}>
                            <SelectedRowContext.Provider value={selectedTrackIdValue}>
                              <LoopContext.Provider value={loopValue}>
                                <AnnotationEditingContext.Provider value={annotationEditingValue}>
                                  <AnnotationsContext.Provider value={annotationsValue}>
                                    <IsPlayingContext.Provider value={isPlayingValue}>
                                      <ActiveAnnotationContext.Provider
                                        value={activeAnnotationValue}
                                      >
                                        <CurrentTimeContext.Provider value={currentTimeValue}>
                                          <SelectionContext.Provider value={selectionValue}>
                                            <TrackReorderPreviewContext.Provider
                                              value={reorderPreviewValue}
                                            >
                                              <PlaylistMixerContext.Provider value={mixerValue}>
                                                <PlaylistTimelineContext.Provider
                                                  value={timelineValue}
                                                >
                                                  {children}
                                                </PlaylistTimelineContext.Provider>
                                              </PlaylistMixerContext.Provider>
                                            </TrackReorderPreviewContext.Provider>
                                          </SelectionContext.Provider>
                                        </CurrentTimeContext.Provider>
                                      </ActiveAnnotationContext.Provider>
                                    </IsPlayingContext.Provider>
                                  </AnnotationsContext.Provider>
                                </AnnotationEditingContext.Provider>
                              </LoopContext.Provider>
                            </SelectedRowContext.Provider>
                          </SelectedTrackIdContext.Provider>
                        </UndoRedoContext.Provider>
                      </PlaylistZoomContext.Provider>
                    </PlaylistSettingsContext.Provider>
                  </PlaylistViewContext.Provider>
                </EditorControlsContext.Provider>
              </PlaybackControlsContext.Provider>
            </EngineRefsContext.Provider>
          </PlaybackRefsContext.Provider>
        </MediaElementTrackContext.Provider>
      </PlaybackRateContext.Provider>
    </ThemeProvider>
  );
};
