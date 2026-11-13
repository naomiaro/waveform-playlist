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
import type { MediaElementPlayout, FadeConfig } from '@waveform-playlist/media-element-playout';
import { resolveMediaElementPlayout } from './playout/resolveMediaElementPlayout';
import { type WaveformDataObject } from '@waveform-playlist/core';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import type { AnnotationData } from '@waveform-playlist/core';
import { extractPeaksFromWaveformData } from './waveformDataLoader';
import type WaveformData from 'waveform-data';
import type { PeakData } from '@waveform-playlist/core';
import type { ClipPeaks, TrackClipPeaks } from './WaveformPlaylistContext';
import { useAnimationFrameLoop } from './hooks/useAnimationFrameLoop';
import { followAnnotations } from './providerInternals/followAnnotations';
import {
  useAnnotationState,
  type AnnotationListProp,
} from './providerInternals/useAnnotationState';
import { useFrameCallbacks } from './providerInternals/useFrameCallbacks';
import { centrePlayhead, useScrollFollow } from './providerInternals/useScrollFollow';
import { useMergedTheme } from './providerInternals/useMergedTheme';
import { useTimeFormat } from './hooks/useTimeFormat';
import { useShallowStable } from './hooks/useShallowStable';
import {
  BLOCKED,
  ActiveAnnotationContext,
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
  MEDIA_ELEMENT_TRACK_ID,
  SelectionContext,
  TrackReorderPreviewContext,
  UndoRedoContext,
  type ActiveAnnotationContextValue,
  type CurrentTimeContextValue,
  type IsPlayingContextValue,
  type MediaElementTrackContextValue,
  type PlaybackControlsContextValue,
  type PlaybackRateContextValue,
  type PlaybackRefsContextValue,
  type PlaylistSettingsContextValue,
  type PlaylistViewContextValue,
  type PlaylistZoomContextValue,
  type SelectionContextValue,
} from './contexts/playlistContexts';

// The one row of the view is always drawn as selected. One object, so the
// context value never changes.
const ONLY_ROW_SELECTED = { selectedTrackId: MEDIA_ELEMENT_TRACK_ID };

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

