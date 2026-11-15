/**
 * useArrangementView
 *
 * What `WaveformPlaylistProvider` publishes about an arrangement (#812),
 * DERIVED from it during render and never written back: the loaded tracks,
 * one drawing row per track (the loaded clips' records and the placeholder
 * records of the clips still loading, in the arrangement's clip order), the
 * timeline length, `trackStates` from the arrangement's mixer, and the undo
 * state. The arrangement is the one owner of all of it.
 *
 * Every result keeps its identity while nothing it depends on changed: a
 * fader move changes `trackStates` and nothing else; a clip edit changes
 * `tracks` and the rows of the clips it touched, not `trackStates`.
 */
import { useMemo, useRef, useSyncExternalStore } from 'react';
import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, ClipTrack } from '@waveform-playlist/core';
import type { Arrangement, TrackMixerValues } from '@waveform-playlist/engine';
import type { ClipPeaks, TrackClipPeaks, TrackState } from '../WaveformPlaylistContext';
import { useArrangementTracks } from '../hooks/useArrangementTracks';
import { useWaveformDataCache } from '../hooks/useWaveformDataCache';
import {
  derivePeaks,
  EMPTY_PEAKS_CACHE,
  type DerivePeaksOptions,
  type PeaksCache,
} from '../utils/derivePeaks';
import { EMPTY_LOADED_TRACKS, loadedTracks, type LoadedTracksCache } from '../utils/loadedTracks';
import { placeholderPeaks } from '../utils/placeholderPeaks';
import { sameItems } from '../utils/sameItems';
import { timelineDuration } from '../utils/timelineDuration';

export interface ArrangementViewOptions {
  samplesPerPixel: number;
  mono: boolean;
  /** The finest zoom level: the scale the worker generates peaks at. */
  baseScale: number;
  /**
   * The rate placeholder records are built at, or `null` while the provider
   * does not know its real rate yet: then no placeholder record is built
   * (B1b; the provider passes `isSampleRateKnown ? sampleRate : null`).
   */
  placeholderSampleRate: number | null;
}

export interface ArrangementView {
  /** The arrangement's tracks without their loading clips. Never write to them. */
  tracks: readonly ClipTrack[];
  /** One row per track, in the arrangement's clip order, placeholders included. */
  peaksDataArray: TrackClipPeaks[];
  /** The end, in seconds, of the last placeholder record; 0 when there is none. */
  placeholdersEnd: number;
  /** The end, in seconds, of the loaded audio (placeholders do not count). */
  duration: number;
  /** One entry per track, in order, from the arrangement's mixer. */
  trackStates: TrackState[];
  canUndo: boolean;
  canRedo: boolean;
  /** The last pass of `derivePeaks` (loaded clips): for the trim preview. */
  peaksCacheRef: React.RefObject<PeaksCache>;
  /** What the loaded clips' peaks are derived with: for the trim preview. */
  peaksOptions: DerivePeaksOptions;
}

interface RowsCache {
  readonly byTrackId: ReadonlyMap<string, TrackClipPeaks>;
  readonly result: TrackClipPeaks[];
}

interface StatesCache {
  readonly byTrackId: ReadonlyMap<string, TrackState>;
  readonly result: TrackState[];
}

const EMPTY_ROWS: RowsCache = { byTrackId: new Map(), result: [] };
const EMPTY_STATES: StatesCache = { byTrackId: new Map(), result: [] };
const DEFAULT_MIX: TrackMixerValues = { volume: 1, muted: false, soloed: false, pan: 0 };

interface RowInputs {
  loadedPeaks: PeaksCache;
  samplesPerPixel: number;
  mono: boolean;
  placeholderSampleRate: number | null;
}

/** A track's row: each clip's record by clip id, placeholders where they can be drawn. */
function rowFor(track: ArrangementTrack, index: number, inputs: RowInputs): TrackClipPeaks {
  const loadedRow = inputs.loadedPeaks.result[index];
  if (!track.clips.some(isLoadingClip)) return loadedRow;
  const rate = inputs.placeholderSampleRate;
  const row: ClipPeaks[] = [];
  for (const clip of track.clips) {
    if (!isLoadingClip(clip)) {
      const entry = inputs.loadedPeaks.clips.get(clip.id);
      if (entry) row.push(entry.clipPeaks);
      continue;
    }
    if (rate === null) continue;
    const record = placeholderPeaks(clip, track.name, {
      contextSampleRate: rate,
      samplesPerPixel: inputs.samplesPerPixel,
      mono: inputs.mono,
    });
    if (record) row.push(record);
  }
  return row;
}

function deriveRows(
  tracks: readonly ArrangementTrack[],
  inputs: RowInputs,
  previous: RowsCache
): RowsCache {
  const byTrackId = new Map<string, TrackClipPeaks>();
  const rows = tracks.map((track, index) => {
    const row = rowFor(track, index, inputs);
    const before = previous.byTrackId.get(track.id);
    const stable = sameItems(before, row) ? before : row;
    byTrackId.set(track.id, stable);
    return stable;
  });
  return { byTrackId, result: sameItems(previous.result, rows) ? previous.result : rows };
}

