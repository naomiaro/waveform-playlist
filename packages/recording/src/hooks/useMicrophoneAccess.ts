/**
 * Hook for managing microphone access and device enumeration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { enumerateMicrophones } from '@waveform-playlist/core';
import { UseMicrophoneAccessReturn, MicrophoneDevice } from '../types';

export function useMicrophoneAccess(): UseMicrophoneAccessReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MicrophoneDevice[]>([]);
  // Whether `devices` names the real microphones (core's `hasLabels`).
  const [hasLabels, setHasLabels] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Mirrors the stream state so unmount cleanup and overlapping requests
  // operate on the CURRENT stream, not a stale closure capture.
  const streamRef = useRef<MediaStream | null>(null);
  // Generation token: bumped by every requestAccess (and by stopStream /
  // unmount). A getUserMedia grant belonging to an older generation is a
  // stale request — its stream must be stopped, not installed, or the mic
  // stays hot with no owner (permission prompt resolving after unmount,
  // or the slower of two overlapping requests).
  const requestGenerationRef = useRef(0);
  // Set by unmount cleanup (plain assignment — the exhaustive-deps rule
  // rejects read-modify-writes like a generation bump in cleanup functions).
  const isUnmountedRef = useRef(false);
  // Counts the mount effect's setups. A request saves it on entry: one that
  // started before a hide (or Fast Refresh) is stale after the show, though
  // the setup has reset isUnmountedRef by then (#947). No microphone is
  // opened for a hidden component; the app asks again (#822).
  const mountEpochRef = useRef(0);

  // Enumerate audio input devices — delegates to the framework-agnostic core
  // helper (redaction-aware fallback labels, SSR/insecure-context safe).
  const enumerateDevices = useCallback(async () => {
    try {
      const { devices: audioInputs, hasLabels: labelled } = await enumerateMicrophones();
      setDevices(audioInputs);
      setHasLabels(labelled);
    } catch (err) {
      console.warn('[waveform-playlist] Failed to enumerate devices:', String(err));
      setError(err instanceof Error ? err : new Error('Failed to enumerate devices'));
    }
  }, []);

  // Request microphone access
  const requestAccess = useCallback(
    async (deviceId?: string, audioConstraints?: MediaTrackConstraints) => {
      const generation = ++requestGenerationRef.current;
      const mountEpoch = mountEpochRef.current;
      // Superseded by a newer request or stopStream, or begun before an
      // unmount or a hide: its result is not this hook's state any more.
      const isStale = () =>
        generation !== requestGenerationRef.current ||
        mountEpoch !== mountEpochRef.current ||
        isUnmountedRef.current;
      setIsLoading(true);
      setError(null);

      try {
        // Stop and clear the existing stream. Clearing state (not just
        // stopping tracks) matters on failure: consumers left holding a
        // stopped stream silently record silence with no error.
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          setStream(null);
        }

        // Build audio constraints
        const audio: MediaTrackConstraints & { latency?: number } = {
          // Recording-optimized defaults: prioritize raw audio quality and low latency
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0, // Low latency mode (not in TS types yet, but supported in modern browsers)
          // User-provided constraints override defaults
          ...audioConstraints,
          // Device ID override (if specified)
          ...(deviceId && { deviceId: { exact: deviceId } }),
        };

        const constraints: MediaStreamConstraints = {
          audio,
          video: false,
        };

        // Undefined on an insecure origin (http that is not localhost) and in
        // very old browsers: say so, in place of a TypeError about `undefined`.
        const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
        if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
          throw new Error(
            'Microphone access is not available: navigator.mediaDevices is undefined. ' +
              'It needs a secure context (https or localhost).'
          );
        }

        const newStream = await mediaDevices.getUserMedia(constraints);

        // Stale while the permission prompt was open: stop the just-granted
        // stream instead of installing it (a hot mic nobody owns).
        if (isStale()) {
          newStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = newStream;
        setStream(newStream);

        // The microphone is unplugged, or its permission revoked: the track
        // ends and delivers silence from then on. The state must not keep
        // offering it, and nothing is opened in its place: the app asks again
        // (maintainer, #944). Our own track.stop() fires no `ended`, and a
        // stream that has been replaced since is not this hook's any more.
        const onEnded = () => {
          if (streamRef.current !== newStream) return;
          streamRef.current = null;
          setStream(null);
          setError(
            new Error(
              'The microphone was disconnected or its permission was revoked. Request microphone access again.'
            )
          );
        };
        newStream
          .getTracks()
          .forEach((track) => track.addEventListener('ended', onEnded, { once: true }));

        // Enumerate devices after getting permission (labels will be available)
        await enumerateDevices();
      } catch (err) {
        console.warn('[waveform-playlist] Failed to access microphone:', String(err));
        if (!isStale()) {
          setError(err instanceof Error ? err : new Error('Failed to access microphone'));
        }
      } finally {
        // A newer request owns isLoading. stopStream and the cleanup have
        // already cleared it for the request they made stale.
        if (generation === requestGenerationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [enumerateDevices]
  );

  // Stop the stream and revoke access
  const stopStream = useCallback(() => {
    // Invalidate any in-flight request so a pending grant can't re-arm the mic;
    // its finally no longer clears isLoading, so do it here (#947).
    requestGenerationRef.current++;
    setIsLoading(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // Check initial permission state, enumerate devices, and listen for hot-plug changes
  useEffect(() => {
    // Reset on (re)mount — StrictMode dev remounts reuse the same hook
    // instance, so a flag left true by the probe-unmount's cleanup would
    // stop every future getUserMedia grant as "stale".
    isUnmountedRef.current = false;
    // A request that began before this setup is stale (#947).
    mountEpochRef.current += 1;
    // Try to enumerate devices (labels won't be available without permission)
    enumerateDevices();

    // Re-enumerate when devices are plugged in or removed. Undefined on an
    // insecure origin (http that is not localhost): nothing to listen to
    // there, and the enumeration above gave no devices.
    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    mediaDevices?.addEventListener('devicechange', enumerateDevices);

    return () => {
      mediaDevices?.removeEventListener('devicechange', enumerateDevices);
      // Invalidate any in-flight request (a grant arriving after unmount is
      // stopped by the isUnmounted check, one arriving after a show by the
      // mount epoch) and stop the current stream.
      isUnmountedRef.current = true;
      // The request it made stale will not clear isLoading.
      setIsLoading(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        // This cleanup also runs for Fast Refresh and a hidden <Activity>,
        // after which the hook lives on: its state must not keep offering a
        // stopped stream (#822). As after stopStream(), the app asks again.
        setStream(null);
      }
    };
  }, [enumerateDevices]);

  return {
    stream,
    devices,
    hasLabels,
    isLoading,
    requestAccess,
    stopStream,
    error,
  };
}
