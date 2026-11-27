/**
 * Hook for integrated multi-track recording: the microphone, the take, and
 * the take added to the arrangement that owns the tracks (#812).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRecordingWithTakeEnded } from './useRecording';
import { useMicrophoneAccess } from './useMicrophoneAccess';
import { useMicrophoneLevel } from './useMicrophoneLevel';
import { takeNotSaved, takeRefusal, withTake } from './takeTarget';
import type { MicrophoneDevice } from '../types';
import {
  type AudioClip,
  type MeterSource,
  type RecordingProgressSource,
  resolveRecordingOffsetSamples,
} from '@waveform-playlist/core';
import type { Arrangement } from '@waveform-playlist/engine';
import {
  resumeGlobalAudioContext,
  getGlobalAudioContext,
  getGlobalContext,
} from '@waveform-playlist/playout';

export interface IntegratedRecordingOptions {
  /**
   * Current playback/cursor position in seconds.
   * Punch-in semantics (#579): the recorded clip lands exactly at this
   * position and REPLACES any existing clip content it overlaps — partial
   * overlaps are trimmed, fully-covered clips removed, spanning clips split.
   */
  currentTime?: number;

  /**
   * MediaTrackConstraints for audio recording
   * These will override the recording-optimized defaults (echo cancellation off, low latency)
   */
  audioConstraints?: MediaTrackConstraints;

  /**
   * Number of channels to record (1 = mono, 2 = stereo)
   * Default: 1 (mono)
   */
  channelCount?: number;

  /**
   * Samples per pixel for peak generation
   * Default: 1024
   */
  samplesPerPixel?: number;

  /**
   * Latency offset to skip at the start of the recording, in **seconds**.
   * Absolute replacement for the auto-computed `outputLatency + lookAhead` value
   * — use this to apply an externally-measured round-trip latency. `0` disables
   * compensation; when omitted, the auto-computed value is used. Pass the same
   * value into the preview's `recordingState.latencyOffset`
   * (`<WaveformRecordingPreview recordingState>`) so the live preview
   * matches the finalized clip. Negative or non-finite values are treated as 0.
   */
  latencyOffset?: number;
}

export interface UseIntegratedRecordingReturn {
  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  /**
   * The id of the track the running take will be added to: the track that was
   * selected when `startRecording()` was called, whatever is selected since.
   * `null` whenever `isRecording` is false. Use it, not the selected track,
   * for the live preview (`recordingState.trackId`).
   */
  recordingTrackId: string | null;
  /**
   * Live microphone levels (`useMicrophoneLevel`'s `meter`). The hook does not
   * re-render as they change: pass it to `<SegmentedVUMeter meter={meter} />`
   * or read it with `meter.subscribe()` / `useMeterLevels(meter)`.
   */
  meter: MeterSource;
  /**
   * Elapsed time and live-preview peaks of the take (`useRecording`'s
   * `progress`). The hook does not re-render as they change: pass it to
   * `<WaveformRecordingPreview recordingState={{ …, progress }} />` or read it with
   * `progress.subscribe()` / `useRecordingProgress(progress)`.
   */
  progress: RecordingProgressSource;
  error: Error | null;

  // Microphone state
  stream: MediaStream | null;
  devices: MicrophoneDevice[];
  hasPermission: boolean;
  selectedDevice: string | null;

  // Recording controls
  /** Start capturing on the selected track. Resolves `true` when the capture
   *  pipeline actually started — callers that synchronize playback with
   *  recording (overdub) should check this before starting playback.
   *  Resolves `false` and sets `error`, recording nothing, when no track is
   *  selected, when the arrangement holds no track of the selected id, for a
   *  MIDI track, and for a track that holds a clip whose audio is not loaded
   *  (still loading, failed to load, or a clip that cannot be made from it). */
  startRecording: () => Promise<boolean>;
  /** Stop the take and add it to the track it was started on, with one
   *  `arrangement.updateTrack()`: one undo step. Resolves when the take is on
   *  its track (or was refused, with `error` set); it never rejects.
   *
   *  A take that ends without this call is added the same way: when the
   *  microphone is unplugged (`error` then says so), and when the component
   *  using the hook unmounts or is hidden mid-take. */
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  requestMicAccess: () => Promise<void>;
  changeDevice: (deviceId: string) => Promise<void>;
}

