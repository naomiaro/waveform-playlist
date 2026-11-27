import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { ThemeProvider } from 'styled-components';
import type {
  EffectsFunction,
  TrackEffectsFunction,
  SoundFontCache,
} from '@waveform-playlist/playout';
import type {
  Arrangement,
  EngineState,
  PlaylistEngine,
  PlayoutAdapter,
} from '@waveform-playlist/engine';
import { type Fade, type MidiNoteData } from '@waveform-playlist/core';
import { type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { syncSoundFontCacheToAdapter } from './soundFontSync';
import type { TrackDragPreview } from './utils/trackOrderPreview';
import type { PeakData } from '@waveform-playlist/core';
import type { AnnotationData, AnnotationStore } from '@waveform-playlist/core';
import {
  useTimeFormat,
  useZoomControls,
  useMasterVolume,
  useSelectionState,
  useLoopState,
  useSelectedTrack,
  useAnimationFrameLoop,
} from './hooks';
import { followAnnotations } from './providerInternals/followAnnotations';
import {
  useAnnotationState,
  type AnnotationListProp,
} from './providerInternals/useAnnotationState';
import { useFrameCallbacks, type FrameData } from './providerInternals/useFrameCallbacks';
import { centrePlayhead, useScrollFollow } from './providerInternals/useScrollFollow';
import { useMergedTheme } from './providerInternals/useMergedTheme';
import { useZoomAnchor } from './providerInternals/zoomAnchor';
import { useTrimPreview } from './providerInternals/useTrimPreview';
import { useEngineLifetime } from './providerInternals/useEngineLifetime';
import { useArrangementView } from './providerInternals/useArrangementView';
import { useReadyOnce } from './providerInternals/useReadyOnce';
import { useArrangementEditing } from './providerInternals/useArrangementEditing';
import { createDragGuard } from './providerInternals/dragGuard';
import { useArrangementKey } from './providerInternals/arrangementIdentity';

// Types
/**
 * What one clip is drawn from.
 *
 * `isPlaceholder` is true for the record of a clip whose audio is still loading
 * (`placeholderPeaks`): it is drawn without drag or trim handles, and there is
 * NO clip for it in `usePlaylistTimeline().tracks`, so look it up by `clipId`,
 * never by position. Every other record has it false.
 */
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
  isPlaceholder: boolean;
}

export type TrackClipPeaks = ClipPeaks[];

export type { TrackDragPreview };

export interface TrackState {
  name: string;
  /** The track's own mute, or true while a take is recording onto it (#843). */
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
}

