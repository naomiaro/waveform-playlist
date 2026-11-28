/**
 * Hook for managing microphone access and device enumeration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { enumerateMicrophones } from '@waveform-playlist/core';
import { UseMicrophoneAccessReturn, MicrophoneDevice } from '../types';

export function useMicrophoneAccess(): UseMicrophoneAccessReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MicrophoneDevice[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
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

  // Enumerate audio input devices — delegates to the framework-agnostic core
  // helper (redaction-aware fallback labels, SSR/insecure-context safe).
  const enumerateDevices = useCallback(async () => {
    try {
      const { devices: audioInputs } = await enumerateMicrophones();
      setDevices(audioInputs);
    } catch (err) {
      console.warn('[waveform-playlist] Failed to enumerate devices:', String(err));
      setError(err instanceof Error ? err : new Error('Failed to enumerate devices'));
    }
  }, []);

  // Request microphone access
  const requestAccess = useCallback(
    async (deviceId?: string, audioConstraints?: MediaTrackConstraints) => {
      const generation = ++requestGenerationRef.current;
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

        // Superseded by a newer request, stopStream, or unmount while the
        // permission prompt was open — stop the just-granted stream instead
        // of installing it (a hot mic nobody owns).
        if (generation !== requestGenerationRef.current || isUnmountedRef.current) {
          newStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = newStream;
        setStream(newStream);
        setHasPermission(true);

        // The microphone is unplugged, or its permission revoked: the track
        // ends and delivers silence from then on. The state must not keep
        // offering it, and nothing is opened in its place: the app asks again
        // (maintainer, #944). Our own track.stop() fires no `ended`, and a
        // stream that has been replaced since is not this hook's any more.
        const onEnded = () => {
          if (streamRef.current !== newStream) return;
          streamRef.current = null;
          setStream(null);
          setHasPermission(false);
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
        if (generation === requestGenerationRef.current) {
          setError(err instanceof Error ? err : new Error('Failed to access microphone'));
          setHasPermission(false);
        }
      } finally {
        if (generation === requestGenerationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [enumerateDevices]
  );

  // Stop the stream and revoke access
  const stopStream = useCallback(() => {
    // Invalidate any in-flight request so a pending grant can't re-arm the mic
    requestGenerationRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setHasPermission(false);
    }
  }, []);

  // Check initial permission state, enumerate devices, and listen for hot-plug changes
  useEffect(() => {
    // Reset on (re)mount — StrictMode dev remounts reuse the same hook
    // instance, so a flag left true by the probe-unmount's cleanup would
    // stop every future getUserMedia grant as "stale".
    isUnmountedRef.current = false;
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
      // stopped by the isUnmounted check) and stop the current stream.
      isUnmountedRef.current = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        // This cleanup also runs for Fast Refresh and a hidden <Activity>,
        // after which the hook lives on: its state must not keep offering a
        // stopped stream (#822). As after stopStream(), the app asks again.
        setStream(null);
        setHasPermission(false);
      }
    };
  }, [enumerateDevices]);

  return {
    stream,
    devices,
    hasPermission,
    isLoading,
    requestAccess,
    stopStream,
    error,
  };
}
