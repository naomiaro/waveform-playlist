/**
 * useEngineLifetime
 *
 * The engine of `WaveformPlaylistProvider` around an arrangement (#812). The
 * arrangement owns the tracks, the mix, the undo history and the loading, and
 * outlives every engine: this hook builds an engine on it on mount and when
 * `effects` changes identity or `zoomLevels` changes content (QG), disposes
 * it in every cleanup, and gives the arrangement the context it decodes with.
 * A track edit builds nothing: the engine follows the arrangement (#798).
 *
 * It also owns what a play waiting for an engine needs (#675, the six rules of
 * `notes/playback-and-engine.md`, "Engine Rebuilds vs Playback"):
 * `pendingResumeRef`, `engineBuildInFlightRef` and `engineEpoch`. The
 * provider's `play`, `pause`, `stop` and resume effect read and write them.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  attachDecodeContext,
  PlaylistEngine,
  type Arrangement,
  type EngineState,
  type PlayoutAdapter,
} from '@waveform-playlist/engine';
import type {
  EffectsFunction,
  SoundFontCache,
  TrackEffectsFunction,
} from '@waveform-playlist/playout';
import { resolvePlayoutAdapter } from '../playout/resolvePlayoutAdapter';

/** The rate the provider assumes until its first adapter says otherwise. */
const PROVISIONAL_SAMPLE_RATE = 48000;

/** A play that must start once the engine being built is assigned. */
export interface PendingResume {
  position: number;
  /** Set for duration-limited playback. */
  endTime?: number;
}

export interface UseEngineLifetimeOptions {
  arrangement: Arrangement;
  /** Read when an engine is built; a new identity builds nothing. */
  createAdapter?: () => PlayoutAdapter;
  /** Master effects chain (default Tone.js adapter). A new identity rebuilds. */
  effects?: EffectsFunction;
  /** Read when an engine is built; the adapter keeps it for its whole life. */
  resolveTrackEffects: (trackId: string) => TrackEffectsFunction | undefined;
  soundFontCacheRef: React.RefObject<SoundFontCache | undefined>;
  /** The provider's `sampleRate` prop. Read when an engine is built. */
  sampleRateProp?: number;
  /** Compared by content: an inline array with the same levels builds nothing. */
  zoomLevels?: number[];
  samplesPerPixelRef: React.RefObject<number>;
  /** Where a bounded play stops: carried into the resume of a play a rebuild interrupts. */
  playbackEndTimeRef: React.RefObject<number | null>;
  /** Give a new engine the provider's selection, loop, volume and selected track. */
  seedEngine: (engine: PlaylistEngine) => void;
  /** Subscribe to a new engine (`statechange`, `stop`). */
  onEngine: (engine: PlaylistEngine) => void;
  /**
   * A new engine's first state, once, after `onEngine`: an engine built on
   * an arrangement sends its tracks in its constructor and emits no
   * `statechange`, so this is where `canZoomIn` / `canZoomOut` first arrive.
   */
  onEngineState: (state: EngineState) => void;
  stopAnimationFrameLoop: () => void;
  /** The latest committed `onError` (QG). */
  onErrorRef: React.RefObject<((error: Error) => void) | undefined>;
}