import {
  BLOCKED,
  ActiveAnnotationContext,
  ArrangementContext,
  AnnotationOptionsContext,
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
  TrimPreviewContext,
  DragGuardContext,
  RecordingTrackContext,
  TrimPreviewPeaksContext,
  UndoRedoContext,
  type ActiveAnnotationContextValue,
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
  /**
   * What the provider plays and draws: the tracks, their mix, the undo
   * history and the loading of their audio (#812). Make it with
   * `useCreateArrangement` and change it through its methods (or
   * `useArrangement()` below the provider); the provider follows it. A new
   * object is a new playlist: everything below the provider mounts again.
   */
  arrangement: Arrangement;
  /**
   * Draw and analyse every track as one channel. A provider option, not a
   * view option: the provider computes the peaks with it.
   */
  mono?: boolean;
  /**
   * The zoom level the provider starts at, in samples per pixel (default
   * 1024). The initial value only: afterwards the engine owns the level,
   * which `useEditorControls().zoomIn()` / `zoomOut()` change. A later change
   * of this prop is not followed.
   */
  samplesPerPixel?: number;
  zoomLevels?: number[]; // Array of zoom levels in samples per pixel (lower = more zoomed in)
  /**
   * Whether automatic scroll (the view keeps the playhead centred during
   * playback) starts on; default false. The initial value only: afterwards
   * the provider owns the setting, which
   * `usePlaybackControls().setAutomaticScroll` (or the
   * `AutomaticScrollCheckbox`) changes. A later change of this prop is not
   * followed.
   */
  automaticScroll?: boolean;
  theme?: Partial<WaveformPlaylistTheme>;
  /**
   * The owner of the annotations (#867): make it with
   * `useCreateAnnotationStore` and change the annotations with its methods.
   * The provider publishes what it holds and writes nothing back. Without it
   * there are no annotations.
   */
  annotationStore?: AnnotationStore;
  /**
   * The three annotation options (`editable`, `linkEndpoints`,
   * `isContinuousPlay`); the annotations are `annotationStore`'s. The provider
   * follows the three: an option takes a new value of its field, and a setter
   * or checkbox changes it in between.
   */
  annotationList?: AnnotationListProp;
  /** Master effects chain (default Tone.js adapter only). A new function builds a new engine. */
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
  /**
   * Called once per mount, the first time an engine is attached and no source
   * of the arrangement is still pending. Read when it is called: a new
   * function identity builds nothing.
   */
  onReady?: () => void;
  /** Called when the engine or its adapter cannot be built (e.g. a missing
   *  optional peer, a throwing `createAdapter`, or an invalid
   *  `zoomLevels`/`samplesPerPixel`), and when `onReady` throws. A source that
   *  fails to load is not reported here: see `useArrangementSources`. The
   *  provider already logs the error; use this to surface it in your UI. */
  onError?: (err: Error) => void;
  /** SoundFont cache for sample-based MIDI playback. When provided, MIDI clips
   *  use SoundFont samples instead of PolySynth synthesis. */
  soundFontCache?: SoundFontCache;
  /** Disable the automatic stop when the cursor reaches the end of the
   *  longest track — the transport rolls until an explicit stop/pause
   *  (DAW-style). The multitrack view then draws the timeline as wide as its
   *  container, as `<WaveformViewOptions fillViewport>` does. Recording
   *  sessions suppress the auto-stop automatically, so most recording UIs
   *  don't need this. A provider option, not a view option: the animation
   *  loop and `seekTo` follow it. */
  indefinitePlayback?: boolean;
  /** Desired AudioContext sample rate. Creates a cross-browser AudioContext at
   *  this rate via standardized-audio-context. Pre-computed peaks (.dat files)
   *  render instantly when they match. On mismatch, falls back to worker. */
  sampleRate?: number;
  /** Factory for a custom PlayoutAdapter. When omitted, the Tone.js engine
   *  (@waveform-playlist/playout) is dynamically imported — so a custom adapter
   *  lets a consumer use neither @waveform-playlist/playout nor tone. Called once
   *  per engine build; the provider owns and disposes the returned instance.
   *  Read when an engine is built: a new function identity builds nothing. */
  createAdapter?: () => PlayoutAdapter;
  children: ReactNode;
}

export const WaveformPlaylistProvider: React.FC<WaveformPlaylistProviderProps> = (props) => {
  // A new arrangement object is a new playlist: everything below mounts again.
  const key = useArrangementKey(props.arrangement);
  return <ProviderOnArrangement key={key} {...props} />;
};

// Resting (non-playing) cursor positions display the raw time unchanged.
// Latency compensation (outputLatency + lookAhead) models the gap between
// the Transport's scheduling position and audible output — a property of
// *playing*, not of position. A seeked/paused/stopped cursor has no audible
// counterpart; the commanded position is the truth. During playback the
// animation loop uses engine.getAudibleTime() instead.
function toVisualTime(rawTime: number): number {
  return Number.isFinite(rawTime) ? Math.max(0, rawTime) : 0;
}

/** What a new engine is given and how the provider follows it; set after the hooks that own it. */
interface EngineFollowers {
  seed: (engine: PlaylistEngine) => void;
  follow: (engine: PlaylistEngine) => void;
  mirror: (state: EngineState) => void;
}

