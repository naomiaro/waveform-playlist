/**
 * The context objects, their value types and their hooks (#688).
 *
 * Both providers render the SAME context objects for the part they share, so
 * a control written against `useIsPlaying()` or `usePlaybackControls()` works
 * under either. What only one provider has is on its own context, and the
 * other provider blocks it (see `BLOCKED`), so that a hook never reaches
 * through one provider to an outer one of the other kind.
 *
 * This file imports no provider and no engine: a MediaElement-only bundle
 * must not pull in the WebAudio provider through it.
 */
import { createContext, useContext } from 'react';
import type { ClipTrack, AnnotationData } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import type { MediaElementPlayout, FadeConfig } from '@waveform-playlist/media-element-playout';
import type { TimeFormat } from '@waveform-playlist/ui-components';
import type { AnnotationPreviewHandle } from '../hooks/useAnnotationDragHandlers';
import type { FrameData } from '../providerInternals/useFrameCallbacks';
import type { TrackDragPreview } from '../utils/trackOrderPreview';
import type { TrackClipPeaks, TrackState } from '../WaveformPlaylistContext';

export type { FrameData };

const WEB_AUDIO = 'WaveformPlaylistProvider';
const MEDIA_ELEMENT = 'MediaElementPlaylistProvider';

/** The id of the one track of a MediaElement player (its row and its clip carry it). */
export const MEDIA_ELEMENT_TRACK_ID = 'media-element-track-0';

/**
 * What a provider puts in a context it does not serve. The hook then throws
 * and names the provider that is needed, instead of reading an outer provider
 * of the other kind.
 */
export const BLOCKED = Symbol('waveform-playlist.blocked-context');
type Blocked = typeof BLOCKED;
type Slot<T> = T | Blocked | null;

// ---------------------------------------------------------------------------
// Shared: rendered by both providers
// ---------------------------------------------------------------------------

/**
 * Whether playback is running. Its own context (#768): it is the only value of
 * the playback state that changes on play, pause and stop, and a component
 * that needs a ref or a frame callback (`usePlaybackRefs`) must not re-render
 * with it.
 */
export interface IsPlayingContextValue {
  isPlaying: boolean;
}

/**
 * Refs and functions that keep their identity for the life of the provider
 * (#768). Reading this never causes a re-render: read a ref's `.current` in an
 * event handler, an effect or a frame callback, not during render.
 */
export interface PlaybackRefsContextValue {
  /** The playback position, in seconds. Advances during playback. */
  currentTimeRef: React.RefObject<number>;
  /**
   * The position to DRAW. Under the WebAudio provider it is the audible
   * position (the raw time less output latency and lookahead while playing);
   * under the MediaElement provider it is `currentTimeRef` itself, because a
   * media element reports the audible position.
   */
  visualTimeRef: React.RefObject<number>;
  /** Register a per-frame callback driven by the provider's one animation loop. */
  registerFrameCallback: (id: string, cb: (data: FrameData) => void) => void;
  /** Unregister a per-frame callback. */
  unregisterFrameCallback: (id: string) => void;
}

/**
 * The selected time range, in seconds. Apart from the state context because it
 * is the only state that changes on every pointer move of a selection drag
 * (#733). `selectionStart === selectionEnd` means nothing is selected.
 */
