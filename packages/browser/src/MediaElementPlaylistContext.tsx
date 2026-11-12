import React, {
  createContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { ThemeProvider } from 'styled-components';
import type { MediaElementPlayout, FadeConfig } from '@waveform-playlist/media-element-playout';
import { resolveMediaElementPlayout } from './playout/resolveMediaElementPlayout';
import { type WaveformDataObject } from '@waveform-playlist/core';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import type { AnnotationData } from '@waveform-playlist/core';
import type { AnnotationPreviewHandle } from './hooks/useAnnotationDragHandlers';
import { extractPeaksFromWaveformData } from './waveformDataLoader';
import type WaveformData from 'waveform-data';
import type { PeakData } from '@waveform-playlist/core';
import type { ClipPeaks, TrackClipPeaks } from './WaveformPlaylistContext';
import { useAnimationFrameLoop } from './hooks/useAnimationFrameLoop';
import { followAnnotations } from './providerInternals/followAnnotations';
import { useAnnotationState } from './providerInternals/useAnnotationState';
import { useFrameCallbacks } from './providerInternals/useFrameCallbacks';
import { centrePlayhead, useScrollFollow } from './providerInternals/useScrollFollow';
import { useRequiredContext } from './providerInternals/useRequiredContext';
import { useViewDefaults } from './providerInternals/useViewDefaults';
import {
  MediaElementInternalsContext,
  MediaElementSelectionContext,
  type MediaElementInternalsValue,
  type MediaElementSelectionValue,
} from './providerInternals/mediaElementInternalContexts';

// Configuration for a single media element track
export interface MediaElementTrackConfig {
  /** Audio source URL or Blob URL */
  source: string;
  /** Pre-computed waveform data (required for visualization) */
  waveformData: WaveformDataObject;
  /** Track name for display */
  name?: string;
  /** Fade in configuration (requires audioContext on provider) */
  fadeIn?: FadeConfig;
  /** Fade out configuration (requires audioContext on provider) */
  fadeOut?: FadeConfig;
}

// Context values for animation (high-frequency updates)
export interface MediaElementAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: React.RefObject<number>;
}

// Context values for playlist state
export interface MediaElementStateContextValue {
  continuousPlay: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  playbackRate: number;
  isAutomaticScroll: boolean;
}