export interface EngineLifetime {
  engineRef: React.RefObject<PlaylistEngine | null>;
  adapterRef: React.RefObject<PlayoutAdapter | null>;
  /** Bumped each time a freshly built engine is assigned. */
  engineEpoch: number;
  /** Ask for another run of what follows `engineEpoch` (a play handed to an engine already assigned). */
  bumpEngineEpoch: () => void;
  /** False from the start of each build until its engine is assigned. */
  isEngineAttached: boolean;
  /** True from the start of a build until its engine is assigned, it fails or it is superseded. */
  engineBuildInFlightRef: React.RefObject<boolean>;
  /** The play waiting for the engine being built (#675). */
  pendingResumeRef: React.RefObject<PendingResume | null>;
  /** Whether the current engine's `init()` has run; false for each new engine. */
  audioInitializedRef: React.RefObject<boolean>;
  /** Dispose the engine, leaving nothing reachable; queue a resume if it was playing. */
  disposeEngineKeepingPlayback: () => void;
  /** The `sampleRate` prop or 48000 until the first adapter exists, then the adapter's. */
  sampleRate: number;
  /** True from mount with the `sampleRate` prop, else from the first adapter on. */
  isSampleRateKnown: boolean;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** What one run of the build effect needs; `latest` is read when the build reaches it. */
interface BuildContext {
  arrangement: Arrangement;
  effects: EffectsFunction | undefined;
  zoomLevels: number[] | undefined;
  latest: React.RefObject<UseEngineLifetimeOptions>;
  engineRef: React.RefObject<PlaylistEngine | null>;
  adapterRef: React.RefObject<PlayoutAdapter | null>;
  engineBuildInFlightRef: React.RefObject<boolean>;
  pendingResumeRef: React.RefObject<PendingResume | null>;
  audioInitializedRef: React.RefObject<boolean>;
  /** Called with a new engine's adapter once the engine is assigned. */
  onAssigned: (adapter: PlayoutAdapter) => void;
  setSampleRate: (rate: number) => void;
  setIsEngineAttached: (attached: boolean) => void;
  bumpEngineEpoch: () => void;
}

interface BuildRun {
  cancelled: boolean;
}

async function buildEngine(ctx: BuildContext, run: BuildRun): Promise<void> {
  let engine: PlaylistEngine | null = null;
  try {
    const options = ctx.latest.current;
    // A new adapter needs its AudioContext resumed on the first play.
    ctx.audioInitializedRef.current = false;
    const adapter = await resolvePlayoutAdapter({
      createAdapter: options.createAdapter,
      effects: ctx.effects,
      trackEffects: options.resolveTrackEffects,
      soundFontCache: options.soundFontCacheRef.current,
      sampleRate: options.sampleRateProp,
    });
    if (run.cancelled) {
      // Superseded: the next run owns engineBuildInFlightRef now.
      adapter.dispose();
      return;
    }
    ctx.setSampleRate(adapter.audioContext.sampleRate);
    ctx.adapterRef.current = adapter;
    engine = new PlaylistEngine({
      adapter,
      arrangement: ctx.arrangement,
      // The provider attaches the decode context itself, once per mount.
      attachDecodeContext: false,
      samplesPerPixel: ctx.latest.current.samplesPerPixelRef.current,
      zoomLevels: ctx.zoomLevels,
    });
    const latest = ctx.latest.current;
    latest.seedEngine(engine);
    latest.onEngine(engine);
    latest.onEngineState(engine.getState());
    ctx.engineRef.current = engine;
    ctx.engineBuildInFlightRef.current = false;
    ctx.onAssigned(adapter);
    ctx.setIsEngineAttached(true);
    // Starts any play queued for this engine (the provider's resume effect).
    ctx.bumpEngineEpoch();
  } catch (error) {
    reportBuildFailure(ctx, run, engine, error);
  }
}

/** A build that failed: nothing it made stays reachable, and no queued play waits for it. */
function reportBuildFailure(
  ctx: BuildContext,
  run: BuildRun,
  engine: PlaylistEngine | null,
  error: unknown
): void {
  if (ctx.engineRef.current === null) {
    // Made but never assigned: the cleanup cannot reach it. Disposing the
    // engine disposes its adapter and lets go of the arrangement.
    const leftover = engine ?? ctx.adapterRef.current;
    try {
      leftover?.dispose();
    } catch (disposeErr) {
      console.warn(
        '[waveform-playlist] adapter dispose after load failure threw: ' + String(disposeErr)
      );
    }
    ctx.adapterRef.current = null;
  }
  const onError = ctx.latest.current.onErrorRef.current;
  if (!run.cancelled) {
    // No engine is coming: a queued play would otherwise wait forever and
    // fire on some later, unrelated rebuild.
    ctx.engineBuildInFlightRef.current = false;
    ctx.pendingResumeRef.current = null;
    // An error, not a warning: the playlist cannot be played until a later
    // build succeeds. A build that was superseded or unmounted says nothing
    // here: the build that replaced it speaks for itself.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      '[waveform-playlist] The playlist could not be built and stays in its loading ' +
        'state (it cannot be played). Reason: ' +
        reason +
        (onError ? '' : ' Pass `onError` to WaveformPlaylistProvider to show this in your app.')
    );
  }
  onError?.(error instanceof Error ? error : new Error(String(error)));
}

/** The provider's rate: the prop or 48000 until an adapter says otherwise (B1b). */
function useKnownSampleRate(sampleRateProp: number | undefined) {
  const [sampleRate, setSampleRateState] = useState(
    () => sampleRateProp ?? PROVISIONAL_SAMPLE_RATE
  );
  const [isSampleRateKnown, setIsSampleRateKnown] = useState(() => sampleRateProp !== undefined);
  const setSampleRate = useCallback((rate: number) => {
    setSampleRateState(rate);
    setIsSampleRateKnown(true);
  }, []);
  return { sampleRate, isSampleRateKnown, setSampleRate };
}

/**
 * The decode context: attached once per mount (and again after an
 * <Activity> reveal), detached in the cleanup, which aborts the loads in
 * flight. The getter gives the current adapter's context; while there is no
 * adapter it waits for the next engine's (`onAssigned`). It never rejects.
 */