/**
 * @param arrangement the owner of the tracks (`useCreateArrangement` from
 *   `@waveform-playlist/browser`). The hook reads its tracks when a take starts
 *   and ends and keeps no copy of them.
 * @param selectedTrackId the track the next take is recorded onto
 */
export function useIntegratedRecording(
  arrangement: Arrangement,
  selectedTrackId: string | null,
  options: IntegratedRecordingOptions = {}
): UseIntegratedRecordingReturn {
  const { currentTime = 0, audioConstraints, latencyOffset, ...recordingOptions } = options;

  // True once this hook has resumed the audio context. Nothing draws it, so
  // it is a ref: as state it gave startRecording a new identity.
  const audioResumedRef = useRef(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [hookError, setHookError] = useState<Error | null>(null);

  // Capture timeline position when recording starts (not at stop time)
  const recordingStartTimeRef = useRef(0);
  // The track the take was started on (an audio track: startRecording
  // checks). The take lands there whatever is selected when it stops: the
  // target cannot be switched mid-take, as in dawcore, where the session is
  // keyed by the track id.
  const recordingTrackIdRef = useRef<string | null>(null);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  // True from the moment startRecording() begins its async startup until it
  // settles. isRecording only turns true a render after the startup succeeds,
  // so without this a second call in that window would re-capture the track.
  const isStartingRef = useRef(false);

  // Keep selectedTrackId and currentTime in refs for use in callbacks.
  // Avoids stale closures and keeps the callbacks from being recreated when
  // either changes (currentTime is the resting position: it changes on seek,
  // pause and stop, not while playing).
  const selectedTrackIdRef = useRef(selectedTrackId);
  selectedTrackIdRef.current = selectedTrackId;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  // The app usually writes the constraints inline, a new object each render.
  const audioConstraintsRef = useRef(audioConstraints);
  audioConstraintsRef.current = audioConstraints;

  // Assigned below, where finishTake is made; useRecording reads it when a
  // take ends by itself.
  const finishTakeRef = useRef<(buffer: AudioBuffer | null) => void>(() => {});

  // Microphone access
  const { stream, devices, hasPermission, requestAccess, error: micError } = useMicrophoneAccess();

  // Microphone level (for VU meter)
  const {
    meter,
    resetPeak,
    error: meterError,
  } = useMicrophoneLevel(stream, {
    channelCount: recordingOptions.channelCount,
  });

  // Recording
  const {
    isRecording,
    isPaused,
    progress,
    startRecording: startRec,
    stopRecording: stopRec,
    pauseRecording,
    resumeRecording,
    error: recError,
  } = useRecordingWithTakeEnded(stream, recordingOptions, (buffer) =>
    // The take ended without our stopRecording(): keep it (#822).
    finishTakeRef.current(buffer)
  );
  // The start below can wait on the audio context first. It then calls the
  // startRec of the latest render: the one it closed over may hold a stream
  // that a cleanup has stopped meanwhile (a hide and a reveal).
  const startRecRef = useRef(startRec);
  startRecRef.current = startRec;
  // What requestMicAccess asks for, read when it is called.
  const selectedDeviceRef = useRef(selectedDevice);
  selectedDeviceRef.current = selectedDevice;
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  // Start recording handler. Reads selectedTrackId from its ref, and the
  // tracks from the arrangement as they are now: a track the app added in the
  // same handler is there (arrangement.addTrack is synchronous).
  const startRecording = useCallback(async (): Promise<boolean> => {
    // A take is running or starting: starting again must not re-capture its
    // track or its start position (useRecording would refuse further down,
    // after both had been overwritten).
    if (isRecordingRef.current || isStartingRef.current) return false;
    if (!selectedTrackIdRef.current) {
      setHookError(
        new Error('Cannot start recording: no track selected. Select or create a track first.')
      );
      return false;
    }
    // Refuse before anything is captured: a track that is not there, a MIDI
    // track (#756), a track holding a clip whose audio is not loaded.
    const refusal = takeRefusal(arrangement, selectedTrackIdRef.current);
    if (refusal) {
      setHookError(refusal);
      return false;
    }

    isStartingRef.current = true;
    try {
      setHookError(null);
      // Resume audio context if needed
      if (!audioResumedRef.current) {
        await resumeGlobalAudioContext();
        audioResumedRef.current = true;
      }

      // Capture timeline position NOW — before recording starts.
      // The position at stop time would be wrong: the caller may pass a new
      // `currentTime` (a seek, a pause) while the take is running.
      recordingStartTimeRef.current = currentTimeRef.current;
      recordingTrackIdRef.current = selectedTrackIdRef.current;
      setRecordingTrackId(selectedTrackIdRef.current);

      const started = await startRecRef.current();
      if (!started) setRecordingTrackId(null);
      return started;
    } catch (err) {
      setRecordingTrackId(null);
      setHookError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      isStartingRef.current = false;
    }
  }, [arrangement]);

  // Add a finished take to the track it was started on. Called once per take
  // by whichever saw it end: stopRecording below, or useRecording when the
  // take ended by itself. Synchronous, so an effect cleanup can call it.
  const finishTake = useCallback(
    (buffer: AudioBuffer | null) => {
      // The track the take was started on, not the one selected now (#756).
      // Taken out of the ref: a Stop pressed while an unplug is being handled
      // receives the same buffer, and must not add it a second time.
      // Nothing was captured (also a stop while the next take is still
      // starting, which must leave that take's track alone): nothing to add.
      if (!buffer) return;
      const trackId = recordingTrackIdRef.current;
      recordingTrackIdRef.current = null;
      setRecordingTrackId(null);
      if (!trackId) return;

      // Read from the arrangement now, after the stop handshake (which can
      // take more than a second): an edit made meanwhile is in its tracks.
      if (!arrangement.getTracks().some((t) => t.id === trackId)) {
        const err = new Error(
          `Recording completed but track "${trackId}" no longer exists. The recorded audio could not be saved.`
        );
        console.warn(`[waveform-playlist] ${err.message}`);
        setHookError(err);
        return;
      }

      // Use the start time captured when the take began, not the current `currentTime`.
      // Punch-in replace (#579): the take lands exactly here; overlapped
      // content is carved out below when the clip list is assembled.
      const startSample = Math.floor(recordingStartTimeRef.current * buffer.sampleRate);

      // Latency compensation: an explicit latencyOffset (seconds) replaces the
      // auto-computed outputLatency + lookAhead window. Shared resolver with the
      // live preview (`WaveformRecordingPreview`) — keep both using the same value so
      // trim widths match.
      const audioContext = getGlobalAudioContext();
      const outputLatency = audioContext.outputLatency ?? 0;
      const toneContext = getGlobalContext();
      const lookAhead = toneContext.lookAhead ?? 0;
      const latencyOffsetSamples = resolveRecordingOffsetSamples({
        overrideSeconds: latencyOffset,
        outputLatency,
        lookAhead,
        sampleRate: buffer.sampleRate,
      });

      // Guard: very short recordings (< latency compensation) would produce negative duration
      const effectiveDuration = Math.max(0, buffer.length - latencyOffsetSamples);
      if (effectiveDuration === 0) {
        console.warn(
          '[waveform-playlist] Recording too short for latency compensation — discarding'
        );
        setHookError(new Error('Recording was too short to save. Try recording for longer.'));
        return;
      }

      // Create new clip from recording
      const newClip: AudioClip = {
        id: `clip-${Date.now()}`,
        audioBuffer: buffer,
        startSample,
        durationSamples: effectiveDuration,
        offsetSamples: latencyOffsetSamples,
        sampleRate: buffer.sampleRate,
        sourceDurationSamples: buffer.length,
        gain: 1.0,
        name: `Recording ${new Date().toLocaleTimeString()}`,
      };

      // One edit, one undo step: the take, and the carve of what it overlaps.
      try {
        arrangement.updateTrack(trackId, (track) => withTake(track, newClip));
      } catch (err) {
        // The arrangement refused the track (its kind changed during the take).
        const notSaved = takeNotSaved(trackId, err);
        console.warn(`[waveform-playlist] ${notSaved.message}`);
        setHookError(notSaved);
      }
    },
    [arrangement, latencyOffset]
  );
  finishTakeRef.current = finishTake;

  // Stop recording and add the take to the track it was started on
  const stopRecording = useCallback(async (): Promise<void> => {
    let buffer: AudioBuffer | null = null;
    try {
      buffer = await stopRec();
    } catch (err) {
      setHookError(err instanceof Error ? err : new Error(String(err)));
    }
    finishTakeRef.current(buffer);
  }, [stopRec]);

  // Auto-select first device when available, or fallback if selected device was unplugged
  useEffect(() => {
    if (!hasPermission || devices.length === 0) return;

    if (selectedDevice === null) {
      // First-time selection
      setSelectedDevice(devices[0].deviceId);
    } else if (!devices.some((d) => d.deviceId === selectedDevice)) {
      // Selected device was removed — fall back to first available. Not
      // during a take: requestAccess stops the stream the take is reading
      // (the same hazard requestMicAccess and changeDevice refuse). The effect
      // runs again when the take ends.
      if (isRecording) return;
      const fallbackId = devices[0].deviceId;
      setSelectedDevice(fallbackId);
      resetPeak();
      requestAccess(fallbackId, audioConstraintsRef.current);
    }
  }, [hasPermission, devices, selectedDevice, isRecording, resetPeak, requestAccess]);

  // Mirror isRecording for the device-switch guards below — reading the
  // state directly would churn the callbacks every recording toggle.
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  // Request microphone access
  const requestMicAccess = useCallback(async () => {
    // requestAccess stops the current stream's tracks, and track.stop() fires
    // no 'ended' event — the recording's source is never rewired, so the rest
    // of the take silently records silence. Refuse while recording.
    if (isRecordingRef.current) {
      setHookError(new Error('Cannot request microphone access while recording. Stop first.'));
      return;
    }
    try {
      setHookError(null);
      // The device the picker shows, while it is still there: after a hide
      // the app asks again, and must get the microphone it had chosen. An
      // exact id of a device that has left the list would fail the request,
      // so that case asks for the default one (the fallback effect then
      // corrects the selection).
      const selected = selectedDeviceRef.current;
      const deviceId =
        selected !== null && devicesRef.current.some((d) => d.deviceId === selected)
          ? selected
          : undefined;
      await requestAccess(deviceId, audioConstraintsRef.current);
      await resumeGlobalAudioContext();
      audioResumedRef.current = true;
    } catch (err) {
      setHookError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [requestAccess]);

  // Change device
  const changeDevice = useCallback(
    async (deviceId: string) => {
      // Same silent-silence hazard as requestMicAccess above.
      if (isRecordingRef.current) {
        setHookError(new Error('Cannot switch microphone while recording. Stop first.'));
        return;
      }
      try {
        setHookError(null);
        setSelectedDevice(deviceId);
        resetPeak();
        await requestAccess(deviceId, audioConstraintsRef.current);
        await resumeGlobalAudioContext();
        audioResumedRef.current = true;
      } catch (err) {
        setHookError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [requestAccess, resetPeak]
  );

  return {
    // Recording state
    isRecording,
    isPaused,
    // Only while a take is running: a take can also end without our
    // stopRecording (the microphone is unplugged and useRecording stops itself).
    recordingTrackId: isRecording ? recordingTrackId : null,
    meter,
    progress,
    error: hookError || micError || meterError || recError,

    // Microphone state
    stream,
    devices,
    hasPermission,
    selectedDevice,

    // Recording controls
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    requestMicAccess,
    changeDevice,
  };
}