/** The end in seconds of the last placeholder record, 0 when there is none. */
function lastPlaceholderEnd(rows: readonly TrackClipPeaks[]): number {
  let end = 0;
  for (const row of rows) {
    for (const record of row) {
      if (!record.isPlaceholder || !record.sampleRate) continue;
      end = Math.max(end, (record.startSample + record.durationSamples) / record.sampleRate);
    }
  }
  return end;
}

function sameState(a: TrackState, name: string, mix: TrackMixerValues): boolean {
  return (
    a.name === name &&
    a.volume === mix.volume &&
    a.muted === mix.muted &&
    a.soloed === mix.soloed &&
    a.pan === mix.pan
  );
}

function deriveTrackStates(
  tracks: readonly ArrangementTrack[],
  mixer: ReadonlyMap<string, TrackMixerValues>,
  previous: StatesCache
): StatesCache {
  const byTrackId = new Map<string, TrackState>();
  const states = tracks.map((track) => {
    // Every track the arrangement holds has a mixer entry; the default is
    // there so that the array never holds `undefined`.
    const mix = mixer.get(track.id) ?? DEFAULT_MIX;
    const before = previous.byTrackId.get(track.id);
    const state =
      before && sameState(before, track.name, mix)
        ? before
        : {
            name: track.name,
            volume: mix.volume,
            muted: mix.muted,
            soloed: mix.soloed,
            pan: mix.pan,
          };
    byTrackId.set(track.id, state);
    return state;
  });
  return { byTrackId, result: sameItems(previous.result, states) ? previous.result : states };
}

/** A value of the arrangement, read with `useSyncExternalStore` (a primitive or a kept object). */
function useArrangementValue<T>(arrangement: Arrangement, read: (a: Arrangement) => T): T {
  const store = useMemo(
    () => ({
      subscribe: (listener: () => void) => arrangement.subscribe(listener),
      getSnapshot: () => read(arrangement),
    }),
    [arrangement, read]
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

const readMixer = (arrangement: Arrangement) => arrangement.getMixer();
const readCanUndo = (arrangement: Arrangement) => arrangement.canUndo;
const readCanRedo = (arrangement: Arrangement) => arrangement.canRedo;

export function useArrangementView(
  arrangement: Arrangement,
  options: ArrangementViewOptions
): ArrangementView {
  const { samplesPerPixel, mono, baseScale, placeholderSampleRate } = options;
  const arrangementTracks = useArrangementTracks(arrangement);
  const mixer = useArrangementValue(arrangement, readMixer);
  const canUndo = useArrangementValue(arrangement, readCanUndo);
  const canRedo = useArrangementValue(arrangement, readCanRedo);

  // The caches below are projections of the arrangement, kept so that each
  // pass can hand back what did not change; nothing reads them as state.
  const loadedCacheRef = useRef<LoadedTracksCache>(EMPTY_LOADED_TRACKS);
  const tracks = useMemo(() => {
    const next = loadedTracks(arrangementTracks, loadedCacheRef.current);
    loadedCacheRef.current = next.cache;
    return next.tracks;
  }, [arrangementTracks]);

  const { getWaveformData, version } = useWaveformDataCache(tracks, baseScale);
  const peaksOptions = useMemo<DerivePeaksOptions>(
    () => ({ samplesPerPixel, mono, getGeneratedWaveformData: getWaveformData }),
    [samplesPerPixel, mono, getWaveformData]
  );

  const peaksCacheRef = useRef<PeaksCache>(EMPTY_PEAKS_CACHE);
  const loadedPeaks = useMemo(() => {
    const next = derivePeaks(tracks, peaksOptions, peaksCacheRef.current);
    peaksCacheRef.current = next;
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` invalidates the ref-backed lookup
  }, [tracks, peaksOptions, version]);

  const rowsCacheRef = useRef<RowsCache>(EMPTY_ROWS);
  const peaksDataArray = useMemo(() => {
    const inputs = { loadedPeaks, samplesPerPixel, mono, placeholderSampleRate };
    const next = deriveRows(arrangementTracks, inputs, rowsCacheRef.current);
    rowsCacheRef.current = next;
    return next.result;
  }, [arrangementTracks, loadedPeaks, samplesPerPixel, mono, placeholderSampleRate]);

  const placeholdersEnd = useMemo(() => lastPlaceholderEnd(peaksDataArray), [peaksDataArray]);
  const duration = useMemo(() => timelineDuration(tracks), [tracks]);

  const statesCacheRef = useRef<StatesCache>(EMPTY_STATES);
  const trackStates = useMemo(() => {
    const next = deriveTrackStates(arrangementTracks, mixer, statesCacheRef.current);
    statesCacheRef.current = next;
    return next.result;
  }, [arrangementTracks, mixer]);

  return {
    tracks,
    peaksDataArray,
    placeholdersEnd,
    duration,
    trackStates,
    canUndo,
    canRedo,
    peaksCacheRef,
    peaksOptions,
  };
}