const ProviderOnArrangement: React.FC<WaveformPlaylistProviderProps> = ({
  arrangement,
  mono = false,
  samplesPerPixel: initialSamplesPerPixel = 1024,
  zoomLevels,
  automaticScroll = false,
  theme: userThemeProp,
  annotationStore,
  annotationList,
  effects,
  trackEffects,
  onReady,
  onError,
  soundFontCache,
  indefinitePlayback = false,
  sampleRate: sampleRateProp,
  createAdapter,
  children,
}) => {
  const mergedTheme = useMergedTheme(userThemeProp);

  // Content-stable: an inline array is new on every render. The engine's
  // lifetime compares the levels by content too.
  const stableZoomLevels = useMemo(
    () => zoomLevels,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomLevels?.join(',')]
  );

  // The annotations are the annotation store's (#867); the provider derives
  // what it publishes from it. Shared with the MediaElement provider (#769).
  const {
    getAnnotations,
    annotationLookup,
    annotationPreview,
    activeAnnotationId,
    activeAnnotationIdRef,
    setActiveAnnotationId,
    continuousPlay,
    continuousPlayRef,
    setContinuousPlay,
    setAnnotationsEditable,
    setLinkEndpoints,
    annotationsValue,
    annotationOptionsValue,
  } = useAnnotationState({
    annotationStore,
    annotationList,
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
  // Live track-reorder drag preview (view-level only; see the
  // "Track Reordering" section of packages/browser/CLAUDE.md). Set by
  // ClipInteractionProvider's onDragOver, cleared on drag end/cancel.
  // The committed order is untouched until drop.
  const [trackDragPreview, setTrackDragPreview] = useState<TrackDragPreview | null>(null);

  // Refs
  // Ref for animation loop access (avoids adding the prop to useCallback deps)
  const indefinitePlaybackRef = useRef(indefinitePlayback);
  indefinitePlaybackRef.current = indefinitePlayback;
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;
  const playStartPositionRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  // Visually-aligned playback time (see toVisualTime / getAudibleTime). The
  // animation loop updates this per frame. Pause/seek/stop paths sync it
  // explicitly so the static playhead reflects the commanded resting position.
  const visualTimeRef = useRef<number>(0);
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
  // The latest committed callbacks (QG): read when they are called, so a new
  // identity builds nothing.
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useLayoutEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });
  const playbackStartTimeRef = useRef<number>(0); // context.currentTime when playback started
  const audioStartPositionRef = useRef<number>(0); // Audio position when playback started
  const playbackEndTimeRef = useRef<number | null>(null); // Audio position where playback should stop (for selections)
  // Suppresses the engine 'stop' mirror (below) around provider-initiated
  // engine.stop() calls that immediately seek/restart playback in the same
  // synchronous block (play(), setSelection, reschedulePlayback). Without
  // this, the mirror's ref writes would race the restart's own writes and
  // briefly show the pre-restart position/isPlaying=false. Stop paths that
  // don't restart afterward don't need suppression — see the mirror's own
  // comment for why.
  const suppressEngineStopMirrorRef = useRef(false);
  // The latest engine zoom, available to a rebuild before React commits it.
  const engineSamplesPerPixelRef = useRef(initialSamplesPerPixel);
  // True while the bounded play in progress is the highlighted selection itself
  // (its start and end are the selection's). Set by play(). Selection playback
  // ignores continuous play; anything else, including an annotation clicked
  // while a selection is highlighted elsewhere, follows it.
  const isSelectionPlayRef = useRef(false);
  // Incremented by every play(), stop() and pause(). A play() that has been
  // waiting on engine.init() compares it afterwards: if it moved, the user has
  // since asked for something else and the older play must not start.
  const playRequestIdRef = useRef(0);

  const { animationFrameRef, startAnimationFrameLoop, stopAnimationFrameLoop } =
    useAnimationFrameLoop();

  // A build that fails while playback shows as running (a rebuild began
  // during playback and queued its resume, which the failure dropped): no
  // engine is coming, so playback shows stopped where it was. Nothing starts
  // by itself after a later build (maintainer, D3).
  const onBuildFailure = useCallback(() => {
    if (!isPlayingRef.current) return;
    setIsPlaying(false);
    stopAnimationFrameLoop();
    visualTimeRef.current = toVisualTime(currentTimeRef.current);
    setCurrentTime(currentTimeRef.current);
  }, [stopAnimationFrameLoop]);

  // The engine's own state is mirrored by the hooks below, which need the
  // engine ref first; these three reach them through a ref set after them.
  const followersRef = useRef<EngineFollowers | null>(null);
  const seedEngine = useCallback(
    (engine: PlaylistEngine) => followersRef.current?.seed(engine),
    []
  );
  const onEngine = useCallback(
    (engine: PlaylistEngine) => followersRef.current?.follow(engine),
    []
  );
  const onEngineState = useCallback((state: EngineState) => {
    engineSamplesPerPixelRef.current = state.samplesPerPixel;
    followersRef.current?.mirror(state);
  }, []);

  // The engine around the arrangement: built on mount and when `effects` or
  // the zoom levels change, disposed in every cleanup (#812). A track edit
  // builds nothing.
  const {
    engineRef,
    adapterRef,
    engineEpoch,
    bumpEngineEpoch,
    isEngineAttached,
    engineBuildInFlightRef,
    pendingResumeRef,
    audioInitializedRef,
    sampleRate,
    isSampleRateKnown,
  } = useEngineLifetime({
    arrangement,
    createAdapter,
    effects,
    resolveTrackEffects,
    soundFontCacheRef,
    sampleRateProp,
    zoomLevels,
    samplesPerPixelRef: engineSamplesPerPixelRef,
    playbackEndTimeRef,
    seedEngine,
    onEngine,
    onEngineState,
    stopAnimationFrameLoop,
    onErrorRef,
    onBuildFailure,
  });
  // For the animation loop, which runs outside render.
  const sampleRateRef = useRef(sampleRate);
  sampleRateRef.current = sampleRate;

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
  // The committed zoom level for the animation loop. A zoom change keeps a
  // point of the view in place: the hovering pointer, else the selection,
  // else the cursor, else the centre (#828; `zoomAnchorX`).
  const getZoomAnchorTimes = useCallback(
    () => ({
      selectionStart: selectionStartRef.current ?? 0,
      selectionEnd: selectionEndRef.current ?? 0,
      cursorTime: visualTimeRef.current,
    }),
    [selectionStartRef, selectionEndRef]
  );
  const samplesPerPixelRef = useZoomAnchor({
    scrollContainerRef,
    samplesPerPixel,
    sampleRate,
    getTimes: getZoomAnchorTimes,
  });
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

  // Everything the provider publishes about the tracks, derived from the
  // arrangement during render and never written back (#812).
  const baseScale = useMemo(
    () => Math.min(...(stableZoomLevels ?? [256, 512, 1024, 2048, 4096, 8192])),
    [stableZoomLevels]
  );
  const view = useArrangementView(arrangement, {
    samplesPerPixel,
    mono,
    baseScale,
    placeholderSampleRate: isSampleRateKnown ? sampleRate : null,
  });
  const { tracks, duration } = view;
  // The animation loop and `seekTo` read the timeline end from here, so that
  // neither changes identity when it moves: `seekTo` and `play` are in the
  // controls value, which must not follow `duration` (#767). Written during
  // render, like `isPlayingRef`, so that a child that calls `seekTo` from a
  // layout effect of the same commit already gets the new end.
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const { isReady, refusePlayBeforeFirstReady } = useReadyOnce({
    isEngineAttached,
    arrangement,
    onReadyRef,
    onErrorRef,
    trackCount: tracks.length,
    duration,
  });

  // A trim drag in progress (#812): moves go to this source, and only the
  // dragged clip's view follows them. The tracks change once, on release.
  const { trimPreview, trimPreviewPeaks } = useTrimPreview({
    tracks,
    peaksOptions: view.peaksOptions,
    peaksCacheRef: view.peaksCacheRef,
  });

  // The mixer setters, reorder, undo, redo and the recording session: all
  // through the arrangement, engine or not.
  const [dragGuard] = useState(createDragGuard);
  const editing = useArrangementEditing(arrangement, dragGuard);
  const { recordingActiveRef } = editing;

  // Cross-hook concern: reads selection refs to set loop region
  const setLoopRegionFromSelection = useCallback(() => {
    const start = selectionStartRef.current ?? 0;
    const end = selectionEndRef.current ?? 0;
    if (start !== end && end > start) {
      setLoopRegion(start, end);
    }
  }, [setLoopRegion, selectionStartRef, selectionEndRef]);

  // Forward late-arriving / swapped SoundFontCache to the live adapter so
  // MIDI tracks upgrade from PolySynth without an engine rebuild. Before the
  // first adapter exists this runs against null, which the helper ignores;
  // the build reads the cache from its ref.
  useEffect(() => {
    syncSoundFontCacheToAdapter(adapterRef.current, soundFontCache);
  }, [soundFontCache, adapterRef]);

  // A loaded clip with nothing to draw from is almost always a wiring
  // mistake. A clip still loading is not in `tracks`, so it is never reported.
  useEffect(() => {
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (!clip.audioBuffer && !clip.waveformData && !clip.midiNotes) {
          console.warn(`[waveform-playlist] Clip "${clip.id}" has no audio data or waveform data`);
        }
      }
    }
  }, [tracks]);

  // Audio clock from the adapter's own AudioContext (#510 — replaces tone's
  // getContext()). Stable; reads a ref so identity never changes.
  const getAudioContextTime = useCallback(
    () => adapterRef.current?.audioContext.currentTime ?? 0,
    [adapterRef]
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
  }, [getAudioContextTime, engineRef]);

  // Pair-write helper for the dual-ref pattern. Storage stays raw on
  // `currentTimeRef`; display gets the guard-clamped raw version on `visualTimeRef`
  // (compensation happens in the animation loop via engine.getAudibleTime() while playing).
  // Use this at every pause/seek/stop/loop site — never assign one ref alone
  // (browser/CLAUDE.md: "Display uses visualTimeRef").
  const setCurrentTimeRefs = useCallback((rawTime: number) => {
    currentTimeRef.current = rawTime;
    visualTimeRef.current = toVisualTime(rawTime);
  }, []);

  // Read the engine's scheduler lookahead (Tone adapter ~0.1s, native 0).
  // Exposed through PlaybackRefsContextValue so consumers (e.g., recording
  // live preview) compute audible-latency from the same source as the playhead.
  const getLookAhead = useCallback((): number => {
    return engineRef.current?.lookAhead ?? 0;
  }, [engineRef]);

  const getOutputLatency = useCallback((): number => {
    const audioCtx = adapterRef.current?.audioContext;
    return audioCtx && 'outputLatency' in audioCtx ? (audioCtx as AudioContext).outputLatency : 0;
  }, [adapterRef]);

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
  // setSelection, reschedulePlayback) — those already set the correct target
  // position themselves; an unguarded mirror would clobber it mid-transition
  // with the pre-restart position. Stop paths that terminate playback
  // (stop(), the rAF loop's own annotation/selection/duration-end branches)
  // don't need suppression: they either write the identical value the
  // mirror would (both read _playStartPosition), or run their own
  // setCurrentTimeRefs call synchronously right after this listener, which —
  // as plain refs, not batched state — simply overwrites the mirror's write
  // with no other code observing the transient value in between.
  const mirrorEngineStop = useCallback(
    (engine: PlaylistEngine) => {
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
    },
    [stopAnimationFrameLoop, setCurrentTimeRefs]
  );

  // What a new engine is given and how the provider follows it. The engine
  // owns selection, loop, selected track, zoom and master volume; the hooks
  // mirror them from `statechange`. Seeded so that a fresh engine does not
  // put them back to defaults.
  useLayoutEffect(() => {
    const mirror = (state: EngineState) => {
      onSelectionEngineState(state);
      onLoopEngineState(state);
      onSelectedTrackEngineState(state);
      onZoomEngineState(state);
      onVolumeEngineState(state);
    };
    followersRef.current = {
      seed: (engine) => {
        engine.setSelection(selectionStartRef.current ?? 0, selectionEndRef.current ?? 0);
        engine.setLoopRegion(loopStartRef.current ?? 0, loopEndRef.current ?? 0);
        if (isLoopEnabledRef.current) engine.setLoopEnabled(true);
        engine.setMasterVolume(masterVolumeRef.current ?? 1.0);
        if (selectedTrackIdRef.current) engine.selectTrack(selectedTrackIdRef.current);
      },
      follow: (engine) => {
        engine.on('statechange', onEngineState);
        engine.on('stop', () => mirrorEngineStop(engine));
      },
      mirror,
    };
  });

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
        annotations: getAnnotations(),
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
    samplesPerPixelRef,
    setActiveAnnotationId,
    startAnimationFrameLoop,
    getPlaybackTime,
    setCurrentTimeRefs,
    annotationLookup,
    // Refs and a stable function from the shared provider hooks: they never
    // change, and are listed because the linter cannot see that.
    getAnnotations,
    activeAnnotationIdRef,
    continuousPlayRef,
    isAutomaticScrollRef,
    scrollContainerRef,
    runFrameCallbacks,
    engineRef,
    recordingActiveRef,
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
            ? annotationLookup.byId(getAnnotations(), activeId)
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
    getAnnotations,
    activeAnnotationIdRef,
    engineRef,
  ]);

  // Start a play that waited for an engine: playback a rebuild interrupted, or a
  // play() asked for while one was being built (#675). Runs when a freshly
  // built engine is assigned (and when play() asks for another run).
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
      console.warn('[waveform-playlist] Failed to resume playback on the new engine:', err);
      setIsPlaying(false);
      stopAnimationLoop();
    });
  }, [
    engineEpoch,
    startAnimationLoop,
    stopAnimationLoop,
    getAudioContextTime,
    engineRef,
    pendingResumeRef,
    audioInitializedRef,
  ]);

  // Playback controls
  const play = useCallback(
    async (startTime?: number, playDuration?: number) => {
      // Before the first ready of this mount nothing plays and nothing is
      // queued (#812): no ref, no request id, no pending resume is touched.
      if (refusePlayBeforeFirstReady()) return;
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
        // The engine is being built. Queue the play: the
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
            bumpEngineEpoch();
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
        // The play never started, so the UI must not keep saying it is
        // playing. The engine.stop() above is suppressed (the mirror would
        // otherwise clear the flag before the seek that follows it), so
        // nothing else turns isPlaying off on this path: a restart that
        // throws — a seek or an annotation click while playing — would
        // leave the transport showing playback that is not running (#827).
        setIsPlaying(false);
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
      engineRef,
      engineBuildInFlightRef,
      pendingResumeRef,
      audioInitializedRef,
      bumpEngineEpoch,
      refusePlayBeforeFirstReady,
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
  }, [stopAnimationLoop, getPlaybackTime, setCurrentTimeRefs, engineRef, pendingResumeRef]);

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
  }, [stopAnimationLoop, setActiveAnnotationId, setCurrentTimeRefs, engineRef, pendingResumeRef]);

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
    [play, setCurrentTimeRefs, recordingActiveRef]
  );

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
      engineRef,
      pendingResumeRef,
    ]
  );

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
    }),
    [
      playbackStartTimeRef,
      audioStartPositionRef,
      getPlaybackTime,
      getAudioContextTime,
      getLookAhead,
      getOutputLatency,
      engineRef,
    ]
  );

  const loopValue: LoopContextValue = useMemo(
    () => ({ isLoopEnabled, loopStart, loopEnd }),
    [isLoopEnabled, loopStart, loopEnd]
  );

  const selectedTrackIdValue: SelectedTrackIdContextValue = useMemo(
    () => ({ selectedTrackId }),
    [selectedTrackId]
  );

  const { canUndo, canRedo } = view;
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

  // What a click on an annotation does (#686). A play of the annotation's
  // length, so the audio ends on the sample; with continuous play on, an
  // open-ended one. Continuous play is read when the click happens, so the
  // function never changes.
  const playAnnotation = useCallback(
    (annotation: AnnotationData) => {
      // Before the first ready the click does nothing, highlight included.
      if (refusePlayBeforeFirstReady()) return;
      setActiveAnnotationId(annotation.id);
      const playDuration = continuousPlayRef.current
        ? undefined
        : annotation.end - annotation.start;
      play(annotation.start, playDuration).catch((err) => {
        console.warn(
          '[waveform-playlist] Failed to start playback for annotation ' +
            annotation.id +
            ': ' +
            String(err)
        );
      });
    },
    [play, setActiveAnnotationId, continuousPlayRef, refusePlayBeforeFirstReady]
  );

  // The actions both providers have (#688). Changes only with the
  // `annotationStore` prop.
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
      setAnnotationsEditable,
      setLinkEndpoints,
      annotationPreview,
      annotationStore,
      setActiveAnnotationId,
      playAnnotation,
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
      setAnnotationsEditable,
      setLinkEndpoints,
      annotationPreview,
      annotationStore,
      setActiveAnnotationId,
      playAnnotation,
    ]
  );

  // The actions only the multitrack editor has. Never changes.
  const editorControlsValue: EditorControlsContextValue = useMemo(
    () => ({
      setCurrentTime: setCurrentTimeControl,

      // Track controls (the arrangement's mix and order)
      setTrackMute: editing.setTrackMute,
      setTrackSolo: editing.setTrackSolo,
      setTrackVolume: editing.setTrackVolume,
      setTrackPan: editing.setTrackPan,
      reorderTrack: editing.reorderTrack,
      setTrackDragPreview,
      setSelectedTrackId: setSelectedTrackIdControl,

      // Zoom
      zoomIn: zoom.zoomIn,
      zoomOut: zoom.zoomOut,

      // Master volume
      setMasterVolume,

      // Loop controls
      setLoopEnabled,
      setLoopRegion,
      setLoopRegionFromSelection,
      clearLoopRegion,

      // Undo/redo (the arrangement's history)
      undo: editing.undo,
      redo: editing.redo,

      // Recording
      setRecordingActive: editing.setRecordingActive,
    }),
    [
      setCurrentTimeControl,
      editing.setTrackMute,
      editing.setTrackSolo,
      editing.setTrackVolume,
      editing.setTrackPan,
      editing.reorderTrack,
      setTrackDragPreview,
      setSelectedTrackIdControl,
      zoom.zoomIn,
      zoom.zoomOut,
      setMasterVolume,
      setLoopEnabled,
      setLoopRegion,
      setLoopRegionFromSelection,
      clearLoopRegion,
      editing.undo,
      editing.redo,
      editing.setRecordingActive,
    ]
  );

  const viewValue: PlaylistViewContextValue = useMemo(
    () => ({
      sampleRate,
      mono,
      indefinitePlayback,
    }),
    [sampleRate, mono, indefinitePlayback]
  );

  const settingsValue: PlaylistSettingsContextValue = useMemo(
    () => ({ timeFormat, isAutomaticScroll }),
    [timeFormat, isAutomaticScroll]
  );

  const zoomValue: PlaylistZoomContextValue = useMemo(
    () => ({ samplesPerPixel, canZoomIn: zoom.canZoomIn, canZoomOut: zoom.canZoomOut }),
    [samplesPerPixel, zoom.canZoomIn, zoom.canZoomOut]
  );

  // Changes on every clip operation (a trim once, on release: its moves are
  // the trim preview, #812), on a zoom (the peaks are computed per zoom
  // level) and when audio arrives for a clip.
  const { peaksDataArray, trackStates } = view;
  const timelineValue: PlaylistTimelineContextValue = useMemo(
    () => ({ tracks, peaksDataArray, duration, isReady }),
    [tracks, peaksDataArray, duration, isReady]
  );

  // Changes on every mute, solo, volume or pan change.
  const mixerValue: PlaylistMixerContextValue = useMemo(
    () => ({ trackStates, masterVolume }),
    [trackStates, masterVolume]
  );

  // Changes on every drag-over of a track reorder.
  const reorderPreviewValue: TrackReorderPreviewContextValue = useMemo(
    () => ({ trackDragPreview }),
    [trackDragPreview]
  );

  // Outermost: the values that change least. The order has no effect on
  // behaviour (every value is committed together); it is for reading.
  // The two MediaElement-only contexts are blocked: inside this provider
  // `usePlaybackRate()` must not reach a MediaElement provider further out.
  return (
    <ThemeProvider theme={mergedTheme}>
      <PlaybackRateContext value={BLOCKED}>
        <MediaElementTrackContext value={BLOCKED}>
          <ArrangementContext value={arrangement}>
            <PlaybackRefsContext value={refsValue}>
              <EngineRefsContext value={engineRefsValue}>
                <DragGuardContext value={dragGuard}>
                  <TrimPreviewContext value={trimPreview}>
                    <TrimPreviewPeaksContext value={trimPreviewPeaks}>
                      <PlaybackControlsContext value={controlsValue}>
                        <EditorControlsContext value={editorControlsValue}>
                          <PlaylistViewContext value={viewValue}>
                            <PlaylistSettingsContext value={settingsValue}>
                              <PlaylistZoomContext value={zoomValue}>
                                <UndoRedoContext value={undoRedoValue}>
                                  <SelectedTrackIdContext value={selectedTrackIdValue}>
                                    <SelectedRowContext value={selectedTrackIdValue}>
                                      <LoopContext value={loopValue}>
                                        <AnnotationOptionsContext value={annotationOptionsValue}>
                                          <AnnotationsContext value={annotationsValue}>
                                            <IsPlayingContext value={isPlayingValue}>
                                              <ActiveAnnotationContext
                                                value={activeAnnotationValue}
                                              >
                                                <CurrentTimeContext value={currentTimeValue}>
                                                  <SelectionContext value={selectionValue}>
                                                    <TrackReorderPreviewContext
                                                      value={reorderPreviewValue}
                                                    >
                                                      <PlaylistMixerContext value={mixerValue}>
                                                        <PlaylistTimelineContext
                                                          value={timelineValue}
                                                        >
                                                          <RecordingTrackContext
                                                            value={editing.recordingTrack}
                                                          >
                                                            {children}
                                                          </RecordingTrackContext>
                                                        </PlaylistTimelineContext>
                                                      </PlaylistMixerContext>
                                                    </TrackReorderPreviewContext>
                                                  </SelectionContext>
                                                </CurrentTimeContext>
                                              </ActiveAnnotationContext>
                                            </IsPlayingContext>
                                          </AnnotationsContext>
                                        </AnnotationOptionsContext>
                                      </LoopContext>
                                    </SelectedRowContext>
                                  </SelectedTrackIdContext>
                                </UndoRedoContext>
                              </PlaylistZoomContext>
                            </PlaylistSettingsContext>
                          </PlaylistViewContext>
                        </EditorControlsContext>
                      </PlaybackControlsContext>
                    </TrimPreviewPeaksContext>
                  </TrimPreviewContext>
                </DragGuardContext>
              </EngineRefsContext>
            </PlaybackRefsContext>
          </ArrangementContext>
        </MediaElementTrackContext>
      </PlaybackRateContext>
    </ThemeProvider>
  );
};