export interface MediaElementPlaylistProviderProps {
  /** Single track configuration with source URL and waveform data */
  track: MediaElementTrackConfig;
  /** Initial samples per pixel (zoom level) */
  samplesPerPixel?: number;
  /** Playback rate (default 1). Not clamped by the provider: the bundled
   *  engine is created at it as given, while `setPlaybackRate` clamps to
   *  0.5–2. The user's `setPlaybackRate` overrides it; a later change of this
   *  prop overrides that, until they choose again. */
  playbackRate?: number;
  /** Whether to preserve pitch when changing playback rate (default: true).
   *  Set to false when using an external pitch processor like SoundTouch. */
  preservesPitch?: boolean;
  /** Enable automatic scroll to keep playhead centered */
  automaticScroll?: boolean;
  /** Theme configuration */
  theme?: Partial<WaveformPlaylistTheme>;
  /**
   * The annotations and the three annotation options (`editable`,
   * `linkEndpoints`, `isContinuousPlay`). The provider follows all four: an
   * option takes a new value of its field, and a setter or checkbox changes
   * it in between.
   */
  annotationList?: AnnotationListProp;
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
  playbackRate: initialPlaybackRate = 1,
  preservesPitch = true,
  automaticScroll = false,
  theme: userThemeProp,
  annotationList,
  audioContext,
  onAnnotationsChange,
  onReady,
  onError,
  createPlayout,
  children,
}) => {
  const mergedTheme = useMergedTheme(userThemeProp);

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
  // The latest instruction wins: the `playbackRate` prop when it changes, or
  // what the user chose with `setPlaybackRate` since. A changed prop becomes
  // the state here, during render (the "derive state from a prop" pattern),
  // so the speed select never shows a speed other than the one playing.
  const [ratePropSeen, setRatePropSeen] = useState(initialPlaybackRate);
  // `Object.is`: a NaN prop (a failed parse in the consumer) must compare
  // equal to itself, or this would set state on every render.
  if (!Object.is(ratePropSeen, initialPlaybackRate)) {
    setRatePropSeen(initialPlaybackRate);
    setPlaybackRateState(initialPlaybackRate);
  }
  // The same speed for a player that arrives later (see the init effect).
  // Written by `setPlaybackRate`, and by the layout effect below for a prop
  // VALUE it has not applied yet. Not on every run: the effect also runs
  // again with the same prop (a StrictMode remount, a revealed `<Activity>`),
  // and it runs after a child's layout effect of the same commit; none of
  // those is a new instruction, and each would put the prop's speed back
  // over one that was chosen since. A layout effect, for two reasons: a
  // render React discards leaves nothing here that never committed, and it
  // runs before any child's passive effect of the same commit, so a child
  // that sets a speed in answer to a prop change (restoring a saved one) is
  // the later instruction and wins.
  const playbackRateRef = useRef(initialPlaybackRate);
  const ratePropAppliedRef = useRef(initialPlaybackRate);
  useLayoutEffect(() => {
    if (Object.is(ratePropAppliedRef.current, initialPlaybackRate)) return;
    ratePropAppliedRef.current = initialPlaybackRate;
    playbackRateRef.current = initialPlaybackRate;
  }, [initialPlaybackRate]);
  // Annotations are derived from the prop (single source of truth in the
  // parent). Shared with the WebAudio provider (#769).
  const {
    annotationsRef,
    annotationLookup,
    setAnnotations,
    annotationPreview,
    activeAnnotationId,
    activeAnnotationIdRef,
    setActiveAnnotationId,
    continuousPlayRef,
    setContinuousPlay,
    setAnnotationsEditable,
    setLinkEndpoints,
    annotationsValue,
    annotationOptionsValue,
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
  // The playhead, the progress overlay and `AudioPosition` register here; the
  // one loop below draws them.
  const { registerFrameCallback, unregisterFrameCallback, runFrameCallbacks } = useFrameCallbacks();

  // The time selection. Setting it moves the cursor to its start, and Play
  // plays it (see `setSelection` and `play` below), as under the WebAudio
  // provider (#688).
  const [selection, setSelectionState] = useState<SelectionContextValue>({
    selectionStart: 0,
    selectionEnd: 0,
  });
  const selectionRef = useRef(selection);

  const [samplesPerPixel] = useState(initialSamplesPerPixel);
  const { timeFormat, setTimeFormat } = useTimeFormat();

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
  // Where a queued play ends is `playbackEndTimeRef`, as for a running one.
  // A play asked for while there is no player (the first one is loading, or
  // one is being replaced). Started by the init effect when the player
  // arrives; cleared by Stop, Pause, new audio and a failed init.
  const pendingPlayRef = useRef<{ position: number } | null>(null);
  // False only after an init failed: otherwise there is a player, or one on
  // its way, for a play to start on or wait for. It starts true: a child's
  // mount effect runs before this provider's init effect, and a `play()`
  // there must be queued like any other. The init's cleanup sets it true
  // again for the same reason (cleanups run before any effect of the commit).
  const playoutInFlightRef = useRef(true);

  // Get sample rate from waveform data
  const sampleRate = track.waveformData.sample_rate;
  // The length of the audio is known from the waveform data: it does not wait
  // for the player (#688). "The player can be used" is `isReady`.
  const duration = track.waveformData.duration;

  // Peaks are derived during render, so the waveform is drawn on first paint.
  const trackName = track.name;
  const trackWaveformData = track.waveformData;
  // The peaks alone first: a new name or new fades must not extract them again.
  const trackPeaks = useMemo<{ peaks: PeakData; durationSamples: number } | null>(() => {
    try {
      const durationSamples = Math.ceil(trackWaveformData.duration * sampleRate);
      const extractedPeaks = extractPeaksFromWaveformData(
        trackWaveformData as WaveformData,
        samplesPerPixel,
        0, // channel index
        0, // offset
        durationSamples
      );
      return {
        peaks: {
          length: extractedPeaks.length,
          data: [extractedPeaks.data],
          bits: extractedPeaks.bits,
        } as PeakData,
        durationSamples,
      };
    } catch (err) {
      console.warn(
        '[waveform-playlist] Failed to extract peaks from waveform data: ' + String(err)
      );
      return null;
    }
  }, [trackWaveformData, samplesPerPixel, sampleRate]);

  // The one clip of the one track. It carries the track's fades, so the view
  // draws them as it draws any clip's (#685).
  // Compared by value: a fade written inline (`fadeIn: { duration: 1 }` in a
  // `track` that is not memoized) is a new object on every render of the
  // parent, and must neither build a new clip nor a new player (below).
  const trackFadeIn = useShallowStable(track.fadeIn);
  const trackFadeOut = useShallowStable(track.fadeOut);
  const peaksDataArray = useMemo<TrackClipPeaks[]>(() => {
    if (!trackPeaks) return [];
    const clipPeaks: ClipPeaks = {
      clipId: 'media-element-clip',
      trackName: trackName ?? 'Track',
      peaks: trackPeaks.peaks,
      startSample: 0,
      durationSamples: trackPeaks.durationSamples,
      fadeIn: trackFadeIn,
      fadeOut: trackFadeOut,
    };
    return [[clipPeaks]];
  }, [trackPeaks, trackName, trackFadeIn, trackFadeOut]);

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
      // Where playback came to rest is where the next one starts from: a Stop
      // pressed while stopped must not move the cursor (to the start of a
      // range that has played out, say). A pause is not a rest.
      playStartPositionRef.current = cursor;
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
        // The URL is left out of the message on purpose: it may carry a
        // token, and consumers show `error.message` in their UI.
        playout.on('error', (mediaError) => {
          if (cancelled) return;
          const detail = mediaError
            ? ' (code ' +
              mediaError.code +
              (mediaError.message ? ': ' + mediaError.message : '') +
              ')'
            : '';
          const error = new Error('Media failed to load' + detail);
          console.warn('[waveform-playlist] ' + error.message);
          // Nothing is audible any more: do not go on showing "playing".
          if (isPlayingRef.current) restAt(currentTimeRef.current);
          onError?.(error);
        });
        // The browser refused to start playback (no user gesture, most often
        // for a play that was queued and started here, outside the click).
        playout.on('playrejected', () => {
          if (cancelled) return;
          if (isPlayingRef.current) restAt(currentTimeRef.current);
        });

        playout.addTrack({
          source: track.source,
          peaks: track.waveformData,
          name: track.name,
          audioContext,
          fadeIn: trackFadeIn,
          fadeOut: trackFadeOut,
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
          // The element's `ended` also arrives after the loop or `timeupdate`
          // has already ended a range that reaches the end of the audio;
          // that rest stands.
          if (cancelled || !isPlayingRef.current) return;
          const boundedEnd = playbackEndTimeRef.current;
          if (boundedEnd !== null && !isSelectionPlayRef.current) {
            restAt(Math.min(boundedEnd, waveformData.duration));
            return;
          }
          restAt(playStartPositionRef.current);
          setActiveAnnotationId(null);
        });

        playoutRef.current = playout;
        // The speed the provider shows (`usePlaybackRate()`, the speed
        // select) is the prop's, or the one chosen since the prop last
        // changed. The bundled engine was created at the prop's speed, as
        // given: it is told only a speed that differs (its setter clamps,
        // its constructor does not, so repeating the prop could change it).
        // A custom `createPlayout` is not given the speed: it is always told.
        const speed = playbackRateRef.current;
        if (createPlayout || !Object.is(speed, initialPlaybackRate)) {
          playout.setPlaybackRate(speed);
        }
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
          // A play that was queued moved the cursor ref to its start; show it.
          setCurrentTime(currentTimeRef.current);
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
      // A player is on its way again, also after an init that failed.
      playoutInFlightRef.current = true;
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
        // That place is also where a Stop leaves the cursor from now on.
        setCurrentTime(currentTimeRef.current);
        // Not while a play is queued: it has set its own play start (the
        // selection's start for a resumed selection), and it is kept.
        if (pendingPlayRef.current === null) {
          playStartPositionRef.current = currentTimeRef.current;
        }
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
    trackFadeIn,
    trackFadeOut,
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
        pendingPlayRef.current = { position: actualStartTime };
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
    if (!playoutRef.current) {
      // The play it cancelled moved the cursor ref to its start; show it.
      setCurrentTime(currentTimeRef.current);
      return;
    }

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
    (requestedStart: number, requestedEnd: number) => {
      // Ordered and inside the audio, whoever asks: the highlight, the cursor
      // and what Play plays must be one range (typed times can be reversed
      // or past the end; the multitrack engine orders its pair too).
      const length = latestAudioRef.current.waveformData.duration;
      const clamp = (time: number) => Math.max(0, Math.min(time, length));
      const start = clamp(Math.min(requestedStart, requestedEnd));
      const end = clamp(Math.max(requestedStart, requestedEnd));
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
    playbackRateRef.current = clampedRate;
    setPlaybackRateState(clampedRate);
    if (playoutRef.current) {
      playoutRef.current.setPlaybackRate(clampedRate);
    }
  }, []);

  // Context values. The shared ones are the same context objects the
  // WebAudio provider renders (#688), each holding fields that change together.
  const isPlayingValue: IsPlayingContextValue = useMemo(() => ({ isPlaying }), [isPlaying]);
  const currentTimeValue: CurrentTimeContextValue = useMemo(() => ({ currentTime }), [currentTime]);
  const activeAnnotationValue: ActiveAnnotationContextValue = useMemo(
    () => ({ activeAnnotationId }),
    [activeAnnotationId]
  );
  const settingsValue: PlaylistSettingsContextValue = useMemo(
    () => ({ timeFormat, isAutomaticScroll }),
    [timeFormat, isAutomaticScroll]
  );

  // Never changes. A media element reports the audible position, so the
  // position to draw is the playback position itself.
  const refsValue: PlaybackRefsContextValue = useMemo(
    () => ({
      currentTimeRef,
      visualTimeRef: currentTimeRef,
      registerFrameCallback,
      unregisterFrameCallback,
    }),
    [registerFrameCallback, unregisterFrameCallback]
  );

  // What a click on an annotation does (#686). An open-ended play: where it
  // ends (the annotation's end, or not at all with continuous play) is the
  // animation loop's job, which follows the option and the annotation as they
  // are at that moment. Never changes.
  const playAnnotation = useCallback(
    (annotation: AnnotationData) => {
      setActiveAnnotationId(annotation.id);
      play(annotation.start).catch((err) => {
        console.warn(
          '[waveform-playlist] Failed to start playback for annotation ' +
            annotation.id +
            ': ' +
            String(err)
        );
      });
    },
    [play, setActiveAnnotationId]
  );

  // Never changes.
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
      setAnnotations,
      annotationPreview,
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
      setAnnotations,
      annotationPreview,
      setActiveAnnotationId,
      playAnnotation,
    ]
  );

  // A single track at a fixed zoom level: the two provider modes and both
  // zoom directions are always off.
  const viewValue: PlaylistViewContextValue = useMemo(
    () => ({ sampleRate, mono: false, indefinitePlayback: false }),
    [sampleRate]
  );
  const zoomValue: PlaylistZoomContextValue = useMemo(
    () => ({ samplesPerPixel, canZoomIn: false, canZoomOut: false }),
    [samplesPerPixel]
  );

  const playbackRateValue: PlaybackRateContextValue = useMemo(
    () => ({ playbackRate, setPlaybackRate }),
    [playbackRate, setPlaybackRate]
  );

  const trackValue: MediaElementTrackContextValue = useMemo(
    () => ({
      duration,
      isReady,
      peaksDataArray,
      fadeIn: trackFadeIn,
      fadeOut: trackFadeOut,
      playoutRef,
    }),
    [duration, isReady, peaksDataArray, trackFadeIn, trackFadeOut]
  );

  // The nine contexts only the WebAudio provider serves are blocked, so that
  // inside this provider `useLoop()` (say) throws instead of reading a
  // WebAudio provider further out. Outermost: what changes least.
  return (
    <ThemeProvider theme={mergedTheme}>
      <EditorControlsContext value={BLOCKED}>
        <EngineRefsContext value={BLOCKED}>
          <AnnotationOptionsContext value={annotationOptionsValue}>
            <LoopContext value={BLOCKED}>
              <SelectedTrackIdContext value={BLOCKED}>
                <UndoRedoContext value={BLOCKED}>
                  <PlaylistTimelineContext value={BLOCKED}>
                    <PlaylistMixerContext value={BLOCKED}>
                      <TrackReorderPreviewContext value={BLOCKED}>
                        <PlaybackRefsContext value={refsValue}>
                          <PlaybackControlsContext value={controlsValue}>
                            <PlaylistViewContext value={viewValue}>
                              <PlaylistZoomContext value={zoomValue}>
                                <PlaylistSettingsContext value={settingsValue}>
                                  <MediaElementTrackContext value={trackValue}>
                                    <PlaybackRateContext value={playbackRateValue}>
                                      <AnnotationsContext value={annotationsValue}>
                                        <IsPlayingContext value={isPlayingValue}>
                                          <ActiveAnnotationContext value={activeAnnotationValue}>
                                            <CurrentTimeContext value={currentTimeValue}>
                                              <SelectionContext value={selection}>
                                                <SelectedRowContext value={ONLY_ROW_SELECTED}>
                                                  {children}
                                                </SelectedRowContext>
                                              </SelectionContext>
                                            </CurrentTimeContext>
                                          </ActiveAnnotationContext>
                                        </IsPlayingContext>
                                      </AnnotationsContext>
                                    </PlaybackRateContext>
                                  </MediaElementTrackContext>
                                </PlaylistSettingsContext>
                              </PlaylistZoomContext>
                            </PlaylistViewContext>
                          </PlaybackControlsContext>
                        </PlaybackRefsContext>
                      </TrackReorderPreviewContext>
                    </PlaylistMixerContext>
                  </PlaylistTimelineContext>
                </UndoRedoContext>
              </SelectedTrackIdContext>
            </LoopContext>
          </AnnotationOptionsContext>
        </EngineRefsContext>
      </EditorControlsContext>
    </ThemeProvider>
  );
};