function useDecodeContext(
  arrangement: Arrangement,
  adapterRef: React.RefObject<PlayoutAdapter | null>
): (adapter: PlayoutAdapter) => void {
  const arrivalRef = useRef<Deferred<BaseAudioContext> | null>(null);
  const getDecodeContext = useCallback(async (): Promise<BaseAudioContext> => {
    const adapter = adapterRef.current;
    if (adapter) return adapter.audioContext;
    arrivalRef.current ??= deferred<BaseAudioContext>();
    return arrivalRef.current.promise;
  }, [adapterRef]);
  useEffect(
    () => attachDecodeContext(arrangement, getDecodeContext),
    [arrangement, getDecodeContext]
  );
  return useCallback((adapter: PlayoutAdapter) => {
    const arrival = arrivalRef.current;
    arrivalRef.current = null;
    arrival?.resolve(adapter.audioContext);
  }, []);
}

/**
 * Dispose the current engine ahead of a rebuild, leaving nothing reachable
 * through engineRef or adapterRef. If the engine is PLAYING at this moment,
 * queue a resume for its replacement. The engine is asked directly, not
 * React's `isPlaying`, which is only as fresh as the last render (#675).
 */
function useDisposeKeepingPlayback(
  refs: Pick<BuildContext, 'engineRef' | 'adapterRef' | 'pendingResumeRef' | 'latest'>
): () => void {
  const { engineRef, adapterRef, pendingResumeRef, latest } = refs;
  return useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.getState().isPlaying && !pendingResumeRef.current) {
      pendingResumeRef.current = {
        position: engine.getCurrentTime(),
        endTime: latest.current.playbackEndTimeRef.current ?? undefined,
      };
    }
    engine.dispose();
    engineRef.current = null;
    // The adapter went with the engine. Nothing may reach it either: the
    // soundfont sync, the clock and the decode context read it (#811).
    adapterRef.current = null;
  }, [engineRef, adapterRef, pendingResumeRef, latest]);
}

export function useEngineLifetime(options: UseEngineLifetimeOptions): EngineLifetime {
  const { arrangement, effects, zoomLevels, sampleRateProp } = options;
  // Callbacks and build-time inputs, as of the latest committed render.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  // An inline array (zoomLevels={[256, 512]}) is new on every render; only
  // its content is a reason to rebuild.
  const stableZoomLevels = useMemo(
    () => zoomLevels,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomLevels?.join(',')]
  );

  const engineRef = useRef<PlaylistEngine | null>(null);
  const adapterRef = useRef<PlayoutAdapter | null>(null);
  const engineBuildInFlightRef = useRef(false);
  const pendingResumeRef = useRef<PendingResume | null>(null);
  const audioInitializedRef = useRef(false);
  const [engineEpoch, setEngineEpoch] = useState(0);
  const [isEngineAttached, setIsEngineAttached] = useState(false);
  const bumpEngineEpoch = useCallback(() => setEngineEpoch((epoch) => epoch + 1), []);
  const { sampleRate, isSampleRateKnown, setSampleRate } = useKnownSampleRate(sampleRateProp);
  const onAssigned = useDecodeContext(arrangement, adapterRef);
  const disposeEngineKeepingPlayback = useDisposeKeepingPlayback({
    engineRef,
    adapterRef,
    pendingResumeRef,
    latest,
  });

  useEffect(() => {
    const run: BuildRun = { cancelled: false };
    engineBuildInFlightRef.current = true;
    setIsEngineAttached(false);
    const ctx: BuildContext = {
      arrangement,
      effects,
      zoomLevels: stableZoomLevels,
      latest,
      engineRef,
      adapterRef,
      engineBuildInFlightRef,
      pendingResumeRef,
      audioInitializedRef,
      onAssigned,
      setSampleRate,
      setIsEngineAttached,
      bumpEngineEpoch,
    };
    void buildEngine(ctx, run);
    return () => {
      run.cancelled = true;
      engineBuildInFlightRef.current = false;
      latest.current.stopAnimationFrameLoop();
      // Never leave a disposed engine reachable (#675).
      disposeEngineKeepingPlayback();
    };
  }, [
    arrangement,
    effects,
    stableZoomLevels,
    onAssigned,
    setSampleRate,
    bumpEngineEpoch,
    disposeEngineKeepingPlayback,
  ]);

  return {
    engineRef,
    adapterRef,
    engineEpoch,
    bumpEngineEpoch,
    isEngineAttached,
    engineBuildInFlightRef,
    pendingResumeRef,
    audioInitializedRef,
    disposeEngineKeepingPlayback,
    sampleRate,
    isSampleRateKnown,
  };
}