export interface SelectionContextValue {
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Where the cursor rests, in seconds: the position playback starts from. It
 * changes on a seek, a pause, a stop (including playback reaching the end) and
 * a selection whose start moves; it does NOT advance during playback (read
 * `currentTimeRef`, or register a frame callback, for that). Apart from the
 * other values so that a component reading `isPlaying` or a ref is not
 * re-rendered by every seek, nor by every pointer move of a leftward selection
 * drag (#740).
 */
export interface CurrentTimeContextValue {
  currentTime: number;
}

/**
 * The annotation that is playing or was last chosen. Its own context because
 * it changes at every annotation boundary during playback (#740).
 */
export interface ActiveAnnotationContextValue {
  activeAnnotationId: string | null;
}

/**
 * The annotations and whether playback runs on past the end of one. Changes
 * on an annotation edit and on the continuous-play toggle; an edge drag that
 * uses the preview source changes it once, on release.
 */
export interface AnnotationsContextValue {
  annotations: AnnotationData[];
  continuousPlay: boolean;
}

/**
 * The actions both providers have (#688). The value never changes, so reading
 * it never re-renders.
 */
export interface PlaybackControlsContextValue {
  /**
   * Starts playback at `startTime` (default: the cursor). With `playDuration`
   * it stops by itself after that many seconds of audio.
   */
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  /** Ends playback and returns the cursor to where playback started. */
  stop: () => void;
  /** Moves the cursor, clamped to the audio. During playback, playback restarts there. */
  seekTo: (time: number) => void;
  /** Sets the selected range and moves the cursor to its start. During playback, playback
   *  restarts: a range is played start to end (open-ended under WaveformPlaylistProvider with
   *  looping on), a collapsed one carries on from there. */
  setSelection: (start: number, end: number) => void;

  setTimeFormat: (format: TimeFormat) => void;

  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;

  setContinuousPlay: (enabled: boolean) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  /**
   * Where an annotation edge drag shows its moves while it is in progress.
   * Pass it to `useAnnotationDragHandlers({ preview })`; read it in a custom
   * annotation renderer with `useAnnotationsWithPreview`. Stable identity.
   */
  annotationPreview: AnnotationPreviewHandle;
  setActiveAnnotationId: (id: string | null) => void;
}

/**
 * View configuration (#768): what the provider was configured with. Changes
 * on a prop change (and once when the real sample rate is known), never
 * during an interaction.
 */
export interface PlaylistViewContextValue {
  sampleRate: number;
  waveHeight: number;
  barWidth: number;
  barGap: number;
  /** Draw bars with pill-shaped rounded caps (radius barWidth/2). */
  roundedBars: boolean;
  /** Width in pixels of progress bars. Defaults to barWidth + barGap (fills gaps). */
  progressBarWidth: number;
  /** Whether tracks are rendered in mono mode. Always false under the MediaElement provider. */
  mono: boolean;
  /** Whether playback continues past the end of loaded audio instead of
   *  auto-stopping (implies the fillViewport layout). Always false under the
   *  MediaElement provider. */
  indefinitePlayback: boolean;
  /** Whether the timeline visually fills the scroll container even when the
   *  audio is shorter (layout only). Always false under the MediaElement provider. */
  fillViewport: boolean;
}

/**
 * The two settings a user toggles (#768). Apart from the view value because
 * every clip overlay and the visualization shell read that one: a toggle here
 * renders only the components that show the setting.
 */
export interface PlaylistSettingsContextValue {
  timeFormat: TimeFormat;
  isAutomaticScroll: boolean;
}

/**
 * The zoom level (#768). Changes on a zoom. Under the MediaElement provider
 * the level is fixed: `canZoomIn` and `canZoomOut` are always false.
 */
export interface PlaylistZoomContextValue {
  samplesPerPixel: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

// ---------------------------------------------------------------------------
// WaveformPlaylistProvider only
// ---------------------------------------------------------------------------

/**
 * The actions only the multitrack editor has (#688). The value never changes.
 */
export interface EditorControlsContextValue {
  /**
   * Moves the cursor without touching playback. `seekTo` is the one to use
   * from a control; this is for the view's own press and drag handling.
   */
  setCurrentTime: (time: number) => void;

  // Track controls
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;

  /** Move a track to a new index in the vertical track order. Purely
   *  organizational — playback is not interrupted. The reordered tracks
   *  array flows back through onTracksChange. */
  reorderTrack: (trackId: string, toIndex: number) => void;

  /** Internal: call after every track-reorder DRAG interaction ends
   *  (committed or canceled) to force the view's track-controls part to remount
   *  its slots, discarding any @dnd-kit sortable-plugin DOM
   *  corruption. Not needed for button-driven reorderTrack calls (they never
   *  touch dnd-kit's DOM). See bumpTrackReorderEpoch in the provider. */
  bumpTrackReorderEpoch: () => void;

  /** INTERNAL wiring for ClipInteractionProvider: publishes/clears the live
   *  track-reorder drag preview. Custom drag integrations may call it, but
   *  most consumers only ever READ trackDragPreview from useTrackReorderPreview(). */
  setTrackDragPreview: React.Dispatch<React.SetStateAction<TrackDragPreview | null>>;

  setSelectedTrackId: (trackId: string | null) => void;

  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;

  // Master volume
  setMasterVolume: (volume: number) => void;

  // Annotation editing
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;

  // Loop controls
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;

  // Recording
  /** Mark a recording session active/inactive. While active: (1) the
   *  end-of-audio auto-stop is suppressed so overdub playback runs past the
   *  end of existing material, and (2) with an `armedTrackId`, that track's
   *  existing content is transiently muted — punch-in recording replaces
   *  whatever the take overlaps (#579), so the doomed material must not play
   *  under the overdub; its previous mute state is restored when the session
   *  ends (audio-only, the UI mute control is untouched). Wired automatically
   *  from the Waveform / PlaylistVisualization `recordingState` prop; overdub
   *  flows should also call it eagerly (before `play()`). */
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
}

/**
 * Refs and functions of the multitrack engine (#688). Like
 * `usePlaybackRefs()`, the value never changes.
 */
export interface EngineRefsContextValue {
  // Refs for direct time calculation in animated components (avoids timing drift)
  playbackStartTimeRef: React.RefObject<number>; // context.currentTime when playback started
  audioStartPositionRef: React.RefObject<number>; // Audio position when playback started
  /** Returns raw playback time from engine (auto-wraps at loop boundaries). */
  getPlaybackTime: () => number;
  /** Current time of the adapter's AudioContext, in seconds. */
  getAudioContextTime: () => number;
  /**
   * Returns the current adapter scheduler lookahead (Tone ~0.1s, native 0).
   * Use this for any audible-latency calculation that must match the playhead
   * (e.g., recording live-preview peak slicing).
   */
  getLookAhead: () => number;
  /**
   * Returns the adapter AudioContext's output latency in seconds.
   * Use this for audible-latency calculations (e.g., recording live-preview peak slicing).
   */
  getOutputLatency: () => number;
  /** The engine. `current` is null until the first build and during a rebuild. */
  playoutRef: React.RefObject<PlaylistEngine | null>;
  /** Ref set by useClipDragHandlers during boundary trim drags.
   *  When true, loadAudio skips engine rebuild — visual updates flow via React state only. */
  isDraggingRef: React.MutableRefObject<boolean>;
}

/** Whether annotations can be edited, and how their edges behave (#688). */
export interface AnnotationEditingContextValue {
  annotationsEditable: boolean;
  linkEndpoints: boolean;
}

/** Loop region (separate from selection), Audacity-style loop points (#768). */
export interface LoopContextValue {
  isLoopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}

/** The track selected for editing operations (#768). */
export interface SelectedTrackIdContextValue {
  selectedTrackId: string | null;
}

/** Whether undo and redo are available (#768). Changes after an edit. */
export interface UndoRedoContextValue {
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * What is on the timeline (#768). Changes on every clip operation, on every
 * pointer move of a trim and on a zoom (the peaks are computed per zoom
 * level), so call `usePlaylistTimeline()` only in a component
 * that draws tracks or needs the timeline length during render.
 */
export interface PlaylistTimelineContextValue {
  tracks: ClipTrack[]; // Original tracks array with IDs
  peaksDataArray: TrackClipPeaks[]; // Array of tracks, each containing array of clip peaks
  duration: number;
  /** Whether the playlist has finished loading all tracks */
  isReady: boolean;
  onTracksChange: ((tracks: ClipTrack[]) => void) | undefined;
}

/** Mixer state (#768). Changes on every mute, solo, volume or pan change. */
export interface PlaylistMixerContextValue {
  trackStates: TrackState[];
  masterVolume: number;
}

/** The live track-reorder drag (#768). Changes on every drag-over. */
export interface TrackReorderPreviewContextValue {
  /** Non-null while a track-reorder drag is live: the dragged track and the
   *  index it would drop at. Both playlist columns derive their display
   *  layout from it; custom renderTrackControls consumers can read it to
   *  mirror the preview in their own UI. */
  trackDragPreview: TrackDragPreview | null;
  /** Internal: incremented after every track-reorder drag interaction ends.
   *  The view's track-controls part folds this into each slot's `key` to
   *  force a remount, working around @dnd-kit sortable-plugin DOM corruption
   *  (see bumpTrackReorderEpoch in EditorControlsContextValue). */
  trackReorderEpoch: number;
}

// ---------------------------------------------------------------------------
// MediaElementPlaylistProvider only
// ---------------------------------------------------------------------------

/** The playback speed and its setter (#688). Changes when the speed does. */
export interface PlaybackRateContextValue {
  /** 0.5 to 2. */
  playbackRate: number;
  /** Clamped to 0.5–2. Stable identity. */
  setPlaybackRate: (rate: number) => void;
}

/**
 * The one track of a MediaElement player (#688). Changes when the track or the
 * zoom level does, and when the player becomes ready.
 */
export interface MediaElementTrackContextValue {
  /** The length of the track's audio, from its waveform data. Never 0 for a real track. */
  duration: number;
  /**
   * True once the media element has loaded its metadata, false again while a
   * replaced player loads. Use this, not `duration`, as "the player can be used".
   */
  isReady: boolean;
  /** One track with one clip (`[]` when the peak data could not be read). The clip carries the track's fadeIn / fadeOut. */
  peaksDataArray: TrackClipPeaks[];
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
  /** The player. `current` is null until it has been created. */
  playoutRef: React.RefObject<MediaElementPlayout | null>;
}

// ---------------------------------------------------------------------------
// The contexts. Each holds fields that change together (#733, #740, #768).
// ---------------------------------------------------------------------------

const slot = <T>() => createContext<Slot<T>>(null);

// Shared
export const IsPlayingContext = slot<IsPlayingContextValue>();
export const PlaybackRefsContext = slot<PlaybackRefsContextValue>();
export const SelectionContext = slot<SelectionContextValue>();
export const CurrentTimeContext = slot<CurrentTimeContextValue>();
export const ActiveAnnotationContext = slot<ActiveAnnotationContextValue>();
export const AnnotationsContext = slot<AnnotationsContextValue>();
export const PlaybackControlsContext = slot<PlaybackControlsContextValue>();
export const PlaylistViewContext = slot<PlaylistViewContextValue>();
export const PlaylistSettingsContext = slot<PlaylistSettingsContextValue>();
export const PlaylistZoomContext = slot<PlaylistZoomContextValue>();
/**
 * INTERNAL (the context and its hook are not exported from the package): which
 * row the view draws as selected. Both providers serve it, so the tracks part
 * of the view needs no provider-specific hook: the multitrack provider gives
 * the value of `useSelectedTrackId()` (the same object), the MediaElement
 * provider its one track, always.
 */
export const SelectedRowContext = slot<SelectedTrackIdContextValue>();

// WaveformPlaylistProvider only
export const EditorControlsContext = slot<EditorControlsContextValue>();
export const EngineRefsContext = slot<EngineRefsContextValue>();
export const AnnotationEditingContext = slot<AnnotationEditingContextValue>();
export const LoopContext = slot<LoopContextValue>();
export const SelectedTrackIdContext = slot<SelectedTrackIdContextValue>();
export const UndoRedoContext = slot<UndoRedoContextValue>();
export const PlaylistTimelineContext = slot<PlaylistTimelineContextValue>();
export const PlaylistMixerContext = slot<PlaylistMixerContextValue>();
export const TrackReorderPreviewContext = slot<TrackReorderPreviewContextValue>();

// MediaElementPlaylistProvider only
export const PlaybackRateContext = slot<PlaybackRateContextValue>();
export const MediaElementTrackContext = slot<MediaElementTrackContextValue>();

// ---------------------------------------------------------------------------
// One hook per context. A component re-renders only when the value of a
// context it reads changes, so read the smallest group that has the field.
// ---------------------------------------------------------------------------

function useSlot<T>(context: React.Context<Slot<T>>, hookName: string, needs: string): T {
  const value = useContext(context);
  if (value === BLOCKED) {
    const nearest = needs === WEB_AUDIO ? MEDIA_ELEMENT : WEB_AUDIO;
    throw new Error(
      `${hookName} needs ${needs}, and the nearest playlist provider here is ${nearest}, ` +
        'which does not provide it'
    );
  }
  if (!value) {
    throw new Error(`${hookName} must be used within ${needs}`);
  }
  return value;
}

const EITHER = `${WEB_AUDIO} or ${MEDIA_ELEMENT}`;

/** `{ isPlaying }`. Re-renders on play, pause and stop. */
export const useIsPlaying = () => useSlot(IsPlayingContext, 'useIsPlaying', EITHER);

/**
 * Refs and functions that never change identity: `currentTimeRef`,
 * `visualTimeRef`, `registerFrameCallback`, `unregisterFrameCallback`. Calling
 * this never re-renders the component. Read `.current` in a handler, an effect
 * or a frame callback; to re-render when the value behind a ref changes, also
 * call the hook that carries it (`useCurrentTime()`, `useIsPlaying()`).
 */
export const usePlaybackRefs = () => useSlot(PlaybackRefsContext, 'usePlaybackRefs', EITHER);

/**
 * The selected time range. A component that calls this re-renders on every
 * pointer move of a selection drag, so call it in the smallest component that
 * shows the selection.
 */
export const useSelection = () => useSlot(SelectionContext, 'useSelection', EITHER);

/**
 * Where the cursor rests, in seconds. A component that calls this re-renders
 * on every seek, pause and stop, and on every pointer move of a selection drag
 * to the left. The value does not advance during playback: for a live position
 * read `currentTimeRef` from `usePlaybackRefs()` or register a frame callback
 * there.
 */
export const useCurrentTime = () => useSlot(CurrentTimeContext, 'useCurrentTime', EITHER);

/**
 * The id of the annotation that is playing or was last chosen, or `null`. A
 * component that calls this re-renders at every annotation boundary during
 * playback, so call it in the smallest component that shows the active one.
 */
export const useActiveAnnotation = () =>
  useSlot(ActiveAnnotationContext, 'useActiveAnnotation', EITHER);

/** `{ annotations, continuousPlay }`. Re-renders on an annotation edit and on the toggle. */
export const useAnnotations = () => useSlot(AnnotationsContext, 'useAnnotations', EITHER);

/**
 * The actions both providers have: `play`, `pause`, `stop`, `seekTo`,
 * `setSelection`, and the annotation, scroll and time-format setters. The
 * value never changes, so calling this never re-renders.
 */
export const usePlaybackControls = () =>
  useSlot(PlaybackControlsContext, 'usePlaybackControls', EITHER);

/**
 * View configuration: `sampleRate`, `waveHeight`, `timeScaleHeight`,
 * `controls`, bar style, `mono`, `indefinitePlayback`, `fillViewport`.
 * Re-renders on a prop change.
 */
export const usePlaylistView = () => useSlot(PlaylistViewContext, 'usePlaylistView', EITHER);

/** `{ timeFormat, isAutomaticScroll }`. Re-renders when the user changes either. */
export const usePlaylistSettings = () =>
  useSlot(PlaylistSettingsContext, 'usePlaylistSettings', EITHER);

/** `{ samplesPerPixel, canZoomIn, canZoomOut }`. Re-renders on a zoom. */
export const usePlaylistZoom = () => useSlot(PlaylistZoomContext, 'usePlaylistZoom', EITHER);

/**
 * The multitrack editor's actions: track mixer and order, zoom, loop, undo,
 * annotation editing settings, recording. WaveformPlaylistProvider only. The
 * value never changes.
 */
export const useEditorControls = () =>
  useSlot(EditorControlsContext, 'useEditorControls', WEB_AUDIO);

/**
 * The multitrack engine's refs and clock functions (`playoutRef`,
 * `getPlaybackTime`, `getLookAhead`, …). WaveformPlaylistProvider only. The
 * value never changes.
 */
export const useEngineRefs = () => useSlot(EngineRefsContext, 'useEngineRefs', WEB_AUDIO);

/** `{ annotationsEditable, linkEndpoints }`. WaveformPlaylistProvider only. */
export const useAnnotationEditing = () =>
  useSlot(AnnotationEditingContext, 'useAnnotationEditing', WEB_AUDIO);

/** `{ isLoopEnabled, loopStart, loopEnd }`. Re-renders on a loop change. */
export const useLoop = () => useSlot(LoopContext, 'useLoop', WEB_AUDIO);

/** `{ selectedTrackId }`. Re-renders when another track is selected. */
export const useSelectedTrackId = () =>
  useSlot(SelectedTrackIdContext, 'useSelectedTrackId', WEB_AUDIO);

/**
 * INTERNAL (not exported from the package): `{ selectedTrackId }` for the row
 * the view draws as selected, under either provider. Consumers use
 * `useSelectedTrackId()`, which only the multitrack provider serves.
 */
export const useSelectedRow = () => useSlot(SelectedRowContext, 'The tracks of the view', EITHER);

/** `{ canUndo, canRedo }`. Re-renders after an edit. */
export const useUndoRedo = () => useSlot(UndoRedoContext, 'useUndoRedo', WEB_AUDIO);

/**
 * `{ tracks, peaksDataArray, duration, isReady, onTracksChange }`. A component
 * that calls this re-renders on every clip operation, on every pointer move of
 * a trim and on a zoom.
 */
export const usePlaylistTimeline = () =>
  useSlot(PlaylistTimelineContext, 'usePlaylistTimeline', WEB_AUDIO);

/**
 * `{ trackStates, masterVolume }`. A component that calls this re-renders on
 * every mute, solo, volume or pan change (each step of a slider drag).
 */
export const usePlaylistMixer = () => useSlot(PlaylistMixerContext, 'usePlaylistMixer', WEB_AUDIO);

/**
 * `{ trackDragPreview, trackReorderEpoch }`. A component that calls this
 * re-renders on every drag-over of a track reorder.
 */
export const useTrackReorderPreview = () =>
  useSlot(TrackReorderPreviewContext, 'useTrackReorderPreview', WEB_AUDIO);

/** `{ playbackRate, setPlaybackRate }`. MediaElementPlaylistProvider only. */
export const usePlaybackRate = () => useSlot(PlaybackRateContext, 'usePlaybackRate', MEDIA_ELEMENT);

/**
 * `{ duration, isReady, peaksDataArray, fadeIn, fadeOut, playoutRef }`: the
 * one track of a MediaElement player. MediaElementPlaylistProvider only.
 */
export const useMediaElementTrack = () =>
  useSlot(MediaElementTrackContext, 'useMediaElementTrack', MEDIA_ELEMENT);

/**
 * INTERNAL (not exported from the package): throws under
 * MediaElementPlaylistProvider, in the name of a hook that reads only shared
 * contexts but is not meant to run there. `usePlaybackShortcuts()` listens on
 * the window; what keys do for the single-track player is not decided yet.
 */
export const useWebAudioProviderOnly = (hookName: string): void => {
  useSlot(EditorControlsContext, hookName, WEB_AUDIO);
};

/**
 * INTERNAL (not exported from the package): the loop state, or `null` where
 * there is none (under the MediaElement provider). For the one hook that
 * starts playback under both providers.
 */
export const useLoopOptional = (): LoopContextValue | null => {
  const value = useContext(LoopContext);
  return value === BLOCKED ? null : value;
};
const orNull = <T>(value: T | typeof BLOCKED | null): T | null =>
  value === BLOCKED ? null : value;

/**
 * INTERNAL (not exported from the package): like {@link usePlaylistView} and
 * {@link usePlaylistZoom} but `null` when there is no provider above. For a
 * hook that may also be called outside one with explicit options.
 */
export const usePlaylistViewOptional = () => orNull(useContext(PlaylistViewContext));
export const usePlaylistZoomOptional = () => orNull(useContext(PlaylistZoomContext));