// Context values for controls
export interface MediaElementControlsContextValue {
  /**
   * Starts playback at `startTime` (default: the cursor). With `playDuration`
   * it stops by itself after that many seconds of audio. Called before the
   * player exists, the play is queued and starts when the player arrives.
   */
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setContinuousPlay: (enabled: boolean) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  /**
   * Where an annotation edge drag shows its moves while it is in progress.
   * The built-in annotation boxes publish to it; read it in a custom
   * annotation renderer with `useAnnotationsWithPreview`. Stable identity.
   */
  annotationPreview: AnnotationPreviewHandle;
  setActiveAnnotationId: (id: string | null) => void;
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// Context values for playlist data
export interface MediaElementDataContextValue {
  /** The length of the track's audio, from its waveform data. Never 0 for a real track. */
  duration: number;
  /**
   * True once the media element has loaded its metadata, false again while a
   * replaced player loads. Use this, not `duration`, as "the player can be used".
   */
  isReady: boolean;
  peaksDataArray: TrackClipPeaks[];
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  samplesPerPixel: number;
  playoutRef: React.RefObject<MediaElementPlayout | null>;
  controls: { show: boolean; width: number };
  barWidth: number;
  barGap: number;
  /** Draw bars with pill-shaped rounded caps (radius barWidth/2). */
  roundedBars: boolean;
  progressBarWidth: number;
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
}

// Create contexts
const MediaElementAnimationContext = createContext<MediaElementAnimationContextValue | null>(null);
const MediaElementStateContext = createContext<MediaElementStateContextValue | null>(null);
const MediaElementControlsContext = createContext<MediaElementControlsContextValue | null>(null);
const MediaElementDataContext = createContext<MediaElementDataContextValue | null>(null);

export interface MediaElementPlaylistProviderProps {
  /** Single track configuration with source URL and waveform data */
  track: MediaElementTrackConfig;
  /** Initial samples per pixel (zoom level) */
  samplesPerPixel?: number;
  /** Height of each waveform track */
  waveHeight?: number;
  /** Show timescale */
  timescale?: boolean;
  /** Initial playback rate (0.5 to 2.0) */
  playbackRate?: number;
  /** Whether to preserve pitch when changing playback rate (default: true).
   *  Set to false when using an external pitch processor like SoundTouch. */
  preservesPitch?: boolean;
  /** Enable automatic scroll to keep playhead centered */
  automaticScroll?: boolean;
  /** Theme configuration */
  theme?: Partial<WaveformPlaylistTheme>;
  /** Track controls configuration */
  controls?: { show: boolean; width: number };
  /** Annotations */
  annotationList?: {
    annotations?: AnnotationData[];
    isContinuousPlay?: boolean;
  };
  /** Width of waveform bars */
  barWidth?: number;
  /** Gap between waveform bars */
  barGap?: number;
  /** Draw bars with pill-shaped rounded caps (radius barWidth/2). Default: false */
  roundedBars?: boolean;
  /** Width of progress bars */
  progressBarWidth?: number;
  /** Callback when annotations are changed (drag, edit, etc.) */
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /**
   * AudioContext for Web Audio routing (fades, effects).
   * When provided, audio routes through Web Audio nodes:
   *   HTMLAudioElement → MediaElementSourceNode → fadeGain → volumeGain → destination
   *
   * Without this, playback uses HTMLAudioElement directly (no fades or effects).
   * Each provider instance should use its own AudioContext or share one —
   * createMediaElementSource() is called once per audio element.
   */
  audioContext?: AudioContext;
  /** Called when the media element has loaded its metadata (it knows its
   *  length and can be played and seeked), once per player. */
  onReady?: () => void;
  /** Called when playout initialization fails (e.g. a missing optional peer,
   *  a throwing `createPlayout`, or an `addTrack` error) and when the media
   *  element reports an error (a source that cannot be loaded or decoded).
   *  The provider already logs the error; use this to surface it in your UI. */
  onError?: (err: Error) => void;
  /** Factory for a custom MediaElement playout. When omitted, the bundled engine
   *  (@waveform-playlist/media-element-playout) is dynamically imported. A
   *  custom playout must implement `on()` and emit `loadedmetadata`: the
   *  provider is not ready until it does. */
  createPlayout?: () => MediaElementPlayout;
  children: ReactNode;
}

/**
 * MediaElementPlaylistProvider
 *
 * A simplified playlist provider for single-track playback using HTMLAudioElement.
 * Key features:
 * - Pitch-preserving playback rate (0.5x - 2.0x)
 * - Pre-computed peaks visualization (no AudioBuffer needed)
 * - Simpler API than full WaveformPlaylistProvider
 *
 * Use this for:
 * - Language learning apps (speed control)
 * - Podcast players
 * - Single-track audio viewers
 *
 * For multi-track editing, use WaveformPlaylistProvider instead.
 */
export const MediaElementPlaylistProvider: React.FC<MediaElementPlaylistProviderProps> = ({
  track,
  samplesPerPixel: initialSamplesPerPixel = 1024,
  waveHeight = 100,
  timescale = false,
  playbackRate: initialPlaybackRate = 1,
  preservesPitch = true,
  automaticScroll = false,
  theme: userThemeProp,
  controls: controlsProp,
  annotationList,
  barWidth = 1,
  barGap = 0,
  roundedBars = false,
  progressBarWidth: progressBarWidthProp,
  audioContext,
  onAnnotationsChange,
  onReady,
  onError,
  createPlayout,
  children,
}) => {
  const { controls, mergedTheme, progressBarWidth, timeScaleHeight } = useViewDefaults({
    controls: controlsProp,
    theme: userThemeProp,
    barWidth,
    barGap,
    progressBarWidth: progressBarWidthProp,
    timescale,
  });

  // State
  const [isPlaying, setIsPlayingState] = useState(false);
  // Read by `seekTo` and `setSelection`, which must know at call time whether
  // playback is running; written together with the state, never by a render.
  const isPlayingRef = useRef(false);
  const setIsPlaying = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlayingState(playing);
  }, []);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(initialPlaybackRate);
  // Annotations are derived from the prop (single source of truth in the
  // parent). Shared with the WebAudio provider (#769).
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
    providerName: 'MediaElementPlaylistProvider',
  });
  const {
    scrollContainerRef,
    setScrollContainer,
    isAutomaticScroll,
    isAutomaticScrollRef,
    setAutomaticScroll,
  } = useScrollFollow(automaticScroll);
  // The playhead and the progress overlay register here; the one loop below
  // draws them. Not in a public context yet (see mediaElementInternalContexts).
  const { registerFrameCallback, unregisterFrameCallback, runFrameCallbacks } = useFrameCallbacks();

  // The time selection. Setting it moves the cursor to its start, and Play
  // plays it (see `setSelection` and `play` below), as under the WebAudio
  // provider (#688).
  const [selection, setSelectionState] = useState<MediaElementSelectionValue>({
    selectionStart: 0,
    selectionEnd: 0,
  });
  const selectionRef = useRef(selection);

  const [samplesPerPixel] = useState(initialSamplesPerPixel);

  // Refs
  const playoutRef = useRef<MediaElementPlayout | null>(null);
  const currentTimeRef = useRef<number>(0);
  const samplesPerPixelRef = useRef<number>(initialSamplesPerPixel);
  const { startAnimationFrameLoop, stopAnimationFrameLoop } = useAnimationFrameLoop();

  // What the play that is running (or queued) is, in the WebAudio provider's
  // terms (#688):
  //  - where Stop, the end of the audio and the end of an annotation return
  //    the cursor (for the selection: its start, even when resumed part-way);
  //  - where a bounded play ends (null: it runs on);
  //  - whether it is the highlighted selection that is playing. Then
  //    continuous play is out of the picture: annotation ends do not stop it.
  const playStartPositionRef = useRef(0);
  const playbackEndTimeRef = useRef<number | null>(null);
  const isSelectionPlayRef = useRef(false);
  // A play asked for while there is no player (the first one is loading, or
  // one is being replaced). Started by the init effect when the player
  // arrives; cleared by Stop, Pause, new audio and a failed init.
  const pendingPlayRef = useRef<{ position: number; endTime?: number } | null>(null);
  // True from the start of an init unless it failed: only then is there a
  // player, or one on its way, for a play to start on or wait for.
  const playoutInFlightRef = useRef(false);

  // Get sample rate from waveform data
  const sampleRate = track.waveformData.sample_rate;
  // The length of the audio is known from the waveform data: it does not wait
  // for the player (#688). "The player can be used" is `isReady`.
  const duration = track.waveformData.duration;

  // Peaks are derived during render, so the waveform is drawn on first paint.
  const trackName = track.name;
  const trackWaveformData = track.waveformData;
  const peaksDataArray = useMemo<TrackClipPeaks[]>(() => {
    try {
      const durationSamples = Math.ceil(trackWaveformData.duration * sampleRate);
      const extractedPeaks = extractPeaksFromWaveformData(
        trackWaveformData as WaveformData,
        samplesPerPixel,
        0, // channel index
        0, // offset
        durationSamples
      );

      const clipPeaks: ClipPeaks = {
        clipId: 'media-element-clip',
        trackName: trackName ?? 'Track',
        peaks: {
          length: extractedPeaks.length,
          data: [extractedPeaks.data],
          bits: extractedPeaks.bits,
        } as PeakData,
        startSample: 0,
        durationSamples,
      };

      return [[clipPeaks]];
    } catch (err) {
      console.warn(
        '[waveform-playlist] Failed to extract peaks from waveform data: ' + String(err)
      );
      return [];
    }
  }, [trackWaveformData, trackName, samplesPerPixel, sampleRate]);

  // The audio of the latest COMMITTED render, read by two things that must not
  // wait for a render or an effect of their own:
  //  - the cleanup below, to tell "new audio" from "the same audio in a new
  //    player" (a new name, fades, the pitch setting, a callback's identity);
  //  - `seekTo`, which clamps to the length of this audio. The `duration`
  //    state cannot serve: it is 0 until the first player is ready and still
  //    the previous file's length while the next one loads (and inside
  //    `onReady`), so a saved position restored for a longer file was cut off
  //    at the old length. Reading a ref also keeps `seekTo`'s identity (#767).
  // Written in a layout effect, not during render: a render React discards
  // (a transition, Suspense) must not leave audio here that never committed.
  // Layout effects run before the passive cleanups of the same commit.
  const latestAudioRef = useRef({ source: track.source, waveformData: track.waveformData });
  useLayoutEffect(() => {
    latestAudioRef.current = { source: track.source, waveformData: track.waveformData };
  }, [track.source, track.waveformData]);

  // Ends playback with the cursor resting at `cursor`. The player is paused
  // and moved there too (not `stop()`, which rewinds the element to 0): its
  // own time must agree with the cursor, because the element reports its
  // position back (`timeupdate` writes `currentTimeRef`).
  const restAt = useCallback(
    (cursor: number) => {
      const playout = playoutRef.current;
      if (playout) {
        playout.pause();
        playout.seekTo(cursor);
      }
      stopAnimationFrameLoop();
      setIsPlaying(false);
      playbackEndTimeRef.current = null;
      currentTimeRef.current = cursor;
      setCurrentTime(cursor);
    },
    [stopAnimationFrameLoop, setIsPlaying]
  );

  // The init effect starts a queued play when its player arrives, long after
  // the render that created the effect: it reads the loop starter from here.
  const startAnimationLoopRef = useRef<() => void>(() => {});
  // Likewise the step that ends playback, for the engine's `timeupdate`.
  const endPlaybackIfDueRef = useRef<(time: number) => boolean>(() => false);

  // Initialize playout and load track
  useEffect(() => {
    let cancelled = false;
    let createdPlayout: MediaElementPlayout | null = null;
    // The audio this run's player is for.
    const source = track.source;
    const waveformData = track.waveformData;
    playoutInFlightRef.current = true;

    (async () => {
      try {
        const playout = await resolveMediaElementPlayout({
          createPlayout,
          playbackRate: initialPlaybackRate,
          preservesPitch,
        });
        if (cancelled) {
          playout.dispose();
          return;
        }
        createdPlayout = playout;

        // Subscribed before the track exists: the engine attaches the
        // listeners when it creates the media element, so neither event can
        // be missed. "Ready" is the element having its metadata (#688), not
        // this object existing; a source that cannot be loaded never is.
        playout.on('loadedmetadata', () => {
          if (cancelled) return;
          setIsReady(true);
          onReady?.();
        });
        playout.on('error', (mediaError) => {
          if (cancelled) return;
          const detail = mediaError
            ? ' (code ' +
              mediaError.code +
              (mediaError.message ? ': ' + mediaError.message : '') +
              ')'
            : '';
          const error = new Error('Media failed to load: ' + source + detail);
          console.warn('[waveform-playlist] ' + error.message);
          onError?.(error);
        });

        playout.addTrack({
          source: track.source,
          peaks: track.waveformData,
          name: track.name,
          audioContext,
          fadeIn: track.fadeIn,
          fadeOut: track.fadeOut,
        });

        // The media element reports its position about four times a second,
        // also while the tab is hidden and animation frames are not running.
        // It keeps the cursor current, and it is the fallback that ends a
        // range or an annotation in a hidden tab (up to a quarter of a second
        // late); in a visible tab the animation loop sees the end first.
        playout.on('timeupdate', (time) => {
          if (cancelled) return;
          currentTimeRef.current = time;
          if (isPlayingRef.current) endPlaybackIfDueRef.current(time);
        });

        // The audio played to its end. The cursor returns to where playback
        // started, as on Stop. A bounded play that is not the selection rests
        // at its own end instead: the loop below does the same when it sees
        // the end first, and which of the two does is a race.
        playout.setOnPlaybackComplete(() => {
          if (cancelled) return;
          const boundedEnd = playbackEndTimeRef.current;
          if (boundedEnd !== null && !isSelectionPlayRef.current) {
            restAt(Math.min(boundedEnd, waveformData.duration));
            return;
          }
          restAt(playStartPositionRef.current);
          setActiveAnnotationId(null);
        });

        playoutRef.current = playout;
        // The cursor may not be at 0: a position kept across a same-audio
        // replacement, or one stored by `seekTo` while there was no player (a
        // restore for this file). Move the new player there now, so its own
        // time agrees with the cursor before Play is pressed (`pause()` reads
        // it, and the media element reports it).
        if (currentTimeRef.current > 0) {
          playout.seekTo(currentTimeRef.current);
        }
        // A play asked for while there was no player starts now. The media
        // element accepts play() before its metadata has loaded.
        const queued = pendingPlayRef.current;
        if (queued) {
          pendingPlayRef.current = null;
          currentTimeRef.current = queued.position;
          playout.play(undefined, queued.position);
          setIsPlaying(true);
          startAnimationLoopRef.current();
        }
      } catch (err) {
        if (!cancelled) {
          // Nothing will arrive for a queued play to wait for.
          playoutInFlightRef.current = false;
          pendingPlayRef.current = null;
        }
        console.warn('[waveform-playlist] MediaElement playout init failed: ' + String(err));
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      cancelled = true;
      stopAnimationFrameLoop();
      // The player that was playing is about to be disposed: playback has
      // stopped, whatever replaces it. Left true, the UI showed "playing"
      // with no audio and no loop, and the playhead and progress overlay
      // (drawn at rest only while not playing) stopped following seeks.
      setIsPlaying(false);
      // Whatever replaces this player has its own metadata to load.
      setIsReady(false);
      const latest = latestAudioRef.current;
      if (latest.source !== source || latest.waveformData !== waveformData) {
        // New audio: the old position and the old active annotation mean
        // nothing in it. Done here, in the cleanup, and not when the next
        // player is set up: React runs every cleanup of a commit before any
        // effect, so an effect of a child that restores a saved position for
        // the new audio (`seekTo`, `setActiveAnnotationId`) runs after this
        // and is kept.
        currentTimeRef.current = 0;
        setCurrentTime(0);
        setActiveAnnotationId(null);
        // A play queued for the old audio, and where a Stop would return to
        // in it, mean nothing either. (A play queued AFTER this cleanup, for
        // the new audio, is kept: the cleanup has already run by then.)
        pendingPlayRef.current = null;
        playStartPositionRef.current = 0;
        isSelectionPlayRef.current = false;
      } else {
        // The same audio (or an unmount): keep the listener's place, and
        // bring the state up to it. During playback only the ref advances.
        setCurrentTime(currentTimeRef.current);
      }
      if (createdPlayout) {
        createdPlayout.dispose();
      }
      playoutRef.current = null;
    };
  }, [
    track.source,
    track.waveformData,
    track.name,
    track.fadeIn,
    track.fadeOut,
    audioContext,
    initialPlaybackRate,
    preservesPitch,
    onReady,
    onError,
    stopAnimationFrameLoop,
    setActiveAnnotationId,
    setIsPlaying,
    restAt,
    createPlayout,
  ]);

  // The step that follows the annotations and ends playback when it is due.
  // Returns true when it ended playback. Run by the animation loop on every
  // frame and by the engine's `timeupdate` (see the init effect), so it must
  // give the same result when it runs twice for one position.
  const endPlaybackIfDue = useCallback(
    (time: number): boolean => {
      const activeAnnotationEnded = followAnnotations({
        annotations: annotationsRef.current,
        lookup: annotationLookup,
        time,
        activeId: activeAnnotationIdRef.current,
        // Playing the selection takes continuous play out of the picture,
        // and on the frame that reaches a bounded play's end the highlight
        // is held (the end check below stops there). As in the WebAudio loop.
        followOnly: continuousPlayRef.current || isSelectionPlayRef.current,
        holdHighlight: playbackEndTimeRef.current !== null && time >= playbackEndTimeRef.current,
        setActiveAnnotationId,
      });
      if (activeAnnotationEnded) {
        // Continuous play off: stop at the end of the active annotation and
        // return the cursor to where playback started.
        restAt(playStartPositionRef.current);
        return true;
      }

      // A bounded play (`play(start, duration)`, the selection) has reached
      // its end. The selection returns the cursor to its start; any other
      // range leaves it at the end.
      const endTime = playbackEndTimeRef.current;
      if (endTime !== null && time >= endTime) {
        restAt(isSelectionPlayRef.current ? playStartPositionRef.current : endTime);
        return true;
      }
      return false;
    },
    [
      annotationsRef,
      annotationLookup,
      activeAnnotationIdRef,
      continuousPlayRef,
      setActiveAnnotationId,
      restAt,
    ]
  );

  // Animation loop
  const startAnimationLoop = useCallback(() => {
    const updateTime = () => {
      const time = playoutRef.current?.getCurrentTime() ?? 0;
      currentTimeRef.current = time;

      // The media element reports the audible position: one time for logic
      // and for drawing.
      runFrameCallbacks({
        time,
        visualTime: time,
        sampleRate,
        samplesPerPixel: samplesPerPixelRef.current,
      });

      if (endPlaybackIfDue(time)) return;

      if (isAutomaticScrollRef.current && scrollContainerRef.current) {
        centrePlayhead(scrollContainerRef.current, time, sampleRate, samplesPerPixelRef.current);
      }

      startAnimationFrameLoop(updateTime);
    };

    startAnimationFrameLoop(updateTime);
  }, [
    sampleRate,
    startAnimationFrameLoop,
    isAutomaticScrollRef,
    scrollContainerRef,
    runFrameCallbacks,
    endPlaybackIfDue,
  ]);
  useLayoutEffect(() => {
    startAnimationLoopRef.current = startAnimationLoop;
    endPlaybackIfDueRef.current = endPlaybackIfDue;
  }, [startAnimationLoop, endPlaybackIfDue]);

  const stopAnimationLoop = stopAnimationFrameLoop;

  // Playback controls. The rules are the WebAudio provider's (#688), so that
  // one Play, Stop or seek control means the same under either provider.
  const play = useCallback(
    async (startTime?: number, playDuration?: number) => {
      const actualStartTime = startTime ?? currentTimeRef.current;
      const endTime = playDuration !== undefined ? actualStartTime + playDuration : undefined;

      const playout = playoutRef.current;
      // No player and none on its way (the init failed): nothing to do.
      if (!playout && !playoutInFlightRef.current) return;

      // Is this the highlighted selection being played? It may start inside
      // the selection (resuming after a pause) but always runs to its end.
      const { selectionStart, selectionEnd } = selectionRef.current;
      isSelectionPlayRef.current =
        endTime !== undefined &&
        selectionEnd > selectionStart &&
        actualStartTime >= selectionStart - 1e-6 &&
        actualStartTime < selectionEnd &&
        Math.abs(endTime - selectionEnd) < 1e-6;
      // Where a Stop (or the play finishing) returns the cursor. For the
      // selection that is its start even when this play resumed part-way in.
      playStartPositionRef.current = isSelectionPlayRef.current ? selectionStart : actualStartTime;
      playbackEndTimeRef.current = endTime ?? null;
      currentTimeRef.current = actualStartTime;

      if (!playout) {
        // The player is loading or being replaced: the init effect starts
        // this when it arrives. `isPlaying` stays false until audio starts.
        pendingPlayRef.current = { position: actualStartTime, endTime };
        return;
      }
      pendingPlayRef.current = null;

      // The engine schedules the track's fades in `play()`, relative to the
      // start position; the end is watched by the loop, not by the engine
      // (its own duration timer does not follow a pause or a rate change).
      playout.play(undefined, actualStartTime);
      setIsPlaying(true);
      startAnimationLoop();
    },
    [startAnimationLoop, setIsPlaying]
  );

  const pause = useCallback(() => {
    // Cancels a play queued for a player that has not arrived.
    pendingPlayRef.current = null;
    if (!playoutRef.current) return;

    playoutRef.current.pause();
    setIsPlaying(false);
    stopAnimationLoop();
    setCurrentTime(playoutRef.current.getCurrentTime());
  }, [stopAnimationLoop, setIsPlaying]);

  const stop = useCallback(() => {
    // Cancels a play queued for a player that has not arrived.
    pendingPlayRef.current = null;
    // Return the cursor to where playback started (Audacity-style), with or
    // without a player.
    restAt(playStartPositionRef.current);
    setActiveAnnotationId(null);
  }, [restAt, setActiveAnnotationId]);

  const seekTo = useCallback((time: number) => {
    const trackDuration = latestAudioRef.current.waveformData.duration;
    const clampedTime = Math.max(0, Math.min(time, trackDuration));
    currentTimeRef.current = clampedTime;
    setCurrentTime(clampedTime);

    // Whatever play was running or queued started somewhere else and may
    // have had an end: from here on this position is where playback began.
    playStartPositionRef.current = clampedTime;
    playbackEndTimeRef.current = null;
    isSelectionPlayRef.current = false;
    const queued = pendingPlayRef.current;
    if (queued) {
      queued.position = clampedTime;
      queued.endTime = undefined;
      return;
    }

    const playout = playoutRef.current;
    if (!playout) return;
    if (isPlayingRef.current) {
      // Restart at the new position instead of moving the element under
      // the running play: the engine schedules fades in `play()`, so a bare
      // seek would land mid-fade at the wrong gain.
      playout.play(undefined, clampedTime);
    } else {
      playout.seekTo(clampedTime);
    }
  }, []);

  // Selection. As under the WebAudio provider: the cursor moves to its start,
  // a range set during playback is played start to end, and a collapsed one
  // (a cursor move) carries on open-ended from there.
  const setSelection = useCallback(
    (start: number, end: number) => {
      const previous = selectionRef.current;
      if (previous.selectionStart !== start || previous.selectionEnd !== end) {
        selectionRef.current = { selectionStart: start, selectionEnd: end };
        setSelectionState(selectionRef.current);
      }
      const cursorMoved = currentTimeRef.current !== start;
      currentTimeRef.current = start;
      setCurrentTime(start);

      const playsRange = end > start;
      const endTime = playsRange ? end : undefined;
      // Whatever bounded play was running or queued is over: its end, its
      // start and its active annotation must not outlive it.
      const replaceBoundedPlay = () => {
        playbackEndTimeRef.current = endTime ?? null;
        isSelectionPlayRef.current = playsRange;
        playStartPositionRef.current = start;
        if (activeAnnotationIdRef.current !== null) setActiveAnnotationId(null);
      };

      const queued = pendingPlayRef.current;
      if (queued) {
        queued.position = start;
        queued.endTime = endTime;
        replaceBoundedPlay();
        return;
      }

      const playout = playoutRef.current;
      if (!isPlayingRef.current) {
        // Nothing is playing: an earlier play no longer says anything about
        // this position.
        playStartPositionRef.current = start;
        // Only when the start moved: a rightward drag keeps its start, and
        // must not seek the media element on every pointer move.
        if (playout && cursorMoved) playout.seekTo(start);
        return;
      }

      if (playout) {
        replaceBoundedPlay();
        playout.play(undefined, start);
      }
    },
    [activeAnnotationIdRef, setActiveAnnotationId]
  );

  const setPlaybackRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    setPlaybackRateState(clampedRate);
    if (playoutRef.current) {
      playoutRef.current.setPlaybackRate(clampedRate);
    }
  }, []);

  // Context values
  const animationValue: MediaElementAnimationContextValue = useMemo(
    () => ({
      isPlaying,
      currentTime,
      currentTimeRef,
    }),
    [isPlaying, currentTime]
  );

  const stateValue: MediaElementStateContextValue = useMemo(
    () => ({
      continuousPlay,
      annotations,
      activeAnnotationId,
      playbackRate,
      isAutomaticScroll,
    }),
    [continuousPlay, annotations, activeAnnotationId, playbackRate, isAutomaticScroll]
  );

  const controlsValue: MediaElementControlsContextValue = useMemo(
    () => ({
      play,
      pause,
      stop,
      seekTo,
      setPlaybackRate,
      setContinuousPlay,
      setAnnotations,
      annotationPreview,
      setActiveAnnotationId,
      setAutomaticScroll,
      setScrollContainer,
      scrollContainerRef,
    }),
    [
      play,
      pause,
      stop,
      seekTo,
      setPlaybackRate,
      setContinuousPlay,
      setAnnotations,
      annotationPreview,
      setActiveAnnotationId,
      setAutomaticScroll,
      setScrollContainer,
      scrollContainerRef,
    ]
  );

  // Internal (not exported from the package): see mediaElementInternalContexts.
  const internalsValue: MediaElementInternalsValue = useMemo(
    () => ({
      registerFrameCallback,
      unregisterFrameCallback,
      visualTimeRef: currentTimeRef,
      setSelection,
    }),
    [registerFrameCallback, unregisterFrameCallback, setSelection]
  );

  const dataValue: MediaElementDataContextValue = useMemo(
    () => ({
      duration,
      isReady,
      peaksDataArray,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      samplesPerPixel,
      playoutRef,
      controls,
      barWidth,
      barGap,
      roundedBars,
      progressBarWidth,
      fadeIn: track.fadeIn,
      fadeOut: track.fadeOut,
    }),
    [
      duration,
      isReady,
      peaksDataArray,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      samplesPerPixel,
      controls,
      barWidth,
      barGap,
      roundedBars,
      progressBarWidth,
      track.fadeIn,
      track.fadeOut,
    ]
  );

  return (
    <ThemeProvider theme={mergedTheme}>
      <MediaElementAnimationContext.Provider value={animationValue}>
        <MediaElementStateContext.Provider value={stateValue}>
          <MediaElementControlsContext.Provider value={controlsValue}>
            <MediaElementDataContext.Provider value={dataValue}>
              <MediaElementInternalsContext.Provider value={internalsValue}>
                <MediaElementSelectionContext.Provider value={selection}>
                  {children}
                </MediaElementSelectionContext.Provider>
              </MediaElementInternalsContext.Provider>
            </MediaElementDataContext.Provider>
          </MediaElementControlsContext.Provider>
        </MediaElementStateContext.Provider>
      </MediaElementAnimationContext.Provider>
    </ThemeProvider>
  );
};

// Hooks
const PROVIDER = 'MediaElementPlaylistProvider';

export const useMediaElementAnimation = () =>
  useRequiredContext(MediaElementAnimationContext, 'useMediaElementAnimation', PROVIDER);

export const useMediaElementState = () =>
  useRequiredContext(MediaElementStateContext, 'useMediaElementState', PROVIDER);

export const useMediaElementControls = () =>
  useRequiredContext(MediaElementControlsContext, 'useMediaElementControls', PROVIDER);

export const useMediaElementData = () =>
  useRequiredContext(MediaElementDataContext, 'useMediaElementData', PROVIDER);
